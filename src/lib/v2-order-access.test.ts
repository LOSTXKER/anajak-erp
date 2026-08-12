import { describe, expect, it } from "vitest";
import { canAccessV2OrderCreate } from "./v2-order-access";

describe("V2 order create access", () => {
  it("เปิดฟอร์มเมื่อมีทั้งสิทธิ์สร้างเอกสารขายและเห็นเงิน", () => {
    expect(
      canAccessV2OrderCreate(["create_sales_docs", "see_order_money"]),
    ).toBe(true);
  });

  it("fail closed ระหว่างโหลดหรือเมื่อถูกตัดสิทธิ์เห็นเงิน", () => {
    expect(canAccessV2OrderCreate(undefined)).toBe(false);
    expect(canAccessV2OrderCreate(["create_sales_docs"])).toBe(false);
    expect(canAccessV2OrderCreate(["see_order_money"])).toBe(false);
  });
});
