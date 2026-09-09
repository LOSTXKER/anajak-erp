import { describe, expect, it } from "vitest";
import { qcStockAvailability } from "./qc";

describe("เสื้อสำรองสำหรับงานแก้ QC", () => {
  const lines = [
    { variantId: "stock-m", stockKey: "tee:M:black", spareAvailable: 1 },
    { variantId: "stock-l", stockKey: "tee:L:black", spareAvailable: 10 },
    { variantId: "customer-m", stockKey: null, spareAvailable: 0 },
    { variantId: "stock-m-second-print", stockKey: "tee:M:black", spareAvailable: 1 },
  ];
  it("สำรอง L10 ใช้แทน M ที่เสีย2 ไม่ได้", () => {
    expect(qcStockAvailability(lines, [{ variantId: "stock-m", qty: 2 }]))
      .toEqual({ required: 2, available: 1, shortage: 1 });
  });
  it("ออเดอร์ผสมแต่เสียเฉพาะเสื้อลูกค้าไม่ควรพักรอสต๊อก", () => {
    expect(qcStockAvailability(lines, [{ variantId: "customer-m", qty: 3 }]))
      .toEqual({ required: 0, available: 0, shortage: 0 });
  });
  it("คนละรายการพิมพ์แต่ใช้เสื้อ SKU เดียวกันห้ามนับสำรองกองเดียวซ้ำ", () => {
    expect(qcStockAvailability(lines, [
      { variantId: "stock-m", qty: 1 }, { variantId: "stock-m-second-print", qty: 1 },
    ])).toEqual({ required: 2, available: 1, shortage: 1 });
  });
});
