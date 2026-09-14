import { describe, expect, it } from "vitest";
import { orderStatusTone, ordersHeadline, pipelineStages } from "./order-list-view";

describe("หน้ารายการออเดอร์ — ราง pipeline และตัวเลขหัวหน้า", () => {
  it("นับทั้งหมด/กำลังเดิน/เลยกำหนด จากชุดเดียวกับราง", () => {
    const headline = ordersHeadline(
      { INQUIRY: 2, PRODUCING: 4, ON_HOLD: 1, SHIPPED: 7, COMPLETED: 184, CANCELLED: 12 },
      { PRODUCING: 1 },
    );
    expect(headline).toEqual({ total: 210, active: 7, overdue: 1 });
    expect(ordersHeadline(undefined, undefined)).toEqual({ total: 0, active: 0, overdue: 0 });
  });

  it("ช่วงรับงานซ่อนร่างเมื่อไม่มีงานร่างและไม่ได้กรองอยู่", () => {
    const intake = (counts: Record<string, number>, selected = "") => pipelineStages(counts, selected)[0]!.statuses;
    expect(intake({})).toEqual(["INQUIRY", "CONFIRMED"]);
    expect(intake({ DRAFT: 3 })).toEqual(["DRAFT", "INQUIRY", "CONFIRMED"]);
    expect(intake({}, "DRAFT")).toEqual(["DRAFT", "INQUIRY", "CONFIRMED"]);
    expect(pipelineStages({}, "").map((stage) => stage.label)).toEqual(["รับงาน", "ออกแบบ", "ผลิต", "ส่งของ", "ปิดงาน"]);
  });

  it("โทนสถานะอ่านจากสีกลางของสถานะภายใน", () => {
    expect(orderStatusTone("COMPLETED")).toBe("success");
    expect(orderStatusTone("CANCELLED")).toBe("danger");
    expect(orderStatusTone("PRODUCING")).toBe("warning");
    expect(orderStatusTone("DESIGNING")).toBe("brand");
    expect(orderStatusTone("INQUIRY")).toBe("neutral");
  });
});
