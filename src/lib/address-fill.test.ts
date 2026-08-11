import { describe, expect, it } from "vitest";
import {
  EMPTY_ADDRESS_FILL,
  fillFromCustomer,
  fillFromOrderShipping,
  hasAddressContent,
  shouldClearShippingOnCustomerChange,
} from "./address-fill";

describe("fillFromCustomer — ที่อยู่ผู้ติดต่อ → ช่องที่อยู่จัดส่ง", () => {
  it("ลงได้แค่ช่องที่อยู่ ช่องย่อยต้องว่าง (โปรไฟล์ไม่มีตำบล/อำเภอแยก ห้ามเดา)", () => {
    expect(
      fillFromCustomer({ name: "คุณสมชาย", phone: "021234567", address: "88/12 ม.4 บางพลี" }),
    ).toEqual({
      recipientName: "คุณสมชาย",
      phone: "021234567",
      address: "88/12 ม.4 บางพลี",
      subDistrict: "",
      district: "",
      province: "",
      postalCode: "",
    });
  });

  it("นิติบุคคลใช้ชื่อบริษัทเป็นชื่อผู้รับ (ของถึงบริษัท ไม่ใช่ชื่อคนที่คุยแชท)", () => {
    expect(fillFromCustomer({ name: "คุณสมชาย", company: "สยามเท็กซ์" }).recipientName).toBe(
      "สยามเท็กซ์",
    );
  });

  it("ตัดช่องว่างหัวท้าย และรับ null/undefined ได้", () => {
    expect(fillFromCustomer({ name: "  ก  ", address: "  " }).recipientName).toBe("ก");
    expect(fillFromCustomer({ name: "  ก  ", address: "  " }).address).toBe("");
    expect(fillFromCustomer(null)).toEqual(EMPTY_ADDRESS_FILL);
    expect(fillFromCustomer(undefined)).toEqual(EMPTY_ADDRESS_FILL);
  });
});

describe("fillFromOrderShipping — ที่อยู่จัดส่งบนใบงาน → ช่องที่อยู่", () => {
  it("ก๊อปครบทั้ง 7 ช่อง", () => {
    expect(
      fillFromOrderShipping({
        shippingRecipientName: "สยามเท็กซ์",
        shippingPhone: "021234567",
        shippingAddress: "88/12 ม.4",
        shippingSubDistrict: "บางพลีใหญ่",
        shippingDistrict: "บางพลี",
        shippingProvince: "สมุทรปราการ",
        shippingPostalCode: "10540",
      }),
    ).toEqual({
      recipientName: "สยามเท็กซ์",
      phone: "021234567",
      address: "88/12 ม.4",
      subDistrict: "บางพลีใหญ่",
      district: "บางพลี",
      province: "สมุทรปราการ",
      postalCode: "10540",
    });
  });

  it("ออเดอร์ที่ไม่มีที่อยู่จัดส่งได้ชุดว่าง", () => {
    expect(fillFromOrderShipping({})).toEqual(EMPTY_ADDRESS_FILL);
    expect(fillFromOrderShipping(null)).toEqual(EMPTY_ADDRESS_FILL);
  });
});

describe("hasAddressContent", () => {
  it("ชื่อผู้รับ/เบอร์อย่างเดียวไม่นับว่ามีที่อยู่", () => {
    expect(
      hasAddressContent({ ...EMPTY_ADDRESS_FILL, recipientName: "สยามเท็กซ์", phone: "021234567" }),
    ).toBe(false);
  });

  it("มีช่องที่อยู่ช่องใดช่องหนึ่งก็นับ", () => {
    expect(hasAddressContent({ ...EMPTY_ADDRESS_FILL, address: "88/12" })).toBe(true);
    expect(hasAddressContent({ ...EMPTY_ADDRESS_FILL, province: "สมุทรปราการ" })).toBe(true);
    expect(hasAddressContent(EMPTY_ADDRESS_FILL)).toBe(false);
  });
});

describe("shouldClearShippingOnCustomerChange", () => {
  it("ที่อยู่ที่ก๊อปมาจากลูกค้ารายเดิม ต้องล้างเมื่อสลับลูกค้า", () => {
    expect(shouldClearShippingOnCustomerChange("cust-a", "cust-b")).toBe(true);
    expect(shouldClearShippingOnCustomerChange("cust-a", null)).toBe(true);
  });

  it("ลูกค้าคนเดิมไม่ต้องล้าง (เลือกซ้ำ/หน้าโหลดใหม่)", () => {
    expect(shouldClearShippingOnCustomerChange("cust-a", "cust-a")).toBe(false);
  });

  it("ที่อยู่ที่พิมพ์เอง (ที่อยู่ไซต์งาน) ต้องรักษาไว้แม้เปลี่ยนลูกค้าวางบิล", () => {
    expect(shouldClearShippingOnCustomerChange(null, "cust-b")).toBe(false);
  });
});
