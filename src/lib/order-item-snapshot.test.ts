import { describe, expect, it } from "vitest";
import { snapshotOrderItems } from "./order-item-snapshot";

/**
 * ภาพถ่ายรายการก่อนแก้ (งานแก้/เคลม ก้อน 0) — ของจริงถูก deleteMany ทิ้งทุกครั้งที่แก้รายการ
 * เทสต์นี้ล็อกว่า "ไซซ์ สี จำนวน และลาย" ยังอ่านย้อนได้จาก revision ไม่ใช่เหลือแต่ยอดเงิน
 */
describe("snapshotOrderItems", () => {
  it("เก็บไซซ์ สี จำนวน และลาย ของรายการเดิมไว้ครบ", () => {
    const snapshot = snapshotOrderItems([
      {
        description: "เสื้อทีมงานอีเวนต์",
        totalQuantity: 12,
        products: [
          {
            description: "เสื้อยืดคอกลม ดำ",
            baseUnitPrice: { toNumber: () => 180 },
            variants: [
              { size: "M", color: "ดำ", quantity: 5 },
              { size: "L", color: "ดำ", quantity: 7 },
            ],
          },
        ],
        prints: [
          { position: "FRONT", printType: "SILK_SCREEN" },
          { position: "BACK", printType: "DTF" },
        ],
      },
    ]);

    expect(snapshot).toEqual([
      {
        d: "เสื้อทีมงานอีเวนต์",
        q: 12,
        p: [
          {
            d: "เสื้อยืดคอกลม ดำ",
            u: 180,
            v: [
              { s: "M", c: "ดำ", q: 5 },
              { s: "L", c: "ดำ", q: 7 },
            ],
          },
        ],
        pr: ["FRONT · SILK_SCREEN", "BACK · DTF"],
      },
    ]);
  });

  it("ไม่ใส่คีย์สีเมื่อไม่มีสี และไม่ใส่คีย์ลายเมื่อไม่มีงานพิมพ์", () => {
    const [entry] = snapshotOrderItems([
      {
        description: "เสื้อเปล่า",
        totalQuantity: 3,
        products: [
          {
            description: "เสื้อยืด",
            baseUnitPrice: 90,
            variants: [{ size: "S", color: null, quantity: 3 }],
          },
        ],
        prints: [],
      },
    ]);

    expect(entry!.p[0]!.v[0]).toEqual({ s: "S", q: 3 });
    expect(entry).not.toHaveProperty("pr");
  });

  it("ทนกับรายการที่ไม่มี products/variants และกับ input ว่าง", () => {
    expect(snapshotOrderItems([])).toEqual([]);
    expect(snapshotOrderItems(null)).toEqual([]);
    expect(snapshotOrderItems(undefined)).toEqual([]);
    expect(
      snapshotOrderItems([{ description: null, totalQuantity: null, products: null, prints: null }])
    ).toEqual([{ d: "", q: 0, p: [] }]);
  });

  it("อ่านราคาได้ทั้ง Decimal ของ prisma, ตัวเลข และสตริง", () => {
    const [entry] = snapshotOrderItems([
      {
        description: "ชุดผสม",
        totalQuantity: 3,
        products: [
          { description: "a", baseUnitPrice: { toNumber: () => 12.5 }, variants: [{ size: "F", quantity: 1 }] },
          { description: "b", baseUnitPrice: "99.50", variants: [{ size: "F", quantity: 1 }] },
          { description: "c", baseUnitPrice: null, variants: [{ size: "F", quantity: 1 }] },
        ],
      },
    ]);

    expect(entry!.p.map((product) => product.u)).toEqual([12.5, 99.5, 0]);
  });
});
