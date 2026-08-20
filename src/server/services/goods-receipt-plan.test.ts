import { describe, it, expect } from "vitest";
import {
  netReceivedByVariant,
  netReceivedByProduct,
  variantNetKey,
  receiptInspectionOf,
  receiptInspectionOfVariants,
  assertValidReceiptLines,
  summarizeReceiptLines,
} from "./goods-receipt-plan";

describe("netReceivedByVariant / netReceivedByProduct — รับสุทธิ (รับ − คืน)", () => {
  const rows = [
    { orderItemProductId: "p1", size: "M", color: "ดำ", qtyCounted: 50, receiptType: "CUSTOMER_GARMENT" },
    { orderItemProductId: "p1", size: "M", color: "ดำ", qtyCounted: 10, receiptType: "SEWING_GARMENT" },
    { orderItemProductId: "p1", size: "M", color: "ดำ", qtyCounted: 5, receiptType: "CUSTOMER_RETURN" },
    { orderItemProductId: "p1", size: "L", color: "ดำ", qtyCounted: 30, receiptType: "CUSTOMER_GARMENT" },
    { orderItemProductId: null, size: "M", color: null, qtyCounted: 99, receiptType: "CUSTOMER_GARMENT" },
  ];

  it("ต่อ (สินค้า, ไซส์, สี): ใบคืนลูกค้าหักลบ · แถวไม่ผูกรายการสินค้าถูกข้าม", () => {
    const net = netReceivedByVariant(rows);
    expect(net.get(variantNetKey("p1", "M", "ดำ"))).toBe(55); // 50+10−5
    expect(net.get(variantNetKey("p1", "L", "ดำ"))).toBe(30);
    expect(net.size).toBe(2);
  });

  it("ต่อรายการสินค้า: รวมทุกไซส์/สี", () => {
    const net = netReceivedByProduct(rows);
    expect(net.get("p1")).toBe(85); // 55+30
    expect(net.size).toBe(1);
  });

  it("คืนมากกว่ารับ → สุทธิติดลบตามจริง (ไม่ clamp — เลขฟ้องว่าข้อมูลนับผิด)", () => {
    const net = netReceivedByProduct([
      { orderItemProductId: "p1", qtyCounted: 3, receiptType: "CUSTOMER_GARMENT" },
      { orderItemProductId: "p1", qtyCounted: 8, receiptType: "CUSTOMER_RETURN" },
    ]);
    expect(net.get("p1")).toBe(-5);
  });

  it("ไซส์/สี null เข้า key ว่าง — ไม่ชนกับไซส์จริง", () => {
    const net = netReceivedByVariant([
      { orderItemProductId: "p1", size: null, color: null, qtyCounted: 7, receiptType: "CUSTOMER_GARMENT" },
    ]);
    expect(net.get(variantNetKey("p1", null, null))).toBe(7);
    expect(net.get(variantNetKey("p1", "M", null))).toBeUndefined();
  });
});

describe("receiptInspectionOf — ติ๊กตรวจรับ (ด่านพร้อมผลิตใช้ flag นี้)", () => {
  it("รับสุทธิครบยอด (หรือเกิน) → ติ๊ก + โน้ตยอดล่าสุด", () => {
    expect(receiptInspectionOf(100, 100)).toEqual({
      receivedInspected: true,
      receiveNote: "รับสุทธิ 100/100",
    });
    expect(receiptInspectionOf(105, 100).receivedInspected).toBe(true);
  });

  it("ยังไม่ครบ → ไม่ติ๊ก (โน้ตยังอัปเดตให้เห็นความคืบหน้า)", () => {
    expect(receiptInspectionOf(99, 100)).toEqual({
      receivedInspected: false,
      receiveNote: "รับสุทธิ 99/100",
    });
  });

  it("ยอดงาน 0 → ห้ามติ๊กเอง (0 ≥ 0 แต่ไม่มีของให้รับจริง)", () => {
    expect(receiptInspectionOf(0, 0).receivedInspected).toBe(false);
  });
});

describe("receiptInspectionOfVariants — ครบทุกไซส์/สี", () => {
  const variants = [
    { size: "M", color: "ดำ", quantity: 10 },
    { size: "L", color: "ดำ", quantity: 10 },
  ];

  it("ยอดรวมครบแต่ M เกินกลบ L ที่ขาดไม่ได้", () => {
    const net = new Map([
      [variantNetKey("p1", "M", "ดำ"), 20],
      [variantNetKey("p1", "L", "ดำ"), 0],
    ]);
    expect(receiptInspectionOfVariants("p1", variants, net)).toEqual({
      receivedInspected: false,
      receiveNote: "รับสุทธิ 20/20",
    });
  });

  it("ครบทุก canonical variant จึงติ๊กพร้อมผลิต", () => {
    const net = new Map([
      [variantNetKey("p1", "M", "ดำ"), 11],
      [variantNetKey("p1", "L", "ดำ"), 10],
    ]);
    expect(receiptInspectionOfVariants("p1", variants, net).receivedInspected).toBe(true);
  });

  it("canonical key ซ้ำถูกรวม quantity ก่อนตัดสิน", () => {
    const net = new Map([[variantNetKey("p1", "M", null), 5]]);
    expect(receiptInspectionOfVariants("p1", [
      { size: "M", color: null, quantity: 5 },
      { size: "M", color: null, quantity: 5 },
    ], net).receivedInspected).toBe(false);
  });
});

