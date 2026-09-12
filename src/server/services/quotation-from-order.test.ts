import { describe, expect, it, vi } from "vitest";
import { quotationFromOrder } from "./quotation-from-order";
import { computeOrderTotals, computeQuotationTotals } from "./pricing";
import { calculateQuotationSummary } from "@/lib/pricing";
import { quotationRouter } from "@/server/routers/quotation";
import type { Context } from "@/server/trpc";

const item = (subtotal: number, quantity = 10) => ({ description: "เสื้อพร้อมพิมพ์", totalQuantity: quantity, subtotal, products: [{ description: "เสื้อขาว" }] });

describe("quotation from existing order", () => {
  it("copies every fee, discount and recorded VAT without adding platform fees", () => {
    const order = {
      items: [item(10200, 60)], fees: [{ name: "ค่าเตรียมแบบ", amount: 500 }, { name: "ค่าส่ง", amount: 100.5 }],
      discount: 200.25, taxAmount: 742.02, paymentTerms: "NET_30", platformFee: 200,
    };
    const quote = quotationFromOrder(order);
    const canonical = computeOrderTotals({ itemSubtotals: [10200], feeAmounts: [500, 100.5], discount: 200.25, taxRate: 7 });
    expect(quote.items.map((line) => [line.name, line.quantity, line.unitPrice])).toEqual([
      ["เสื้อพร้อมพิมพ์", 60, 170], ["ค่าเตรียมแบบ", 1, 500], ["ค่าส่ง", 1, 100.5],
    ]);
    expect(quote).toMatchObject({ subtotal: 10800.5, discount: 200.25, tax: 742.02, totalAmount: 11342.27, terms: "เครดิต 30 วัน" });
    expect(quote.totalAmount).toBe(canonical.totalAmount);
    expect(quote.lineTotals.reduce((sum, amount) => sum + amount, 0)).toBe(quote.subtotal);
  });

  it("keeps the exact order amount when a per-piece price cannot represent it in cents", () => {
    const quote = quotationFromOrder({ items: [item(100, 3)], fees: [], discount: 0, taxAmount: 7, paymentTerms: null });
    expect(quote.items[0]).toMatchObject({ quantity: 1, unit: "งาน", unitPrice: 100 });
    expect(quote.items[0].description).toContain("รวม 3 ชิ้น");
    expect(quote.totalAmount).toBe(107);
  });

  it("fee-only orders and zero VAT keep their source amounts", () => {
    const quote = quotationFromOrder({ items: [], fees: [{ name: "ค่าบริการ", amount: 1500 }], discount: 50, taxAmount: 0, paymentTerms: "FULL_PREPAY" });
    expect(quote).toMatchObject({ subtotal: 1500, discount: 50, tax: 0, totalAmount: 1450 });
    expect(quote.items).toHaveLength(1);
  });

  it.each([
    ["NET_30", "เครดิต 30 วัน"],
    ["DEPOSIT_50", "มัดจำ 50%"],
    ["FULL_PREPAY", "ชำระเต็มจำนวนล่วงหน้า"],
    ["จ่ายมัดจำก่อน 2,000 บาท\nส่วนที่เหลือจ่ายวันรับของ", "จ่ายมัดจำก่อน 2,000 บาท\nส่วนที่เหลือจ่ายวันรับของ"],
    ["LEGACY_CUSTOM_TERMS", "LEGACY_CUSTOM_TERMS"],
    ["__proto__", "__proto__"],
    [null, ""],
  ])("renders customer-readable terms for %s without changing free text", (paymentTerms, expected) => {
    const quote = quotationFromOrder({ items: [item(100)], fees: [], discount: 0, taxAmount: 0, paymentTerms });
    expect(quote.terms).toBe(expected);
    expect(quote.totalAmount).toBe(100);
  });

  it.each([1.005, 33.335, 0.105, 99999.995, 1e-7])("preview and saved unit prices agree for %s", (unitPrice) => {
    const input = { items: [{ quantity: 3, unitPrice }], discount: 0.005, tax: 0.005 };
    const canonical = computeQuotationTotals(input);
    const preview = calculateQuotationSummary(input);
    expect(preview.lineTotals).toEqual(canonical.lineTotals);
    expect(preview.subtotal).toBe(canonical.subtotal);
    expect(preview.total).toBe(canonical.totalAmount);
  });

  it("preview endpoint requires the effective money permission and rejects orders past inquiry", async () => {
    const source = { id: "o1", orderNumber: "ORD-1", customerId: "c1", customer: { name: "ลูกค้า" }, internalStatus: "INQUIRY", items: [item(10200, 60)], fees: [{ name: "ค่าแบบ", amount: 500 }], discount: 0, taxAmount: 749, paymentTerms: "NET_30" };
    const readOrder = vi.fn().mockResolvedValue(source);
    const ctx = { prisma: { order: { findUniqueOrThrow: readOrder } }, userId: "u1", userRole: "SALES", permissionOverrides: null } as unknown as Context;
    const quote = await quotationRouter.createCaller(ctx).previewFromOrder({ id: "o1" });
    expect(quote).toMatchObject({ customerId: "c1", totalAmount: 11449, subtotal: 10700, terms: "เครดิต 30 วัน" });
    await expect(quotationRouter.createCaller({ ...ctx, permissionOverrides: { see_order_money: false } }).previewFromOrder({ id: "o1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    readOrder.mockResolvedValue({ ...source, internalStatus: "CONFIRMED" });
    await expect(quotationRouter.createCaller(ctx).previewFromOrder({ id: "o1" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
