// P0.2 verify — ยิงทุกเส้นทางเงินผ่าน tRPC caller จริง (zod + RBAC + services + DB จริง)
// ข้อมูลที่สร้างติดป้าย [P0.2-VERIFY] — จะถูกล้างพร้อม DB ตอน P0.3
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/lib/prisma";
import superjson from "@/lib/superjson";
import { Prisma } from "@prisma/client";
import { currentPeriod } from "@/server/services/document-number";

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

async function main() {
  const period = currentPeriod();

  // ---------- 0) superjson safety net ----------
  const wire = superjson.deserialize(superjson.serialize(new Prisma.Decimal("123.45")));
  ok("0.1 superjson แปลง Decimal → number บน wire", wire === 123.45 && typeof wire === "number", wire);

  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER", isActive: true } });
  const caller = appRouter.createCaller({ prisma, userId: owner.id, userRole: owner.role });

  const customer = await prisma.customer.create({ data: { name: "[P0.2-VERIFY] ลูกค้าทดสอบ" } });

  // ---------- 1) order.create สูตร A + เลขเอกสารต่อเนื่อง ----------
  const orderInput = {
    orderType: "CUSTOM" as const,
    channel: "SHOPEE" as const,
    customerId: customer.id,
    title: "[P0.2-VERIFY] สูตร A",
    externalOrderId: "SHP-TEST-1",
    platformFee: 60,
    discount: 90,
    taxRate: 7,
    items: [
      {
        products: [
          {
            productType: "T_SHIRT",
            description: "เสื้อทดสอบ",
            baseUnitPrice: 100,
            variants: [{ size: "M", quantity: 10 }],
          },
        ],
        prints: [{ position: "FRONT", printType: "DTF", unitPrice: 20 }],
        addons: [
          { addonType: "CUSTOM", name: "ค่าบล็อก", pricingType: "PER_ORDER" as const, unitPrice: 50 },
        ],
      },
    ],
    fees: [{ feeType: "DELIVERY", name: "ค่าส่ง", amount: 40 }],
  };
  // คาดหวัง: items = 10×100 + 10×20 + 50 = 1250 · fees 40 · base = 1250+40-90 = 1200
  // tax 7% = 84 · total = 1284 — platformFee 60 ต้องไม่ถูกบวก (สูตร B เดิมจะได้ 1348.20)
  const o1 = await caller.order.create(orderInput);
  ok("1.1 subtotalItems = 1250", o1.subtotalItems === 1250, o1.subtotalItems);
  ok("1.2 taxAmount = 84", o1.taxAmount === 84, o1.taxAmount);
  ok("1.3 totalAmount = 1284 (platformFee ไม่ถูกบวก)", o1.totalAmount === 1284, o1.totalAmount);
  ok("1.4 platformFee เก็บเป็นข้อมูล = 60", o1.platformFee === 60, o1.platformFee);
  ok(`1.5 เลขออเดอร์ ORD-${period}-NNNN`, new RegExp(`^ORD-${period}-\\d{4}$`).test(o1.orderNumber), o1.orderNumber);
  ok("1.6 taxLineType = HIRE_OF_WORK (CUSTOM)", o1.items[0]?.taxLineType === "HIRE_OF_WORK", o1.items[0]?.taxLineType);

  const o2 = await caller.order.create({ ...orderInput, title: "[P0.2-VERIFY] เลขต่อเนื่อง", externalOrderId: "SHP-TEST-2" });
  const n1 = parseInt(o1.orderNumber.slice(-4), 10);
  const n2 = parseInt(o2.orderNumber.slice(-4), 10);
  ok("1.7 เลขออเดอร์รันต่อเนื่อง +1", n2 === n1 + 1, `${o1.orderNumber} → ${o2.orderNumber}`);

  await expectError(
    "1.8 updateItems ส่วนลดเกินยอด → ปฏิเสธ",
    () => caller.order.updateItems({ id: o1.id, items: orderInput.items, discount: 99999 }),
    "ส่วนลดเกิน"
  );

  // ---------- 2) billing: จ่าย / จ่ายเกิน / void / refund ----------
  const inv = await caller.billing.create({
    orderId: o1.id,
    customerId: customer.id,
    type: "DEPOSIT_INVOICE",
    amount: 642,
    discount: 0,
    tax: 0,
  });
  ok(`2.1 เลขบิล INV-D-${period}-NNNN`, new RegExp(`^INV-D-${period}-\\d{4}$`).test(inv.invoiceNumber), inv.invoiceNumber);
  ok("2.2 บิล totalAmount = 642", inv.totalAmount === 642, inv.totalAmount);

  await caller.billing.recordPayment({ invoiceId: inv.id, amount: 300, method: "TRANSFER" });
  let invDb = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
  ok("2.3 จ่ายบางส่วน → PARTIALLY_PAID", invDb.paymentStatus === "PARTIALLY_PAID", invDb.paymentStatus);

  await expectError(
    "2.4 จ่ายเกินยอดคงเหลือ → ปฏิเสธ",
    () => caller.billing.recordPayment({ invoiceId: inv.id, amount: 400, method: "TRANSFER" }),
    "เกินยอดคงเหลือ"
  );

  await caller.billing.recordPayment({ invoiceId: inv.id, amount: 342, method: "CASH" });
  invDb = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
  ok("2.5 จ่ายครบ → PAID + paidAt", invDb.paymentStatus === "PAID" && invDb.paidAt !== null, invDb.paymentStatus);

  let cust = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
  ok("2.6 totalSpent = 642 หลังจ่ายครบ", cust.totalSpent === 642, cust.totalSpent);

  await caller.billing.recordRefund({ invoiceId: inv.id, amount: 100, method: "TRANSFER" });
  invDb = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
  cust = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
  ok("2.7 refund 100 → PARTIALLY_PAID + totalSpent 542", invDb.paymentStatus === "PARTIALLY_PAID" && cust.totalSpent === 542, { s: invDb.paymentStatus, t: cust.totalSpent });

  await caller.billing.voidInvoice({ invoiceId: inv.id, reason: "ทดสอบ void" });
  invDb = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
  cust = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
  ok("2.8 void → VOIDED + totalSpent กลับ 0", invDb.paymentStatus === "VOIDED" && cust.totalSpent === 0, { s: invDb.paymentStatus, t: cust.totalSpent });

  await expectError(
    "2.9 void ซ้ำ → ปฏิเสธ",
    () => caller.billing.voidInvoice({ invoiceId: inv.id, reason: "ซ้ำ" }),
    "ถูกยกเลิกไปแล้ว"
  );

  await caller.billing.recordRefund({ invoiceId: inv.id, amount: 200, method: "TRANSFER" });
  invDb = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
  cust = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
  ok("2.10 refund หลัง void → สถานะคง VOIDED + totalSpent ไม่โดนหักซ้ำ (คง 0)", invDb.paymentStatus === "VOIDED" && cust.totalSpent === 0, { s: invDb.paymentStatus, t: cust.totalSpent });

  // ---------- 3) status machine + guards ----------
  await caller.order.updateStatus({ id: o2.id, internalStatus: "CONFIRMED" });
  const prod = await caller.production.create({
    orderId: o2.id,
    steps: [{ stepType: "SCREEN_PRINTING", sortOrder: 0 }],
  });
  let o2Db = await prisma.order.findUniqueOrThrow({ where: { id: o2.id } });
  ok("3.1 production.create จาก CONFIRMED (CUSTOM) → auto-hop เป็น PRODUCING", o2Db.internalStatus === "PRODUCING" && prod.id !== undefined, o2Db.internalStatus);

  // PRODUCING → READY_TO_SHIP ข้าม QC/แพ็ค (เลี่ยง COMPLETED ที่ติดด่านวางบิลก่อน — คนละด่าน)
  await expectError(
    "3.2 PRODUCING → READY_TO_SHIP (ข้ามขั้น) → ปฏิเสธ",
    () => caller.order.updateStatus({ id: o2.id, internalStatus: "READY_TO_SHIP" }),
    "ไม่สามารถเปลี่ยนสถานะ"
  );

  await caller.order.updateStatus({ id: o2.id, internalStatus: "CANCELLED", reason: "ทดสอบ" });
  o2Db = await prisma.order.findUniqueOrThrow({ where: { id: o2.id } });
  ok("3.3 ยกเลิกได้ + cancelledAt", o2Db.internalStatus === "CANCELLED" && o2Db.cancelledAt !== null, o2Db.internalStatus);

  await expectError(
    "3.4 แก้ค่าธรรมเนียมหลังยกเลิก → ปฏิเสธ",
    () => caller.order.updateFees({ id: o2.id, fees: [{ feeType: "RUSH_FEE", name: "ด่วน", amount: 100 }] }),
    // ข้อความจาก orderEditLockedReason (B10 รวมข้อความ lock — "แก้ค่าธรรมเนียมไม่ได้")
    "ค่าธรรมเนียมไม่ได้"
  );
  await expectError(
    "3.5 แก้ส่วนลดหลังยกเลิก → ปฏิเสธ",
    () => caller.order.update({ id: o2.id, discount: 5 }),
    "ข้อมูลการเงินไม่ได้"
  );
  const noteUpd = await caller.order.update({ id: o2.id, notes: "แก้โน้ตได้" });
  ok("3.6 แก้ field ไม่ใช่เงินหลังยกเลิกยังได้", noteUpd.notes === "แก้โน้ตได้", noteUpd.notes);

  // ---------- 4) quotation → convert + ภาษีไม่หาย ----------
  const q1 = await caller.quotation.create({
    customerId: customer.id,
    title: "[P0.2-VERIFY] ใบเสนอราคา",
    validUntil: new Date(Date.now() + 7 * 86400_000).toISOString(),
    discount: 0,
    tax: 70,
    items: [{ name: "งานทดสอบ", quantity: 10, unit: "ชิ้น", unitPrice: 100 }],
  });
  ok(`4.1 เลขใบเสนอราคา QT-${period}-NNNN`, new RegExp(`^QT-${period}-\\d{4}$`).test(q1.quotationNumber), q1.quotationNumber);
  ok("4.2 subtotal 1000 / total 1070", q1.subtotal === 1000 && q1.totalAmount === 1070, { s: q1.subtotal, t: q1.totalAmount });

  const q2 = await caller.quotation.create({
    customerId: customer.id,
    title: "[P0.2-VERIFY] ทดสอบ update",
    validUntil: new Date(Date.now() + 7 * 86400_000).toISOString(),
    discount: 0,
    tax: 70,
    items: [{ name: "งานทดสอบ", quantity: 10, unit: "ชิ้น", unitPrice: 100 }],
  });
  const q2u = await caller.quotation.update({ id: q2.id, discount: 100 });
  ok("4.3 quotation.update discount → recompute totalAmount = 970", q2u.totalAmount === 970, q2u.totalAmount);

  await caller.quotation.updateStatus({ id: q1.id, status: "ACCEPTED" });
  const co = await caller.quotation.convertToOrder({ id: q1.id });
  const coDb = await prisma.order.findUniqueOrThrow({ where: { id: co.id } });
  ok("4.4 convert: taxRate 7 / taxAmount 70 / total 1070", coDb.taxRate === 7 && coDb.taxAmount === 70 && coDb.totalAmount === 1070, { r: coDb.taxRate, a: coDb.taxAmount, t: coDb.totalAmount });

  await caller.order.updateFees({ id: co.id, fees: [] });
  const coDb2 = await prisma.order.findUniqueOrThrow({ where: { id: co.id } });
  ok("4.5 แก้ fees หลัง convert → ภาษีไม่หาย (total คง 1070)", coDb2.totalAmount === 1070 && coDb2.taxAmount === 70, { t: coDb2.totalAmount, a: coDb2.taxAmount });

  // ---------- 5) design flow ผ่าน transition กลาง ----------
  const o3 = await caller.order.create({ ...orderInput, channel: "LINE" as const, title: "[P0.2-VERIFY] design flow", externalOrderId: undefined, platformFee: undefined });
  await caller.order.updateStatus({ id: o3.id, internalStatus: "CONFIRMED" });
  await caller.order.updateStatus({ id: o3.id, internalStatus: "DESIGNING" });
  const design = await caller.design.upload({ orderId: o3.id, fileUrl: "https://example.com/design-v1.png" });
  let o3Db = await prisma.order.findUniqueOrThrow({ where: { id: o3.id } });
  ok("5.1 upload แบบ → DESIGNING", o3Db.internalStatus === "DESIGNING", o3Db.internalStatus);

  await caller.design.approveByToken({ token: design.approvalToken!, approved: true });
  o3Db = await prisma.order.findUniqueOrThrow({ where: { id: o3.id } });
  ok("5.2 ลูกค้าอนุมัติผ่าน token ตอน DESIGNING → DESIGN_APPROVED", o3Db.internalStatus === "DESIGN_APPROVED", o3Db.internalStatus);

  await caller.production.create({ orderId: o3.id, steps: [{ stepType: "SCREEN_PRINTING", sortOrder: 0 }] });
  o3Db = await prisma.order.findUniqueOrThrow({ where: { id: o3.id } });
  ok("5.3 สร้างใบผลิตจาก DESIGN_APPROVED → auto-hop เป็น PRODUCING", o3Db.internalStatus === "PRODUCING", o3Db.internalStatus);

  // ---------- 6) aggregates ส่งเป็น number ----------
  // (6.2 order.stats ถูกถอด — endpoint ลบแล้ว 2026-07-06: ไม่มีจอใช้ + เคยรั่วยอดขายรายเดือน)
  const bstats = await caller.billing.stats();
  ok("6.1 billing.stats เป็น number ทุกตัว", typeof bstats.totalUnpaid === "number" && typeof bstats.paidThisMonth === "number", bstats);

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