describe("assertValidReceiptLines — ด่านกรอกใบตรวจรับ", () => {
  it("ทิ้งบรรทัดว่าง (นับ 0 + ตำหนิ 0) — บรรทัดมีแต่ตำหนิยังนับเป็นบรรทัดจริง", () => {
    const lines = assertValidReceiptLines([
      { qtyCounted: 10, defectQty: 0 },
      { qtyCounted: 0, defectQty: 0 },
      { qtyCounted: 0, defectQty: 2 },
    ]);
    expect(lines).toHaveLength(2);
  });

  it("เหลือ 0 บรรทัด → ปฏิเสธ", () => {
    expect(() => assertValidReceiptLines([{ qtyCounted: 0, defectQty: 0 }])).toThrow(
      "ยังไม่ได้นับของ — ระบุจำนวนอย่างน้อย 1 บรรทัด"
    );
  });

  it("Station เก็บแถวนับ 0 เป็นหลักฐานของขาดได้", () => {
    const lines = assertValidReceiptLines(
      [
        { qtyCounted: 0, defectQty: 0, size: "M" },
        { qtyCounted: 3, defectQty: 0, size: "L" },
      ],
      { preserveZeroLines: true, allowAllZero: true },
    );
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ size: "M", qtyCounted: 0 });
  });

  it("Station ยอมรับผลนับทั้งใบเป็น 0 เมื่อ caller เปิดโหมดหลักฐาน", () => {
    expect(assertValidReceiptLines(
      [{ qtyCounted: 0, defectQty: 0 }],
      { preserveZeroLines: true, allowAllZero: true },
    )).toHaveLength(1);
  });

  it("จำนวนไม่ใช่จำนวนเต็ม / ติดลบ → ปฏิเสธ (ทั้งฝั่งนับและฝั่งตำหนิ)", () => {
    expect(() => assertValidReceiptLines([{ qtyCounted: 1.5, defectQty: 0 }])).toThrow(
      "จำนวนต้องเป็นจำนวนเต็ม"
    );
    // qtyCounted ติดลบผ่าน filter ได้เมื่อ defectQty > 0 — ต้องโดนด่านติดลบ
    expect(() => assertValidReceiptLines([{ qtyCounted: -3, defectQty: 1 }])).toThrow(
      "จำนวนติดลบไม่ได้"
    );
    // ฝั่ง defectQty ของทั้งสองด่าน (review จับ: เดิมเทสแตะแต่ qtyCounted — ตัดเงื่อนไข
    // defectQty ทิ้งแล้วเทสยังเขียว)
    expect(() => assertValidReceiptLines([{ qtyCounted: 5, defectQty: 0.5 }])).toThrow(
      "จำนวนต้องเป็นจำนวนเต็ม"
    );
    expect(() => assertValidReceiptLines([{ qtyCounted: 5, defectQty: -1 }])).toThrow(
      "จำนวนติดลบไม่ได้"
    );
  });
});

describe("summarizeReceiptLines — ยอดรวม + ขาด/เกิน", () => {
  const lines = [
    { description: "เสื้อคอกลม", size: "M", color: "ดำ", qtyExpected: 50, qtyCounted: 48, defectQty: 1 },
    { description: "เสื้อคอกลม", size: "L", color: null, qtyExpected: 30, qtyCounted: 33, defectQty: 0 },
    { description: "เสื้อโปโล", size: null, color: null, qtyExpected: 20, qtyCounted: 20, defectQty: 2 },
  ];

  it("ใบรับ: นับรวม/ตำหนิรวม + ขาด/เกินเฉพาะแถวที่ไม่ตรงคาด (รูปแบบข้อความคงเดิม)", () => {
    const s = summarizeReceiptLines("CUSTOMER_GARMENT", lines);
    expect(s.totalCounted).toBe(101);
    expect(s.totalDefect).toBe(3);
    expect(s.discrepancies).toEqual(["เสื้อคอกลม M/ดำ: ขาด 2", "เสื้อคอกลม L: เกิน 3"]);
  });

  it("ใบคืนลูกค้า: ไม่มี concept ขาด/เกิน — discrepancies ว่างเสมอ", () => {
    const s = summarizeReceiptLines("CUSTOMER_RETURN", lines);
    expect(s.discrepancies).toEqual([]);
    expect(s.totalCounted).toBe(101);
  });

  it("แถวไม่มีไซส์ → ป้ายขาด/เกินไม่มีวรรคค้าง (แค่ชื่อ: ขาด n)", () => {
    const s = summarizeReceiptLines("CUSTOMER_GARMENT", [
      { description: "หมวก", size: null, color: null, qtyExpected: 10, qtyCounted: 8, defectQty: 0 },
    ]);
    expect(s.discrepancies).toEqual(["หมวก: ขาด 2"]);
  });
});
