import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { DEMO_SEED_SCENARIOS, validateDemoDatabaseUrl } from "../src/lib/demo-seed-plan";
import { computeQuotationTotals } from "../src/server/services/pricing";
import { D, round2 } from "../src/server/services/money";

const apply = process.argv.includes("--apply");
const allowedIds = new Set(DEMO_SEED_SCENARIOS.map((scenario) => `demo-quotation-${scenario.key}`));
const include = { items: { orderBy: { sortOrder: "asc" as const } }, order: { include: { fees: true } } };
const readQuotes = () => prisma.quotation.findMany({ where: { id: { startsWith: "demo-quotation-" } }, include, orderBy: { quotationNumber: "asc" } });
type Quote = Awaited<ReturnType<typeof readQuotes>>[number];

function plan(quote: Quote) {
  assert(allowedIds.has(quote.id), `ไม่ใช่ใบเสนอจาก scenario demo: ${quote.id}`);
  const key = quote.id.slice("demo-quotation-".length);
  assert.equal(quote.orderId, `demo-order-${key}`, "ใบเสนอไม่ได้ผูกออเดอร์ demo เดียวกัน");
  assert(quote.order, "ไม่พบออเดอร์ demo");
  const lineTotal = round2(quote.items.reduce((sum, item) => sum.plus(item.totalPrice), D(0)));
  if (lineTotal.eq(quote.subtotal)) return null;
  const missingFees = quote.order.fees.filter((fee) => !quote.items.some((item) => item.name === fee.name && D(item.totalPrice).eq(fee.amount)));
  assert(missingFees.length > 0, `${quote.id}: ส่วนต่างไม่ได้มาจากค่าบริการที่ยังไม่มีรายการ`);
  const missingAmount = round2(missingFees.reduce((sum, fee) => sum.plus(fee.amount), D(0)));
  assert(lineTotal.plus(missingAmount).eq(quote.subtotal), `${quote.id}: ค่าบริการไม่ตรงส่วนต่าง ห้ามซ่อมอัตโนมัติ`);
  const additions = missingFees.map((fee, index) => ({
    id: `${quote.id}-fee-${index + 1}`,
    quotationId: quote.id,
    sortOrder: Math.max(-1, ...quote.items.map((item) => item.sortOrder)) + index + 1,
    name: fee.name,
    quantity: 1,
    unit: "รายการ",
    unitPrice: fee.amount,
    totalPrice: fee.amount,
  }));
  const checked = computeQuotationTotals({ items: [...quote.items, ...additions], discount: quote.discount, tax: quote.tax });
  assert(D(checked.subtotal).eq(quote.subtotal), `${quote.id}: subtotal หลังซ่อมไม่ตรงยอดใบเดิม`);
  assert(D(checked.totalAmount).eq(quote.totalAmount), `${quote.id}: ยอดสุทธิหลังซ่อมไม่ตรงยอดใบเดิม`);
  assert(quote.items.every((item, index) => D(item.totalPrice).eq(checked.lineTotals[index])), `${quote.id}: รายการเดิมมีราคาคูณจำนวนไม่ตรงยอด`);
  return { id: quote.id, document: quote.quotationNumber, itemSubtotalBefore: lineTotal.toNumber(), subtotal: quote.subtotal, totalAmount: quote.totalAmount, additions };
}

async function main() {
  validateDemoDatabaseUrl(process.env.DATABASE_URL);
  assert.equal(process.env.ANAJAK_ERP_DEMO_MODE, "1", "ต้องเปิดผ่านโหมด demo");
  assert.equal(await prisma.setting.count({ where: { key: { in: ["stock_api_url", "stock_api_key"] } } }), 0, "ฐาน demo ต้องไม่มีการเชื่อม Stock");
  const quotes = await readQuotes();
  const plans = quotes.map(plan).filter((value) => value !== null);
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", target: "127.0.0.1:5433/anajak_erp_demo", reviewed: quotes.length, repairs: plans }, null, 2));
  if (!apply) return;
  await prisma.$transaction(async (tx) => {
    for (const original of plans) {
      await tx.$queryRaw`SELECT id FROM quotations WHERE id = ${original.id} FOR UPDATE`;
      const current = await tx.quotation.findUniqueOrThrow({ where: { id: original.id }, include });
      assert.deepEqual(plan(current), original, "ข้อมูลเปลี่ยนหลัง dry-run ของรอบนี้ หยุดก่อนเขียน");
      await tx.quotationItem.createMany({ data: original.additions });
      const repaired = await tx.quotation.findUniqueOrThrow({ where: { id: original.id }, include });
      assert.equal(plan(repaired), null);
      assert.equal(repaired.totalAmount, original.totalAmount);
    }
  });
  console.log(`เพิ่มเฉพาะรายการค่าบริการที่ขาด ${plans.length} ใบ ยอดเอกสารทุกใบคงเดิม`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
