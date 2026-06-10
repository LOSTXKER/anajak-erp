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

const SEQ_TYPES = ["DEPOSIT_INVOICE", "FINAL_INVOICE", "RECEIPT"];

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
    const dn = await caller.billing.create({
      orderId: order1.id,
      customerId: customer.id,
      type: "DEBIT_NOTE",
      amount: 500,
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
  } finally {
    // ---------- ล้างข้อมูลทดสอบเกลี้ยง + คืนเลขเอกสาร ----------
    const testInvoices = await prisma.invoice.findMany({
      where: { orderId: { in: ids.orders } },
      select: { id: true, invoiceNumber: true },
    });
    for (const inv of testInvoices) {
      await prisma.notification.deleteMany({ where: { message: { contains: inv.invoiceNumber } } });
    }
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [...testInvoices.map((i) => i.id), ...ids.orders] } },
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
