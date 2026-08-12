import { describe, expect, it } from "vitest";
import {
  findActiveV2NavigationItem,
  resolveV2Href,
  v2NavigationPathname,
} from "./v2-navigation";

describe("V2 navigation routes", () => {
  it("พาเฉพาะหน้าออเดอร์ที่มี V2 แล้วเข้า prefix ใหม่", () => {
    expect(resolveV2Href("/orders")).toBe("/v2/orders");
    expect(resolveV2Href("/orders/new?next=quote")).toBe(
      "/v2/orders/new?next=quote",
    );
    expect(resolveV2Href("/orders/order-1?tab=money#billing")).toBe(
      "/v2/orders/order-1?tab=money#billing",
    );
  });

  it("ไม่เปลี่ยน route เดิมที่ยังไม่มี V2 หรือ path ที่ชื่อคล้ายกัน", () => {
    expect(resolveV2Href("/")).toBe("/v2");
    expect(resolveV2Href("/?from=palette#today")).toBe(
      "/v2?from=palette#today",
    );
    expect(resolveV2Href("/customers/customer-1")).toBe("/customers/customer-1");
    expect(resolveV2Href("/orders-new")).toBe("/orders-new");
    expect(resolveV2Href("/v2/orders/order-1")).toBe("/v2/orders/order-1");
  });

  it("แปลง V2 pathname ให้ registry กลางหา active item ถูก", () => {
    expect(v2NavigationPathname("/v2")).toBe("/");
    expect(v2NavigationPathname("/v2/")).toBe("/");
    expect(v2NavigationPathname("/v2/orders/new?next=quote")).toBe("/orders/new");

    expect(findActiveV2NavigationItem("/v2")?.id).toBe("dashboard");
    expect(findActiveV2NavigationItem("/v2/orders")?.id).toBe("orders");
    expect(findActiveV2NavigationItem("/v2/orders/new")?.id).toBe("orders");
    expect(findActiveV2NavigationItem("/v2/orders/order-1")?.id).toBe("orders");
  });

  it("ใช้ path boundary และไม่อ้างว่าหน้า V2 ที่ยังไม่มีเป็น active", () => {
    expect(findActiveV2NavigationItem("/v2/orders-new")).toBeUndefined();
    expect(findActiveV2NavigationItem("/v2/customers")).toBeUndefined();
  });
});
