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
