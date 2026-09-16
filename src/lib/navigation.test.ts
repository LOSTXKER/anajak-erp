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
    // เมนูย่อยการผลิตต้องชนะ /production ที่เป็น prefix เดียวกัน
    expect(findActiveNavigationItem("/production/print-runs")?.id).toBe("print-runs");
    expect(findActiveNavigationItem("/production/metrics")?.id).toBe("production-metrics");
    expect(findActiveNavigationItem("/production/abc")?.id).toBe("production");
  });

  it("label ตามต้นแบบ แต่คำเดิมทั้งอังกฤษและไทยยังค้นเจอผ่าน aliases (UX4.6)", () => {
    const dashboard = NAVIGATION_ITEMS.find((item) => item.id === "dashboard")!;
    expect(dashboard.label).toBe("หน้าแรก");
    expect(dashboard.aliases).toContain("dashboard");
    // เปลี่ยนป้ายตามต้นแบบแล้ว คำเดิมต้องยังพิมพ์ค้นเจอ ไม่งั้นคนที่ท่องคำเก่าหาไม่เจอ
    expect(dashboard.aliases).toContain("แดชบอร์ด");
    const renamed = [
      ["billing", "บิลและการเงิน", "บิล/การเงิน"],
      ["analytics", "รายงาน", "สถิติ"],
      ["stock", "สต๊อกเสื้อ", "สต๊อก"],
      ["production", "คิวงานผลิต", "การผลิต"],
    ] as const;
    for (const [id, label, oldLabel] of renamed) {
      const item = NAVIGATION_ITEMS.find((entry) => entry.id === id)!;
      expect(item.label).toBe(label);
      expect(item.aliases).toContain(oldLabel);
    }
  });

  it("กรอง surface และ permission จาก registry เดียว", () => {
    const noPermissions = navigationItemsForSurface("sidebar", []);
    expect(noPermissions.some((item) => item.id === "billing")).toBe(false);
    // การแจ้งเตือนขึ้นทั้งรางและจานค้นหาแล้ว (ต้นแบบ NAV2) — ตัวที่ยังจำกัด surface คือ "หัก ณ ที่จ่าย"
    expect(noPermissions.some((item) => item.id === "notifications")).toBe(true);
    const palette = navigationItemsForSurface("palette", [
      "manage_billing_docs",
    ]);
    expect(palette.some((item) => item.id === "wht")).toBe(false);
    expect(palette.some((item) => item.id === "billing")).toBe(true);
  });

  it("จัด Sidebar เป็นหมวดครบและเรียงงานผลิตตามทางเดินจริง", () => {
    const groups = groupedNavigationItems("sidebar", [
      "see_order_money",
      "supervise_operations",
      "manage_billing_docs",
      "see_finance",
    ]);

    // หัวกลุ่มตามต้นแบบ: 5 หัว + กลุ่มท้ายไม่มีหัวข้อ (ราง sidebar วาดเส้นคั่นแทน)
    expect(groups.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: "main", label: "ภาพรวม" },
      { id: "sales", label: "งานขาย" },
      { id: "production", label: "การผลิต" },
      { id: "products", label: "ของและสินค้า" },
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
    // กลุ่มการผลิตมีเมนูย่อยครบสี่ตามต้นแบบ เรียงตามทางเดินงานจริง
    expect(
      groups.find((group) => group.id === "production")?.items.map((item) => item.id),
    ).toEqual(["production", "print-runs", "outsource", "production-metrics"]);
    // ของและสินค้ารวมสต๊อกเสื้อไว้ด้วยกันตามต้นแบบ โดยไม่ตัด "แพทเทิร์น" ที่ต้นแบบไม่มี
    expect(groups.find((group) => group.id === "products")?.items.map((item) => item.id)).toEqual([
      "products",
      "patterns",
      "stock",
    ]);
    // กลุ่มท้ายมีการแจ้งเตือนอยู่ในรางคู่กับกระดิ่งบนแถบบน
    expect(groups.find((group) => group.id === "system")?.items.map((item) => item.id)).toEqual([
      "notifications",
      "settings",
    ]);
  });

  it("ซ่อนเฉพาะหมวดที่ไม่มีสิทธิ์ ไม่ซ่อนเมนูที่มีสิทธิ์ไว้หลัง disclosure", () => {
    const groups = groupedNavigationItems("sidebar", []);

    expect(groups.some((group) => group.id === "finance")).toBe(false);
    expect(groups.find((group) => group.id === "production")?.items.map((item) => item.id)).toEqual([
      "production",
      "print-runs",
      "outsource",
      "production-metrics",
    ]);

    const operatorGroups = groupedNavigationItems("sidebar", ["manage_production"]);
    expect(
      operatorGroups.find((group) => group.id === "production")?.items.map((item) => item.id),
    ).toEqual(["production", "print-runs", "outsource", "production-metrics"]);
  });
});
