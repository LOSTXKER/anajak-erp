/**
 * verify รายงานภาษีขายรายเดือน (Gate B5) — integration จริงกับ DB
 * รัน: npm run verify:tax · ข้อมูลใช้ marker [TAX-VERIFY] ลบเกลี้ยงท้ายสคริปต์
 * โจทย์: ขอบเขตชนิดใบ (REC/CN/DN เท่านั้น) · งวดตาม issueDate ?? createdAt (เขตเวลาไทย)
 * · CN ติดลบ · ใบ void คงแถวแต่ไม่รวมยอด · role gate การเงิน
 */
import { appRouter } from "@/server/routers/_app";
import { prisma } from "@/lib/prisma";

const MARK = "[TAX-VERIFY]";
let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    pass++;
    console.log(`PASS: ${name}`);
  } else {
    fails.push(name);
    console.log(`FAIL: ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
}

async function main() {
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER", isActive: true } });
  const caller = appRouter.createCaller({ prisma, userId: owner.id, userRole: owner.role });
  const staffCaller = appRouter.createCaller({
    prisma,
    userId: owner.id,
    userRole: "PRODUCTION_STAFF",
  });

  // งวดทดสอบ = มี.ค. 2024 (อดีตไกล — ไม่ชนใบจริงของระบบ)
  const Y = 2024;
  const M = 3;
  const stamp = Date.now();

  const customer = await prisma.customer.create({
    data: {
      name: `${MARK} บริษัท ผู้ซื้อ, ทดสอบ จำกัด`, // มี comma — เทส escape ปลายทาง
      customerType: "CORPORATE",
      taxId: "0105512345678",
      branchNumber: "00000",
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: `TEST-TAX-${stamp}`,
      title: `${MARK} งานทดสอบภาษีขาย`,
      customerId: customer.id,
      createdById: owner.id,
      totalAmount: 5000,
    },
  });

  const mkInvoice = (over: Record<string, unknown>) =>
    prisma.invoice.create({
      data: {
        orderId: order.id,
        customerId: customer.id,
        type: "RECEIPT",
        amount: 1000,
        discount: 0,
        tax: 70,
        totalAmount: 1070,
        ...over,
      } as never,
    });

  try {
    // ── seed: ใบหลากชนิด/งวด ──
    // R1 ใบเสร็จในงวด (issueDate กลางเดือน)
    const r1 = await mkInvoice({
      invoiceNumber: `TEST-TAX-R1-${stamp}`,
      issueDate: new Date("2024-03-10T00:00:00.000Z"),
    });
    // R2 กดสร้างเดือนเม.ย. แต่ issueDate ย้อนงวดมี.ค. (เคสบันทึกย้อน B3) — ต้องเข้างวดมี.ค.
    const r2 = await mkInvoice({
      invoiceNumber: `TEST-TAX-R2-${stamp}`,
      issueDate: new Date("2024-03-31T00:00:00.000Z"),
      createdAt: new Date("2024-04-05T04:00:00.000Z"),
    });
    // R3 ไม่มี issueDate → ใช้ createdAt · 00:30 น. ไทยของ 1 มี.ค. = 17:30Z ของ 29 ก.พ.
    // (เทสขอบเดือนเขตเวลาไทย — UTC ยังเป็นเดือนก่อน แต่งวดไทยคือมี.ค.)
    const r3 = await mkInvoice({
      invoiceNumber: `TEST-TAX-R3-${stamp}`,
      issueDate: null,
      createdAt: new Date("2024-02-29T17:30:00.000Z"),
    });
    // R4 อยู่เดือนอื่น (ก.พ.) — ห้ามโผล่งวดมี.ค.
    await mkInvoice({
      invoiceNumber: `TEST-TAX-R4-${stamp}`,
      issueDate: new Date("2024-02-15T00:00:00.000Z"),
    });
    // R5 ใบ void ในงวด — คงแถว ยอดไม่รวม
    const r5 = await mkInvoice({
      invoiceNumber: `TEST-TAX-R5-${stamp}`,
      issueDate: new Date("2024-03-20T00:00:00.000Z"),
      isVoided: true,
      voidedReason: "ออกผิดใบ",
    });
    // CN อ้าง R1 (ลดหนี้ 200+14) ในงวด
    const cn = await mkInvoice({
      invoiceNumber: `TEST-TAX-CN-${stamp}`,
      type: "CREDIT_NOTE",
      amount: 200,
      tax: 14,
      totalAmount: 214,
      issueDate: new Date("2024-03-25T00:00:00.000Z"),
      originalInvoiceId: r1.id,
      adjustmentReason: "คืนของชำรุด",
    });
    // DN อ้าง R1 (เพิ่มหนี้ 100+7) ในงวด
    await mkInvoice({
      invoiceNumber: `TEST-TAX-DN-${stamp}`,
      type: "DEBIT_NOTE",
      amount: 100,
      tax: 7,
      totalAmount: 107,
      issueDate: new Date("2024-03-26T00:00:00.000Z"),
      originalInvoiceId: r1.id,
    });
    // ใบแจ้งหนี้ (ไม่ใช่เอกสารกำกับภาษี) ในงวด — ห้ามโผล่
    const f1 = await mkInvoice({
      invoiceNumber: `TEST-TAX-F1-${stamp}`,
      type: "FINAL_INVOICE",
      issueDate: new Date("2024-03-12T00:00:00.000Z"),
    });
    // CN อ้าง "ใบแจ้งหนี้" = ปรับยอดค้าง ไม่ใช่เหตุการณ์ภาษี — ห้ามเข้ารายงาน
    // (BLOCKER จาก review B5: เดิมหัก VAT ซ้ำกับใบเสร็จที่สะท้อนการลดแล้ว → ภ.พ.30 ขาด)
    await mkInvoice({
      invoiceNumber: `TEST-TAX-CNF-${stamp}`,
      type: "CREDIT_NOTE",
      amount: 300,
      tax: 21,
      totalAmount: 321,
      issueDate: new Date("2024-03-27T00:00:00.000Z"),
      originalInvoiceId: f1.id,
      adjustmentReason: "ลดยอดใบแจ้งหนี้",
    });

    // ── รายงานงวดมี.ค. ──
    const report = await caller.billing.salesTaxReport({ year: Y, month: M });
    const mine = report.rows.filter((r) => r.invoiceNumber.startsWith("TEST-TAX-"));
    const numbers = mine.map((r) => r.invoiceNumber);

    check(
      "1.1 ใบเสร็จ/CN/DN ของงวดครบ (รวมใบ void + ใบบันทึกย้อน + ใบขอบเดือนไทย)",
      [r1, r2, r3, r5, cn].every((inv) =>
        numbers.includes((inv as { invoiceNumber: string }).invoiceNumber)
      ) && numbers.includes(`TEST-TAX-DN-${stamp}`),
      numbers
    );
    check("1.2 ใบแจ้งหนี้ (FINAL_INVOICE) ไม่เข้ารายงาน", !numbers.includes(`TEST-TAX-F1-${stamp}`));
    check("1.3 ใบงวดอื่น (ก.พ.) ไม่โผล่", !numbers.includes(`TEST-TAX-R4-${stamp}`));
    check(
      "1.4 CN อ้างใบแจ้งหนี้ (ปรับยอดค้าง) ไม่เข้ารายงาน — ไม่หัก VAT ซ้ำ",
      !numbers.includes(`TEST-TAX-CNF-${stamp}`)
    );

    const cnRow = mine.find((r) => r.invoiceNumber === `TEST-TAX-CN-${stamp}`)!;
    check(
      "2.1 ใบลดหนี้ยอดติดลบ + หมายเหตุอ้างใบเดิม",
      cnRow.base === -200 && cnRow.vat === -14 && cnRow.note.includes(`TEST-TAX-R1-${stamp}`),
      { base: cnRow.base, note: cnRow.note }
    );
    const voidRow = mine.find((r) => r.invoiceNumber === `TEST-TAX-R5-${stamp}`)!;
    check(
      "2.2 ใบ void: แถวคงอยู่ ยอด 0 + หมายเหตุยกเลิก",
      voidRow.isVoided && voidRow.total === 0 && voidRow.note.includes("ยกเลิก")
    );

    // สรุปเฉพาะใบทดสอบ: R1+R2+R3 (3×1070) − CN 214 + DN 107 = 3103 · ฐาน 2900 · VAT 203
    const liveMine = mine.filter((r) => !r.isVoided);
    const sumBase = liveMine.reduce((s, r) => s + r.base, 0);
    const sumVat = liveMine.reduce((s, r) => s + r.vat, 0);
    check("3.1 ยอดฐาน/VAT ของชุดทดสอบถูก (CN หัก DN บวก void ไม่นับ)",
      Math.abs(sumBase - 2900) < 0.005 && Math.abs(sumVat - 203) < 0.005,
      { sumBase, sumVat }
    );
    check(
      "3.2 summary รวมของงวดสอดคล้องแถว (นับเฉพาะไม่ void)",
      report.summary.docCount === report.rows.filter((r) => !r.isVoided).length &&
        report.summary.voidedCount === report.rows.filter((r) => r.isVoided).length
    );

    // ── ขอบงวด: เดือนก.พ.เห็น R4 แต่ไม่เห็น R3 (createdAt UTC ก.พ.แต่งวดไทยมี.ค.) ──
    const feb = await caller.billing.salesTaxReport({ year: 2024, month: 2 });
    const febNumbers = feb.rows.map((r) => r.invoiceNumber);
    check(
      "4.1 งวดก.พ.: เห็นใบก.พ. · ไม่เห็นใบ 00:30 น.ไทยของ 1 มี.ค. (ขอบเดือนไทยถูก)",
      febNumbers.includes(`TEST-TAX-R4-${stamp}`) && !febNumbers.includes(`TEST-TAX-R3-${stamp}`),
      febNumbers.filter((n) => n.startsWith("TEST-TAX-"))
    );

    // ── role gate ──
    await staffCaller.billing
      .salesTaxReport({ year: Y, month: M })
      .then(
        () => check("5.1 ช่างผลิตดูรายงานภาษีขายไม่ได้", false),
        () => check("5.1 ช่างผลิตดูรายงานภาษีขายไม่ได้", true)
      );
  } finally {
    // ── ลบเกลี้ยง (CN/DN อ้าง R1 ด้วย FK Restrict — ลบลูกก่อนแม่) ──
    await prisma.invoice.deleteMany({
      where: { invoiceNumber: { startsWith: "TEST-TAX-" }, originalInvoiceId: { not: null } },
    });
    await prisma.invoice.deleteMany({ where: { invoiceNumber: { startsWith: "TEST-TAX-" } } });
    await prisma.order.deleteMany({ where: { title: { contains: MARK } } });
    await prisma.customer.deleteMany({ where: { name: { contains: MARK } } });
  }

  console.log(`\n=== ผล: ผ่าน ${pass} · ตก ${fails.length} ===`);
  if (fails.length > 0) {
    console.log("ตก:", fails.join(" / "));
    process.exit(1);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("VERIFY CRASHED:", e);
  process.exit(1);
});
