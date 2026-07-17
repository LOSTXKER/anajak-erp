import { describe, expect, it } from "vitest";
import {
  findActiveNavigationItem,
  navigationItemMatchesPath,
  navigationItemsForSurface,
  NAVIGATION_ITEMS,
} from "./navigation";

describe("navigation registry", () => {
  it("ใช้ exact match กับหน้า dashboard", () => {
    const dashboard = NAVIGATION_ITEMS.find((item) => item.id === "dashboard")!;
    expect(navigationItemMatchesPath(dashboard, "/")).toBe(true);
    expect(navigationItemMatchesPath(dashboard, "/orders")).toBe(false);
  });

  it("ใช้ path boundary ไม่จับ route ที่แค่ขึ้นต้นเหมือนกัน", () => {
    const orders = NAVIGATION_ITEMS.find((item) => item.id === "orders")!;
    expect(navigationItemMatchesPath(orders, "/orders/abc")).toBe(true);
    expect(navigationItemMatchesPath(orders, "/orders-new")).toBe(false);
  });

  it("เลือก route ที่ยาวและเจาะจงที่สุด", () => {
    expect(findActiveNavigationItem("/billing/notes/abc")?.id).toBe("billing-notes");
    expect(findActiveNavigationItem("/settings/stock")?.id).toBe("stock");
    expect(findActiveNavigationItem("/settings/patterns/abc")?.id).toBe("patterns");
  });

  it("label เป็นไทยแล้ว แต่คำอังกฤษเดิมยังค้นเจอผ่าน aliases (UX4.6)", () => {
    const dashboard = NAVIGATION_ITEMS.find((item) => item.id === "dashboard")!;
    expect(dashboard.label).toBe("แดชบอร์ด");
    expect(dashboard.aliases).toContain("dashboard");

    const outsource = NAVIGATION_ITEMS.find((item) => item.id === "outsource")!;
    expect(outsource.label).toBe("จ้างร้านนอก");
    expect(outsource.aliases).toContain("outsource");
  });

  it("กรอง surface และ permission จาก registry เดียว", () => {
    const noPermissions = navigationItemsForSurface("sidebar", []);
    expect(noPermissions.some((item) => item.id === "billing")).toBe(false);
    expect(noPermissions.some((item) => item.id === "factory")).toBe(false);
    expect(noPermissions.some((item) => item.id === "notifications")).toBe(false);

    const supervisor = navigationItemsForSurface("sidebar", ["supervise_operations"]);
    expect(supervisor.some((item) => item.id === "factory")).toBe(true);
  });
});
