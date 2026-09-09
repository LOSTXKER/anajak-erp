import { describe, expect, it } from "vitest";
import { assertStandardItem, assertStandardsTicked, assertStepReopenable, pieceQtyPlan, assertStepQuantitiesCounted } from "./work-order-form";
import { workOrderStandards } from "@/lib/work-order-standards";

describe("ด่านเช็คลิสต์ก่อนปิดขั้น", () => {
  const all = workOrderStandards("HEAT_PRESS");
  it("ติ๊กไม่ครบ = ปิดไม่ได้ บอกจำนวนที่เหลือ", () => {
    expect(() => assertStandardsTicked("HEAT_PRESS", all.slice(1))).toThrow("เหลืออีก 1 ข้อ");
  });
  it("ติ๊กครบ = ผ่าน · ข้อความเก่าที่ไม่อยู่ในรายการแล้วไม่นับ", () => {
    expect(() => assertStandardsTicked("HEAT_PRESS", [...all, "ข้อเก่า"])).not.toThrow();
    expect(() => assertStandardItem("HEAT_PRESS", "ข้อเก่า")).toThrow();
  });
});

describe("ย้อนขั้นที่ปิดแล้ว", () => {
  const evidence = { outsourceOrders: 0, goodsReceipts: 0, printRunItems: 0 };
  const step = { status: "COMPLETED", stepType: "HEAT_PRESS", sortOrder: 3 };
  it("ขั้นถัดไปยังไม่เริ่ม = ย้อนได้", () => {
    expect(() => assertStepReopenable({ step, siblings: [{ sortOrder: 4, status: "PENDING" }], evidence })).not.toThrow();
  });
  it("ขั้นถัดไปเริ่มแล้ว / มีใบส่งร้าน / ขั้นของ flow อื่น / ยังไม่ปิด = ย้อนไม่ได้", () => {
    expect(() => assertStepReopenable({ step, siblings: [{ sortOrder: 4, status: "IN_PROGRESS" }], evidence })).toThrow("ขั้นถัดไปเริ่มทำแล้ว");
    expect(() => assertStepReopenable({ step, siblings: [], evidence: { ...evidence, outsourceOrders: 1 } })).toThrow("ใบส่งร้าน");
    expect(() => assertStepReopenable({ step: { ...step, stepType: "DTF_PRINT" }, siblings: [], evidence })).toThrow("หลักฐานของระบบ");
    expect(() => assertStepReopenable({ step: { ...step, status: "IN_PROGRESS" }, siblings: [], evidence })).toThrow("ยังไม่ได้ปิด");
  });
});

describe("ยอดต่อแถว", () => {
  const variants = [
    { id: "v1", productId: "p1", description: "โปโล", sku: null, size: "S", color: "กรมท่า", quantity: 20 },
    { id: "v2", productId: "p1", description: "โปโล", sku: null, size: "M", color: "กรมท่า", quantity: 40 },
  ];
  it("รวมยอดทำแล้วเป็นยอดของขั้น + สร้าง scopeKey ต่อแถว", () => {
    const plan = pieceQtyPlan({ rows: [{ variantId: "v1", done: 20, waste: 0 }, { variantId: "v2", done: 15, waste: 2 }], variants, qtyTotal: 60 });
    expect(plan.qtyDone).toBe(35);
    expect(plan.lines[1]).toMatchObject({ scopeKey: "p1:v2:NO_PRINT", qtyGood: 15, qtyScrap: 2, qtyPlanned: 40 });
  });
  it("เกินจำนวนแถว / เกินยอดขั้น / แถวไม่รู้จัก / แถวซ้ำ = ปฏิเสธ", () => {
    expect(() => pieceQtyPlan({ rows: [{ variantId: "v1", done: 19, waste: 2 }], variants, qtyTotal: 60 })).toThrow("เกิน 20 ตัว");
    expect(() => pieceQtyPlan({ rows: [{ variantId: "v2", done: 40, waste: 0 }], variants, qtyTotal: 30 })).toThrow("ไม่เกิน 30 ตัว");
    expect(() => pieceQtyPlan({ rows: [{ variantId: "zz", done: 1, waste: 0 }], variants, qtyTotal: null })).toThrow("โหลดหน้าใหม่");
    expect(() => pieceQtyPlan({ rows: [{ variantId: "v1", done: 1, waste: 0 }, { variantId: "v1", done: 1, waste: 0 }], variants, qtyTotal: null })).toThrow("ซ้ำ");
  });
  it("งานแก้ M 2 ใช้แผน 2 ตัว ไม่ยืมยอด M 40 หรือไซซ์อื่นในออเดอร์", () => {
    const reworkQuantities = [{ sourceOrderItemVariantId: "v2", qtyPlanned: 2 }];
    const base = { variants, qtyTotal: 2, reworkQuantities };
    expect(pieceQtyPlan({ ...base, rows: [{ variantId: "v2", done: 1, waste: 1 }] }).lines[0])
      .toMatchObject({ qtyPlanned: 2, qtyGood: 1, qtyScrap: 1 });
    expect(() => pieceQtyPlan({ ...base, rows: [{ variantId: "v2", done: 3, waste: 0 }] })).toThrow("เกิน 2 ตัว");
    expect(() => pieceQtyPlan({ ...base, rows: [{ variantId: "v1", done: 1, waste: 0 }] })).toThrow("ไม่อยู่ในรายการ");
  });
});

describe("ปิดงานแก้ต้องบันทึกผลจริง", () => {
  it("จำนวนดีรวมดูครบแต่มีไซซ์ตกหล่นก็ปิดไม่ได้", () => {
    expect(() => assertStepQuantitiesCounted({ qtyTotal: 3, qtyDone: 3, quantities: [
      { qtyPlanned: 2, qtyGood: 2, qtyScrap: 0 }, { qtyPlanned: 1, qtyGood: 0, qtyScrap: 0 },
    ] })).toThrow("ครบทุกไซซ์");
  });
  it("ตรวจผลครบแล้วแม้แก้ไม่ผ่านบางตัวก็ส่งกลับ QC ได้", () => {
    expect(() => assertStepQuantitiesCounted({ qtyTotal: 3, qtyDone: 2, quantities: [
      { qtyPlanned: 2, qtyGood: 1, qtyScrap: 1 }, { qtyPlanned: 1, qtyGood: 1, qtyScrap: 0 },
    ] })).not.toThrow();
  });
});
