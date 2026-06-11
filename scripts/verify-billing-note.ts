// verify จริงกับ DB: ใบวางบิล + ลูกหนี้ aging + เช็ควงเงินเครดิต
// ยิงผ่าน tRPC caller จริง — ลบข้อมูลทดสอบเกลี้ยงตอนจบ + คืน DocumentSequence
// ห้ามรันบน DB ใช้งานจริง
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/lib/prisma";
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

const SEQ_TYPES = ["FINAL_INVOICE", "BILLING_NOTE"];

async function main() {
  const period = currentPeriod();
  const seqBefore = await prisma.documentSequence.findMany({
    where: { period, docType: { in: SEQ_TYPES } },
  });

  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER", isActive: true } });
  const ownerCaller = appRouter.createCaller({ prisma, userId: owner.id, userRole: owner.role });
  // จำลอง SALES — role มาจาก context (audit log ยังผูก user จริง)
  const salesCaller = appRouter.createCaller({ prisma, userId: owner.id, userRole: "SALES" });

  const ids = { customer: "", orders: [] as string[] };

  try {
    const customer = await prisma.customer.create({
      data: { name: "[BN-VERIFY] ลูกค้าทดสอบ", creditLimit: 5000 },
    });
    ids.customer = customer.id;

    const baseOrder = {
      orderType: "CUSTOM" as const,
      channel: "LINE" as const,
      customerId: customer.id,
      createdById: owner.id,
      customerStatus: "ORDER_RECEIVED" as const,
    };
    // o1: ผูกพันแล้ว (CONFIRMED) 3000 — จะวางบิล 2000
    const o1 = await prisma.order.create({
      data: {
        ...baseOrder,
        orderNumber: "TEST-BN-1",
        internalStatus: "CONFIRMED",
        title: "[BN-VERIFY] งานที่หนึ่ง",
        totalAmount: 3000,
      },
    });
    // o2: ยังไม่ผูกพัน (INQUIRY) 4000 — ใช้ทดสอบด่านวงเงินตอนยืนยัน
    const o2 = await prisma.order.create({
      data: {
        ...baseOrder,
        orderNumber: "TEST-BN-2",
        internalStatus: "INQUIRY",
        title: "[BN-VERIFY] งานที่สอง",
        totalAmount: 4000,
      },
    });
    ids.orders.push(o1.id, o2.id);
    // o2 ต้องมีรายการ ≥1 เพื่อให้ยืนยันออเดอร์ได้ (ด่านกันออเดอร์เปล่าตอน confirm)
    await prisma.orderItem.create({
      data: { orderId: o2.id, description: "[BN-VERIFY] รายการงานที่สอง", totalQuantity: 1, subtotal: 4000 },
    });

    const inv = await ownerCaller.billing.create({
      orderId: o1.id,
      customerId: customer.id,
      type: "FINAL_INVOICE",
      amount: 2000,
    });

    // ---------- 1) วงเงินเครดิต ----------
    const credit = await ownerCaller.customer.creditStatus({ customerId: customer.id });
    ok(
      "1.1 exposure = ใบค้าง 2000 + งานยังไม่วางบิล 1000 (o2 ยังไม่ผูกพันไม่นับ)",
      credit.exposure === 3000 && credit.invoiceOutstanding === 2000 && credit.unbilled === 1000,
      credit
    );
    ok("1.2 วงเงินคงเหลือ = 2000", credit.available === 2000, credit.available);

    await expectError(
      "1.3 SALES ยืนยันออเดอร์ 4000 เกินวงเงิน → ปฏิเสธ",
      () => salesCaller.order.updateStatus({ id: o2.id, internalStatus: "CONFIRMED" }),
      "เกินวงเงินเครดิต"
    );

    const confirmed = await ownerCaller.order.updateStatus({ id: o2.id, internalStatus: "CONFIRMED" });
    ok("1.4 OWNER ยืนยันเกินวงเงินได้ (ตัดสินใจเอง)", confirmed.internalStatus === "CONFIRMED", confirmed.internalStatus);

    // ปลดพัก ON_HOLD → CONFIRMED: ยอดถูกนับใน exposure อยู่แล้ว ห้ามนับซ้ำจนบล็อก SALES ปลอม
    await ownerCaller.order.updateStatus({ id: o2.id, internalStatus: "ON_HOLD" });
    const resumed = await salesCaller.order.updateStatus({ id: o2.id, internalStatus: "CONFIRMED" });
    ok("1.5 SALES ปลดพักออเดอร์เดิมได้ (ไม่นับวงเงินซ้ำ)", resumed.internalStatus === "CONFIRMED", resumed.internalStatus);

    // ---------- 2) ใบวางบิล ----------
    const eligible1 = await ownerCaller.billingNote.eligibleInvoices({ customerId: customer.id });
    ok(
      "2.1 ใบค้างชำระโผล่ในลิสต์วางบิลได้ พร้อมยอดคงเหลือ",
      eligible1.invoices.length === 1 && eligible1.invoices[0].outstanding === 2000,
      eligible1
    );

    const note = await ownerCaller.billingNote.create({
      customerId: customer.id,
      invoiceIds: [inv.id],
      notes: "[BN-VERIFY]",
    });
    ok(
      `2.2 เลขใบวางบิล BN-${period}-NNNN + ยอดรวม 2000`,
      new RegExp(`^BN-${period}-\\d{4}$`).test(note.billingNoteNumber) && note.totalAmount === 2000,
      note.billingNoteNumber
    );

    const eligible2 = await ownerCaller.billingNote.eligibleInvoices({ customerId: customer.id });
    ok("2.3 ใบที่อยู่บนใบวางบิลแล้วหายจากลิสต์", eligible2.invoices.length === 0, eligible2.invoices.length);

    await expectError(
      "2.3b void ใบแจ้งหนี้ที่อยู่บนใบวางบิล active → ปฏิเสธ",
      () => ownerCaller.billing.voidInvoice({ invoiceId: inv.id, reason: "ทดสอบ" }),
      "ยกเลิกใบวางบิลก่อน"
    );

    await expectError(
      "2.4 วางบิลใบเดิมซ้ำ → ปฏิเสธ",
      () =>
        ownerCaller.billingNote.create({ customerId: customer.id, invoiceIds: [inv.id] }),
      "อยู่บนใบวางบิลอื่น"
    );

    await ownerCaller.billingNote.void({ id: note.id, reason: "[BN-VERIFY] ทดสอบยกเลิก" });
    const eligible3 = await ownerCaller.billingNote.eligibleInvoices({ customerId: customer.id });
    ok("2.5 ยกเลิกใบวางบิล → ใบแจ้งหนี้กลับมาวางบิลใหม่ได้", eligible3.invoices.length === 1, eligible3.invoices.length);

    // ---------- 3) aging ----------
    const past45 = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    await prisma.invoice.update({ where: { id: inv.id }, data: { dueDate: past45 } });
    const aging = await ownerCaller.billingNote.aging();
    const row = aging.rows.find((r) => r.customerId === customer.id);
    ok(
      "3.1 aging จัดถังถูก: ค้าง 2000 อยู่ถังเลย 31-60 วัน",
      !!row && row.buckets.d31_60 === 2000 && row.total === 2000,
      row
    );
  } finally {
    // ---------- ล้างเกลี้ยง + คืนเลขเอกสาร ----------
    const testInvoices = await prisma.invoice.findMany({
      where: { orderId: { in: ids.orders } },
      select: { id: true },
    });
    const invoiceIds = testInvoices.map((i) => i.id);
    const notes = await prisma.billingNote.findMany({
      where: { customerId: ids.customer },
      select: { id: true },
    });
    await prisma.billingNoteItem.deleteMany({
      where: { billingNoteId: { in: notes.map((n) => n.id) } },
    });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [...invoiceIds, ...ids.orders, ...notes.map((n) => n.id)] } },
    });
    await prisma.billingNote.deleteMany({ where: { customerId: ids.customer } });
    await prisma.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await prisma.invoice.deleteMany({ where: { orderId: { in: ids.orders } } });
    await prisma.orderRevision.deleteMany({ where: { orderId: { in: ids.orders } } });
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
