import { createHash } from "node:crypto";

import { ManufacturingDomainError } from "./manufacturing-domain";

export type ManufacturingCommandLedgerEntry = {
  requestHash: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  result: unknown;
  errorCode: string | null;
  errorMessage: string | null;
};

export type ManufacturingCommandDecision =
  | { kind: "EXECUTE" }
  | { kind: "IN_FLIGHT" }
  | { kind: "REPLAY_SUCCESS"; result: unknown }
  | { kind: "REPLAY_FAILURE"; errorCode: string | null; errorMessage: string | null };

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function hashManufacturingCommand(input: {
  commandType: string;
  expectedRevision: number;
  productionId?: string;
  productionStepId?: string;
  actorId?: string;
  payload: unknown;
}): string {
  const canonical = JSON.stringify(canonicalize(input));
  return createHash("sha256").update(canonical).digest("hex");
}

export function decideManufacturingCommand(params: {
  existing: ManufacturingCommandLedgerEntry | null;
  requestHash: string;
}): ManufacturingCommandDecision {
  if (!params.existing) return { kind: "EXECUTE" };
  if (params.existing.requestHash !== params.requestHash) {
    throw new ManufacturingDomainError(
      "COMMAND_ID_REUSED",
      "commandId นี้ถูกใช้กับคำสั่งคนละชุดข้อมูลแล้ว",
    );
  }
  if (params.existing.status === "PENDING") return { kind: "IN_FLIGHT" };
  if (params.existing.status === "SUCCEEDED") {
    return { kind: "REPLAY_SUCCESS", result: params.existing.result };
  }
  return {
    kind: "REPLAY_FAILURE",
    errorCode: params.existing.errorCode,
    errorMessage: params.existing.errorMessage,
  };
}

export function assertExpectedRevision(params: {
  entityLabel: string;
  currentRevision: number;
  expectedRevision: number;
}): void {
  if (
    !Number.isSafeInteger(params.expectedRevision) ||
    params.expectedRevision < 0 ||
    params.currentRevision !== params.expectedRevision
  ) {
    throw new ManufacturingDomainError(
      "REVISION_CONFLICT",
      `${params.entityLabel} ถูกอัปเดตจากอีกจอแล้ว กรุณาโหลดข้อมูลใหม่`,
    );
  }
}

export function nextManufacturingRevision(currentRevision: number): number {
  if (!Number.isSafeInteger(currentRevision) || currentRevision < 0) {
    throw new ManufacturingDomainError("INVALID_TRANSITION", "revision ปัจจุบันไม่ถูกต้อง");
  }
  return currentRevision + 1;
}
