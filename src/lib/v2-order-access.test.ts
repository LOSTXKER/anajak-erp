import { describe, expect, it } from "vitest";
import { canCreateOrderWithPricing } from "./v2-order-access";

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
});
