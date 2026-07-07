import type { Role } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";

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

// บันทึกรับเงิน/คืนเงิน/ยกเลิกบิล — ตรง moneyRecorder ที่ server (แคบกว่า finance:
// ไม่รวม MANAGER · เจ้าของ+บัญชีเท่านั้นแตะเงินเข้า-ออกจริง)
export const MONEY_RECORDER_ROLES: Role[] = ["OWNER", "ACCOUNTANT"];

export const canSeeFinance = (role: Role): boolean => FINANCE_ROLES.includes(role);
export const canSeeOrderMoney = (role: Role): boolean => ORDER_MONEY_ROLES.includes(role);
export const canCreateSalesDocs = (role: Role): boolean => SALES_DOC_ROLES.includes(role);

// ⑦: mutation ฝั่ง server ที่คืนแถวออเดอร์เต็ม — strip เงินก่อนส่งออก (รั่วระดับ payload:
// จอไม่ใช้เงินจากคำตอบ mutation — invalidate แล้ว refetch ผ่าน getById ที่ strip แล้ว)
// PERM3: ตัดสินด้วย hasPermission (default ตาม role เดิมเป๊ะ + override รายคน) · ใช้ใน
// order.ts + quotation.ts
type OrderMoneyKey =
  | "subtotalItems"
  | "subtotalFees"
  | "discount"
  | "taxAmount"
  | "totalAmount"
  | "platformFee"
  | "totalCost"
  | "profitMargin";

export function stripOrderMoneyForRole<T extends Record<OrderMoneyKey, unknown>>(
  order: T,
  role: Role,
  permissionOverrides: unknown
): Omit<T, OrderMoneyKey> & { [K in OrderMoneyKey]: T[K] | null } {
  const seesCost = hasPermission(role, permissionOverrides, "see_finance");
  const seesMoney = hasPermission(role, permissionOverrides, "see_order_money");
  return {
    ...order,
    // totalCost คง 0 (ไม่ใช่ null) ตาม pattern order.list/getById เดิม — UI ฝั่ง cost อ่านเป็นเลขเสมอ
    totalCost: seesCost ? order.totalCost : 0,
    profitMargin: seesCost ? order.profitMargin : null,
    subtotalItems: seesMoney ? order.subtotalItems : null,
    subtotalFees: seesMoney ? order.subtotalFees : null,
    discount: seesMoney ? order.discount : null,
    taxAmount: seesMoney ? order.taxAmount : null,
    totalAmount: seesMoney ? order.totalAmount : null,
    platformFee: seesMoney ? order.platformFee : null,
    // generic spread ทำให้ TS มองเป็น intersection (เลข & null = never) — ชนิดจริงคือ mapped ข้างบน
  } as Omit<T, OrderMoneyKey> & { [K in OrderMoneyKey]: T[K] | null };
}

// ตัวช่วยกรองเมนู/รายการ UI ตาม role — undefined roles = ทุกคนเห็น · มี role ต้องอยู่ในลิสต์
// (role ยังไม่โหลด = ซ่อนรายการที่จำกัด กัน flash เมนูเงินให้ช่างชั่ววินาที)
export function roleAllows(userRole: Role | null | undefined, allowed?: Role[]): boolean {
  if (!allowed) return true;
  return userRole != null && allowed.includes(userRole);
}
