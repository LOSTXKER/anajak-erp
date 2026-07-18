import { describe, expect, it } from "vitest";
import {
  buildShippingMutationInput,
  shouldPrefillShippingOnCustomerChange,
  validateShippingState,
  type ShippingState,
} from "./use-order-shipping";

const shipping: ShippingState = {
  recipientName: "ลูกค้าทดสอบ",
  phone: "0812345678",
  address: "99 ถนนสุขุมวิท",
  subDistrict: "คลองเตย",
  district: "คลองเตย",
  province: "กรุงเทพฯ",
  postalCode: "10110",
};

describe("optional shipping intent", () => {
  it("ไม่ validate หรือส่ง prefill เมื่อยังไม่ได้เลือกใช้ที่อยู่", () => {
    expect(validateShippingState(shipping, false)).toEqual([]);
    expect(buildShippingMutationInput(shipping, false)).toBeUndefined();
  });

  it("บังคับชื่อผู้รับและที่อยู่เมื่อเลือกใช้", () => {
    const partial = { ...shipping, recipientName: "", address: "" };
    expect(validateShippingState(partial, true)).toEqual([
      "กรุณาระบุชื่อผู้รับ (ที่อยู่จัดส่ง)",
      "กรุณาระบุที่อยู่จัดส่ง",
    ]);
  });

  it("ส่งที่อยู่ครบเมื่อผู้ใช้เลือกใช้", () => {
    expect(validateShippingState(shipping, true)).toEqual([]);
    expect(buildShippingMutationInput(shipping, true)).toEqual(shipping);
  });

  it("เปิดสวิตช์อย่างเดียวยัง prefill ลูกค้าใหม่ได้ แต่ข้อมูลที่พิมพ์เองต้องรักษาไว้", () => {
    expect(shouldPrefillShippingOnCustomerChange(false)).toBe(true);
    expect(shouldPrefillShippingOnCustomerChange(true)).toBe(false);
  });
});
