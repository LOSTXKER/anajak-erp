import { factoryStationKeyForStep } from "@/lib/factory-station";

export type ManufacturingTaskRouteInput = {
  canSupervise: boolean;
  executionEnabled: boolean;
  executionMode: string | null;
  workCenterCode: string | null;
  stepType: string;
  stepId: string;
  productionId: string;
  orderNumber: string;
};

export function manufacturingTaskHref(input: ManufacturingTaskRouteInput): string {
  if (input.canSupervise) return `/production/${input.productionId}`;

  if (input.executionEnabled) {
    if (
      input.executionMode === "OUTSOURCE" ||
      input.workCenterCode === "OUTSOURCE"
    ) {
      const params = new URLSearchParams({
        view: "outsource",
        q: input.orderNumber,
      });
      return `/production?${params.toString()}`;
    }
    if (!input.workCenterCode) return `/production/${input.productionId}`;

    const params = new URLSearchParams({
      station: input.workCenterCode,
      jobId: input.stepId,
    });
    return `/factory/station?${params.toString()}`;
  }

  const station = factoryStationKeyForStep(input.stepType);
  if (!station) return `/production/${input.productionId}`;
  const params = new URLSearchParams({
    station,
    productionId: input.productionId,
    focusStepId: input.stepId,
  });
  return `/factory/station?${params.toString()}`;
}
