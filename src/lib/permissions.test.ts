import { describe, it, expect } from "vitest";
import type { Role } from "@prisma/client";
import {
  PERMISSIONS,
  PERMISSION_DEFS,
  NON_OVERRIDABLE_PERMISSIONS,
  parsePermissionOverrides,
  hasPermission,
  defaultPermissionsOf,
  effectivePermissions,
  type Permission,
} from "./permissions";

// ── ตาราง default ที่คาดหวัง — เขียนซ้ำอิสระจาก PERMISSION_DEFS โดยเจตนา ──
// pin พฤติกรรมระบบจริง ณ 2026-07-07 (ถอดจากด่าน requireRole ทุก router): ใครแก้ catalog
// แล้วตารางนี้ไม่แก้ตาม = เทสแดง บังคับให้ตั้งใจเปลี่ยนทั้งคู่พร้อมเหตุผล
const EXPECTED: Record<Role, Permission[]> = {
  OWNER: [
    "see_order_money", "see_finance", "record_payments", "manage_billing_docs",
    "manage_costs", "create_sales_docs", "manage_customers",
    "update_order_status_sales", "update_order_status_production",
    "update_order_status_design", "close_orders",
    "manage_production", "manage_delivery", "manage_design_files",
    "create_design_assets", "supervise_operations",
    "manage_settings", "view_admin_reports", "manage_users",
  ],
  MANAGER: [
    // เท่าเจ้าของ ยกเว้น: บันทึกเงินจริง (moneyRecorder = OWNER/ACCOUNTANT) + จัดการพนักงาน
    "see_order_money", "see_finance", "manage_billing_docs",
    "manage_costs", "create_sales_docs", "manage_customers",
    "update_order_status_sales", "update_order_status_production",
    "update_order_status_design", "close_orders",
    "manage_production", "manage_delivery", "manage_design_files",
    "create_design_assets", "supervise_operations",
    "manage_settings", "view_admin_reports",
  ],
  ACCOUNTANT: [
    "see_order_money", "see_finance", "record_payments", "manage_billing_docs",
    "manage_costs", "manage_customers", "close_orders",
  ],
  SALES: [
    "see_order_money", "create_sales_docs", "manage_customers",
    "update_order_status_sales", "update_order_status_production",
    "update_order_status_design", "close_orders",
    "manage_delivery", "create_design_assets",
  ],
  PRODUCTION_STAFF: [
    "update_order_status_production", "manage_production", "manage_delivery",
  ],
  DESIGNER: [
    "update_order_status_design", "manage_design_files", "create_design_assets",
  ],
};

const ROLES = Object.keys(EXPECTED) as Role[];

describe("catalog — โครงถูกต้อง", () => {
  it("มี 19 สิทธิ์ ครบ ไม่ซ้ำ และทุกตัวมี label/group/defaultRoles", () => {
    expect(PERMISSIONS).toHaveLength(19);
    expect(new Set(PERMISSIONS).size).toBe(19);
    for (const d of PERMISSION_DEFS) {
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.group.length).toBeGreaterThan(0);
      expect(d.defaultRoles.length).toBeGreaterThan(0);
      expect(d.defaultRoles).toContain("OWNER"); // เจ้าของต้องมีทุกสิทธิ์โดย default
    }
  });
});

describe("default matrix 6 role × 19 สิทธิ์ — ตรงพฤติกรรมระบบเดิมเป๊ะ", () => {
  for (const role of ROLES) {
    it(`${role}: ชุด default ตรงตาราง (${EXPECTED[role].length} สิทธิ์)`, () => {
      // เทียบเป็นเซ็ตครบสองทาง — สิทธิ์เกิน/ขาดโผล่ทั้งคู่
      expect([...defaultPermissionsOf(role)].sort()).toEqual([...EXPECTED[role]].sort());
    });
  }

  it("ทุกช่องของ matrix ผ่าน hasPermission ตรงตาราง (ไม่มี override)", () => {
    for (const role of ROLES) {
      for (const perm of PERMISSIONS) {
        expect(hasPermission(role, null, perm), `${role} × ${perm}`).toBe(
          EXPECTED[role].includes(perm)
        );
      }
    }
  });
});

describe("override รายคน — ทับ default ได้สองทาง", () => {
  it("ติ๊กเพิ่ม: ช่างได้ see_order_money · ติ๊กตัด: SALES เสีย create_sales_docs", () => {
    expect(hasPermission("PRODUCTION_STAFF", { see_order_money: true }, "see_order_money")).toBe(true);
    expect(hasPermission("SALES", { create_sales_docs: false }, "create_sales_docs")).toBe(false);
  });

  it("override แตะเฉพาะ key ที่ระบุ — สิทธิ์อื่นของคนเดิมไม่ขยับ", () => {
    const o = { see_order_money: true };
    expect(hasPermission("PRODUCTION_STAFF", o, "manage_production")).toBe(true);
    expect(hasPermission("PRODUCTION_STAFF", o, "record_payments")).toBe(false);
  });

  it("manage_users ไม่รับ override (กันล็อคตัวเอง/ยกสิทธิ์จัดการคน)", () => {
    expect(NON_OVERRIDABLE_PERMISSIONS).toContain("manage_users");
    expect(hasPermission("MANAGER", { manage_users: true }, "manage_users")).toBe(false);
    expect(hasPermission("OWNER", { manage_users: false }, "manage_users")).toBe(true);
  });

  it("effectivePermissions = default ± override (ใช้ส่งให้จอ)", () => {
    const eff = effectivePermissions("PRODUCTION_STAFF", {
      see_order_money: true,
      manage_delivery: false,
    });
    expect(eff).toContain("see_order_money");
    expect(eff).not.toContain("manage_delivery");
    expect(eff).toContain("manage_production");
    expect(eff).toContain("update_order_status_production");
  });
});

describe("parsePermissionOverrides — ข้อมูล JSON เสียต้องไม่พัง (fail กลับ default)", () => {
  it("null/undefined/ชนิดผิด → ว่าง (ใช้ default ล้วน)", () => {
    for (const bad of [null, undefined, "x", 42, true, ["see_finance"]]) {
      expect(parsePermissionOverrides(bad)).toEqual({});
    }
  });

  it("key แปลก/ค่าไม่ใช่ boolean ถูกทิ้ง — เก็บเฉพาะคู่ที่ถูกต้อง", () => {
    expect(
      parsePermissionOverrides({
        see_finance: true,
        not_a_permission: true,
        record_payments: "yes",
        manage_costs: 1,
      })
    ).toEqual({ see_finance: true });
  });

  it("ค่าเสียใน hasPermission → ใช้ default ตาม role (ช่างยังไม่เห็นเงิน)", () => {
    expect(hasPermission("PRODUCTION_STAFF", { see_order_money: "true" }, "see_order_money")).toBe(false);
    expect(hasPermission("ACCOUNTANT", "corrupted", "see_finance")).toBe(true);
  });
});
