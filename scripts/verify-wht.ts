/**
 * verify WHT หัก ณ ที่จ่ายขารับ + ทะเบียน 50ทวิ (ก้อน 3) — integration จริงกับ DB
 * รัน: npm run verify:wht · ข้อมูลใช้ marker [WHT-VERIFY] ลบเกลี้ยง + คืน DocumentSequence
 */
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/lib/prisma";
import { currentPeriod } from "@/server/services/document-number";

const MARK = "[WHT-VERIFY]";
let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++;
    console.log(`PASS: ${name}`);
  } else {
    fails.push(name);
    console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER", isActive: true } });
  const caller = appRouter.createCaller({ prisma, userId: owner.id, userRole: owner.role });

  const period = currentPeriod();
  const seqBefore = await prisma.documentSequence.findUnique({
    where: { docType_period: { docType: "FINAL_INVOICE", period } },
    select: { lastNumber: true },
  });

  const customer = await prisma.customer.create({
    data: { name: `${MARK} บจก.ทดสอบหักภาษี`, customerType: "CORPORATE", taxId: "0105500000001" },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: `TEST-WHT-${Date.now()}`,
      title: `${MARK} งานทดสอบ WHT`,
      customerId: customer.id,
      createdById: owner.id,
      internalStatus: "SHIPPED",
      totalAmount: 321,
    },
  });

  try {
    const mkInvoice = () =>
      caller.billing.create({
        orderId: order.id,
        customerId: customer.id,
        type: "FINAL_INVOICE",
        amount: 100,
        tax: 7,
      });

    // ── 1. รับเงิน 104 + WHT 3 → บิลปิด PAID + เกิดทะเบียน 50ทวิ ──
    const inv1 = await mkInvoice();
    await caller.billing.recordPayment({
      invoiceId: inv1.id,
      amount: 104,
      whtAmount: 3,
      method: "BANK_TRANSFER",
      evidenceUrl: "https://example.com/slip.jpg",
    });
    const inv1After = await prisma.invoice.findUniqueOrThrow({
      where: { id: inv1.id },
      include: { payments: true },
    });
    check("1.1 เงินสด 104 + WHT 3 = 107 → PAID", inv1After.paymentStatus === "PAID");
    check("1.2 payment เก็บ whtAmount/evidenceUrl", inv1After.payments[0].whtAmount === 3 && !!inv1After.payments[0].evidenceUrl);
    const cert1 = await prisma.whtCertificate.findFirst({ where: { invoiceId: inv1.id } });
    check(
      "1.3 ทะเบียน 50ทวิ เกิดอัตโนมัติ ฐาน=ก่อน VAT รอใบ",
      cert1?.received === false && Number(cert1.baseAmount) === 100 && Number(cert1.amount) === 3
    );

    // ── 2. กันจ่ายเกิน (รวม WHT) ──
    await caller.billing
      .recordPayment({ invoiceId: inv1.id, amount: 1, method: "CASH" })
      .then(
        () => check("2.1 จ่ายทับบิลที่ปิดแล้ว → โดนกัน", false),
        (e) => check("2.1 จ่ายทับบิลที่ปิดแล้ว → โดนกัน", String(e.message).includes("เกินยอดคงเหลือ"))
      );

    // ── 3. จ่ายบางส่วน + ตามด้วย WHT งวดหลัง ──
    const inv2 = await mkInvoice();
    await caller.billing.recordPayment({ invoiceId: inv2.id, amount: 50, method: "CASH" });
    let inv2Now = await prisma.invoice.findUniqueOrThrow({ where: { id: inv2.id } });
    check("3.1 จ่าย 50/107 → PARTIALLY_PAID", inv2Now.paymentStatus === "PARTIALLY_PAID");
    await caller.billing.recordPayment({
      invoiceId: inv2.id,
      amount: 54,
      whtAmount: 3,
      method: "BANK_TRANSFER",
      whtCertNumber: "WH-001/2569",
    });
    inv2Now = await prisma.invoice.findUniqueOrThrow({ where: { id: inv2.id } });
    check("3.2 งวดสอง 54+WHT3 → PAID", inv2Now.paymentStatus === "PAID");
    const cert2 = await prisma.whtCertificate.findFirst({ where: { invoiceId: inv2.id } });
    check("3.3 กรอกเลขใบมาด้วย = ได้ใบแล้วทันที", cert2?.received === true && cert2.certNumber === "WH-001/2569");

    // ── 4. ทะเบียน + markReceived + stats ──
    const list = await caller.wht.list({ received: false });
    check("4.1 ทะเบียนโชว์ใบที่รอ", list.some((c) => c.id === cert1!.id));
    await caller.wht.markReceived({ id: cert1!.id, certNumber: "WH-002/2569", fileUrl: "https://example.com/cert.pdf" });
    const cert1After = await prisma.whtCertificate.findUniqueOrThrow({ where: { id: cert1!.id } });
    check("4.2 markReceived เก็บเลข+ไฟล์", cert1After.received && cert1After.certNumber === "WH-002/2569");

    // ── 5. refund บนบิลที่มี WHT — สถานะคิดรวม WHT ──
    const inv3 = await mkInvoice();
    await caller.billing.recordPayment({ invoiceId: inv3.id, amount: 104, whtAmount: 3, method: "BANK_TRANSFER" });
    await caller.billing.recordRefund({ invoiceId: inv3.id, amount: 10, method: "BANK_TRANSFER" });
    const inv3Now = await prisma.invoice.findUniqueOrThrow({ where: { id: inv3.id } });
    check("5.1 คืนเงิน 10 → เคลียร์เหลือ 97/107 = PARTIALLY_PAID", inv3Now.paymentStatus === "PARTIALLY_PAID");
  } finally {
    const invoices = await prisma.invoice.findMany({ where: { orderId: order.id }, select: { id: true } });
    const invIds = invoices.map((i) => i.id);
    await prisma.whtCertificate.deleteMany({ where: { invoiceId: { in: invIds } } });
    await prisma.payment.deleteMany({ where: { invoiceId: { in: invIds } } });
    await prisma.invoice.deleteMany({ where: { id: { in: invIds } } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    // คืนเลขเอกสารที่สคริปต์กินไป (DB ไม่มีบิลเดือนนี้ค้างจากของจริงระหว่างรัน — เสี่ยงต่ำ)
    if (seqBefore) {
      await prisma.documentSequence.update({
        where: { docType_period: { docType: "FINAL_INVOICE", period } },
        data: { lastNumber: seqBefore.lastNumber },
      });
    } else {
      await prisma.documentSequence.deleteMany({ where: { docType: "FINAL_INVOICE", period } });
    }
  }

  console.log(`\n=== ผล: ผ่าน ${pass} · ตก ${fails.length} ===`);
  if (fails.length > 0) {
    console.log("ตก:", fails.join(" / "));
    process.exit(1);
  }
  await prisma.$disconnect();
}

main();
