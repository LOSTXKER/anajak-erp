/**
 * verify: สำเนาคู่สัญญาบนเอกสาร (เบสสั่ง 2026-08-12)
 *
 * พิสูจน์สิ่งเดียว แต่เป็นสิ่งที่ทั้งใบงานนี้ทำเพื่อมัน:
 *   ออกเอกสาร → แก้ที่อยู่ลูกค้า + ย้ายที่อยู่บริษัท → พิมพ์ใบเดิมซ้ำ
 *   ต้องได้ข้อมูลของ "วันที่ออกใบ" ไม่ใช่ข้อมูลวันนี้
 *
 * รัน: npx tsx scripts/verify-doc-snapshot.ts
 * สร้างข้อมูลทดสอบเองแล้วลบทิ้งท้ายสคริปต์ (ไม่แตะข้อมูลจริง)
 */
// ใช้ client ตัวเดียวกับแอป (extend แล้ว — Decimal→number ฯลฯ) ไม่ใช่ PrismaClient ดิบ
// เหมือนสคริปต์ verify ตัวอื่นในโฟลเดอร์นี้
import { prisma } from "@/lib/prisma";
import { resolveDocBuyer, resolveDocSeller } from "@/lib/customer-doc-address";
import { COMPANY_PROFILE_KEY, parseCompanyProfile } from "@/lib/company-profile";
import { buildDocumentPartySnapshot } from "@/server/services/document-party";
const TAG = "[VERIFY-SNAPSHOT]";

