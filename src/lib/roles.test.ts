import { describe, it, expect } from "vitest";
import type { Role } from "@prisma/client";
import {
  FINANCE_ROLES,
  ORDER_MONEY_ROLES,
  SALES_DOC_ROLES,
  canSeeFinance,
  canSeeOrderMoney,
  canCreateSalesDocs,
  roleAllows,
} from "./roles";

const ALL_ROLES: Role[] = [
  "OWNER", "MANAGER", "ACCOUNTANT", "PRODUCTION_STAFF", "DESIGNER", "SALES",
];
const NON_MONEY: Role[] = ["PRODUCTION_STAFF", "DESIGNER"];

describe("role groups (B12 — เมนู/พิมพ์เงินไม่โชว์ช่าง)", () => {
  it("FINANCE_ROLES = เจ้าของ/ผู้จัดการ/บัญชี — ช่าง/กราฟิก/ขาย ไม่อยู่", () => {
    expect(FINANCE_ROLES).toEqual(["OWNER", "MANAGER", "ACCOUNTANT"]);
    for (const r of ["PRODUCTION_STAFF", "DESIGNER", "SALES"] as Role[]) {
      expect(canSeeFinance(r)).toBe(false);
    }
  });

  it("ORDER_MONEY_ROLES เพิ่ม SALES (ตามมัดจำ/ราคาออเดอร์) — ช่าง/กราฟิกยังไม่เห็น", () => {
    expect(ORDER_MONEY_ROLES).toContain("SALES");
    expect(canSeeOrderMoney("SALES")).toBe(true);
    for (const r of NON_MONEY) expect(canSeeOrderMoney(r)).toBe(false);
  });

  it("SALES_DOC_ROLES = เปิดออเดอร์/ใบเสนอ (ตรง salesUp server) — ไม่รวม ACCOUNTANT", () => {
    expect(SALES_DOC_ROLES).toEqual(["OWNER", "MANAGER", "SALES"]);
    expect(canCreateSalesDocs("ACCOUNTANT")).toBe(false);
    expect(canCreateSalesDocs("SALES")).toBe(true);
    for (const r of NON_MONEY) expect(canCreateSalesDocs(r)).toBe(false);
  });
});

describe("roleAllows (ตัวกรองเมนู/⌘K/print)", () => {
  it("ไม่ระบุ allowed = ทุกคนเห็น (เมนู ops)", () => {
    for (const r of ALL_ROLES) expect(roleAllows(r, undefined)).toBe(true);
  });

  it("มี allowed → เฉพาะ role ในลิสต์", () => {
    expect(roleAllows("OWNER", FINANCE_ROLES)).toBe(true);
    expect(roleAllows("PRODUCTION_STAFF", FINANCE_ROLES)).toBe(false);
    expect(roleAllows("DESIGNER", FINANCE_ROLES)).toBe(false);
  });

  it("role ยังไม่โหลด (null/undefined) + มี allowed = ซ่อน (กัน flash เมนูเงิน)", () => {
    expect(roleAllows(null, FINANCE_ROLES)).toBe(false);
    expect(roleAllows(undefined, FINANCE_ROLES)).toBe(false);
    // แต่เมนู ops (ไม่จำกัด) ยังโชว์แม้ role ยังไม่โหลด
    expect(roleAllows(null, undefined)).toBe(true);
  });
});
