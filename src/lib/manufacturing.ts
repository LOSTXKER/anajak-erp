export const WORK_ORDER_STATES = [
  "DRAFT",
  "RELEASED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export type ManufacturingWorkOrderState = (typeof WORK_ORDER_STATES)[number];

export const OPERATION_STATES = [
  "PLANNED",
  "READY",
  "RUNNING",
  "BLOCKED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type ManufacturingOperationState = (typeof OPERATION_STATES)[number];

export const EXCEPTION_STATES = [
  "OPEN",
  "ACKNOWLEDGED",
  "RESOLVED",
  "CLOSED",
] as const;

export type ManufacturingExceptionState = (typeof EXCEPTION_STATES)[number];

export const REWORK_STATES = [
  "PLANNED",
  "RELEASED",
  "IN_PROGRESS",
  "AWAITING_REINSPECTION",
  "COMPLETED",
  "CANCELLED",
] as const;

export type ManufacturingReworkState = (typeof REWORK_STATES)[number];

export const QUALITY_DISPOSITIONS = ["HOLD", "REWORK", "SCRAP"] as const;

export type ManufacturingQualityDisposition = (typeof QUALITY_DISPOSITIONS)[number];

export const OPERATION_PHASES = [
  "PREPARATION",
  "MANUFACTURING",
  "OUTSOURCE",
  "QUALITY",
  "PACKING",
] as const;

export type ManufacturingOperationPhase = (typeof OPERATION_PHASES)[number];

/* ============================================================
   ป้ายไทยของ enum ผลิต V2 — ชุดเดียวทั้งเว็บ (2026-09-18)

   เดิมแต่ละหน้าตั้งคำเอง: หน้าตั้งค่าสูตรมี PHASE_LABELS ของตัวเอง จอโรงงานมี
   CAPACITY_UNIT_LABEL ของตัวเอง และเขียนระดับความรุนแรงเป็น ternary สามชั้น
   แก้คำที่เดียวแล้วอีกหน้ายังพูดคำเก่าโดยไม่มีอะไรร้อง

   ใส่เฉพาะ enum ที่มีหน้าจอเรียกใช้จริงแล้ว — ตัวที่ยังไม่มีใครแสดง (WorkOrderState,
   OperationState, ReworkState, QualityDisposition ฯลฯ) รอตั้งคำตอนจอแรกที่ใช้มันเกิด
   ไม่ตั้งคำไทยดักไว้ก่อน เพราะคำที่ไม่มีของจริงให้ดูมักไม่ตรงกับที่ผู้ใช้ต้องอ่าน
   ============================================================ */

export const OPERATION_PHASE_LABELS: Readonly<Record<ManufacturingOperationPhase, string>> = {
  PREPARATION: "เตรียมงาน",
  MANUFACTURING: "ผลิตในโรงงาน",
  OUTSOURCE: "ส่งร้านนอก",
  QUALITY: "ตรวจคุณภาพ",
  PACKING: "แพ็ก/ส่ง",
};

/** หน่วยกำลังผลิต (schema CapacityUnit) — ค่าที่เก็บคือจำนวนต่อวัน คำจึงลงท้าย /วัน */
export const CAPACITY_UNIT_LABELS = {
  PIECE: "ชิ้น/วัน",
  MINUTE: "นาที/วัน",
  BATCH: "รอบ/วัน",
} as const;

export type ManufacturingCapacityUnit = keyof typeof CAPACITY_UNIT_LABELS;

/** ระดับความรุนแรงของปัญหา (schema ExceptionSeverity) — เรียงจากเบาไปหนัก */
export const EXCEPTION_SEVERITY_LABELS = {
  INFO: "แจ้งไว้",
  WARNING: "ต้องดู",
  CRITICAL: "ด่วนมาก",
} as const;

export type ManufacturingExceptionSeverity = keyof typeof EXCEPTION_SEVERITY_LABELS;

export const WORK_ORDER_TRANSITIONS: Readonly<
  Record<ManufacturingWorkOrderState, readonly ManufacturingWorkOrderState[]>
> = {
  DRAFT: ["RELEASED", "CANCELLED"],
  RELEASED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const OPERATION_TRANSITIONS: Readonly<
  Record<ManufacturingOperationState, readonly ManufacturingOperationState[]>
> = {
  PLANNED: ["READY", "BLOCKED", "CANCELLED"],
  READY: ["RUNNING", "BLOCKED", "CANCELLED"],
  RUNNING: ["READY", "BLOCKED", "COMPLETED", "CANCELLED"],
  BLOCKED: ["READY", "RUNNING", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const EXCEPTION_TRANSITIONS: Readonly<
  Record<ManufacturingExceptionState, readonly ManufacturingExceptionState[]>
> = {
  OPEN: ["ACKNOWLEDGED"],
  ACKNOWLEDGED: ["RESOLVED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

export const REWORK_TRANSITIONS: Readonly<
  Record<ManufacturingReworkState, readonly ManufacturingReworkState[]>
> = {
  PLANNED: ["RELEASED", "CANCELLED"],
  RELEASED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["AWAITING_REINSPECTION", "CANCELLED"],
  AWAITING_REINSPECTION: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export interface ManufacturingQuantityTotals {
  qtyPlanned: number;
  qtyGood: number;
  qtyScrap: number;
  qtyRework: number;
}

export interface ManufacturingQuantityDelta {
  qtyGood: number;
  qtyScrap: number;
  qtyRework: number;
}

export interface ManufacturingDependencyState {
  operationId: string;
  state: ManufacturingOperationState;
}
