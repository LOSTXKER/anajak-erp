// verify จริงกับ DB: มัดจำตาม payment terms + เพดานวางบิล + dueDate อัตโนมัติ + overdue sweep
// ยิงผ่าน tRPC caller จริง (zod + RBAC + lock + services) — ลบข้อมูลทดสอบเกลี้ยงตอนจบ
// และคืนค่า DocumentSequence กลับที่เดิม (เลขจริงไม่ขยับ) · ห้ามรันบน DB ใช้งานจริง
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/lib/prisma";
import { currentPeriod } from "@/server/services/document-number";
import { dueDateFromTerms } from "@/server/services/payment-plan";
import { sweepOverdueInvoices, overdueCutoffUtc } from "@/server/services/overdue";

let passCount = 0;
const fails: string[] = [];
function ok(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passCount++;
    console.log("PASS:", name);
  } else {
    fails.push(name);
    console.log("FAIL:", name, "→", JSON.stringify(detail));
  }
}
async function expectError(name: string, fn: () => Promise<unknown>, msgPart: string) {
  try {
    await fn();
    ok(name, false, "ไม่ throw เลย");
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    ok(name, m.includes(msgPart), m);
  }
}

const SEQ_TYPES = ["DEPOSIT_INVOICE", "FINAL_INVOICE", "RECEIPT", "DEBIT_NOTE"];

