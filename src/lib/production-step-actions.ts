import { isOutsourceStep, laneOf } from "@/lib/production-steps";

export type ProductionStepUiAction =
  | "send-outsource"
  | "quick-pass"
  | "start"
  | "complete"
  | "details";

export interface ProductionStepActionPolicyInput {
  stepType: string;
  status: string;
  canOutsource: boolean;
  canUpdateStep: boolean;
  ownedByOther: boolean;
  hasActiveOutsource: boolean;
  qcFailedBlocked: boolean;
}

export interface ProductionStepActionPolicy {
  structuralMode: "outsource" | "internal" | "garment-pick";
  primary: ProductionStepUiAction | null;
  canSendOutsource: boolean;
  canQuickPass: boolean;
  canRunInternal: boolean;
}

export function getProductionStepActionPolicy(
  input: ProductionStepActionPolicyInput,
): ProductionStepActionPolicy {
  const structuralMode = isOutsourceStep(input.stepType)
    ? "outsource"
    : input.stepType === "GARMENT_PICK"
      ? "garment-pick"
      : "internal";
  const unfinished = input.status !== "COMPLETED";
  const available =
    unfinished &&
    !input.ownedByOther &&
    !input.hasActiveOutsource &&
    !input.qcFailedBlocked;

  const canSendOutsource =
    structuralMode === "outsource" && input.canOutsource && available;
  const canQuickPass =
    structuralMode === "outsource" && input.canUpdateStep && available;
  const canRunInternal =
    structuralMode === "internal" &&
    input.canUpdateStep &&
    available &&
    input.status !== "FAILED";

  return {
    structuralMode,
    primary: canSendOutsource
      ? "send-outsource"
      : canRunInternal
        ? input.status === "IN_PROGRESS" ? "complete" : "start"
        : null,
    canSendOutsource,
    canQuickPass,
    canRunInternal,
  };
}

export interface LaneOrderStepLite {
  id: string;
  stepType: string;
  status: string;
  sortOrder: number;
}

// UX4.10: "ขั้นแรกที่ยังไม่เสร็จ" ของแต่ละเลน — ปุ่ม primary เน้นเฉพาะขั้นนี้
// ขั้นถัดๆ ไปในเลนเดียวกันถูกลดเป็นปุ่มรอง + ป้าย "รอขั้นก่อนหน้า"
// (server ไม่กันการเริ่มข้ามลำดับ — จอเป็นด่านเดียว กันงาน IN_PROGRESS ผีข้ามขั้น)
export function firstPendingStepIdsByLane(steps: LaneOrderStepLite[]): Set<string> {
  const claimed = new Set<string>(); // เลนที่มีขั้นค้างตัวแรกแล้ว
  const ids = new Set<string>();
  for (const step of [...steps].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (step.status === "COMPLETED") continue;
    const lane = laneOf(step.stepType);
    if (claimed.has(lane)) continue;
    claimed.add(lane);
    ids.add(step.id);
  }
  return ids;
}
