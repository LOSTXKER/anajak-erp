import { describe, expect, it } from "vitest";
import { customMadeSpecFacts, hasCustomMadeSpec } from "./custom-made-spec";

const empty = {
  productType: "POLO", patternId: undefined, fabricType: "", material: "", fabricWeight: "",
  fabricColor: "", collarType: "", sleeveType: "", bodyFit: "", patternNote: "",
};

describe("สรุปสเปคตัดเย็บ (ป้าย + ค่า)", () => {
  it("ประเภทสินค้าอย่างเดียวไม่นับว่าระบุสเปคแล้ว (มีค่าตั้งต้นเสมอ)", () => {
    expect(hasCustomMadeSpec(empty)).toBe(false);
    expect(hasCustomMadeSpec({ ...empty, collarType: "POLO" })).toBe(true);
    expect(hasCustomMadeSpec({ ...empty, material: "  " })).toBe(false);
  });
  it("รวมชนิดผ้า ส่วนผสม น้ำหนัก เป็นป้าย 'ผ้า' เดียว และแปลรหัสเป็นคำไทย", () => {
    const facts = customMadeSpecFacts({ ...empty, fabricType: "TC", material: "TC", fabricWeight: "220 แกรม", collarType: "POLO", sleeveType: "SHORT", bodyFit: "REGULAR" }, "โปโลมาตรฐาน");
    expect(facts.map((f) => `${f.label}=${f.value}`)).toEqual([
      "ประเภท=เสื้อโปโล",
      "แพทเทิร์น=โปโลมาตรฐาน",
      "ผ้า=TC (65/35) TC 220 แกรม",
      "คอ=คอโปโล",
      "แขน=แขนสั้น",
      "ทรง=Regular",
    ]);
  });
  it("ช่องว่างไม่โผล่ · หมายเหตุกินเต็มแถว", () => {
    const facts = customMadeSpecFacts({ ...empty, patternNote: "ขลิบปกขาว" });
    expect(facts).toEqual([
      { label: "ประเภท", value: "เสื้อโปโล" },
      { label: "หมายเหตุแพทเทิร์น", value: "ขลิบปกขาว", wide: true },
    ]);
  });
});
