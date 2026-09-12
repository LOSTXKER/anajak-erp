import { floorJobHref } from "@/lib/production-surface";

export type OperationsOrigin = { productionId: string; stepId: string };
export type OperationsSearchParams = {
  from?: string;
  production?: string;
  step?: string;
  run?: string;
};

export function operationsOrigin(
  params: OperationsSearchParams,
): OperationsOrigin | undefined {
  if (params.from !== "floor" || !params.production || !params.step)
    return undefined;
  return { productionId: params.production, stepId: params.step };
}

export function operationsHref(
  path: string,
  origin?: OperationsOrigin,
  runNumber?: string,
) {
  const query = new URLSearchParams(
    origin
      ? { from: "floor", production: origin.productionId, step: origin.stepId }
      : undefined,
  );
  if (runNumber) query.set("run", runNumber);
  return query.size ? `${path}?${query}` : path;
}

export function operationsBack(origin?: OperationsOrigin) {
  return origin
    ? {
        href: floorJobHref(origin.productionId, origin.stepId),
        label: "กลับขั้นงานบนจอช่าง",
      }
    : { href: "/production", label: "กลับคิวผลิต" };
}
