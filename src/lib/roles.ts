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

export const canSeeFinance = (role: Role): boolean => FINANCE_ROLES.includes(role);
export const canSeeOrderMoney = (role: Role): boolean => ORDER_MONEY_ROLES.includes(role);
