import type { Role } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "เจ้าของ",
  MANAGER: "ผู้จัดการ",
  ACCOUNTANT: "บัญชี",
  PRODUCTION_STAFF: "ฝ่ายผลิต",
  DESIGNER: "ดีไซเนอร์",
  SALES: "ฝ่ายขาย",
};

export const ROLE_OPTIONS = (
  Object.entries(ROLE_LABELS) as [Role, string][]
).map(([value, label]) => ({ value, label }));

// กลุ่มบทบาทฝั่งเงิน — นิยามกลางที่เดียว (audit 2026-07-02 พบ hardcode ซ้ำ ~20 จุด/5 ไฟล์
// รวมทีละไฟล์ตอนแตะตามกติกา refactor targeted: ไฟล์ที่แก้หลังจากนี้ให้ import จากที่นี่)

// เห็นตัวเลขการเงินรวม + ทุน/กำไร (ตาราง RBAC §7 — ตัวเลขทุนห้ามรั่วถึงขาย/ช่าง)
export const FINANCE_ROLES: Role[] = ["OWNER", "MANAGER", "ACCOUNTANT"];

// เห็นเงินฝั่งขายของออเดอร์ (ราคา/บิล/ยอดรับชำระ) — รวม SALES (ขายเอง+ตามมัดจำ)
// แต่ไม่รวมช่าง/กราฟิก (job ticket ก็ตัดเงินออกด้วยเหตุเดียวกัน)
export const ORDER_MONEY_ROLES: Role[] = [...FINANCE_ROLES, "SALES"];

// สร้าง/แก้เอกสารขาย (ออเดอร์/ใบเสนอ) — ตรง middleware salesUp ที่ server (order/quotation.create)
// ไม่รวม ACCOUNTANT (ทำบัญชี ไม่เปิดงานขาย)
export const SALES_DOC_ROLES: Role[] = ["OWNER", "MANAGER", "SALES"];

export const canSeeFinance = (role: Role): boolean => FINANCE_ROLES.includes(role);
export const canSeeOrderMoney = (role: Role): boolean => ORDER_MONEY_ROLES.includes(role);
export const canCreateSalesDocs = (role: Role): boolean => SALES_DOC_ROLES.includes(role);

// ตัวช่วยกรองเมนู/รายการ UI ตาม role — undefined roles = ทุกคนเห็น · มี role ต้องอยู่ในลิสต์
// (role ยังไม่โหลด = ซ่อนรายการที่จำกัด กัน flash เมนูเงินให้ช่างชั่ววินาที)
export function roleAllows(userRole: Role | null | undefined, allowed?: Role[]): boolean {
  if (!allowed) return true;
  return userRole != null && allowed.includes(userRole);
}
