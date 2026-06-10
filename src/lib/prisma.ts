import { PrismaClient } from "@prisma/client";

// เงินทุก field ใน DB เป็น Decimal(12,2) — แปลงเป็น number ที่ขอบเขต Prisma ชั้นเดียวตรงนี้
// โค้ดชั้นบน (router/UI) ใช้ number ตามเดิม · การคำนวณเงินฝั่งเขียนทำผ่าน services ด้วย Decimal
// หมายเหตุ: result extension ไม่ครอบ aggregate/groupBy — จุดพวกนั้นต้องแปลงเองที่ call site
const createPrismaClient = () =>
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  }).$extends({
    name: "money-decimal-to-number",
    result: {
      customer: {
        totalSpent: { needs: { totalSpent: true }, compute: (c) => c.totalSpent.toNumber() },
        creditLimit: { needs: { creditLimit: true }, compute: (c) => c.creditLimit?.toNumber() ?? null },
      },
      order: {
        subtotalItems: { needs: { subtotalItems: true }, compute: (o) => o.subtotalItems.toNumber() },
        subtotalFees: { needs: { subtotalFees: true }, compute: (o) => o.subtotalFees.toNumber() },
        discount: { needs: { discount: true }, compute: (o) => o.discount.toNumber() },
        taxRate: { needs: { taxRate: true }, compute: (o) => o.taxRate.toNumber() },
        taxAmount: { needs: { taxAmount: true }, compute: (o) => o.taxAmount.toNumber() },
        totalAmount: { needs: { totalAmount: true }, compute: (o) => o.totalAmount.toNumber() },
        totalCost: { needs: { totalCost: true }, compute: (o) => o.totalCost.toNumber() },
        platformFee: { needs: { platformFee: true }, compute: (o) => o.platformFee?.toNumber() ?? null },
      },
      orderItem: {
        subtotal: { needs: { subtotal: true }, compute: (i) => i.subtotal.toNumber() },
      },
      orderItemProduct: {
        baseUnitPrice: { needs: { baseUnitPrice: true }, compute: (p) => p.baseUnitPrice.toNumber() },
        discount: { needs: { discount: true }, compute: (p) => p.discount.toNumber() },
        subtotal: { needs: { subtotal: true }, compute: (p) => p.subtotal.toNumber() },
      },
      orderItemPrint: {
        unitPrice: { needs: { unitPrice: true }, compute: (p) => p.unitPrice.toNumber() },
      },
      orderItemAddon: {
        unitPrice: { needs: { unitPrice: true }, compute: (a) => a.unitPrice.toNumber() },
      },
      orderFee: {
        amount: { needs: { amount: true }, compute: (f) => f.amount.toNumber() },
      },
      serviceCatalog: {
        defaultPrice: { needs: { defaultPrice: true }, compute: (s) => s.defaultPrice.toNumber() },
      },
      quotation: {
        subtotal: { needs: { subtotal: true }, compute: (q) => q.subtotal.toNumber() },
        discount: { needs: { discount: true }, compute: (q) => q.discount.toNumber() },
        tax: { needs: { tax: true }, compute: (q) => q.tax.toNumber() },
        totalAmount: { needs: { totalAmount: true }, compute: (q) => q.totalAmount.toNumber() },
      },
      quotationItem: {
        unitPrice: { needs: { unitPrice: true }, compute: (i) => i.unitPrice.toNumber() },
        totalPrice: { needs: { totalPrice: true }, compute: (i) => i.totalPrice.toNumber() },
      },
      product: {
        basePrice: { needs: { basePrice: true }, compute: (p) => p.basePrice.toNumber() },
        costPrice: { needs: { costPrice: true }, compute: (p) => p.costPrice?.toNumber() ?? null },
      },
      productVariant: {
        priceAdj: { needs: { priceAdj: true }, compute: (v) => v.priceAdj.toNumber() },
        sellingPrice: { needs: { sellingPrice: true }, compute: (v) => v.sellingPrice.toNumber() },
        costPrice: { needs: { costPrice: true }, compute: (v) => v.costPrice.toNumber() },
      },
      delivery: {
        shippingCost: { needs: { shippingCost: true }, compute: (d) => d.shippingCost.toNumber() },
      },
      costEntry: {
        amount: { needs: { amount: true }, compute: (c) => c.amount.toNumber() },
        unitCost: { needs: { unitCost: true }, compute: (c) => c.unitCost?.toNumber() ?? null },
      },
      production: {
        totalCost: { needs: { totalCost: true }, compute: (p) => p.totalCost.toNumber() },
      },
      materialUsage: {
        unitCost: { needs: { unitCost: true }, compute: (m) => m.unitCost.toNumber() },
        totalCost: { needs: { totalCost: true }, compute: (m) => m.totalCost.toNumber() },
      },
      productionStep: {
        estimatedCost: { needs: { estimatedCost: true }, compute: (s) => s.estimatedCost?.toNumber() ?? null },
        actualCost: { needs: { actualCost: true }, compute: (s) => s.actualCost?.toNumber() ?? null },
      },
      outsourceOrder: {
        unitCost: { needs: { unitCost: true }, compute: (o) => o.unitCost.toNumber() },
        totalCost: { needs: { totalCost: true }, compute: (o) => o.totalCost.toNumber() },
      },
      invoice: {
        amount: { needs: { amount: true }, compute: (i) => i.amount.toNumber() },
        discount: { needs: { discount: true }, compute: (i) => i.discount.toNumber() },
        tax: { needs: { tax: true }, compute: (i) => i.tax.toNumber() },
        totalAmount: { needs: { totalAmount: true }, compute: (i) => i.totalAmount.toNumber() },
      },
      payment: {
        amount: { needs: { amount: true }, compute: (p) => p.amount.toNumber() },
      },
      billingNote: {
        totalAmount: { needs: { totalAmount: true }, compute: (b) => b.totalAmount.toNumber() },
      },
      billingNoteItem: {
        amount: { needs: { amount: true }, compute: (i) => i.amount.toNumber() },
      },
    },
  });

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

// type ของ client ภายใน $transaction(async (tx) => ...) — ใช้ใน services ที่ต้องรันใน transaction
export type PrismaTx = Omit<
  ExtendedPrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
