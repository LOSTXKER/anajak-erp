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

  it("พนักงานเข้าใบผลิตเดียวกับหัวหน้า — จอสถานีถูกถอดออก 2026-09-02 รอออกแบบใหม่", () => {
    expect(manufacturingTaskHref(base)).toBe("/production/wo-1");
  });

  it("งานร้านนอกก็เข้าใบผลิต — หน้าคิวร้านนอกถอดออกพร้อมหน้ารายการผลิต 2026-09-02", () => {
    expect(
      manufacturingTaskHref({
        ...base,
        executionMode: "OUTSOURCE",
        workCenterCode: "OUTSOURCE",
        stepId: "op-outsource",
      }),
    ).toBe("/production/wo-1");
  });

  it("ขั้น legacy ที่เคยมี mapping สถานี ก็เข้าใบผลิตเช่นกัน", () => {
    expect(
      manufacturingTaskHref({
        ...base,
        executionEnabled: false,
        executionMode: null,
        workCenterCode: null,
        stepType: "HEAT_PRESS",
        stepId: "legacy-press",
      }),
    ).toBe("/production/wo-1");
  });
});
