import { describe, it, expect } from "vitest";
import { customerProfileGaps } from "./customer-gaps";

describe("customerProfileGaps", () => {
  it("ลูกค้าแชทใหม่ (มีแค่ชื่อ) → ขาดติดต่อ + ที่อยู่", () => {
    const gaps = customerProfileGaps({});
    expect(gaps.map((g) => g.key)).toEqual(["contact", "address"]);
  });

  it("มี LINE ID ถือว่ามีช่องทางติดต่อแล้ว", () => {
    const gaps = customerProfileGaps({ lineId: "@somchai" });
    expect(gaps.map((g) => g.key)).toEqual(["address"]);
  });

  it("บุคคลธรรมดาครบ เบอร์+ที่อยู่ → ไม่ขาดอะไร (ไม่บังคับเลขภาษี)", () => {
    expect(
      customerProfileGaps({ phone: "0812345678", address: "กทม.", customerType: "INDIVIDUAL" })
    ).toEqual([]);
  });

  it("นิติบุคคลไม่มีเลขภาษี → ขาดข้อมูลใบกำกับ", () => {
    const gaps = customerProfileGaps({
      phone: "02",
      address: "กทม.",
      customerType: "CORPORATE",
    });
    expect(gaps.map((g) => g.key)).toEqual(["taxInfo"]);
  });

  it("นิติบุคคลมีเลขภาษี + ใช้ที่อยู่ทั่วไปแทนที่อยู่บิลได้", () => {
    expect(
      customerProfileGaps({
        phone: "02",
        address: "กทม.",
        customerType: "CORPORATE",
        taxId: "0105500000000",
      })
    ).toEqual([]);
  });
});
