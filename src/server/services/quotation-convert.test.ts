import { describe, it, expect } from "vitest";
import {
  assertQuotationConvertible,
  convertCommitAmount,
  deriveOrderTaxRate,
  quotationSkeletonItems,
} from "./quotation-convert";

const DAY_MS = 24 * 60 * 60 * 1000;

const quote = (status: string, validUntil: Date) => ({ status, validUntil });

describe("assertQuotationConvertible", () => {
  it("สถานะที่ไม่ใช่ ACCEPTED → ปฏิเสธ (ต้องอนุมัติก่อนแปลง)", () => {
    const future = new Date(Date.now() + 7 * DAY_MS);
    for (const status of ["DRAFT", "SENT", "CONVERTED", "REJECTED"]) {
      expect(() => assertQuotationConvertible(quote(status, future))).toThrow(
        /อนุมัติก่อนแปลง/
      );
    }
  });

  it("ACCEPTED แต่หมดอายุ (เมื่อวานซืน) → ปฏิเสธ", () => {
    expect(() =>
      assertQuotationConvertible(quote("ACCEPTED", new Date(Date.now() - 2 * DAY_MS)))
    ).toThrow(/หมดอายุแล้ว/);
  });

  it("ACCEPTED + validUntil = วันนี้ (เที่ยงคืน) → ผ่าน — ใบใช้ได้ทั้งวัน validUntil", () => {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    expect(() =>
      assertQuotationConvertible(quote("ACCEPTED", todayMidnight))
    ).not.toThrow();
  });

  it("ACCEPTED + ยังไม่หมดอายุ → ผ่าน", () => {
    expect(() =>
      assertQuotationConvertible(quote("ACCEPTED", new Date(Date.now() + 7 * DAY_MS)))
    ).not.toThrow();
  });
});

describe("convertCommitAmount", () => {
  it("ออเดอร์ผูกที่มีรายการแล้ว → ผูกพันด้วยยอดออเดอร์", () => {
    expect(
      convertCommitAmount({
        linkedOrder: { totalAmount: 9000, itemCount: 3 },
        quotationTotal: 5000,
      })
    ).toBe(9000);
  });

  it("ออเดอร์ผูกเปิดเบา (fees ล้วน ไม่มีรายการ) → ผูกพันด้วยยอดใบเสนอ (เส้น B9)", () => {
    expect(
      convertCommitAmount({
        linkedOrder: { totalAmount: 999, itemCount: 0 },
        quotationTotal: 5000,
      })
    ).toBe(5000);
  });

  it("ใบเสนอลอย (ไม่ผูกออเดอร์) → ยอดใบเสนอ", () => {
    expect(convertCommitAmount({ linkedOrder: null, quotationTotal: 1234.56 })).toBe(
      1234.56
    );
  });
});

describe("deriveOrderTaxRate", () => {
  it("ภาษี 70 บนฐาน 1000 → อัตรา 7%", () => {
    expect(
      deriveOrderTaxRate({ subtotal: 1000, discount: 0, tax: 70 }).toNumber()
    ).toBe(7);
  });

  it("ไม่มีภาษี → 0", () => {
    expect(deriveOrderTaxRate({ subtotal: 1000, discount: 0, tax: 0 }).toNumber()).toBe(0);
  });

  it("ภาษีติดลบ (นอกสเปค — zod กันไว้แล้ว แต่ pin guard tax > 0) → 0", () => {
    expect(deriveOrderTaxRate({ subtotal: 1000, discount: 0, tax: -70 }).toNumber()).toBe(0);
  });

  it("ส่วนลดเต็มยอด (ฐานภาษี 0) + มีภาษี → 0 ไม่ throw (กันหารศูนย์)", () => {
    expect(
      deriveOrderTaxRate({ subtotal: 1000, discount: 1000, tax: 70 }).toNumber()
    ).toBe(0);
  });

  it("ส่วนลดเกินยอด (ฐานติดลบ) + มีภาษี → 0", () => {
    expect(
      deriveOrderTaxRate({ subtotal: 1000, discount: 1500, tax: 70 }).toNumber()
    ).toBe(0);
  });

  it("อัตราไม่ลงตัว → ปัด 2 ตำแหน่ง (half-up)", () => {
    // 33/990*100 = 3.3333... → 3.33
    expect(
      deriveOrderTaxRate({ subtotal: 990, discount: 0, tax: 33 }).toNumber()
    ).toBe(3.33);
  });
});

describe("quotationSkeletonItems", () => {
  const item = (over: Partial<Parameters<typeof quotationSkeletonItems>[0][number]> = {}) => ({
    name: "เสื้อสกรีน",
    description: null as string | null,
    quantity: 10,
    unitPrice: 100,
    totalPrice: 1000,
    ...over,
  });

  it("ไม่มี description → product.description = ชื่อรายการเฉยๆ (ไม่มี ' - ')", () => {
    const [it0] = quotationSkeletonItems([item()]);
    expect(it0.products.create[0].description).toBe("เสื้อสกรีน");
  });

  it("มี description → product.description = 'ชื่อ - รายละเอียด'", () => {
    const [it0] = quotationSkeletonItems([item({ description: "คอกลม สีดำ" })]);
    expect(it0.products.create[0].description).toBe("เสื้อสกรีน - คอกลม สีดำ");
  });

  it("โครงครบตามใบเสนอ: sortOrder ตามลำดับ · จ้างทำของ · variant FREE เดียว · ยอดตรงทั้งสองชั้น", () => {
    const items = quotationSkeletonItems([
      item(),
      item({ name: "โปโล", quantity: 5, unitPrice: 200, totalPrice: 1000 }),
    ]);
    expect(items.map((i) => i.sortOrder)).toEqual([0, 1]);
    for (const it0 of items) {
      expect(it0.taxLineType).toBe("HIRE_OF_WORK");
      expect(it0.products.create).toHaveLength(1);
      const product = it0.products.create[0];
      expect(product.sortOrder).toBe(0);
      expect(product.productType).toBe("OTHER");
      expect(product.variants.create).toEqual([
        { size: "FREE", quantity: it0.totalQuantity },
      ]);
      // ยอด/จำนวนชั้น product = ชั้น item เป๊ะ
      expect(product.totalQuantity).toBe(it0.totalQuantity);
      expect(product.subtotal).toBe(it0.subtotal);
    }
    expect(items[0].description).toBe("เสื้อสกรีน");
    expect(items[0].subtotal).toBe(1000);
    expect(items[0].products.create[0].baseUnitPrice).toBe(100);
    expect(items[1].description).toBe("โปโล");
    expect(items[1].products.create[0].baseUnitPrice).toBe(200);
  });
});
