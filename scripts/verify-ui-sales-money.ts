import assert from "node:assert/strict";
import { prisma, type ExtendedPrismaClient } from "../src/lib/prisma";
import { validateDemoDatabaseUrl } from "../src/lib/demo-seed-plan";
import { productRouter } from "../src/server/routers/product";
import { quotationRouter } from "../src/server/routers/quotation";
import { computeOrderTotals } from "../src/server/services/pricing";
import type { Context } from "../src/server/trpc";

const prefix = `verify-ui-sales-${Date.now()}`;
const rollback = new Error("ROLLBACK_VERIFICATION_FIXTURES");
let quoteId: string | undefined;

async function main() {
  validateDemoDatabaseUrl(process.env.DATABASE_URL);
  assert.equal(process.env.ANAJAK_ERP_DEMO_MODE, "1");
  assert.equal(await prisma.setting.count({ where: { key: { in: ["stock_api_url", "stock_api_key"] } } }), 0);
  const owner = await prisma.user.findFirstOrThrow({ where: { role: "OWNER", isActive: true }, select: { id: true } });
  try {
    await prisma.$transaction(async (tx) => {
      // เรียก router จริงภายใน transaction ทดสอบเดียว เพื่อ rollback เลขเอกสารและ audit พร้อม fixture
      const transactionClient = new Proxy(tx, {
        get(target, property, receiver) {
          if (property === "$transaction") return (work: (client: typeof tx) => Promise<unknown>) => work(tx);
          return Reflect.get(target, property, receiver);
        },
      }) as unknown as ExtendedPrismaClient;
      const context: Context = { prisma: transactionClient, userId: owner.id, userRole: "OWNER", permissionOverrides: null };
      const customer = await tx.customer.create({ data: { id: `${prefix}-customer`, name: prefix } });
      const totals = computeOrderTotals({ itemSubtotals: [100], feeAmounts: [500, 100.5], discount: 10.25, taxRate: 7 });
      const order = await tx.order.create({ data: {
        id: `${prefix}-order`, orderNumber: prefix, customerId: customer.id, createdById: owner.id,
        internalStatus: "INQUIRY", paymentTerms: "NET_30", taxRate: 7, ...totals,
        items: { create: { description: "เสื้อสามตัวราคาเหมา", totalQuantity: 3, subtotal: 100 } },
        fees: { create: [{ feeType: "DESIGN_FEE", name: "ค่าเตรียมแบบ", amount: 500 }, { feeType: "DELIVERY", name: "ค่าส่ง", amount: 100.5 }] },
      } });
      const quotations = quotationRouter.createCaller(context);
      const preview = await quotations.previewFromOrder({ id: order.id });
      assert.equal(preview.totalAmount, totals.totalAmount);
      assert.equal(preview.totalAmount, 738.57);
      assert.deepEqual(preview.items.map((item) => item.unitPrice), [100, 500, 100.5]);
      assert.equal(preview.items[0].unit, "งาน");
      const created = await quotations.create({ customerId: customer.id, orderId: order.id, validUntil: "2027-12-31", terms: preview.terms, items: preview.items, discount: preview.discount, tax: preview.tax });
      quoteId = created.id;
      assert.equal(created.totalAmount, totals.totalAmount);
      assert.equal(created.items.reduce((sum, item) => sum + item.totalPrice, 0), created.subtotal);
      await quotations.updateDraft({ id: created.id, validUntil: "2027-12-31", items: [{ name: "ทดสอบสตางค์", quantity: 3, unit: "ชิ้น", unitPrice: 1.005 }], discount: 0, tax: 0 });
      const edited = await quotations.getById({ id: created.id });
      assert.equal(edited.items[0].unitPrice, 1.01);
      assert.equal(edited.items[0].totalPrice, 3.03);
      assert.equal(edited.totalAmount, 3.03);

      const product = await tx.product.create({ data: { id: `${prefix}-product`, sku: prefix, name: prefix, productType: "T_SHIRT", source: "STOCK", basePrice: 99.75, costPrice: 99.75, variants: { create: { id: `${prefix}-variant`, sku: `${prefix}-M`, size: "M", color: "ขาว", sellingPrice: 150.5, costPrice: 98.75, stock: 12, totalStock: 12 } } } });
      const salesContext: Context = { ...context, userRole: "SALES", permissionOverrides: { manage_settings: true, see_finance: false } };
      const sales = productRouter.createCaller(salesContext);
      const productResult = await sales.getById({ id: product.id });
      assert.equal(productResult.basePrice, 0);
      assert(!Object.hasOwn(productResult, "costPrice"));
      assert(!Object.hasOwn(productResult.variants[0], "costPrice"));
      const saved = await sales.updateVariant({ id: `${prefix}-variant`, priceAdj: 1.005 });
      assert.equal(saved.priceAdj, 1.01);
      assert.equal(saved.sellingPrice, 150.5);
      assert.equal(saved.stock, 12);
      assert(!Object.hasOwn(saved, "costPrice"));
      const finance = await productRouter.createCaller(context).getById({ id: product.id });
      assert.equal(finance.costPrice, 99.75);
      assert.equal(finance.variants[0].costPrice, 98.75);
      await assert.rejects(quotationRouter.createCaller({ ...salesContext, permissionOverrides: { see_order_money: false } }).previewFromOrder({ id: order.id }), { code: "FORBIDDEN" });
      console.log("ผ่าน: preview → สร้างใบเสนอ → แก้ร่าง, fee/discount/VAT/เศษสตางค์, สินค้า/ต้นทุน/override และราคาหลังบันทึก");
      throw rollback;
    }, { timeout: 30_000 });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    assert.equal(await prisma.customer.count({ where: { id: `${prefix}-customer` } }), 0);
    assert.equal(await prisma.order.count({ where: { id: `${prefix}-order` } }), 0);
    assert.equal(await prisma.product.count({ where: { id: `${prefix}-product` } }), 0);
    if (quoteId) assert.equal(await prisma.quotation.count({ where: { id: quoteId } }), 0);
  }
  console.log("rollback แล้ว: ไม่มี fixture ค้าง และเลขรัน/audit ใน transaction ไม่ถูกบันทึก");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
