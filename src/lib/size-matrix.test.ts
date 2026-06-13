import { describe, expect, it } from "vitest";
import { buildSizeVariants, sumVariantQty, matrixColumns } from "./size-matrix";

describe("buildSizeVariants", () => {
  it("เก็บเฉพาะไซส์ที่มีจำนวน > 0 + ใส่สีร่วม", () => {
    const r = buildSizeVariants([["S", 5], ["M", 0], ["L", 10]], "ดำ");
    expect(r).toEqual([
      { size: "S", color: "ดำ", quantity: 5 },
      { size: "L", color: "ดำ", quantity: 10 },
    ]);
  });
  it("ตัดไซส์ว่าง/จำนวน 0 ทิ้ง · trim ไซส์+สี", () => {
    expect(buildSizeVariants([[" XL ", 3], ["", 5], ["M", -1]], " แดง ")).toEqual([
      { size: "XL", color: "แดง", quantity: 3 },
    ]);
  });
  it("ไม่มีจำนวน → array ว่าง", () => {
    expect(buildSizeVariants([["S", 0], ["M", 0]], "ดำ")).toEqual([]);
  });
});

describe("sumVariantQty", () => {
  it("รวมจำนวนทุกไซส์", () => {
    expect(sumVariantQty([{ quantity: 5 }, { quantity: 10 }, { quantity: 3 }])).toBe(18);
    expect(sumVariantQty([])).toBe(0);
  });
});

describe("matrixColumns", () => {
  it("มาตรฐาน + ไซส์ใน variants + ไซส์ที่เพิ่ม (ไม่ซ้ำ case-insensitive)", () => {
    const cols = matrixColumns([{ size: "XS", color: "", quantity: 2 }, { size: "s", color: "", quantity: 1 }], ["4XL"]);
    expect(cols).toContain("XS");
    expect(cols).toContain("4XL");
    // S มาตรฐานมีแล้ว · "s" ใน variant ไม่ควรเพิ่มซ้ำ
    expect(cols.filter((c) => c.toUpperCase() === "S").length).toBe(1);
  });
});
