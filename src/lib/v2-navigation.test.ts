import { describe, expect, it } from "vitest";
import {
  appendSearchParams,
  legacyV2PathToCanonical,
  legacyV2RedirectHref,
} from "./v2-navigation";

describe("legacy V2 redirects", () => {
  it("ย้าย root และ nested route ไป canonical path", () => {
    expect(legacyV2PathToCanonical("/v2")).toBe("/");
    expect(legacyV2PathToCanonical("/v2/")).toBe("/");
    expect(legacyV2PathToCanonical("/v2/orders")).toBe("/orders");
    expect(legacyV2PathToCanonical("/v2/orders/order-1")).toBe(
      "/orders/order-1",
    );
  });

  it("ไม่กิน path ที่แค่ชื่อคล้ายกัน", () => {
    expect(legacyV2PathToCanonical("/v20")).toBe("/v20");
    expect(legacyV2PathToCanonical("/orders")).toBe("/orders");
  });

  it("รักษา query ปกติและ query key ซ้ำ", () => {
    expect(
      appendSearchParams("/orders", {
        status: ["INQUIRY", "PRODUCING"],
        q: "Best งาน",
        empty: undefined,
      }),
    ).toBe(
      "/orders?status=INQUIRY&status=PRODUCING&q=Best+%E0%B8%87%E0%B8%B2%E0%B8%99",
    );
  });

  it("สร้างปลายทาง redirect พร้อม tab/filter เดิม", () => {
    expect(
      legacyV2RedirectHref("/v2/orders/order-1", {
        tab: "history",
        from: "2026-08-01",
      }),
    ).toBe("/orders/order-1?tab=history&from=2026-08-01");
  });
});
