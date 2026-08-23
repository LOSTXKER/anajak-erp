import type {
  InternalStatus,
  OperationState,
  QualityDisposition,
  WorkOrderState,
} from "@prisma/client";
import { badRequest, conflict } from "@/server/errors";
import {
  ManufacturingDomainError,
  reportOperationOutput,
} from "@/server/services/manufacturing-domain";
import { assertExpectedRevision as assertCoreExpectedRevision } from "@/server/services/manufacturing-command";

export const MANUFACTURING_COMMANDS = [
  "createWorkOrder",
  "releaseWorkOrder",
  "assignOperation",
  "resequenceOperation",
  "startOperation",
  "pauseOperation",
  "reportOutput",
  "completeOperation",
  "raiseException",
  "decideQcDisposition",
  "resolveException",
  "planRework",
  "releaseRework",
  "confirmCustomerGarmentEvidence",
  "createOutsourceOrder",
  "transitionOutsourceOrder",
  "cancelOutsourceOrder",
] as const;

export type ManufacturingCommandName = (typeof MANUFACTURING_COMMANDS)[number];

export type OperationAvailableCommand =
  | "assignOperation"
  | "resequenceOperation"
  | "startOperation"
  | "pauseOperation"
  | "reportOutput"
  | "completeOperation"
  | "raiseException"
  | "recordPrep"
  | "manageDtfBatch"
  | "recordQuality"
  | "reinspectQuality"
  | "createOutsourceOrder"
  | "manageOutsource";

type AvailableOperationCommandInput = {
  operationCode: string | null;
  state: OperationState;
  executionEnabled: boolean;
  qtyPlanned: number;
  qtyGood: number;
  qtyRework: number;
  hasBlockingException: boolean;
  dependenciesComplete: boolean;
  assignedToId: string | null;
  actorId: string;
  canOperate: boolean;
  canSupervise: boolean;
  workOrderState: WorkOrderState;
  orderStatus: InternalStatus;
  workCenterActive: boolean | null;
};

type ManufacturingParentCommandState = {
  workOrderState: WorkOrderState;
  orderStatus: InternalStatus;
};

const ADVANCE_WORK_ORDER_STATES: WorkOrderState[] = [
  "RELEASED",
  "IN_PROGRESS",
];
const ADVANCE_ORDER_STATUSES: InternalStatus[] = [
  "PRODUCTION_QUEUE",
  "PRODUCING",
  "QUALITY_CHECK",
  "PACKING",
];
const CLOSED_PLANNING_WORK_ORDER_STATES: WorkOrderState[] = [
  "COMPLETED",
  "CANCELLED",
];
const CLOSED_PLANNING_ORDER_STATUSES: InternalStatus[] = [
  "ON_HOLD",
  "CANCELLED",
  "COMPLETED",
];

export function manufacturingParentCanAdvance(
  input: ManufacturingParentCommandState,
): boolean {
  return (
    ADVANCE_WORK_ORDER_STATES.includes(input.workOrderState) &&
    ADVANCE_ORDER_STATUSES.includes(input.orderStatus)
  );
}

export function manufacturingOperationCanAdvance(
  input: ManufacturingParentCommandState & { workCenterActive: boolean | null },
): boolean {
  return (
    manufacturingParentCanAdvance(input) &&
    input.workCenterActive !== false
  );
}

export function manufacturingOperationCanPlan(
  input: ManufacturingParentCommandState & { workCenterActive: boolean | null },
): boolean {
  return (
    manufacturingParentCanPlan(input) &&
    input.workCenterActive !== false
  );
}

export function manufacturingParentCanPlan(
  input: ManufacturingParentCommandState,
): boolean {
  return (
    !CLOSED_PLANNING_WORK_ORDER_STATES.includes(input.workOrderState) &&
    !CLOSED_PLANNING_ORDER_STATUSES.includes(input.orderStatus)
  );
}

/**
 * Server เป็นผู้ตัดสิน action ของ Station/ERP เสมอ หน้าจอมีหน้าที่ render รายการนี้
 * เท่านั้น เพื่อไม่ให้สิทธิ์, assignment และ state machine drift คนละจอ.
 */
export function availableOperationCommands(
  input: AvailableOperationCommandInput,
): OperationAvailableCommand[] {
  if (!input.executionEnabled || ["COMPLETED", "CANCELLED"].includes(input.state)) {
    return [];
  }

  const commands: OperationAvailableCommand[] = [];
  const canAdvance = manufacturingOperationCanAdvance(input);
  const canPlan = manufacturingOperationCanPlan(input);
  if (input.canSupervise && canPlan) {
    commands.push("assignOperation", "resequenceOperation");
    if (
      canAdvance &&
      input.operationCode === "OUTSOURCE" &&
      ["READY", "RUNNING"].includes(input.state) &&
      !input.hasBlockingException &&
      input.dependenciesComplete &&
      input.qtyGood < input.qtyPlanned
    ) {
      commands.push("createOutsourceOrder");
    }
  }

  const canActOnAssignment =
    input.canOperate &&
    (input.canSupervise || input.assignedToId === null || input.assignedToId === input.actorId);
  if (!canActOnAssignment) return commands;

  const specializedCommand =
    input.operationCode === "PREP"
      ? "recordPrep"
      : input.operationCode === "DTF_PRINT"
        ? "manageDtfBatch"
        : input.operationCode === "FINAL_QC"
          ? "recordQuality"
          : input.operationCode === "OUTSOURCE"
            ? "manageOutsource"
            : null;

  if (
    canAdvance &&
    input.state === "READY" &&
    !input.hasBlockingException &&
    input.dependenciesComplete
  ) {
    commands.push(specializedCommand ?? "startOperation");
  }
  if (input.state === "RUNNING") {
    commands.push("pauseOperation");
    if (canAdvance && !input.hasBlockingException) {
      if (specializedCommand) {
        commands.push(specializedCommand);
      } else if (!specializedCommand) {
        commands.push("reportOutput");
      }
      if (input.qtyGood === input.qtyPlanned && input.qtyRework === 0) {
        commands.push("completeOperation");
      }
    }
  }
  if (
    canAdvance &&
    ["PLANNED", "READY", "RUNNING", "BLOCKED"].includes(input.state)
  ) {
    commands.push("raiseException");
  }
  return commands;
}

