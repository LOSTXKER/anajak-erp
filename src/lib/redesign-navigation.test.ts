import { describe, expect, it } from "vitest";
import {
  redesignActiveNavigationId,
  redesignNavigationHref,
  redesignOrderHref,
  redesignOrderListHref,
} from "@/lib/redesign-navigation";

describe("redesign navigation", () => {
  it("keeps the connected prototype surfaces in the redesign world", () => {
    expect(redesignNavigationHref({ id: "dashboard", href: "/" })).toBe(
      "/redesign",
    );
    expect(redesignNavigationHref({ id: "orders", href: "/orders" })).toBe(
      "/redesign/orders",
    );
    expect(
      redesignNavigationHref({ id: "production", href: "/production" }),
    ).toBe("/redesign/production");
  });

  it("leaves unfinished prototype sections on canonical routes", () => {
    expect(
      redesignNavigationHref({ id: "billing", href: "/billing" }),
    ).toBe("/billing");
  });

  it("encodes workbench ids and preserves order-list query strings", () => {
    expect(redesignOrderHref("order/1")).toBe(
      "/redesign/orders/order%2F1",
    );
    expect(redesignOrderListHref("/orders?attention=stuck&page=2")).toBe(
      "/redesign/orders?attention=stuck&page=2",
    );
    expect(redesignOrderListHref("/orders/new")).toBe("/orders/new");
  });

  it("marks both registry and workbench routes as orders", () => {
    expect(redesignActiveNavigationId("/redesign")).toBe("dashboard");
    expect(redesignActiveNavigationId("/redesign/orders")).toBe("orders");
    expect(redesignActiveNavigationId("/redesign/orders/order-1")).toBe(
      "orders",
    );
    expect(redesignActiveNavigationId("/redesign/production")).toBe(
      "production",
    );
  });
});
