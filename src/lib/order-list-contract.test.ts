import { describe, expect, it } from "vitest";
import {
  ATTENTION_FILTERS,
  CHANNEL_FILTERS,
  DEFAULT_SORT,
  SORT_DEFAULT_DIRECTION,
  SORT_OPTIONS,
  TYPE_FILTERS,
  resolveOrderListSort,
  validDateParam,
} from "./order-list-contract";

describe("order list contract", () => {
  it("คงตัวเลือกตัวกรองที่หน้า orders ใช้ร่วมกัน", () => {
    expect(CHANNEL_FILTERS[0]).toEqual({ value: "", label: "ทุกช่องทาง" });
    expect(CHANNEL_FILTERS).toContainEqual({ value: "LINE", label: "LINE" });
    expect(TYPE_FILTERS[0]).toEqual({ value: "", label: "ทุกประเภท" });
    expect(TYPE_FILTERS).toContainEqual({ value: "CUSTOM", label: "สั่งทำ" });
    expect(ATTENTION_FILTERS).toEqual([
      { value: "", label: "ทุกงาน" },
      { value: "overdue", label: "เลยกำหนด" },
      { value: "due-soon", label: "ใกล้กำหนด 48 ชม." },
      { value: "stuck", label: "งานนิ่งเกิน 3 วัน" },
    ]);
  });

  it("กำหนด sort เริ่มต้นและทิศกดครั้งแรกเหมือนหน้าเดิม", () => {
    expect(DEFAULT_SORT).toBe("createdAt:desc");
    expect(SORT_OPTIONS).toEqual([
      { value: "createdAt:desc", label: "วันที่ (ล่าสุด)" },
      { value: "createdAt:asc", label: "วันที่ (เก่าสุด)" },
      { value: "deadline:asc", label: "กำหนดส่ง (ใกล้สุด)" },
      { value: "deadline:desc", label: "กำหนดส่ง (ไกลสุด)" },
      { value: "totalAmount:desc", label: "ยอดรวม (มาก→น้อย)" },
      { value: "totalAmount:asc", label: "ยอดรวม (น้อย→มาก)" },
      { value: "orderNumber:desc", label: "เลขออเดอร์ (ล่าสุด)" },
      { value: "orderNumber:asc", label: "เลขออเดอร์ (เก่าสุด)" },
    ]);
    expect(SORT_DEFAULT_DIRECTION).toEqual({
      orderNumber: "desc",
      totalAmount: "desc",
      createdAt: "desc",
      deadline: "asc",
    });
  });

  it.each([
    [null, ""],
    ["", ""],
    ["14-08-2026", ""],
    ["2026-13-01", ""],
    ["2026-02-29", ""],
    ["2026-02-31", ""],
    ["2026-04-31", ""],
    ["2028-02-29", "2028-02-29"],
    ["2026-08-14", "2026-08-14"],
  ])("ตรวจวันที่ %s เป็น %s", (rawDate, expected) => {
    expect(validDateParam(rawDate)).toBe(expected);
  });

  it("ใช้ default เมื่อไม่มี sort และยังแสดง sort ยอดเงินเมื่อมีสิทธิ์", () => {
    const result = resolveOrderListSort(undefined, true);

    expect(result).toMatchObject({
      sort: "createdAt:desc",
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    expect(
      result.sortOptions.some((option) => option.value === "totalAmount:asc"),
    ).toBe(true);
  });

  it("ยอมรับ sort ที่ถูกต้องทั้งผู้มีและไม่มีสิทธิ์ดูเงิน", () => {
    expect(resolveOrderListSort("totalAmount:asc", true)).toMatchObject({
      sort: "totalAmount:asc",
      sortBy: "totalAmount",
      sortOrder: "asc",
    });
    expect(resolveOrderListSort("orderNumber:asc", false)).toMatchObject({
      sort: "orderNumber:asc",
      sortBy: "orderNumber",
      sortOrder: "asc",
    });
  });

  it("ตัด sort ยอดเงินและ fallback อย่างปลอดภัยเมื่อไม่มีสิทธิ์", () => {
    const result = resolveOrderListSort("totalAmount:desc", false);

    expect(result).toMatchObject({
      sort: DEFAULT_SORT,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    expect(
      result.sortOptions.every(
        (option) => !option.value.startsWith("totalAmount"),
      ),
    ).toBe(true);
  });

  it("fallback เมื่อ sort จาก URL ไม่อยู่ใน contract", () => {
    expect(resolveOrderListSort("deadline:sideways", true)).toMatchObject({
      sort: DEFAULT_SORT,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  });
});
