/**
 * PERM — ระบบสิทธิ์รายคน (เบสเคาะ 2026-07-06 · spec: docs/spec-user-permissions.md)
 *
 * โครง: ตำแหน่ง (Role) = ชุดสิทธิ์เริ่มต้น (ตารางล่าง — ถอดจากด่าน requireRole จริงทั้งระบบ
 * ณ 2026-07-07 ห้าม drift) + override รายคนใน users.permissionOverrides (JSON) —
 * {"<permission>": true=เพิ่มให้, false=ตัดออก} · ไม่มี key = ใช้ default ตาม role
 *
 * กติกา:
 * - default ต้องตรงพฤติกรรมระบบเดิม 100% — แก้ตารางนี้ = เปลี่ยนสิทธิ์ทั้งระบบ ต้องมีเหตุผล+เทส
 * - manage_users ไม่รับ override (กันล็อคตัวเอง/ยกสิทธิ์จัดการคนให้ใครง่ายๆ — OWNER เท่านั้น)
 * - ด่านที่ชุด role ไม่ตรง catalog (product.delete/cost.delete/attachment.delete/วงเงิน SALES)
 *   คงเช็คแบบเดิมไว้ก่อน — จดใน PERM3 เป็นรายจุด
 */
import type { Role } from "@prisma/client";

export interface PermissionDef {
  key: Permission;
  label: string; // ป้ายบน UI ติ๊กสิทธิ์ (PERM2)
  group: string;
  // ชุดตำแหน่งที่ได้สิทธิ์นี้โดย default — ถอดจาก middleware จริง (ระบุที่มาใน comment)
  defaultRoles: Role[];
}

export type Permission =
  // ── กลุ่มเงิน/เอกสาร ──
  | "see_order_money" // เห็นเงินฝั่งขาย (ราคา/ยอดออเดอร์/บิล/ยอดลูกค้า/ใบเสนอ)
  | "see_finance" // เห็นทุน/กำไร/รายงานการเงิน/อัตราต้นทุน
  | "record_payments" // บันทึกรับเงิน/คืนเงิน/ยกเลิกบิล
  | "manage_billing_docs" // ออกใบแจ้งหนี้/ใบวางบิล/ภาษีขาย/50ทวิ
  | "manage_costs" // บันทึก/แก้ต้นทุนออเดอร์
  | "create_sales_docs" // เปิด/แก้ออเดอร์+ใบเสนอ+ลิงก์ลูกค้า
  | "manage_customers" // เพิ่ม/แก้ลูกค้า/บันทึกการคุย/เช็ควงเงิน
  // ── กลุ่มสถานะออเดอร์ ──
  | "update_order_status_sales" // เดินสถานะฝั่งขาย (เปิดงาน/ยืนยัน/ยกเลิก/พัก)
  | "update_order_status_production" // เดินสถานะฝั่งผลิต-ส่ง (ผลิต→QC→แพ็ค→ส่ง)
  | "update_order_status_design" // รับงานเข้าออกแบบ
  | "close_orders" // ปิดงาน (COMPLETED — หลังวางบิลครบ)
  // ── กลุ่มปฏิบัติการ ──
  | "manage_production" // อัปเดตขั้นผลิต/เบิก-คืนเสื้อ/QC/รอบพิมพ์/เบิกวัสดุ/งานร้านนอก
  | "manage_delivery" // สร้าง/แก้ใบส่งของ + ใบตรวจรับของเข้า
  | "manage_design_files" // อัปโหลดแบบ/แก้แพทเทิร์น/แก้คลังลาย
  | "create_design_assets" // สร้างแพทเทิร์น/ลายใหม่ + ลิงก์อนุมัติแบบ
  | "supervise_operations" // งานหัวหน้า: เปิดใบผลิต/ลบใบส่ง/ถอยสถานะงานส่งแล้ว/QC ร้านนอก
  // ── กลุ่มระบบ ──
  | "manage_settings" // ตั้งค่ากิจการ/ราคากลาง/แพ็คเกจ/เชื่อม Stock/ข้อมูลหลักสินค้า
  | "view_admin_reports" // audit log + Owner Pulse
  | "manage_users"; // จัดการพนักงาน+สิทธิ์ (ไม่รับ override)

