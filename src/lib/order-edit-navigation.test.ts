import { describe, expect, it } from "vitest";
import { buildOrderEditHref } from "./order-edit-navigation";

describe("buildOrderEditHref", () => {
  it("สร้าง URL แท็บรับเรื่องพร้อมจุดโฟกัสและแท็บขากลับ", () => {
    expect(
      buildOrderEditHref("order-1", {
        tab: "intake",
        focus: "shipping",
        returnTab: "overview",
      }),
    ).toBe(
      "/orders/order-1/edit?tab=intake&focus=shipping&returnTab=overview",
    );
  });

  it("ละ query ที่ไม่จำเป็นและ encode id ใน path", () => {
    expect(buildOrderEditHref("order/1", { tab: "items" })).toBe(
      "/orders/order%2F1/edit?tab=items",
    );
  });

  it("รองรับทุกแท็บของฟอร์มออเดอร์", () => {
    expect(
      ["intake", "items", "pricing", "attachments"].map((tab) =>
        buildOrderEditHref("order-1", {
          tab: tab as "intake" | "items" | "pricing" | "attachments",
          returnTab: "items",
        }),
      ),
    ).toEqual([
      "/orders/order-1/edit?tab=intake&returnTab=items",
      "/orders/order-1/edit?tab=items&returnTab=items",
      "/orders/order-1/edit?tab=pricing&returnTab=items",
      "/orders/order-1/edit?tab=attachments&returnTab=items",
    ]);
  });

  it("ปฏิเสธ id ว่างแทนการสร้าง path ที่กำกวม", () => {
    expect(() => buildOrderEditHref("  ", { tab: "intake" })).toThrow(
      "orderId is required",
    );
  });
});
