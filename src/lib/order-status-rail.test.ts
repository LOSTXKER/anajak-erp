import { describe, it, expect } from "vitest";
import { findOffPathAnchor, railStepState, type StatusRevisionLike, singleBackStatus, backStepToward } from "./order-status-rail";
import { getFlowSteps, getNextStatuses } from "./order-status";

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

// ปุ่มย้อนกลับบนหัวใบออเดอร์ (เบสสั่ง 2026-09-18) — ต้องโผล่เฉพาะตอนที่ถอยได้ทางเดียวจริง
describe("singleBackStatus", () => {
  const flow = getFlowSteps("CUSTOM");

  it("QC ถอยไปกำลังผลิตได้ทางเดียว → ได้ปุ่ม", () => {
    const targets = getNextStatuses("CUSTOM", "QUALITY_CHECK").filter((s) => s !== "CANCELLED");
    expect(targets).toContain("PRODUCING");
    expect(singleBackStatus({ flowSteps: flow, internalStatus: "QUALITY_CHECK", allowedTargets: targets })).toBe(
      "PRODUCING",
    );
  });

  it("ขั้นที่เดินหน้าอย่างเดียวไม่มีปุ่มย้อน", () => {
    const targets = getNextStatuses("CUSTOM", "CONFIRMED").filter((s) => s !== "CANCELLED");
    expect(singleBackStatus({ flowSteps: flow, internalStatus: "CONFIRMED", allowedTargets: targets })).toBeNull();
  });

  it("ส่งแล้วถอยได้สองทาง (พร้อมส่ง/QC) → ไม่ยกออกมาเป็นปุ่ม ให้เลือกในเมนู", () => {
    const targets = getNextStatuses("CUSTOM", "SHIPPED").filter((s) => s !== "CANCELLED");
    const back = targets.filter((s) => flow.indexOf(s) < flow.indexOf("SHIPPED") && flow.includes(s));
    expect(back.length).toBeGreaterThan(1);
    expect(singleBackStatus({ flowSteps: flow, internalStatus: "SHIPPED", allowedTargets: targets })).toBeNull();
  });

  it("สิทธิ์ตัดขั้นถอยออกไปแล้ว = ไม่มีปุ่ม (ไม่โชว์ปุ่มที่ server จะปฏิเสธ)", () => {
    expect(singleBackStatus({ flowSteps: flow, internalStatus: "QUALITY_CHECK", allowedTargets: ["PACKING"] })).toBeNull();
  });

  it("พร้อมส่งถอยได้ทางเดียว (กำลังแพ็ค) → ได้ปุ่มบนหัวใบ", () => {
    const targets = getNextStatuses("CUSTOM", "READY_TO_SHIP").filter((s) => s !== "CANCELLED");
    expect(singleBackStatus({ flowSteps: flow, internalStatus: "READY_TO_SHIP", allowedTargets: targets })).toBe(
      "PACKING",
    );
  });

  it("พักงาน/ยกเลิกอยู่นอกเส้นทาง — ไม่เดาขั้นก่อนให้", () => {
    expect(
      singleBackStatus({ flowSteps: flow, internalStatus: "ON_HOLD", allowedTargets: ["PRODUCING", "PRODUCTION_QUEUE"] }),
    ).toBeNull();
  });
});

/**
 * เดินถอยแบบรู้ปลายทาง (งานแก้ตามใบเคลม)
 *
 * เทสต์ชุดนี้เกิดจากของจริง: เทสบนเว็บจริง 2026-09-19 แล้วปุ่ม "สั่งงานแก้เข้าสายผลิต"
 * ตายในเคสหลักที่สุด — ของถูกส่งไปแล้วถึงได้เคลม ("จัดส่งแล้ว" ถอยได้สองทาง)
 * จึงเดินด้วยตารางสถานะจริงทั้งใบ ไม่ใช่ flow ปลอม เพื่อให้จับซ้ำได้ถ้าตารางเปลี่ยน
 */
describe("backStepToward — เดินถอยจนถึงกำลังผลิต", () => {
  function walkToProducing(orderType: "CUSTOM" | "READY_MADE", from: string) {
    const flowSteps = getFlowSteps(orderType) as readonly string[];
    const path: string[] = [];
    let current = from;
    for (let guard = 0; guard < 8 && current !== "PRODUCING"; guard++) {
      const back = backStepToward({
        flowSteps,
        internalStatus: current,
        allowedTargets: getNextStatuses(orderType, current as never),
        target: "PRODUCING",
      });
      if (!back) return { path, stuckAt: current };
      path.push(back);
      current = back;
    }
    return { path, stuckAt: current === "PRODUCING" ? null : current };
  }

  it("จัดส่งแล้ว → ตรวจคุณภาพ → กำลังผลิต (ไม่ไปทาง พร้อมส่ง)", () => {
    expect(walkToProducing("CUSTOM", "SHIPPED")).toEqual({
      path: ["QUALITY_CHECK", "PRODUCING"],
      stuckAt: null,
    });
  });

  it("ปิดงานแล้วก็ยังเดินถึงได้ — ลูกค้าเคลมหลังปิดงานมีจริง", () => {
    expect(walkToProducing("CUSTOM", "COMPLETED")).toEqual({
      path: ["SHIPPED", "QUALITY_CHECK", "PRODUCING"],
      stuckAt: null,
    });
  });

  it("ทุกสถานะหลังผลิตของทั้งสองชนิดงานต้องเดินถึงกำลังผลิตได้", () => {
    for (const orderType of ["CUSTOM", "READY_MADE"] as const) {
      for (const from of ["QUALITY_CHECK", "PACKING", "READY_TO_SHIP", "SHIPPED", "COMPLETED"]) {
        expect(walkToProducing(orderType, from).stuckAt).toBeNull();
      }
    }
  });

  it("ไม่เดินเลยปลายทาง และไม่เดินเมื่ออยู่ก่อนปลายทางอยู่แล้ว", () => {
    const flowSteps = getFlowSteps("CUSTOM") as readonly string[];
    expect(
      backStepToward({
        flowSteps,
        internalStatus: "PRODUCTION_QUEUE",
        allowedTargets: getNextStatuses("CUSTOM", "PRODUCTION_QUEUE"),
        target: "PRODUCING",
      }),
    ).toBeNull();
    // สถานะนอกเส้นทาง (พักงาน) ไม่มีที่ยืนบนราง จึงต้องไม่เดา
    expect(
      backStepToward({
        flowSteps,
        internalStatus: "ON_HOLD",
        allowedTargets: ["PRODUCTION_QUEUE", "CONFIRMED"],
        target: "PRODUCING",
      }),
    ).toBeNull();
  });
});
