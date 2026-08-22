import { TRPCError } from "@trpc/server";

import { productionV2Enabled } from "@/lib/production-v2-flag";

type ProductionV2GateOptions = {
  flagValue?: string;
  nodeEnv?: string;
};

/**
 * Unit tests keep the V2 domain usable without mutating process.env globally.
 * A test that explicitly supplies/sets a disabled flag still exercises the
 * real fail-closed branch.
 */
export function productionV2ApiEnabled(
  options: ProductionV2GateOptions = {},
): boolean {
  const flagValue = Object.hasOwn(options, "flagValue")
    ? options.flagValue
    : process.env.PRODUCTION_V2_ENABLED;
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  return productionV2Enabled(flagValue) ||
    (nodeEnv === "test" && flagValue === undefined);
}

export function assertProductionV2ApiEnabled(
  options?: ProductionV2GateOptions,
): void {
  if (!productionV2ApiEnabled(options)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Production V2 ยังไม่เปิดใช้งาน",
    });
  }
}
