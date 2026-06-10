import { describe, it, expect } from "vitest";
import { priceOrderItems, computeOrderTotals, computeQuotationTotals } from "./pricing";
import { calculateOrderSummary } from "@/lib/pricing";

// เกราะของสูตรเงิน — แตะสูตรใน services/pricing.ts หรือ lib/pricing.ts ต้องผ่านไฟล์นี้ก่อน

describe("priceOrderItems", () => {
  const baseItem = {
    products: [
      { baseUnitPrice: 100, discount: 0, variants: [{ quantity: 10 }] },
    ],
    prints: [{ unitPrice: 20 }],
    addons: [{ pricingType: "PER_ORDER", unitPrice: 50 }],
  };

  it("คิดยอด item: ตัวเปล่า + สกรีนต่อชิ้น + addon ต่อออเดอร์", () => {
    const [item] = priceOrderItems([baseItem]);
    expect(item.totalQuantity).toBe(10);
    expect(item.products[0].subtotal).toBe(1000);
    expect(item.subtotal).toBe(1000 + 200 + 50);
  });

  it("ส่วนลดต่อสินค้าเกินราคา → ราคาสุทธิไม่ติดลบ (clamp 0)", () => {
    const [item] = priceOrderItems([
      {
        products: [{ baseUnitPrice: 50, discount: 80, variants: [{ quantity: 5 }] }],
        prints: [],
        addons: [],
      },
    ]);
    expect(item.products[0].subtotal).toBe(0);
    expect(item.subtotal).toBe(0);
  });

  it("addon PER_PIECE ใช้ quantity override ถ้ามี ไม่มีใช้จำนวนรวมของ item", () => {
    const [withOverride] = priceOrderItems([
      {
        products: [{ baseUnitPrice: 0, variants: [{ quantity: 10 }] }],
        prints: [],
        addons: [{ pricingType: "PER_PIECE", unitPrice: 5, quantity: 3 }],
      },
    ]);
    expect(withOverride.subtotal).toBe(15);

    const [noOverride] = priceOrderItems([
      {
        products: [{ baseUnitPrice: 0, variants: [{ quantity: 10 }] }],
        prints: [],
        addons: [{ pricingType: "PER_PIECE", unitPrice: 5 }],
      },
    ]);
    expect(noOverride.subtotal).toBe(50);
  });

  it("หลายสินค้าใน item เดียว: รวมจำนวน + สกรีนคิดจากจำนวนรวม", () => {
    const [item] = priceOrderItems([
      {
        products: [
          { baseUnitPrice: 100, variants: [{ quantity: 4 }] },
          { baseUnitPrice: 120, discount: 20, variants: [{ quantity: 6 }] },
        ],
        prints: [{ unitPrice: 10 }],
        addons: [],
      },
    ]);
    expect(item.totalQuantity).toBe(10);
    // 4×100 + 6×(120-20) + 10×10 = 400 + 600 + 100
    expect(item.subtotal).toBe(1100);
  });

  it("ราคามีเศษสตางค์ → ปัด 2 ตำแหน่งต่อบรรทัด", () => {
    const [item] = priceOrderItems([
      {
        products: [{ baseUnitPrice: 33.335, variants: [{ quantity: 3 }] }],
        prints: [],
        addons: [],
      },
    ]);
    // 3 × 33.335 = 100.005 → half-up = 100.01 (เลขฐาน Decimal ไม่ใช่ float)
    expect(item.products[0].subtotal).toBe(100.01);
  });
});

