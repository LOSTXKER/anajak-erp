import { describe, expect, it } from "vitest";
import {
  addressLine,
  nullableAddressLine,
  nullablePostalCode,
  optionalAddressLine,
  optionalPostalCode,
  postalCode,
} from "./address-schema";

describe("addressLine", () => {
  it("ตัดช่องว่างหัวท้าย (คนก๊อปที่อยู่จากแชทมักติดช่องว่างมาด้วย)", () => {
    expect(addressLine().parse("  88/12 ม.4  ")).toBe("88/12 ม.4");
  });

  it("ยาวเกินกำหนดถูกปฏิเสธ — กันข้อความหลุดมาทั้งหน้าแล้วไปโผล่บนใบส่งของ", () => {
    expect(() => addressLine(10).parse("x".repeat(11))).toThrow();
    expect(addressLine(10).parse("x".repeat(10))).toBe("x".repeat(10));
  });

  it("ไม่บังคับรูปแบบที่อยู่ — ที่อยู่ไทยเขียนได้หลายแบบ", () => {
    expect(addressLine().parse("บ้านเลขที่ 5 หมู่บ้านสวนหลวง ซ.3")).toBe(
      "บ้านเลขที่ 5 หมู่บ้านสวนหลวง ซ.3",
    );
  });
});

describe("postalCode", () => {
  it("ต้องเป็นตัวเลข 5 หลักเท่านั้น", () => {
    expect(postalCode.parse("10540")).toBe("10540");
    expect(() => postalCode.parse("1054")).toThrow();
    expect(() => postalCode.parse("105401")).toThrow();
    expect(() => postalCode.parse("abcde")).toThrow();
  });

  it("ตัดช่องว่างก่อนตรวจ", () => {
    expect(postalCode.parse(" 10540 ")).toBe("10540");
  });
});

describe("optional* — ช่องที่ยังไม่รองรับการล้างค่า (คงสัญญา API เดิม)", () => {
  it("ไม่ส่งมาเลยก็ได้", () => {
    expect(optionalAddressLine().parse(undefined)).toBeUndefined();
    expect(optionalPostalCode.parse(undefined)).toBeUndefined();
  });

  it("รหัสไปรษณีย์ว่างผ่านได้ (ลูกค้าแชทมาทีหลัง) แต่มั่วไม่ผ่าน", () => {
    expect(optionalPostalCode.parse("")).toBe("");
    expect(() => optionalPostalCode.parse("999")).toThrow();
  });
});

describe("nullable* — ช่องที่ล้างค่าได้", () => {
  it('ช่องว่าง "" กลายเป็น null (ฐานข้อมูลจะได้ไม่มี "" ปนกับ null)', () => {
    expect(nullableAddressLine().parse("")).toBeNull();
    expect(nullableAddressLine().parse("   ")).toBeNull();
    expect(nullablePostalCode.parse("")).toBeNull();
  });

  it("null = ตั้งใจล้างค่า · undefined = ไม่แตะช่องนี้ (Prisma แยกสองอย่างนี้)", () => {
    expect(nullableAddressLine().parse(null)).toBeNull();
    expect(nullableAddressLine().parse(undefined)).toBeUndefined();
    expect(nullablePostalCode.parse(null)).toBeNull();
    expect(nullablePostalCode.parse(undefined)).toBeUndefined();
  });

  it("ค่าปกติผ่านตามเดิม", () => {
    expect(nullableAddressLine().parse(" 45 ม.3 ")).toBe("45 ม.3");
    expect(nullablePostalCode.parse("10540")).toBe("10540");
  });

  it("ไปรษณีย์มั่วยังถูกปฏิเสธแม้อยู่ในโหมดล้างค่าได้", () => {
    expect(() => nullablePostalCode.parse("1x5y0")).toThrow();
  });
});
