import { describe, expect, it } from "vitest";
import {
  canCreateOrderWithPricing,
  canEditOrderWithPricing,
} from "./order-access";

describe("order create access", () => {
  it("เปิดฟอร์มเมื่อมีทั้งสิทธิ์สร้างเอกสารขายและเห็นเงิน", () => {
    expect(
      canCreateOrderWithPricing(["create_sales_docs", "see_order_money"]),
    ).toBe(true);
  });

  it("fail closed ระหว่างโหลดหรือเมื่อถูกตัดสิทธิ์เห็นเงิน", () => {
    expect(canCreateOrderWithPricing(undefined)).toBe(false);
    expect(canCreateOrderWithPricing(["create_sales_docs"])).toBe(false);
    expect(canCreateOrderWithPricing(["see_order_money"])).toBe(false);
  });

  it("ฟอร์มแก้ทั้งใบใช้ gate คู่เดียวกับฟอร์มสร้าง", () => {
    expect(
      canEditOrderWithPricing(["create_sales_docs", "see_order_money"]),
    ).toBe(true);
    expect(canEditOrderWithPricing(["create_sales_docs"])).toBe(false);
    expect(canEditOrderWithPricing(["see_order_money"])).toBe(false);
    expect(canEditOrderWithPricing(undefined)).toBe(false);
  });
});