async function main() {
  const period = currentPeriod();
  const seqBefore = await prisma.documentSequence.findMany({
    where: { period, docType: { in: SEQ_TYPES } },
  });

  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER", isActive: true } });
  const caller = appRouter.createCaller({ prisma, userId: owner.id, userRole: owner.role });

  const ids = { customer: "", orders: [] as string[], invoices: [] as string[] };

  try {
    const customer = await prisma.customer.create({
      data: { name: "[TERMS-VERIFY] ลูกค้าทดสอบ" },
    });
    ids.customer = customer.id;

    // ---------- 1) เทอมมัดจำ 50% + VAT: suggest → ใบมัดจำครึ่งแรก ----------
    const order1 = await prisma.order.create({
      data: {
        orderNumber: "TEST-ORD-TERMS-1",
        orderType: "CUSTOM",
        channel: "LINE",
        customerId: customer.id,
        createdById: owner.id,
        internalStatus: "CONFIRMED",
        customerStatus: "ORDER_RECEIVED",
        title: "[TERMS-VERIFY] มัดจำ 50%",
        paymentTerms: "DEPOSIT_50",
        taxRate: 7,
        subtotalItems: 3000,
        taxAmount: 210,
        totalAmount: 3210,
      },
    });
    ids.orders.push(order1.id);

    const s1 = await caller.billing.suggest({ orderId: order1.id });
    ok(
      "1.1 suggest เทอมมัดจำ 50% → ใบมัดจำ 1605 (ฐาน 1500 + VAT 105)",
      s1.type === "DEPOSIT_INVOICE" && s1.total === 1605 && s1.amount === 1500 && s1.tax === 105,
      s1
    );
    ok("1.2 คงเหลือวางบิลได้เต็มยอด 3210", s1.remaining === 3210, s1.remaining);

    const dep = await caller.billing.create({
      orderId: order1.id,
      customerId: customer.id,
      type: "DEPOSIT_INVOICE",
      amount: s1.amount,
      tax: s1.tax,
    });
    ids.invoices.push(dep.id);
    ok("1.3 ใบมัดจำสร้างได้ totalAmount 1605", dep.totalAmount === 1605, dep.totalAmount);
    ok("1.4 มัดจำไม่มี dueDate อัตโนมัติ", dep.dueDate === null, dep.dueDate);

    const s2 = await caller.billing.suggest({ orderId: order1.id });
    ok(
      "1.5 มีใบมัดจำแล้ว suggest → ใบแจ้งหนี้ส่วนที่เหลือ 1605",
      s2.type === "FINAL_INVOICE" && s2.total === 1605 && s2.remaining === 1605,
      s2
    );

    // ---------- 2) เพดานวางบิล ----------
    await expectError(
      "2.1 วางบิลเกินยอดออเดอร์ → ปฏิเสธ",
      () =>
        caller.billing.create({
          orderId: order1.id,
          customerId: customer.id,
          type: "FINAL_INVOICE",
          amount: 1700,
        }),
      "เกินยอดออเดอร์"
    );

    const fin = await caller.billing.create({
      orderId: order1.id,
      customerId: customer.id,
      type: "FINAL_INVOICE",
      amount: 1500,
      tax: 105,
    });
    ids.invoices.push(fin.id);
    const s3 = await caller.billing.suggest({ orderId: order1.id, type: "FINAL_INVOICE" });
    ok("2.2 วางบิลพอดียอด → คงเหลือ 0", s3.remaining === 0 && s3.total === 0, s3);

    await expectError(
      "2.3 วางบิลซ้ำหลังเต็มเพดาน → ปฏิเสธ",
      () =>
        caller.billing.create({
          orderId: order1.id,
          customerId: customer.id,
          type: "DEPOSIT_INVOICE",
          amount: 1,
        }),
      "เกินยอดออเดอร์"
    );

    await expectError(
      "2.4 ใบเสร็จเกินยอดออเดอร์ (กองแยก) → ปฏิเสธ",
      () =>
        caller.billing.create({
          orderId: order1.id,
          customerId: customer.id,
          type: "RECEIPT",
          amount: 4000,
        }),
      "เกินยอดออเดอร์"
    );

    // ใบเพิ่มหนี้ขยายเพดานใบเสร็จ — เงินงานเพิ่มต้องออกใบเสร็จได้
    // (Gate B1: DN ต้องอ้างใบเดิม + เหตุผล ตาม ม.86/10)
    const dn = await caller.billing.create({
      orderId: order1.id,
      customerId: customer.id,
      type: "DEBIT_NOTE",
      amount: 500,
      originalInvoiceId: fin.id,
      adjustmentReason: "ค่างานเพิ่มหลังยืนยันแบบ (verify)",
    });
    ids.invoices.push(dn.id);
    const rec = await caller.billing.create({
      orderId: order1.id,
      customerId: customer.id,
      type: "RECEIPT",
      amount: 3710, // 3210 + DN 500
    });
    ids.invoices.push(rec.id);
    ok("2.5 ใบเพิ่มหนี้ขยายเพดานใบเสร็จ (3210+500 ออกได้)", rec.totalAmount === 3710, rec.totalAmount);

    // ---------- 3) เครดิตเทอม → dueDate อัตโนมัติ ----------
    const order2 = await prisma.order.create({
      data: {
        orderNumber: "TEST-ORD-TERMS-2",
        orderType: "CUSTOM",
        channel: "LINE",
        customerId: customer.id,
        createdById: owner.id,
        internalStatus: "CONFIRMED",
        customerStatus: "ORDER_RECEIVED",
        title: "[TERMS-VERIFY] เครดิต 30 วัน",
        paymentTerms: "NET_30",
        totalAmount: 1000,
      },
    });
    ids.orders.push(order2.id);

    const credit = await caller.billing.create({
      orderId: order2.id,
      customerId: customer.id,
      type: "FINAL_INVOICE",
      amount: 1000,
    });
    ids.invoices.push(credit.id);
    const expectedDue = dueDateFromTerms("NET_30")!;
    ok(
      "3.1 NET_30 ไม่กรอก dueDate → ตั้งให้ วันนี้(ไทย)+30",
      credit.dueDate !== null &&
        new Date(credit.dueDate).getTime() === expectedDue.getTime(),
      { got: credit.dueDate, expected: expectedDue }
    );

    // ---------- 4) overdue sweep + แจ้งเตือนทีมการเงิน ----------
    const yesterday = new Date(overdueCutoffUtc().getTime() - 24 * 60 * 60 * 1000);
    await prisma.invoice.update({
      where: { id: credit.id },
      data: { dueDate: yesterday },
    });

    const staffCount = await prisma.user.count({
      where: { role: { in: ["OWNER", "MANAGER", "ACCOUNTANT"] }, isActive: true },
    });
    const sweep = await sweepOverdueInvoices(prisma);
    const creditDb = await prisma.invoice.findUniqueOrThrow({ where: { id: credit.id } });
    ok("4.1 sweep แล้วบิลเลยกำหนดกลายเป็น OVERDUE", creditDb.paymentStatus === "OVERDUE", creditDb.paymentStatus);
    ok(`4.2 แจ้งเตือนทีมการเงินครบ ${staffCount} คน`, sweep.notified === staffCount, sweep);

    const notifs = await prisma.notification.findMany({
      where: { type: "PAYMENT", message: { contains: creditDb.invoiceNumber } },
    });
    ok(
      "4.3 แจ้งเตือนระบุเลขบิล + ลิงก์ไป /billing",
      notifs.length === staffCount && notifs.every((n) => n.link === "/billing"),
      notifs.length
    );

    const sweep2 = await sweepOverdueInvoices(prisma);
    ok("4.4 sweep ซ้ำ → ไม่ mark/แจ้งซ้ำ", sweep2.marked === 0 && sweep2.notified === 0, sweep2);

    // ---------- 5) tax point: ใบเสร็จ/ใบกำกับผูกงวดรับเงิน (Gate B3 · ม.78/1(1)) ----------
    const pay1 = await caller.billing.recordPayment({
      invoiceId: credit.id,
      amount: 300,
      method: "CASH",
    });
    const rec1 = await caller.billing.create({
      orderId: order2.id,
      customerId: customer.id,
      type: "RECEIPT",
      amount: 300,
      forPaymentId: pay1.id,
    });
    ids.invoices.push(rec1.id);
    ok(
      "5.1 ใบเสร็จผูกงวดรับเงิน → issueDate = วันรับเงินจริง (tax point)",
      rec1.forPaymentId === pay1.id &&
        rec1.issueDate !== null &&
        new Date(rec1.issueDate!).getTime() === new Date(pay1.createdAt).getTime(),
      { issueDate: rec1.issueDate, paidAt: pay1.createdAt }
    );

    await expectError(
      "5.2 ออกใบเสร็จซ้ำงวดเดิม → ปฏิเสธ (1 งวด 1 ใบ)",
      () =>
        caller.billing.create({
          orderId: order2.id,
          customerId: customer.id,
          type: "RECEIPT",
          amount: 300,
          forPaymentId: pay1.id,
        }),
      "ออกใบเสร็จ/ใบกำกับแล้ว"
    );

    await caller.billing.voidInvoice({ invoiceId: rec1.id, reason: "ทดสอบยกเลิก-ออกใหม่" });
    const rec2 = await caller.billing.create({
      orderId: order2.id,
      customerId: customer.id,
      type: "RECEIPT",
      amount: 300,
      forPaymentId: pay1.id,
    });
    ids.invoices.push(rec2.id);
    const rec1After = await prisma.invoice.findUniqueOrThrow({
      where: { id: rec1.id },
      select: { forPaymentId: true },
    });
    ok(
      "5.3 void ใบเดิมแล้วออกใหม่ผูกงวดเดิมได้ (ใบเก่าถูกปลดผูก)",
      rec2.forPaymentId === pay1.id && rec1After.forPaymentId === null,
      { rec2: rec2.forPaymentId, old: rec1After.forPaymentId }
    );

    await expectError(
      "5.4 ผูกงวดกับใบชนิดอื่น (ไม่ใช่ใบเสร็จ) → ปฏิเสธ",
      () =>
        caller.billing.create({
          orderId: order2.id,
          customerId: customer.id,
          type: "DEBIT_NOTE",
          amount: 100,
          originalInvoiceId: credit.id,
          adjustmentReason: "ทดสอบ",
          forPaymentId: pay1.id,
        }),
      "เฉพาะใบเสร็จ"
    );

    // ใบกำกับของงวดต้องเท่าเงินรับเป๊ะ — แก้ยอดใน dialog แล้วกดสร้าง server ต้องปัด
    const pay2 = await caller.billing.recordPayment({
      invoiceId: credit.id,
      amount: 200,
      method: "CASH",
    });
    await expectError(
      "5.5 ยอดใบเสร็จไม่เท่ายอดงวด → ปฏิเสธ",
      () =>
        caller.billing.create({
          orderId: order2.id,
          customerId: customer.id,
          type: "RECEIPT",
          amount: 150,
          forPaymentId: pay2.id,
        }),
      "ต้องเท่ายอดที่รับ"
    );
    // issueDate ที่ระบุเอง (บันทึกย้อน — วันเงินเข้าจริง) ถูกใช้แทนวันบันทึก
    const rec3 = await caller.billing.create({
      orderId: order2.id,
      customerId: customer.id,
      type: "RECEIPT",
      amount: 200,
      forPaymentId: pay2.id,
      issueDate: "2026-06-30",
    });
    ids.invoices.push(rec3.id);
    ok(
      "5.6 ระบุวันที่เอกสารเอง (บันทึกย้อน) → issueDate ตามที่ระบุ",
      rec3.issueDate !== null &&
        new Date(rec3.issueDate!).toISOString().slice(0, 10) === "2026-06-30",
      rec3.issueDate
    );

    // ---------- 6) เพดานขาที่สอง (Gate B9): แก้ออเดอร์ห้ามลดยอดต่ำกว่าบิลที่ออกแล้ว ----------
    const b9Item = (qty: number, price = 100) => ({
      products: [
        {
          productType: "TSHIRT",
          description: "[TERMS-VERIFY] เสื้อ B9",
          baseUnitPrice: price,
          variants: [{ size: "M", quantity: qty }],
        },
      ],
      prints: [],
      addons: [],
    });
    const order3 = await prisma.order.create({
      data: {
        orderNumber: "TEST-ORD-TERMS-3",
        orderType: "CUSTOM",
        channel: "LINE",
        customerId: customer.id,
        createdById: owner.id,
        internalStatus: "CONFIRMED",
        customerStatus: "ORDER_RECEIVED",
        title: "[TERMS-VERIFY] เพดานขาที่สอง",
        taxRate: 0,
        subtotalItems: 2000,
        totalAmount: 2000,
      },
    });
    ids.orders.push(order3.id);
    await caller.billing.create({
      orderId: order3.id,
      customerId: customer.id,
      type: "DEPOSIT_INVOICE",
      amount: 1000,
    });

    // ตั้งรายการจริงก่อน (2000→1500 ยังคุ้มมัดจำ 1000) — ให้เคส rollback ข้างล่างมีของให้เช็ค
    await caller.order.updateItems({ id: order3.id, items: [b9Item(15)], discount: 0 });
    const o3Reduced = await prisma.order.findUniqueOrThrow({ where: { id: order3.id } });
    ok("6.1 ลดยอดแต่ยังคุ้มบิล (1500 ≥ 1000) → ผ่าน", o3Reduced.totalAmount === 1500, o3Reduced.totalAmount);

    await expectError(
      "6.2 updateItems ลดยอดต่ำกว่าบิลที่ออกแล้ว (800 < มัดจำ 1000) → ปฏิเสธ",
      () => caller.order.updateItems({ id: order3.id, items: [b9Item(8)], discount: 0 }),
      "ต่ำกว่ายอดบิลที่ออกแล้ว"
    );
    const o3AfterBlock = await prisma.order.findUniqueOrThrow({
      where: { id: order3.id },
      include: { items: { include: { products: { include: { variants: true } } } } },
    });
    ok(
      "6.3 โดน block แล้ว tx rollback ทั้งก้อน — ยอด/รายการ 15 ตัวเดิมไม่ถูกแตะ",
      o3AfterBlock.totalAmount === 1500 &&
        o3AfterBlock.items.length === 1 &&
        o3AfterBlock.items[0].products[0]?.variants[0]?.quantity === 15,
      { total: o3AfterBlock.totalAmount, items: o3AfterBlock.items.length }
    );

    // เพิ่มค่าธรรมเนียม 500 (ยอด 2000) แล้ววางบิลเพิ่มจนบิลรวม 1900 — ถอดค่าธรรมเนียมต้องโดน block
    await caller.order.updateFees({
      id: order3.id,
      fees: [{ feeType: "OTHER", name: "[TERMS-VERIFY] ค่าจัดส่ง B9", amount: 500 }],
    });
    const fin3 = await caller.billing.create({
      orderId: order3.id,
      customerId: customer.id,
      type: "FINAL_INVOICE",
      amount: 900,
    });
    await expectError(
      "6.4 updateFees ถอดค่าธรรมเนียม (เหลือ 1500 < บิล 1900) → ปฏิเสธ",
      () => caller.order.updateFees({ id: order3.id, fees: [] }),
      "ต่ำกว่ายอดบิลที่ออกแล้ว"
    );
    await expectError(
      "6.5 order.update ส่วนลด 200 (เหลือ 1800 < บิล 1900) → ปฏิเสธ",
      () => caller.order.update({ id: order3.id, discount: 200 }),
      "ต่ำกว่ายอดบิลที่ออกแล้ว"
    );
    await caller.order.update({ id: order3.id, discount: 100 });
    const o3Boundary = await prisma.order.findUniqueOrThrow({ where: { id: order3.id } });
    ok(
      "6.6 ลดยอดลงมาเท่าบิลพอดี (1900 = 1900) → ผ่าน (ขอบเพดาน)",
      o3Boundary.totalAmount === 1900,
      o3Boundary.totalAmount
    );

    await caller.billing.voidInvoice({ invoiceId: fin3.id, reason: "ทดสอบเพดานขาที่สอง" });
    await caller.order.update({ id: order3.id, discount: 600 });
    const o3AfterVoid = await prisma.order.findUniqueOrThrow({ where: { id: order3.id } });
    ok(
      "6.7 void บิลแล้วเพดานคลาย (เหลือมัดจำ 1000) → ลดยอดเหลือ 1400 ได้",
      o3AfterVoid.totalAmount === 1400,
      o3AfterVoid.totalAmount
    );

    // atomic items+fees: ย้ายมูลค่าจากรายการไปค่าธรรมเนียม ยอดรวมคงเดิม 1400 ≥ floor 1000 —
    // เดิมยิงแยกสอง mutation ขา updateItems จะเห็นยอดกลางทาง (items ใหม่ 200 + fee เก่า 500
    // = 700 < floor 1000) แล้ว block ทั้งที่ยอดสุดท้ายถูกกติกา (review B9 จับ)
    await caller.order.updateItems({
      id: order3.id,
      items: [b9Item(2)],
      discount: 0,
      fees: [{ feeType: "OTHER", name: "[TERMS-VERIFY] ค่าบริการรวม B9", amount: 1200 }],
    });
    const o3Atomic = await prisma.order.findUniqueOrThrow({
      where: { id: order3.id },
      include: { fees: true },
    });
    ok(
      "6.8 updateItems แนบ fees ใน tx เดียว — ย้ายมูลค่า items↔fees ยอดสุดท้ายถูกกติกา ผ่านรวดเดียว",
      o3Atomic.totalAmount === 1400 &&
        o3Atomic.subtotalFees === 1200 &&
        o3Atomic.fees.length === 1 &&
        o3Atomic.discount === 0,
      { total: o3Atomic.totalAmount, fees: o3Atomic.subtotalFees }
    );

    // กองใบเสร็จก็เป็นเพดาน — งานขายสดออกใบเสร็จ/ใบกำกับแล้ว ห้ามลดยอดต่ำกว่าเงินที่รับ
    const order4 = await prisma.order.create({
      data: {
        orderNumber: "TEST-ORD-TERMS-4",
        orderType: "CUSTOM",
        channel: "LINE",
        customerId: customer.id,
        createdById: owner.id,
        internalStatus: "CONFIRMED",
        customerStatus: "ORDER_RECEIVED",
        title: "[TERMS-VERIFY] เพดานกองใบเสร็จ",
        taxRate: 0,
        subtotalItems: 1000,
        totalAmount: 1000,
      },
    });
    ids.orders.push(order4.id);
    const rec4 = await caller.billing.create({
      orderId: order4.id,
      customerId: customer.id,
      type: "RECEIPT",
      amount: 1000,
    });
    await expectError(
      "6.9 กองใบเสร็จ: ลดยอดต่ำกว่าใบเสร็จที่ออกแล้ว (400 < 1000) → ปฏิเสธ",
      () => caller.order.updateItems({ id: order4.id, items: [b9Item(4)], discount: 0 }),
      "ต่ำกว่ายอดบิลที่ออกแล้ว"
    );

    // CN/DN ผ่าน API จริง — พิสูจน์ mapping originalInvoice.type จาก DB (assert + getById)
    await caller.billing.create({
      orderId: order4.id,
      customerId: customer.id,
      type: "CREDIT_NOTE",
      amount: 200,
      originalInvoiceId: rec4.id,
      adjustmentReason: "คืนเงินบางส่วนหลังรับ (verify B9)",
    });
    const o4WithCn = await caller.order.getById({ id: order4.id });
    ok(
      "6.10 CN อ้างใบเสร็จ (คืนเงิน) ไม่ดัน floor — getById.billedFloor คง 1000 (mapping พังจะเป็น 1200)",
      o4WithCn.billedFloor === 1000,
      o4WithCn.billedFloor
    );

    const dn4 = await caller.billing.create({
      orderId: order4.id,
      customerId: customer.id,
      type: "DEBIT_NOTE",
      amount: 300,
      originalInvoiceId: rec4.id,
      adjustmentReason: "งานเพิ่มหลังออกใบเสร็จ (verify B9)",
    });
    const o4WithDn = await caller.order.getById({ id: order4.id });
    ok(
      "6.11 DN ลดเพดานกองใบเสร็จ — getById.billedFloor = 1000−300 = 700",
      o4WithDn.billedFloor === 700,
      o4WithDn.billedFloor
    );
    await caller.order.updateItems({ id: order4.id, items: [b9Item(8)], discount: 0 });
    const o4Reduced = await prisma.order.findUniqueOrThrow({ where: { id: order4.id } });
    ok(
      "6.12 ลดยอดลง 800 (≥ floor 700 หลัง DN) → ผ่าน — เคสอนุญาตของกอง REC−DN",
      o4Reduced.totalAmount === 800,
      o4Reduced.totalAmount
    );
    await expectError(
      "6.13 ลดต่อเหลือ 600 (< floor 700) → ปฏิเสธ",
      () => caller.order.updateItems({ id: order4.id, items: [b9Item(6)], discount: 0 }),
      "ต่ำกว่ายอดบิลที่ออกแล้ว"
    );

    // void DN = เพดานกองใบเสร็จหด (floor เด้งกลับ 1000 > ยอดออเดอร์ 800) — ต้องโดนด่าน
    // ทางออกจริง: ดันยอดออเดอร์กลับขึ้นก่อน (หรือยกเลิกใบเสร็จ) แล้วค่อย void
    await expectError(
      "6.14 void ใบเพิ่มหนี้ที่ใบเสร็จพึ่งอยู่ (floor เด้ง 1000 > ยอด 800) → ปฏิเสธ",
      () => caller.billing.voidInvoice({ invoiceId: dn4.id, reason: "ทดสอบ void DN" }),
      "เกินยอดออเดอร์"
    );
    await caller.order.updateItems({ id: order4.id, items: [b9Item(10)], discount: 0 });
    await caller.billing.voidInvoice({ invoiceId: dn4.id, reason: "ทดสอบ void DN หลังดันยอดกลับ" });
    ok("6.15 ดันยอดกลับ 1000 แล้ว void DN ผ่าน (ทางออกไม่ติดตาย)", true);

    // ออเดอร์ legacy ก่อน B9: บิลเกินยอดออเดอร์อยู่แล้ว (floor 1000 > total 800) —
    // escape hatch ต้องเปิด: ขยับเข้าหา floor/ยอดเท่าเดิมผ่าน · ลดลงอีกโดน block
    const order5 = await prisma.order.create({
      data: {
        orderNumber: "TEST-ORD-TERMS-5",
        orderType: "CUSTOM",
        channel: "LINE",
        customerId: customer.id,
        createdById: owner.id,
        internalStatus: "CONFIRMED",
        customerStatus: "ORDER_RECEIVED",
        title: "[TERMS-VERIFY] legacy บิลเกินยอด",
        taxRate: 0,
        subtotalItems: 800,
        totalAmount: 800,
      },
    });
    ids.orders.push(order5.id);
    await prisma.invoice.create({
      data: {
        invoiceNumber: `TEST-INV-B9LEGACY-${Date.now()}`,
        orderId: order5.id,
        customerId: customer.id,
        type: "DEPOSIT_INVOICE",
        amount: 1000,
        totalAmount: 1000,
      },
    });
    await caller.order.updateItems({ id: order5.id, items: [b9Item(9)], discount: 0 });
    const o5Climb = await prisma.order.findUniqueOrThrow({ where: { id: order5.id } });
    ok(
      "6.16 legacy: ขยับยอดขึ้นเข้าหา floor (800→900 ยังต่ำกว่าบิล 1000) → ผ่าน ไม่ติดตาย",
      o5Climb.totalAmount === 900,
      o5Climb.totalAmount
    );
    await caller.order.updateItems({ id: order5.id, items: [b9Item(9)], discount: 0 });
    ok("6.17 legacy: บันทึกยอดเท่าเดิมเป๊ะ (900 = 900) → ผ่าน (ไม่ block ยอดไม่ลด)", true);
    await expectError(
      "6.18 legacy: ลดยอดลงอีก (900→700) → ปฏิเสธ",
      () => caller.order.updateItems({ id: order5.id, items: [b9Item(7)], discount: 0 }),
      "ต่ำกว่ายอดบิลที่ออกแล้ว"
    );

    // VAT 7% + ขอบเพดานระดับสตางค์ + branch เปลี่ยน taxRate ของ order.update
    const order6 = await prisma.order.create({
      data: {
        orderNumber: "TEST-ORD-TERMS-6",
        orderType: "CUSTOM",
        channel: "LINE",
        customerId: customer.id,
        createdById: owner.id,
        internalStatus: "CONFIRMED",
        customerStatus: "ORDER_RECEIVED",
        title: "[TERMS-VERIFY] เพดานขอบสตางค์ VAT 7%",
        taxRate: 7,
        subtotalItems: 2000,
        taxAmount: 140,
        totalAmount: 2140,
      },
    });
    ids.orders.push(order6.id);
    // ใบมัดจำยอดมีสตางค์: 1000.87 + VAT 70.06 = 1070.93 → floor 1070.93
    await caller.billing.create({
      orderId: order6.id,
      customerId: customer.id,
      type: "DEPOSIT_INVOICE",
      amount: 1000.87,
      tax: 70.06,
    });
    await caller.order.updateItems({
      id: order6.id,
      items: [b9Item(1, 1000.87)],
      discount: 0,
    });
    const o6Boundary = await prisma.order.findUniqueOrThrow({ where: { id: order6.id } });
    ok(
      "6.19 VAT 7%: ลดยอดลงมาเท่า floor เป๊ะระดับสตางค์ (1070.93) → ผ่าน",
      o6Boundary.totalAmount === 1070.93,
      o6Boundary.totalAmount
    );
    await expectError(
      "6.20 VAT 7%: ต่ำกว่า floor 1 สตางค์ (1070.92) → ปฏิเสธ",
      () => caller.order.updateItems({ id: order6.id, items: [b9Item(1, 1000.86)], discount: 0 }),
      "ต่ำกว่ายอดบิลที่ออกแล้ว"
    );
    await expectError(
      "6.21 order.update ถอด VAT (taxRate 7→0 ยอดเหลือ 1000.87 < floor) → ปฏิเสธ",
      () => caller.order.update({ id: order6.id, taxRate: 0 }),
      "ต่ำกว่ายอดบิลที่ออกแล้ว"
    );
  } finally {
    // ---------- ล้างข้อมูลทดสอบเกลี้ยง + คืนเลขเอกสาร ----------
    const testInvoices = await prisma.invoice.findMany({
      where: { orderId: { in: ids.orders } },
      select: { id: true, invoiceNumber: true },
    });
    for (const inv of testInvoices) {
      await prisma.notification.deleteMany({ where: { message: { contains: inv.invoiceNumber } } });
    }
    // แจ้งเตือนจองสต๊อค/อื่นๆ ที่ผูกออเดอร์ทดสอบ (updateItems ตอน CONFIRMED ยิง sync)
    await prisma.notification.deleteMany({ where: { entityId: { in: ids.orders } } });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [...testInvoices.map((i) => i.id), ...ids.orders] } },
    });
    // ปลดผูก FK Restrict ก่อนลบ (forPaymentId → payments · originalInvoiceId → invoices)
    await prisma.invoice.updateMany({
      where: { orderId: { in: ids.orders } },
      data: { forPaymentId: null, originalInvoiceId: null },
    });
    await prisma.payment.deleteMany({ where: { invoiceId: { in: testInvoices.map((i) => i.id) } } });
    await prisma.invoice.deleteMany({ where: { orderId: { in: ids.orders } } });
    await prisma.order.deleteMany({ where: { id: { in: ids.orders } } });
    if (ids.customer) await prisma.customer.deleteMany({ where: { id: ids.customer } });

    for (const docType of SEQ_TYPES) {
      const before = seqBefore.find((s) => s.docType === docType);
      if (before) {
        await prisma.documentSequence.updateMany({
          where: { docType, period },
          data: { lastNumber: before.lastNumber },
        });
      } else {
        await prisma.documentSequence.deleteMany({ where: { docType, period } });
      }
    }
  }

  console.log(`\n=== ผล: ผ่าน ${passCount} · ตก ${fails.length} ===`);
  if (fails.length > 0) {
    console.log("รายการที่ตก:", fails);
    process.exitCode = 1;
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("VERIFY CRASHED:", e);
  process.exit(1);
});