export const PERMISSION_DEFS: PermissionDef[] = [
  // ── เงิน/เอกสาร ──
  // ORDER_MONEY_ROLES (strip order/customer + quotation.list/getById + billing.listByOrder)
  { key: "see_order_money", label: "เห็นเงินฝั่งขาย (ราคา/ยอดออเดอร์/บิล/ยอดลูกค้า)", group: "เงิน/เอกสาร", defaultRoles: ["OWNER", "MANAGER", "ACCOUNTANT", "SALES"] },
  // FINANCE_ROLES (ทุน/กำไร + settings.costRates/estimateMargin + analytics เงิน + revenueByMonth)
  { key: "see_finance", label: "เห็นทุน/กำไร/รายงานการเงิน", group: "เงิน/เอกสาร", defaultRoles: ["OWNER", "MANAGER", "ACCOUNTANT"] },
  // moneyRecorder (billing.recordPayment/voidInvoice/recordRefund)
  { key: "record_payments", label: "บันทึกรับเงิน/คืนเงิน/ยกเลิกบิล", group: "เงิน/เอกสาร", defaultRoles: ["OWNER", "ACCOUNTANT"] },
  // billingStaff (billing.* + billing-note.* + wht.markReceived/stats)
  { key: "manage_billing_docs", label: "ออกใบแจ้งหนี้/ใบวางบิล/รายงานภาษี", group: "เงิน/เอกสาร", defaultRoles: ["OWNER", "MANAGER", "ACCOUNTANT"] },
  // accountantUp (cost.create/update)
  { key: "manage_costs", label: "บันทึกต้นทุนออเดอร์", group: "เงิน/เอกสาร", defaultRoles: ["OWNER", "MANAGER", "ACCOUNTANT"] },
  // salesUp (order/quotation CUD + setBlindShip + design.approve + generateLink ลูกค้า)
  { key: "create_sales_docs", label: "เปิด/แก้ออเดอร์และใบเสนอ", group: "เงิน/เอกสาร", defaultRoles: ["OWNER", "MANAGER", "SALES"] },
  // customerEditors (customer.create/update/addCommunicationLog/creditStatus)
  { key: "manage_customers", label: "จัดการข้อมูลลูกค้า/CRM", group: "เงิน/เอกสาร", defaultRoles: ["OWNER", "MANAGER", "ACCOUNTANT", "SALES"] },

  // ── สถานะออเดอร์ (จาก orderOps + whitelist ต่อ role ใน order.updateStatus) ──
  { key: "update_order_status_sales", label: "เดินสถานะฝั่งขาย (เปิดงาน/ยืนยัน/ยกเลิก/พัก)", group: "สถานะออเดอร์", defaultRoles: ["OWNER", "MANAGER", "SALES"] },
  { key: "update_order_status_production", label: "เดินสถานะฝั่งผลิต-จัดส่ง", group: "สถานะออเดอร์", defaultRoles: ["OWNER", "MANAGER", "SALES", "PRODUCTION_STAFF"] },
  { key: "update_order_status_design", label: "รับงานเข้าออกแบบ", group: "สถานะออเดอร์", defaultRoles: ["OWNER", "MANAGER", "SALES", "DESIGNER"] },
  { key: "close_orders", label: "ปิดงาน (หลังวางบิลครบ)", group: "สถานะออเดอร์", defaultRoles: ["OWNER", "MANAGER", "SALES", "ACCOUNTANT"] },

  // ── ปฏิบัติการ ──
  // productionTeam/productionUp (updateStep/เบิก-คืน/qc.create/print-run/film-stock/stock ops/outsource orders)
  { key: "manage_production", label: "งานผลิต (ขั้นตอน/เบิกเสื้อ/QC/รอบพิมพ์/ร้านนอก)", group: "ปฏิบัติการ", defaultRoles: ["OWNER", "MANAGER", "PRODUCTION_STAFF"] },
  // salesOrProduction/receiver (delivery.create/update/updateStatus รวมยืนยันส่ง + goods-receipt.create)
  // — "ยืนยันส่ง" อยู่สิทธิ์นี้ ไม่ใช่งานหัวหน้า (ช่าง/ขายกดส่งเองได้ตาม flow เดิม · review PERM3 จับ)
  { key: "manage_delivery", label: "ใบส่งของ (รวมยืนยันส่ง) + ตรวจรับของเข้า", group: "ปฏิบัติการ", defaultRoles: ["OWNER", "MANAGER", "SALES", "PRODUCTION_STAFF"] },
  // designerUp (design.upload + pattern.update + artwork.update)
  { key: "manage_design_files", label: "ไฟล์แบบ/แพทเทิร์น/คลังลาย", group: "ปฏิบัติการ", defaultRoles: ["OWNER", "MANAGER", "DESIGNER"] },
  // patternCreate/artworkCreate/design.regenerateToken
  { key: "create_design_assets", label: "สร้างแพทเทิร์น/ลาย + ลิงก์อนุมัติแบบ", group: "ปฏิบัติการ", defaultRoles: ["OWNER", "MANAGER", "DESIGNER", "SALES"] },
  // managerUp ฝั่งคุมงาน (production.create + delivery.delete + rollback สถานะ + outsource QC ตัดสิน
  // + มอบหมายงาน/แก้ต้นทุนจริงบนขั้นผลิต + user.assignables)
  { key: "supervise_operations", label: "งานหัวหน้า (เปิดใบผลิต/ลบใบส่ง/ถอยสถานะ/QC ร้านนอก)", group: "ปฏิบัติการ", defaultRoles: ["OWNER", "MANAGER"] },

  // ── ระบบ ──
  // adminOnly/managerUp ฝั่งตั้งค่า (settings.set* + packaging/service-catalog + stock-sync admin + product.update + vendor)
  { key: "manage_settings", label: "ตั้งค่าระบบ/ข้อมูลหลัก", group: "ระบบ", defaultRoles: ["OWNER", "MANAGER"] },
  // adminOnly (analytics.auditLog + ownerPulse)
  { key: "view_admin_reports", label: "audit log + Owner Pulse", group: "ระบบ", defaultRoles: ["OWNER", "MANAGER"] },
  // ownerOnly (user.*) — ไม่รับ override
  { key: "manage_users", label: "จัดการพนักงานและสิทธิ์", group: "ระบบ", defaultRoles: ["OWNER"] },
];