let pass = 0;
let fail = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "✅" : "❌"} ${label}`);
  if (!ok) {
    console.log(`   คาดหวัง: ${JSON.stringify(expected)}`);
    console.log(`   ได้จริง : ${JSON.stringify(actual)}`);
    fail++;
  } else pass++;
}

async function main() {
  const customer = await prisma.customer.create({
    data: {
      name: `${TAG} ลูกค้า`,
      company: "บริษัท ต้นฉบับ จำกัด",
      customerType: "CORPORATE",
      taxId: "0105551234567",
      branchNumber: "00000",
      phone: "021111111",
      address: "ที่อยู่ผู้ติดต่อเดิม",
      billingAddress: "99 อาคารเอ ถ.สาทรใต้",
      billingSubDistrict: "ทุ่งมหาเมฆ",
      billingDistrict: "สาทร",
      billingProvince: "กรุงเทพมหานคร",
      billingPostalCode: "10120",
    },
  });

  const user = await prisma.user.findFirstOrThrow({ select: { id: true } });
  const order = await prisma.order.create({
    data: {
      orderNumber: `${TAG}-${Date.now()}`,
      customerId: customer.id,
      createdById: user.id,
      totalAmount: 1000,
    },
  });

  // ── ออกใบ (ใช้ service ตัวเดียวกับ router) ─────────────────────────────
  const party = await buildDocumentPartySnapshot(prisma, customer.id);
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: `${TAG}-INV-${Date.now()}`,
      orderId: order.id,
      customerId: customer.id,
      type: "FINAL_INVOICE",
      amount: 1000,
      totalAmount: 1070,
      tax: 70,
      ...party,
    },
  });

  check("ที่อยู่ผู้ซื้อถูกเก็บลงใบตอนออก", invoice.buyerAddress, "99 อาคารเอ ถ.สาทรใต้");
  check("จังหวัดผู้ซื้อถูกเก็บแยกช่อง", invoice.buyerProvince, "กรุงเทพมหานคร");
  check("ชื่อบริษัทผู้ซื้อถูกเก็บ", invoice.buyerCompany, "บริษัท ต้นฉบับ จำกัด");

  // ── ลูกค้าย้ายที่อยู่ + เปลี่ยนชื่อบริษัท หลังออกใบไปแล้ว ─────────────────
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      company: "บริษัท เปลี่ยนชื่อแล้ว จำกัด",
      billingAddress: "1 ที่อยู่ใหม่",
      billingSubDistrict: "ตำบลใหม่",
      billingDistrict: "อำเภอใหม่",
      billingProvince: "ชลบุรี",
      billingPostalCode: "20000",
    },
  });

  const fresh = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoice.id },
    include: { customer: true },
  });
  const buyer = resolveDocBuyer(fresh, fresh.customer);

  check(
    "พิมพ์ใบเดิมซ้ำ → ที่อยู่ยังเป็นของวันที่ออกใบ",
    buyer.address,
    "99 อาคารเอ ถ.สาทรใต้\nทุ่งมหาเมฆ สาทร กรุงเทพมหานคร 10120",
  );
  check("พิมพ์ใบเดิมซ้ำ → ชื่อบริษัทยังเป็นของวันที่ออกใบ", buyer.company, "บริษัท ต้นฉบับ จำกัด");
  check("สาขา 00000 แปลงเป็นสำนักงานใหญ่", buyer.branch, "สำนักงานใหญ่");

  // ── ใบเก่าที่ออกก่อน migration (คอลัมน์ว่าง) ต้องยังพิมพ์ได้ ──────────────
  const legacy = await prisma.invoice.create({
    data: {
      invoiceNumber: `${TAG}-OLD-${Date.now()}`,
      orderId: order.id,
      customerId: customer.id,
      type: "FINAL_INVOICE",
      amount: 500,
      totalAmount: 535,
      tax: 35,
    },
  });
  const legacyFresh = await prisma.invoice.findUniqueOrThrow({
    where: { id: legacy.id },
    include: { customer: true },
  });
  const legacyBuyer = resolveDocBuyer(legacyFresh, legacyFresh.customer);
  check(
    "ใบเก่าที่ไม่มีสำเนา → ถอยไปอ่านค่าสด ไม่พิมพ์ออกมาโล่ง",
    legacyBuyer.address,
    "1 ที่อยู่ใหม่\nตำบลใหม่ อำเภอใหม่ ชลบุรี 20000",
  );

  // ── ฝั่งผู้ขาย: ย้ายออฟฟิศแล้วใบเก่าต้องไม่เปลี่ยน ────────────────────────
  const setting = await prisma.setting.findUnique({ where: { key: COMPANY_PROFILE_KEY } });
  const sellerAtIssue = parseCompanyProfile(setting?.value);
  check("ที่อยู่บริษัทถูกเก็บลงใบตอนออก", invoice.sellerAddress, sellerAtIssue.address || null);

  const moved = { ...sellerAtIssue, address: "ที่อยู่ออฟฟิศใหม่หลังย้าย" };
  check(
    "ย้ายออฟฟิศแล้วพิมพ์ใบเดิมซ้ำ → หัวกระดาษยังเป็นที่อยู่เดิม",
    resolveDocSeller(fresh, moved).address,
    sellerAtIssue.address,
  );
  check(
    "ใบเก่าที่ไม่มีสำเนาผู้ขาย → ใช้ข้อมูลกิจการปัจจุบัน",
    resolveDocSeller(legacyFresh, moved).address,
    "ที่อยู่ออฟฟิศใหม่หลังย้าย",
  );

  // ── นิติบุคคลที่ไม่ได้กรอกชื่อผู้ติดต่อ (เบสสั่ง 2026-09-18) ────────────────
  // สำเนาของลูกค้ารายนี้เก็บชื่อบริษัทช่องเดียว (buyerName = null) — ฝั่งอ่านต้องยังนับว่า
  // "มีสำเนา" ไม่งั้นพิมพ์ใบเก่าซ้ำจะไหลไปอ่านค่าสดเงียบๆ · และชื่อผู้ซื้อบนใบกำกับ
  // ต้องเป็นชื่อบริษัท ไม่ใช่ช่องโล่ง (ม.86/4)
  const corporate = await prisma.customer.create({
    data: {
      company: `${TAG} บริษัท ไม่มีผู้ติดต่อ จำกัด`,
      customerType: "CORPORATE",
      taxId: "0105551234568",
      branchNumber: "00000",
      billingAddress: "1 ถ.เอกมัย",
      billingProvince: "กรุงเทพมหานคร",
    },
  });
  const corporateOrder = await prisma.order.create({
    data: {
      orderNumber: `${TAG}-CORP-${Date.now()}`,
      customerId: corporate.id,
      createdById: user.id,
      totalAmount: 1000,
    },
  });
  const corporateParty = await buildDocumentPartySnapshot(prisma, corporate.id);
  check("นิติบุคคลไม่มีชื่อผู้ติดต่อ → สำเนาไม่มีชื่อคน", corporateParty.buyerName, null);

  const corporateInvoice = await prisma.invoice.create({
    data: {
      invoiceNumber: `${TAG}-CORP-INV-${Date.now()}`,
      orderId: corporateOrder.id,
      customerId: corporate.id,
      type: "FINAL_INVOICE",
      amount: 1000,
      totalAmount: 1070,
      tax: 70,
      ...corporateParty,
    },
  });
  await prisma.customer.update({
    where: { id: corporate.id },
    data: { company: `${TAG} บริษัท เปลี่ยนชื่อแล้ว จำกัด`, billingAddress: "2 ที่อยู่ใหม่" },
  });
  const corporateFresh = await prisma.invoice.findUniqueOrThrow({
    where: { id: corporateInvoice.id },
    include: { customer: true },
  });
  const corporateBuyer = resolveDocBuyer(corporateFresh, corporateFresh.customer);
  check(
    "ใบของนิติบุคคลไม่มีผู้ติดต่อ → ชื่อผู้ซื้อคือชื่อบริษัทตอนออกใบ",
    corporateBuyer.name,
    `${TAG} บริษัท ไม่มีผู้ติดต่อ จำกัด`,
  );
  check("ไม่มีชื่อผู้ติดต่อ → ไม่มีวงเล็บชื่อคนต่อท้าย", corporateBuyer.company, null);
  check(
    "สำเนาที่มีแต่ชื่อบริษัท ยังนับว่ามีสำเนา → ที่อยู่ไม่ไหลไปค่าสด",
    corporateBuyer.address,
    "1 ถ.เอกมัย\nกรุงเทพมหานคร",
  );

  // ── เก็บกวาด ───────────────────────────────────────────────────────────
  await prisma.invoice.deleteMany({ where: { orderId: order.id } });
  await prisma.order.delete({ where: { id: order.id } });
  await prisma.customer.delete({ where: { id: customer.id } });
  await prisma.invoice.deleteMany({ where: { orderId: corporateOrder.id } });
  await prisma.order.delete({ where: { id: corporateOrder.id } });
  await prisma.customer.delete({ where: { id: corporate.id } });

  console.log(`\n${fail === 0 ? "✅ ผ่านครบ" : "❌ ไม่ผ่าน"} — ${pass} ผ่าน / ${fail} ไม่ผ่าน`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
