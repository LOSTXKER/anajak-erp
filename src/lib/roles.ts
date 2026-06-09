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
