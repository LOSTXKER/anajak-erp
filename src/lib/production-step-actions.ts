import { isOutsourceStep } from "@/lib/production-steps";

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
