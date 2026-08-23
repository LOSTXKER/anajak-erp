import { describe, expect, it } from "vitest";

import {
  assertProductionV2ApiEnabled,
  productionV2ApiEnabled,
} from "./production-v2-gate";

describe("Production V2 API rollout gate", () => {
  it("production fail closed เมื่อ flag ไม่ได้เปิด", () => {
    expect(
      productionV2ApiEnabled({ flagValue: undefined, nodeEnv: "production" }),
    ).toBe(false);
    expect(() =>
      assertProductionV2ApiEnabled({
        flagValue: "false",
        nodeEnv: "production",
      }),
    ).toThrow("ยังไม่เปิดใช้งาน");
  });

  it("เปิดเฉพาะ flag จริง และ test bypass ได้เมื่อไม่ได้กำหนด flag", () => {
    expect(
      productionV2ApiEnabled({ flagValue: "true", nodeEnv: "production" }),
    ).toBe(true);
    expect(
      productionV2ApiEnabled({ flagValue: undefined, nodeEnv: "test" }),
    ).toBe(true);
    expect(
      productionV2ApiEnabled({ flagValue: "0", nodeEnv: "test" }),
    ).toBe(false);
  });
});
