import { describe, it, expect } from "vitest";
import { buildReserveLines, toReserveLines, type MirrorProduct } from "./stock-reservation";

// สร้างบรรทัดจองจากเนื้อออเดอร์ — หัวใจคือ: เลือกเฉพาะ FROM_STOCK · จับคู่ variant
// แบบเดียวกับด่านเช็คสต๊อคตอนเปิดงาน · รวมยอดต่อ SKU · variant ไม่เจอ = จองระดับสินค้า+จดปัญหา

const mirror: MirrorProduct[] = [
  {
    id: "p1",
    sku: "TS-001",
    name: "เสื้อยืดคอกลม",
    variants: [
      { id: "v1", sku: "TS-001-S-BLACK", size: "S", color: "ดำ" },
      { id: "v2", sku: "TS-001-M-BLACK", size: "M", color: "ดำ" },
      { id: "v3", sku: "TS-001-M-WHITE", size: "M", color: "ขาว" },
    ],
  },
  {
    id: "p2",
    sku: "CAP-01",
    name: "หมวกแก๊ป",
    variants: [],
  },
];

// เทียบเฉพาะส่วนที่ยิงไป Stock API (sku/qty/note) — metadata เต็มทดสอบแยก
const apiLines = (r: ReturnType<typeof buildReserveLines>) => toReserveLines(r.lines);

describe("buildReserveLines", () => {
  it("จองรายไซส์-สีด้วย variant SKU และรวมยอดบรรทัดซ้ำ", () => {
    const r = buildReserveLines(
      [
        {
          itemSource: "FROM_STOCK",
          productId: "p1",
          description: "เสื้อยืด",
          variants: [
            { size: "S", color: "ดำ", quantity: 10 },
            { size: "M", color: "ดำ", quantity: 5 },
          ],
        },
        {
          itemSource: "FROM_STOCK",
          productId: "p1",
          description: "เสื้อยืด (อีกรายการ)",
          variants: [{ size: "M", color: "ดำ", quantity: 3 }],
        },
      ],
      mirror
    );
    expect(apiLines(r)).toEqual([
      { sku: "TS-001-S-BLACK", qty: 10 },
      { sku: "TS-001-M-BLACK", qty: 8 },
    ]);
    // metadata ครบสำหรับใบเบิก (garment-pick ใช้ตัวเดียวกัน)
    expect(r.lines[0]).toMatchObject({
      productId: "p1",
      variantId: "v1",
      productName: "เสื้อยืดคอกลม",
      size: "S",
      color: "ดำ",
    });
    expect(r.totalQty).toBe(18);
    expect(r.problems).toEqual([]);
  });

  it("ข้ามรายการที่ไม่ใช่ FROM_STOCK / ไม่มี productId / qty 0", () => {
    const r = buildReserveLines(
      [
        {
          itemSource: "CUSTOM_MADE",
          productId: "p1",
          description: "เสื้อสั่งเย็บ",
          variants: [{ size: "M", color: "ดำ", quantity: 100 }],
        },
        {
          itemSource: "FROM_STOCK",
          productId: null,
          description: "ของไม่มี product",
          variants: [{ size: "M", color: "ดำ", quantity: 5 }],
        },
        {
          itemSource: "FROM_STOCK",
          productId: "p1",
          description: "เสื้อยืด",
          variants: [{ size: "M", color: "ดำ", quantity: 0 }],
        },
      ],
      mirror
    );
    expect(r.lines).toEqual([]);
    expect(r.totalQty).toBe(0);
  });

  it("ไม่ระบุสี = จับ variant ตัวแรกที่ไซส์ตรง (กติกาเดียวกับด่านเช็คสต๊อคตอนเปิดงาน)", () => {
    const r = buildReserveLines(
      [
        {
          itemSource: "FROM_STOCK",
          productId: "p1",
          description: "เสื้อยืด",
          variants: [{ size: "M", color: null, quantity: 4 }],
        },
      ],
      mirror
    );
    expect(apiLines(r)).toEqual([{ sku: "TS-001-M-BLACK", qty: 4 }]);
  });

  it("variant ไม่เจอ → จองระดับสินค้า (product SKU) + จดปัญหา", () => {
    const r = buildReserveLines(
      [
        {
          itemSource: "FROM_STOCK",
          productId: "p1",
          description: "เสื้อยืด",
          variants: [{ size: "3XL", color: "เขียว", quantity: 2 }],
        },
        {
          itemSource: "FROM_STOCK",
          productId: "p2",
          description: "หมวก",
          variants: [{ size: "FREE", color: null, quantity: 6 }],
        },
      ],
      mirror
    );
    expect(apiLines(r)).toEqual([
      { sku: "TS-001", qty: 2, note: "ไม่พบ variant 3XL/เขียว — จองระดับสินค้า" },
      { sku: "CAP-01", qty: 6, note: "ไม่พบ variant FREE — จองระดับสินค้า" },
    ]);
    // จองระดับสินค้า = variantId null (ใบเบิกใช้แยกบรรทัด product-level)
    expect(r.lines.map((l) => l.variantId)).toEqual([null, null]);
    expect(r.problems).toHaveLength(2);
  });

  it("product ไม่อยู่ใน mirror (ยังไม่ sync) → ข้าม + จดปัญหา", () => {
    const r = buildReserveLines(
      [
        {
          itemSource: "FROM_STOCK",
          productId: "ghost",
          description: "ของหาย",
          variants: [{ size: "M", color: "ดำ", quantity: 1 }],
        },
      ],
      mirror
    );
    expect(r.lines).toEqual([]);
    expect(r.problems).toEqual(['ไม่พบสินค้า "ของหาย" ในข้อมูล sync จาก Stock']);
  });
});
