import { describe, expect, it } from "vitest";
import {
  getRedesignFlowState,
  getRedesignStageLabel,
} from "@/lib/redesign-flow";

function flowOrder(
  internalStatus: "PRODUCING" | "QUALITY_CHECK" | "COMPLETED" | "ON_HOLD",
  inHouseDtf: boolean,
  outsource: boolean,
) {
  return {
    internalStatus,
    productionRoutes: { inHouseDtf, outsource },
  } as const;
}

describe("ERP command-center production routes", () => {
  it("shows DTF and outsource as honest alternative lanes", () => {
    const dtf = flowOrder("PRODUCING", true, false);
    const outsourced = flowOrder("PRODUCING", false, true);

    expect(getRedesignFlowState(dtf, 3)).toBe("current");
    expect(getRedesignFlowState(dtf, 4)).toBe("not-applicable");
    expect(getRedesignStageLabel(dtf)).toBe("DTF ภายใน");

    expect(getRedesignFlowState(outsourced, 3)).toBe("not-applicable");
    expect(getRedesignFlowState(outsourced, 4)).toBe("current");
    expect(getRedesignStageLabel(outsourced)).toBe("งานร้านนอก");
  });

  it("keeps both production lanes active for a mixed order", () => {
    const mixed = flowOrder("PRODUCING", true, true);

    expect(getRedesignFlowState(mixed, 3)).toBe("current");
    expect(getRedesignFlowState(mixed, 4)).toBe("current");
    expect(getRedesignStageLabel(mixed)).toBe("DTF ภายใน + ร้านนอก");
  });

  it("completes only the applicable lane and fails closed on holds", () => {
    const completedDtf = flowOrder("COMPLETED", true, false);
    const held = flowOrder("ON_HOLD", true, false);

    expect(getRedesignFlowState(completedDtf, 3)).toBe("complete");
    expect(getRedesignFlowState(completedDtf, 4)).toBe("not-applicable");
    expect(getRedesignFlowState(completedDtf, 6)).toBe("complete");
    expect(getRedesignFlowState(held, 3)).toBe("unknown");
  });
});
