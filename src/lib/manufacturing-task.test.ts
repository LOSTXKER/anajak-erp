import { describe, expect, it } from "vitest";
import { manufacturingTaskHref } from "./manufacturing-task";

const base = {
  canSupervise: false,
  executionEnabled: true,
  executionMode: "IN_HOUSE",
  workCenterCode: "FINAL_QC",
  stepType: "CUSTOM",
  stepId: "op-qc",
  productionId: "wo-1",
  orderNumber: "ORD-001",
};

describe("manufacturingTaskHref", () => {
  it("ส่งหัวหน้าเข้า Control Record", () => {
    expect(manufacturingTaskHref({ ...base, canSupervise: true })).toBe(
      "/production/wo-1",
    );
  });

  it("ส่งพนักงาน QC เข้า Station จาก Work Center V2 ไม่ใช่ CUSTOM legacy", () => {
    expect(manufacturingTaskHref(base)).toBe(
      "/factory/station?station=FINAL_QC&jobId=op-qc",
    );
  });

  it("ส่งผู้ประสานงาน Outsource ไป worklist ใน Production", () => {
    expect(
      manufacturingTaskHref({
        ...base,
        executionMode: "OUTSOURCE",
        workCenterCode: "OUTSOURCE",
        stepId: "op-outsource",
      }),
    ).toBe("/production?view=outsource&q=ORD-001");
  });

  it("คงเส้นทาง Station เดิมให้ขั้น legacy ที่มี mapping", () => {
    expect(
      manufacturingTaskHref({
        ...base,
        executionEnabled: false,
        executionMode: null,
        workCenterCode: null,
        stepType: "HEAT_PRESS",
        stepId: "legacy-press",
      }),
    ).toBe(
      "/factory/station?station=heat-press&productionId=wo-1&focusStepId=legacy-press",
    );
  });
});