export function assertExpectedRevision(actual: number, expected: number) {
  try {
    assertCoreExpectedRevision({
      entityLabel: "งาน",
      currentRevision: actual,
      expectedRevision: expected,
    });
  } catch (error) {
    if (error instanceof ManufacturingDomainError) {
      conflict(`${error.message} (revision ${actual})`);
    }
    throw error;
  }
}

export type OutputDelta = {
  qtyGood: number;
  qtyScrap: number;
  qtyRework: number;
};

export function assertOutputDelta(
  current: OutputDelta & { qtyPlanned: number },
  delta: OutputDelta,
) {
  try {
    reportOperationOutput(current, delta);
  } catch (error) {
    if (error instanceof ManufacturingDomainError) badRequest(error.message);
    throw error;
  }
}

export function operationCanComplete(input: {
  state: OperationState;
  qtyPlanned: number;
  qtyGood: number;
  qtyRework: number;
  hasBlockingException: boolean;
}) {
  return (
    input.state === "RUNNING" &&
    !input.hasBlockingException &&
    input.qtyGood === input.qtyPlanned &&
    input.qtyRework === 0
  );
}

export function operationPredecessorsComplete(
  states: readonly OperationState[],
): boolean {
  return states.every((state) => state === "COMPLETED");
}

export function assertQualityExceptionResolution(input: {
  category: string | null;
  blocksJob: boolean;
  disposition?: QualityDisposition;
  currentDisposition?: QualityDisposition | null;
  sourceQcDefectDisposition?: QualityDisposition | null;
  sourceQcDefectHasReworkCase?: boolean;
}) {
  const isQualityException = /QC|QUALITY|DEFECT/i.test(input.category ?? "");
  if (
    input.blocksJob &&
    isQualityException &&
    (!input.disposition || input.disposition === "HOLD")
  ) {
    badRequest("ของที่ไม่ผ่าน QC ต้องเลือกส่งแก้หรือคัดทิ้งก่อนแก้ปัญหา");
  }
  if (
    input.sourceQcDefectDisposition !== undefined &&
    (input.sourceQcDefectDisposition !== input.currentDisposition ||
      input.disposition !== input.currentDisposition)
  ) {
    badRequest(
      "ห้ามเปลี่ยน disposition ของ QC ผ่านการปิดปัญหา ต้องใช้คำสั่ง QC/Rework ที่ปรับจำนวนพร้อมกัน",
    );
  }
  if (
    input.sourceQcDefectDisposition === "REWORK" &&
    input.sourceQcDefectHasReworkCase === false
  ) {
    badRequest("ต้องวางแผน Rework จากของเสีย QC ก่อนปิดปัญหา");
  }
}

export function assertQcDispositionDecision(input: {
  exceptionState: string;
  exceptionDisposition: QualityDisposition | null;
  defectDisposition: QualityDisposition | null;
  blocksJob: boolean;
  defectQty: number;
  operationQuantityId: string | null;
}) {
  if (!["OPEN", "ACKNOWLEDGED"].includes(input.exceptionState)) {
    badRequest("ปัญหา QC นี้ถูกแก้หรือปิดแล้ว");
  }
  if (!input.blocksJob) {
    badRequest("เปลี่ยน disposition ได้เฉพาะ QC HOLD ที่บล็อกงานอยู่");
  }
  if (
    input.exceptionDisposition !== "HOLD" ||
    input.defectDisposition !== "HOLD"
  ) {
    badRequest("QC defect นี้ไม่ได้อยู่ในสถานะ HOLD");
  }
  if (!Number.isSafeInteger(input.defectQty) || input.defectQty <= 0) {
    badRequest("จำนวนของเสีย QC ไม่ถูกต้อง");
  }
  if (!input.operationQuantityId) {
    badRequest("ของเสีย QC ไม่มี quantity line ต้นทาง");
  }
}

export type DueRisk = "OVERDUE" | "AT_RISK" | "ON_TRACK" | "UNSCHEDULED";

export function dueRiskOf(
  deadline: Date | null,
  state: string,
  now = new Date(),
): DueRisk {
  if (!deadline) return "UNSCHEDULED";
  if (["COMPLETED", "CANCELLED"].includes(state)) return "ON_TRACK";
  const remainingMs = deadline.getTime() - now.getTime();
  if (remainingMs < 0) return "OVERDUE";
  return remainingMs <= 48 * 60 * 60 * 1000 ? "AT_RISK" : "ON_TRACK";
}