export const PERMISSIONS: Permission[] = PERMISSION_DEFS.map((d) => d.key);

// สิทธิ์ที่ห้าม override รายคน — กันเปิดสิทธิ์จัดการคน/ล็อคเจ้าของออกจากระบบ
export const NON_OVERRIDABLE_PERMISSIONS: Permission[] = ["manage_users"];

const DEFAULT_ROLES_BY_PERMISSION: Record<Permission, Role[]> = Object.fromEntries(
  PERMISSION_DEFS.map((d) => [d.key, d.defaultRoles])
) as Record<Permission, Role[]>;

export type PermissionOverrides = Partial<Record<Permission, boolean>>;

// อ่านค่า override จาก JSON ใน DB แบบปลอดภัย — key แปลก/ค่าไม่ใช่ boolean ทิ้งเงียบ
// (ข้อมูลเสีย/เวอร์ชันเก่าต้อง fail กลับไป default ตาม role ไม่ใช่พัง)
export function parsePermissionOverrides(raw: unknown): PermissionOverrides {
  if (raw === null || raw === undefined || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out: PermissionOverrides = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if ((PERMISSIONS as string[]).includes(k) && typeof v === "boolean") {
      out[k as Permission] = v;
    }
  }
  return out;
}

// จุดตัดสินเดียวของทั้งระบบ: override รายคน (ถ้ามี) > default ตาม role
export function hasPermission(role: Role, overridesRaw: unknown, perm: Permission): boolean {
  if (!NON_OVERRIDABLE_PERMISSIONS.includes(perm)) {
    const overrides = parsePermissionOverrides(overridesRaw);
    if (perm in overrides) return overrides[perm]!;
  }
  return DEFAULT_ROLES_BY_PERMISSION[perm].includes(role);
}

export function defaultPermissionsOf(role: Role): Permission[] {
  return PERMISSIONS.filter((p) => DEFAULT_ROLES_BY_PERMISSION[p].includes(role));
}

// ชุดสิทธิ์จริงของคน (default ± override) — ให้ user.me ส่งให้จอใช้ (PERM4)
export function effectivePermissions(role: Role, overridesRaw: unknown): Permission[] {
  return PERMISSIONS.filter((p) => hasPermission(role, overridesRaw, p));
}
