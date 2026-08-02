import { describe, expect, it } from "vitest";
import { hasActiveOrderListFilters } from "./order-list-ui";

describe("hasActiveOrderListFilters", () => {
  it("ไม่มีตัวกรอง = เป็น empty state ของข้อมูลใหม่", () => {
    expect(hasActiveOrderListFilters({})).toBe(false);
  });

  it.each([
    ["คำค้น", { search: "ORD-2607" }],
    ["ช่องทาง", { channel: "LINE" }],
    ["ประเภท", { orderType: "CUSTOM" }],
    ["สถานะ", { internalStatus: "ON_HOLD" }],
    ["ความเร่งด่วน", { attention: "overdue" }],
    ["วันที่เริ่ม", { createdAfter: "2026-08-01" }],
    ["วันที่สิ้นสุด", { createdBefore: "2026-08-31" }],
  ])("%s ทำให้ empty state เสนอการล้างตัวกรอง", (_label, filters) => {
    expect(hasActiveOrderListFilters(filters)).toBe(true);
  });
});
