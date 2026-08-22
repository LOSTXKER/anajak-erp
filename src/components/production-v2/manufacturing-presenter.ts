import type { StatusTone } from "@/components/ui/status-label";

export type ManufacturingStatusMeta = {
  label: string;
  tone: StatusTone;
};

const WORK_ORDER_STATUS: Record<string, ManufacturingStatusMeta> = {
  DRAFT: { label: "ร่าง", tone: "neutral" },
  RELEASED: { label: "พร้อมเริ่ม", tone: "accent" },
  IN_PROGRESS: { label: "กำลังผลิต", tone: "warning" },
  COMPLETED: { label: "เสร็จแล้ว", tone: "success" },
  CANCELLED: { label: "ยกเลิก", tone: "danger" },
};

const OPERATION_STATUS: Record<string, ManufacturingStatusMeta> = {
  PLANNED: { label: "วางแผนแล้ว", tone: "neutral" },
  READY: { label: "พร้อมทำ", tone: "accent" },
  RUNNING: { label: "กำลังทำ", tone: "warning" },
  BLOCKED: { label: "ติดปัญหา", tone: "danger" },
  COMPLETED: { label: "เสร็จแล้ว", tone: "success" },
  CANCELLED: { label: "ยกเลิก", tone: "danger" },
};

const EXCEPTION_STATUS: Record<string, ManufacturingStatusMeta> = {
  OPEN: { label: "ยังไม่ได้รับเรื่อง", tone: "danger" },
  ACKNOWLEDGED: { label: "รับเรื่องแล้ว", tone: "warning" },
  RESOLVED: { label: "แก้ไขแล้ว", tone: "success" },
  CLOSED: { label: "ปิดเรื่อง", tone: "neutral" },
};

const EXCEPTION_SEVERITY: Record<string, ManufacturingStatusMeta> = {
  INFO: { label: "ติดตาม", tone: "neutral" },
  WARNING: { label: "ควรเร่ง", tone: "warning" },
  CRITICAL: { label: "วิกฤต", tone: "danger" },
};

const DUE_RISK: Record<string, ManufacturingStatusMeta> = {
  OVERDUE: { label: "เลยกำหนด", tone: "danger" },
  AT_RISK: { label: "ใกล้ถึงกำหนด", tone: "warning" },
  ON_TRACK: { label: "ตามกำหนด", tone: "success" },
  UNSCHEDULED: { label: "ยังไม่มีกำหนด", tone: "neutral" },
};

const EVENT_LABEL: Record<string, string> = {
  CREATED: "สร้างงาน",
  RELEASED: "ปล่อยงานเข้าสู่การผลิต",
  ASSIGNED: "มอบหมายงาน",
  RESEQUENCED: "จัดลำดับงานใหม่",
  STARTED: "เริ่มทำงาน",
  PAUSED: "พักงาน",
  OUTPUT_REPORTED: "บันทึกผลผลิต",
  COMPLETED: "จบขั้นงาน",
  CANCELLED: "ยกเลิกงาน",
  BLOCKED: "หยุดเพราะติดปัญหา",
  UNBLOCKED: "พร้อมทำต่อ",
  EXCEPTION_RAISED: "แจ้งปัญหา",
  EXCEPTION_RESOLVED: "แก้ปัญหาแล้ว",
  REWORK_PLANNED: "วางแผนส่งแก้",
  REWORK_RELEASED: "ปล่อยงานส่งแก้",
  RECEIPT_RECORDED: "บันทึกรับของ",
  MATERIAL_ISSUED: "บันทึกเบิกของ",
  MATERIAL_RETURNED: "บันทึกคืนของ",
  QC_RECORDED: "บันทึกผลตรวจ",
  PACK_RECORDED: "บันทึกการแพ็ก",
};

const REWORK_STATUS: Record<string, ManufacturingStatusMeta> = {
  PLANNED: { label: "รอปล่อยส่งแก้", tone: "neutral" },
  RELEASED: { label: "พร้อมส่งแก้", tone: "accent" },
  IN_PROGRESS: { label: "กำลังแก้", tone: "warning" },
  AWAITING_REINSPECTION: { label: "รอตรวจซ้ำ", tone: "warning" },
  COMPLETED: { label: "ตรวจซ้ำผ่านแล้ว", tone: "success" },
  CANCELLED: { label: "ยกเลิก", tone: "danger" },
};

const UNKNOWN_STATUS: ManufacturingStatusMeta = {
  label: "ไม่ทราบสถานะ",
  tone: "neutral",
};

export function workOrderStatusMeta(value: string): ManufacturingStatusMeta {
  return WORK_ORDER_STATUS[value] ?? UNKNOWN_STATUS;
}

export function operationStatusMeta(value: string): ManufacturingStatusMeta {
  return OPERATION_STATUS[value] ?? UNKNOWN_STATUS;
}

export function exceptionStatusMeta(value: string): ManufacturingStatusMeta {
  return EXCEPTION_STATUS[value] ?? UNKNOWN_STATUS;
}

export function exceptionSeverityMeta(value: string): ManufacturingStatusMeta {
  return EXCEPTION_SEVERITY[value] ?? UNKNOWN_STATUS;
}

export function dueRiskMeta(value: string): ManufacturingStatusMeta {
  return DUE_RISK[value] ?? UNKNOWN_STATUS;
}

export function reworkStatusMeta(value: string): ManufacturingStatusMeta {
  return REWORK_STATUS[value] ?? UNKNOWN_STATUS;
}

export function operationEventLabel(value: string): string {
  return EVENT_LABEL[value] ?? "มีการอัปเดตงาน";
}

export function progressPercent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((done / total) * 100)));
}

export function quantitySummary(input: {
  planned: number;
  good: number;
  scrap: number;
  rework: number;
}): string {
  const parts = [`ดี ${input.good.toLocaleString("th-TH")}/${input.planned.toLocaleString("th-TH")}`];
  if (input.scrap > 0) parts.push(`เสีย ${input.scrap.toLocaleString("th-TH")}`);
  if (input.rework > 0) parts.push(`ส่งแก้ ${input.rework.toLocaleString("th-TH")}`);
  return parts.join(" · ");
}

export function capacityUnitLabel(value: string): string {
  if (value === "PIECE") return "ชิ้น/วัน";
  if (value === "MINUTE") return "นาที/วัน";
  if (value === "BATCH") return "รอบ/วัน";
  return "ต่อวัน";
}

export function dispositionLabel(value: string | null): string | null {
  if (value === "HOLD") return "พักงานไว้ตรวจสอบ";
  if (value === "REWORK") return "ส่งแก้";
  if (value === "SCRAP") return "คัดทิ้ง";
  return null;
}
