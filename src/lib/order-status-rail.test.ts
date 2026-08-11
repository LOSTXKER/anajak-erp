import { describe, it, expect } from "vitest";
import { findOffPathAnchor, railStepState, type StatusRevisionLike } from "./order-status-rail";
import { getFlowSteps } from "./order-status";

const CUSTOM = getFlowSteps("CUSTOM");
const READY = getFlowSteps("READY_MADE");

const rev = (
  newValue: string,
  oldValue: string,
  createdAt: string,
  changeType = "STATUS",
): StatusRevisionLike => ({ changeType, oldValue, newValue, createdAt });

describe("findOffPathAnchor — งานพัก/ยกเลิกค้างอยู่ขั้นไหนของสายงาน", () => {
  it("พักงานตอนกำลังผลิต → ชี้ขั้น PRODUCING", () => {
    const anchor = findOffPathAnchor({
      internalStatus: "ON_HOLD",
      flowSteps: CUSTOM,
      revisions: [rev("ON_HOLD", "PRODUCING", "2026-08-08T09:00:00Z")],
    });
    expect(anchor).toEqual({
      index: CUSTOM.indexOf("PRODUCING"),
      status: "PRODUCING",
      at: "2026-08-08T09:00:00Z",
    });
  });

  it("พักหลายรอบ → ใช้รอบล่าสุดเสมอ ไม่ใช่รอบแรกที่เจอในอาเรย์", () => {
    const anchor = findOffPathAnchor({
      internalStatus: "ON_HOLD",
      flowSteps: CUSTOM,
      revisions: [
        rev("ON_HOLD", "DESIGNING", "2026-07-01T09:00:00Z"),
        rev("ON_HOLD", "PACKING", "2026-08-09T09:00:00Z"),
        rev("ON_HOLD", "CONFIRMED", "2026-06-01T09:00:00Z"),
      ],
    });
    expect(anchor?.status).toBe("PACKING");
  });

  it("สถานะปัจจุบันอยู่ในเส้นทางอยู่แล้ว → ไม่ต้องหา (null)", () => {
    expect(
      findOffPathAnchor({
        internalStatus: "PRODUCING",
        flowSteps: CUSTOM,
        revisions: [rev("PRODUCING", "PRODUCTION_QUEUE", "2026-08-08T09:00:00Z")],
      }),
    ).toBeNull();
  });

  it("ไม่มีประวัติ → null (ไม่เดา)", () => {
    expect(
      findOffPathAnchor({ internalStatus: "CANCELLED", flowSteps: CUSTOM, revisions: [] }),
    ).toBeNull();
    expect(
      findOffPathAnchor({ internalStatus: "CANCELLED", flowSteps: CUSTOM, revisions: undefined }),
    ).toBeNull();
  });

  it("พักงานแล้วยกเลิก → ขั้นก่อนหน้าคือ ON_HOLD ซึ่งไม่มีที่ยืนบนราง → null", () => {
    expect(
      findOffPathAnchor({
        internalStatus: "CANCELLED",
        flowSteps: CUSTOM,
        revisions: [rev("CANCELLED", "ON_HOLD", "2026-08-10T09:00:00Z")],
      }),
    ).toBeNull();
  });

  it("ขั้นที่ค้างไม่อยู่ในเส้นทางของชนิดงานนี้ → null (งานสำเร็จรูปไม่มีขั้นออกแบบ)", () => {
    expect(
      findOffPathAnchor({
        internalStatus: "ON_HOLD",
        flowSteps: READY,
        revisions: [rev("ON_HOLD", "DESIGNING", "2026-08-08T09:00:00Z")],
      }),
    ).toBeNull();
  });

  it("ข้ามแถวประวัติที่ไม่ใช่การเปลี่ยนสถานะ", () => {
    expect(
      findOffPathAnchor({
        internalStatus: "ON_HOLD",
        flowSteps: CUSTOM,
        revisions: [rev("ON_HOLD", "PRODUCING", "2026-08-11T09:00:00Z", "ITEMS")],
      }),
    ).toBeNull();
  });
});

describe("railStepState — สีของแต่ละขั้นบนราง", () => {
  it("ก่อนขั้นปัจจุบัน = เสร็จแล้ว · ขั้นปัจจุบัน = current · หลังจากนั้น = รอทำ", () => {
    const at = (index: number) => railStepState({ index, anchorIndex: 5, cancelled: false });
    expect(at(4)).toBe("done");
    expect(at(5)).toBe("current");
    expect(at(6)).toBe("todo");
  });

  it("ยกเลิก: ขั้นที่ยังไม่ถึง = ไม่ได้ทำต่อ ไม่ใช่รอทำ", () => {
    const at = (index: number) => railStepState({ index, anchorIndex: 7, cancelled: true });
    expect(at(6)).toBe("done");
    expect(at(7)).toBe("current");
    expect(at(8)).toBe("skipped");
  });

  it("ไม่รู้ว่าค้างขั้นไหน (anchor -1) → ไม่มีขั้นไหนถูกไฮไลต์", () => {
    expect(railStepState({ index: 0, anchorIndex: -1, cancelled: false })).toBe("todo");
    expect(railStepState({ index: 9, anchorIndex: -1, cancelled: false })).toBe("todo");
    expect(railStepState({ index: 0, anchorIndex: -1, cancelled: true })).toBe("skipped");
  });
});
