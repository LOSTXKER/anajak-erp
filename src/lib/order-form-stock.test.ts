import { describe, it, expect } from "vitest";
import { mergeStockVariantsIntoItems } from "./order-form-stock";
import { EMPTY_ITEM, EMPTY_PRODUCT } from "@/types/order-form";
import type { OrderItemForm } from "@/types/order-form";
import type { SelectedVariantItem } from "@/components/product-picker";

// เกราะของกับดักสองข้อจาก review 2026-06-11:
// (1) item เป้าหมายที่เพิ่งกดเพิ่ม (ยังเปล่า) ห้ามถูกตัดทิ้งแล้วของไหลไป item แรก
// (2) dialog แก้รายการ (pruneEmpty: false) ห้ามลบ item จาก DB ที่ "ดูว่าง" เงียบๆ

function contentItem(description: string): OrderItemForm {
  return { ...structuredClone(EMPTY_ITEM), description };
}

function stockVariant(overrides?: Partial<SelectedVariantItem>): SelectedVariantItem {
  return {
    productId: "prod-1",
    productVariantId: "var-1",
    sku: "SKU-1",
    productSku: "SKU-1",
    name: "เสื้อคอกลม",
    productType: "T_SHIRT",
    basePrice: 100,
    costPrice: 60,
    size: "L",
    color: "ขาว",
    stock: 50,
    quantity: 5,
    ...overrides,
  };
}

describe("mergeStockVariantsIntoItems", () => {
  it("ของลง item เป้าหมายที่กางอยู่ แม้ item นั้นยังเปล่า (เพิ่งกดเพิ่มรายการ)", () => {
    const prev = [contentItem("งานเดิม A"), contentItem("งานเดิม B"), structuredClone(EMPTY_ITEM)];
    const { items, targetIdx } = mergeStockVariantsIntoItems(prev, [stockVariant()], 2);
    expect(items).toHaveLength(3);
    expect(targetIdx).toBe(2);
    expect(items[2].products[0]?.productId).toBe("prod-1");
    // item เดิมไม่ถูกแตะ
    expect(items[0].products).toHaveLength(0);
    expect(items[1].products).toHaveLength(0);
  });

  it("pruneEmpty default: ตัด item เปล่าอื่นทิ้ง แต่เป้าหมายรอดเสมอ", () => {
    const prev = [structuredClone(EMPTY_ITEM), contentItem("งานจริง"), structuredClone(EMPTY_ITEM)];
    const { items, targetIdx } = mergeStockVariantsIntoItems(prev, [stockVariant()], 2);
    // item เปล่าตัวแรกโดนตัด · เป้าหมาย (เปล่า) รอด
    expect(items).toHaveLength(2);
    expect(items[targetIdx].products[0]?.productId).toBe("prod-1");
    expect(items.some((it) => it.description === "งานจริง")).toBe(true);
  });

  it("pruneEmpty: false (dialog แก้รายการ) — item จาก DB ที่ดูว่างไม่ถูกลบ", () => {
    // แถวข้อมูลเก่า: ไม่มี description/ไซส์ มีแต่ราคา+จำนวน — "ดูว่าง" ตามเกณฑ์ แต่คือของจริง
    const legacy: OrderItemForm = {
      ...structuredClone(EMPTY_ITEM),
      products: [{ ...structuredClone(EMPTY_PRODUCT), baseUnitPrice: 99, variants: [{ size: "", color: "", quantity: 10 }] }],
    };
    const prev = [legacy, contentItem("งานหลัก")];
    const { items } = mergeStockVariantsIntoItems(prev, [stockVariant()], 1, {
      pruneEmpty: false,
    });
    expect(items).toHaveLength(2);
    expect(items[0].products[0]?.baseUnitPrice).toBe(99); // แถวเก่ายังอยู่
    expect(items[1].products.some((p) => p.productId === "prod-1")).toBe(true);
  });

  it("SKU+ไซส์+สีซ้ำใน item เดียวกัน → บวกจำนวนเข้าแถวเดิม ไม่เพิ่มแถวใหม่", () => {
    const first = mergeStockVariantsIntoItems([structuredClone(EMPTY_ITEM)], [stockVariant()], 0);
    const second = mergeStockVariantsIntoItems(first.items, [stockVariant({ quantity: 3 })], 0);
    expect(second.items[0].products).toHaveLength(1);
    expect(second.items[0].products[0].variants[0].quantity).toBe(8);
  });

  it("แถวเปล่าแถวแรกใน item เป้าหมาย → ถูกแทนที่ด้วยของจากสต๊อก (ไม่ทิ้งแถวค้าง)", () => {
    const withEmptyRow: OrderItemForm = {
      ...structuredClone(EMPTY_ITEM),
      description: "งานที่มีแถวเปล่า",
      products: [structuredClone(EMPTY_PRODUCT)],
    };
    const { items } = mergeStockVariantsIntoItems([withEmptyRow], [stockVariant()], 0);
    expect(items[0].products).toHaveLength(1);
    expect(items[0].products[0].productId).toBe("prod-1");
  });

  it("prev ว่าง → สร้าง item ใหม่ให้ ไม่ crash", () => {
    const { items, targetIdx } = mergeStockVariantsIntoItems([], [stockVariant()], null);
    expect(items).toHaveLength(1);
    expect(targetIdx).toBe(0);
    expect(items[0].products[0]?.productId).toBe("prod-1");
  });
});
