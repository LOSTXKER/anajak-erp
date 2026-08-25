import { describe, expect, it } from "vitest";
import {
  findActiveNavigationItem,
  groupedNavigationItems,
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

    const station = NAVIGATION_ITEMS.find((item) => item.id === "station")!;
    expect(station.label).toBe("โหมดสถานี");
    expect(station.aliases).toContain("station");
  });

  it("กรอง surface และ permission จาก registry เดียว", () => {
    const noPermissions = navigationItemsForSurface("sidebar", []);
    expect(noPermissions.some((item) => item.id === "billing")).toBe(false);
    expect(noPermissions.some((item) => item.id === "station")).toBe(false);
    expect(noPermissions.some((item) => item.id === "notifications")).toBe(false);

    const supervisor = navigationItemsForSurface("sidebar", ["supervise_operations"]);
    expect(supervisor.some((item) => item.id === "station")).toBe(false);

    const operator = navigationItemsForSurface("sidebar", ["manage_production"]);
    expect(operator.some((item) => item.id === "station")).toBe(true);
  });

  it("จัด Sidebar เป็นหมวดครบและเรียงงานผลิตตามทางเดินจริง", () => {
    const groups = groupedNavigationItems("sidebar", [
      "see_order_money",
      "supervise_operations",
      "manage_billing_docs",
      "see_finance",
    ]);

    // หัวกลุ่มเหลือ 4 จาก 6 (UI-2026 เฟส 2) — กลุ่มที่มี 2 รายการถอดหัวข้อออก
    // แต่ยังเป็นกลุ่มเดิม ไม่ย้ายรายการ · ระยะห่างระหว่างกลุ่มแบ่งแทน
    expect(groups.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: "main", label: "ภาพรวม" },
      { id: "sales", label: "งานขาย" },
      { id: "production", label: "การผลิต" },
      { id: "products", label: null },
      { id: "finance", label: "การเงิน" },
      { id: "system", label: null },
    ]);
    // ลำดับและสมาชิกของทุกกลุ่มต้องไม่ขยับ — ที่เปลี่ยนคือหัวข้อเท่านั้น
    expect(groups.map((group) => group.id)).toEqual([
      "main",
      "sales",
      "production",
      "products",
      "finance",
      "system",
    ]);
    expect(groups.find((group) => group.id === "sales")?.items.map((item) => item.id)).toEqual([
      "orders",
      "quotations",
      "customers",
    ]);
    expect(
      groups.find((group) => group.id === "production")?.items.map((item) => item.id),
    ).toEqual(["production"]);
  });

  it("ซ่อนเฉพาะหมวดที่ไม่มีสิทธิ์ ไม่ซ่อนเมนูที่มีสิทธิ์ไว้หลัง disclosure", () => {
    const groups = groupedNavigationItems("sidebar", []);

    expect(groups.some((group) => group.id === "finance")).toBe(false);
    expect(groups.find((group) => group.id === "production")?.items.map((item) => item.id)).toEqual([
      "production",
    ]);

    const operatorGroups = groupedNavigationItems("sidebar", ["manage_production"]);
    expect(
      operatorGroups.find((group) => group.id === "production")?.items.map((item) => item.id),
    ).toEqual(["production", "station"]);
  });
});