describe("computeOrderTotals — สูตร A (สูตรเดียวทั้งระบบ)", () => {
  it("เคสอ้างอิงเดียวกับ verify-p02: 1250 + 40 - 90 → VAT 7% = 84 → 1284", () => {
    const totals = computeOrderTotals({
      itemSubtotals: [1250],
      feeAmounts: [40],
      discount: 90,
      taxRate: 7,
    });
    expect(totals.subtotalItems).toBe(1250);
    expect(totals.subtotalFees).toBe(40);
    expect(totals.taxAmount).toBe(84);
    expect(totals.totalAmount).toBe(1284);
  });

  it("ภาษีปัดครึ่งสตางค์แบบ half-up (จุดที่ float คิดผิด)", () => {
    // ฐาน 107.50 × 7% = 7.525 → ต้องได้ 7.53
    // (float: 107.5*0.07 = 7.5249999... → ปัดผิดเป็น 7.52)
    const totals = computeOrderTotals({
      itemSubtotals: [107.5],
      feeAmounts: [],
      discount: 0,
      taxRate: 7,
    });
    expect(totals.taxAmount).toBe(7.53);
    expect(totals.totalAmount).toBe(115.03);
  });

  it("taxRate 0 → ไม่มีภาษี", () => {
    const totals = computeOrderTotals({
      itemSubtotals: [500],
      feeAmounts: [100],
      discount: 50,
      taxRate: 0,
    });
    expect(totals.taxAmount).toBe(0);
    expect(totals.totalAmount).toBe(550);
  });

  it("ส่วนลดเกินยอดรวม → ปฏิเสธ (กันฐานภาษีติดลบ)", () => {
    expect(() =>
      computeOrderTotals({ itemSubtotals: [100], feeAmounts: [], discount: 101, taxRate: 7 })
    ).toThrow(/ส่วนลดเกิน/);
  });

  it("ส่วนลดติดลบ → ปฏิเสธ (กันบวกยอดแฝง)", () => {
    expect(() =>
      computeOrderTotals({ itemSubtotals: [100], feeAmounts: [], discount: -1, taxRate: 0 })
    ).toThrow(/ส่วนลดติดลบ/);
  });

  it("ไม่มีช่องให้ platformFee เข้าสูตร — fee ของ marketplace ห้ามอยู่ในยอดบิล/ฐาน VAT", () => {
    // สัญญาของสูตร A: input มีแค่ 4 ช่องนี้ — เพิ่ม platformFee เข้า input = ผิดดีไซน์
    const totals = computeOrderTotals({
      itemSubtotals: [1000],
      feeAmounts: [],
      discount: 0,
      taxRate: 7,
    });
    expect(totals.totalAmount).toBe(1070); // ไม่ใช่ 1134.20 แบบสูตร B เดิมที่บวก pf 60
  });
});

describe("calculateOrderSummary (client preview) ต้อง mirror สูตร A ของ server", () => {
  const cases = [
    { itemSubtotals: [1250], feeAmounts: [40], discount: 90, taxRate: 7 },
    { itemSubtotals: [350], feeAmounts: [], discount: 0, taxRate: 0 },
    { itemSubtotals: [999.99, 0.01], feeAmounts: [100], discount: 0.5, taxRate: 7 },
    { itemSubtotals: [], feeAmounts: [1500], discount: 0, taxRate: 7 },
  ];

  it.each(cases)("server กับ client ให้ยอดตรงกัน (±0.01 จากการปัด): %j", (input) => {
    const server = computeOrderTotals(input);
    const client = calculateOrderSummary(input);
    expect(Math.abs(client.grandTotal - server.totalAmount)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(client.taxAmount - server.taxAmount)).toBeLessThanOrEqual(0.01);
    expect(client.subtotalItems).toBeCloseTo(server.subtotalItems, 2);
    expect(client.subtotalFees).toBeCloseTo(server.subtotalFees, 2);
  });
});

describe("computeQuotationTotals — ใบเสนอราคา (tax เป็นจำนวนบาท)", () => {
  it("subtotal จากรายการ + ส่วนลด + ภาษีบาท", () => {
    const totals = computeQuotationTotals({
      items: [
        { quantity: 10, unitPrice: 100 },
        { quantity: 2, unitPrice: 250 },
      ],
      discount: 100,
      tax: 70,
    });
    expect(totals.lineTotals).toEqual([1000, 500]);
    expect(totals.subtotal).toBe(1500);
    expect(totals.totalAmount).toBe(1470);
  });

  it("ส่วนลดเกินยอด → ยอดรวมไม่ติดลบ (clamp 0)", () => {
    const totals = computeQuotationTotals({
      items: [{ quantity: 1, unitPrice: 100 }],
      discount: 500,
      tax: 0,
    });
    expect(totals.totalAmount).toBe(0);
  });
});
