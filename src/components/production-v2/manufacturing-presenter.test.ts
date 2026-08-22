import { describe, expect, it } from "vitest";
import {
  dueRiskMeta,
  operationEventLabel,
  progressPercent,
  quantitySummary,
  workOrderStatusMeta,
} from "./manufacturing-presenter";

describe("manufacturing presenter", () => {
  it("แสดงสถานะเป็นภาษาคนและมีข้อความร่วมกับสี", () => {
    expect(workOrderStatusMeta("IN_PROGRESS")).toEqual({
      label: "กำลังผลิต",
      tone: "warning",
    });
    expect(dueRiskMeta("OVERDUE").label).toBe("เลยกำหนด");
  });

  it("กันเปอร์เซ็นต์หลุดช่วงและไม่หารด้วยศูนย์", () => {
    expect(progressPercent(5, 0)).toBe(0);
    expect(progressPercent(12, 10)).toBe(100);
    expect(progressPercent(-1, 10)).toBe(0);
  });

  it("ซ่อนจำนวนเสียและส่งแก้เมื่อไม่มี", () => {
    expect(quantitySummary({ planned: 20, good: 8, scrap: 0, rework: 0 })).toBe(
      "ดี 8/20",
    );
    expect(quantitySummary({ planned: 20, good: 8, scrap: 2, rework: 1 })).toBe(
      "ดี 8/20 · เสีย 2 · ส่งแก้ 1",
    );
  });

  it("ไม่เผยชื่อ event ภายในเมื่อยังไม่รู้จัก", () => {
    expect(operationEventLabel("OUTPUT_REPORTED")).toBe("บันทึกผลผลิต");
    expect(operationEventLabel("SOME_NEW_EVENT")).toBe("มีการอัปเดตงาน");
  });
});
