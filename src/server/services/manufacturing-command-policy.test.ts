import { describe, expect, it } from "vitest";
import {
  assertExpectedRevision,
  assertOutputDelta,
  assertQcDispositionDecision,
  availableOperationCommands,
  dueRiskOf,
  manufacturingOperationCanAdvance,
  manufacturingOperationCanPlan,
  operationCanComplete,
  operationPredecessorsComplete,
  assertQualityExceptionResolution,
} from "./manufacturing-command-policy";

const base = {
  operationCode: "HEAT_PRESS",
  state: "READY" as const,
  executionEnabled: true,
  qtyPlanned: 10,
  qtyGood: 0,
  qtyRework: 0,
  hasBlockingException: false,
  dependenciesComplete: true,
  assignedToId: null,
  actorId: "worker-1",
  canOperate: true,
  canSupervise: false,
  workOrderState: "IN_PROGRESS" as const,
  orderStatus: "PRODUCING" as const,
  workCenterActive: true,
};

describe("manufacturing command policy", () => {
  it("Station ได้ action ตาม state/assignment และหัวหน้าได้ control actions เพิ่ม", () => {
    expect(availableOperationCommands(base)).toEqual([
      "startOperation",
      "raiseException",
    ]);
    expect(
      availableOperationCommands({ ...base, canSupervise: true }),
    ).toEqual([
      "assignOperation",
      "resequenceOperation",
      "startOperation",
      "raiseException",
    ]);
    expect(
      availableOperationCommands({ ...base, assignedToId: "worker-2" }),
    ).toEqual([]);
  });

  it("งานติด blocker เริ่ม/รายงาน/จบไม่ได้ และงานปิดไม่มี action", () => {
    expect(
      availableOperationCommands({ ...base, hasBlockingException: true }),
    ).toEqual(["raiseException"]);
    expect(
      availableOperationCommands({ ...base, state: "COMPLETED" }),
    ).toEqual([]);
  });

  it("DRAFT วางแผนได้แต่ยังเดินงานหรือเปิดปัญหาใหม่ไม่ได้", () => {
    const draft = {
      ...base,
      workOrderState: "DRAFT" as const,
      orderStatus: "DESIGN_APPROVED" as const,
      state: "PLANNED" as const,
      canSupervise: true,
    };
    expect(availableOperationCommands(draft)).toEqual([
      "assignOperation",
      "resequenceOperation",
    ]);
    expect(manufacturingOperationCanPlan(draft)).toBe(true);
    expect(manufacturingOperationCanAdvance(draft)).toBe(false);
  });

  it.each([
    ["ใบผลิตยกเลิก", { workOrderState: "CANCELLED" as const }],
    ["ออเดอร์พัก", { orderStatus: "ON_HOLD" as const }],
    ["จุดงานปิด", { workCenterActive: false }],
  ])("%s ไม่เสนอ assign/resequence/raise หรือคำสั่งเดินงาน", (_label, scope) => {
    const commands = availableOperationCommands({
      ...base,
      ...scope,
      canSupervise: true,
    });
    expect(commands).toEqual([]);
    expect(manufacturingOperationCanPlan({ ...base, ...scope })).toBe(false);
    expect(manufacturingOperationCanAdvance({ ...base, ...scope })).toBe(false);
  });

  it("งาน RUNNING ที่ parent หยุดแล้วคง pause ไว้เป็นคำสั่งเก็บกวาด", () => {
    expect(
      availableOperationCommands({
        ...base,
        state: "RUNNING",
        workOrderState: "CANCELLED",
      }),
    ).toEqual(["pauseOperation"]);
  });

  it("complete เปิดเมื่อ RUNNING และ qtyGood ถึงเป้าเท่านั้น", () => {
    expect(
      availableOperationCommands({ ...base, state: "RUNNING", qtyGood: 9 }),
    ).not.toContain("completeOperation");
    expect(
      availableOperationCommands({ ...base, state: "RUNNING", qtyGood: 10 }),
    ).toContain("completeOperation");
    expect(
      operationCanComplete({
        state: "RUNNING",
        qtyPlanned: 10,
        qtyGood: 10,
        qtyRework: 0,
        hasBlockingException: false,
      }),
    ).toBe(true);
    expect(
      operationCanComplete({
        state: "RUNNING",
        qtyPlanned: 10,
        qtyGood: 10,
        qtyRework: 1,
        hasBlockingException: false,
      }),
    ).toBe(false);
  });

  it("งานเฉพาะทางต้องใช้หลักฐานของสถานีนั้น ห้ามรายงานจำนวนแบบทั่วไปข้าม ledger", () => {
    expect(
      availableOperationCommands({ ...base, operationCode: "PREP" }),
    ).toContain("recordPrep");
    expect(
      availableOperationCommands({
        ...base,
        operationCode: "DTF_PRINT",
        state: "RUNNING",
        qtyGood: 9,
      }),
    ).toContain("manageDtfBatch");
    expect(
      availableOperationCommands({
        ...base,
        operationCode: "FINAL_QC",
        state: "RUNNING",
        qtyGood: 9,
      }),
    ).not.toContain("reportOutput");
    expect(
      availableOperationCommands({
        ...base,
        operationCode: "FINAL_QC",
        state: "RUNNING",
        qtyGood: 10,
      }),
    ).toContain("completeOperation");
  });

  it("แยกสิทธิ์เปิดใบงานร้านนอกของหัวหน้าออกจากสิทธิ์ปฏิบัติงานของ Station", () => {
    const staffCommands = availableOperationCommands({
      ...base,
      operationCode: "OUTSOURCE",
    });
    expect(staffCommands).toContain("manageOutsource");
    expect(staffCommands).not.toContain("createOutsourceOrder");

    const supervisorCommands = availableOperationCommands({
      ...base,
      operationCode: "OUTSOURCE",
      canOperate: false,
      canSupervise: true,
    });
    expect(supervisorCommands).toContain("createOutsourceOrder");
    expect(supervisorCommands).not.toContain("manageOutsource");

    expect(
      availableOperationCommands({
        ...base,
        operationCode: "OUTSOURCE",
        canSupervise: true,
        hasBlockingException: true,
      }),
    ).not.toContain("createOutsourceOrder");
    expect(
      availableOperationCommands({
        ...base,
        operationCode: "OUTSOURCE",
        canSupervise: true,
        state: "RUNNING",
        qtyGood: base.qtyPlanned,
      }),
    ).not.toContain("createOutsourceOrder");
  });

  it("revision stale ถูกปฏิเสธ", () => {
    expect(() => assertExpectedRevision(3, 2)).toThrow("revision 3");
    expect(() => assertExpectedRevision(3, 3)).not.toThrow();
  });

  it("dependency ผ่านเฉพาะ predecessor ที่ COMPLETED — CANCELLED ไม่ส่ง qtyGood ต่อ", () => {
    expect(operationPredecessorsComplete(["COMPLETED", "COMPLETED"])).toBe(true);
    expect(operationPredecessorsComplete(["COMPLETED", "CANCELLED"])).toBe(false);
    expect(operationPredecessorsComplete(["READY"])).toBe(false);
    expect(
      availableOperationCommands({ ...base, dependenciesComplete: false }),
    ).not.toContain("startOperation");
  });

  it("QC blocker resolve ไม่ได้จนกว่าจะเลือก REWORK หรือ SCRAP", () => {
    expect(() =>
      assertQualityExceptionResolution({ category: "QC_DEFECT", blocksJob: true }),
    ).toThrow("ต้องเลือกส่งแก้หรือคัดทิ้ง");
    expect(() =>
      assertQualityExceptionResolution({
        category: "QUALITY",
        blocksJob: true,
        disposition: "HOLD",
      }),
    ).toThrow("ต้องเลือกส่งแก้หรือคัดทิ้ง");
    expect(() =>
      assertQualityExceptionResolution({
        category: "QC_DEFECT",
        blocksJob: true,
        disposition: "REWORK",
      }),
    ).not.toThrow();
    expect(() =>
      assertQualityExceptionResolution({
        category: "QC_DEFECT:defect-1",
        blocksJob: true,
        currentDisposition: "SCRAP",
        sourceQcDefectDisposition: "SCRAP",
        disposition: "REWORK",
      }),
    ).toThrow("ห้ามเปลี่ยน disposition");
    expect(() =>
      assertQualityExceptionResolution({
        category: "QC_DEFECT:defect-1",
        blocksJob: false,
        currentDisposition: "SCRAP",
        sourceQcDefectDisposition: "SCRAP",
        disposition: "SCRAP",
      }),
    ).not.toThrow();
    expect(() =>
      assertQualityExceptionResolution({
        category: "QC_DEFECT:defect-1",
        blocksJob: true,
        currentDisposition: "REWORK",
        sourceQcDefectDisposition: "REWORK",
        sourceQcDefectHasReworkCase: false,
        disposition: "REWORK",
      }),
    ).toThrow("ต้องวางแผน Rework");
  });

  it("decide QC disposition รับเฉพาะ open blocking HOLD ที่มี line และจำนวนจริง", () => {
    expect(() =>
      assertQcDispositionDecision({
        exceptionState: "OPEN",
        exceptionDisposition: "HOLD",
        defectDisposition: "HOLD",
        blocksJob: true,
        defectQty: 2,
        operationQuantityId: "quantity-1",
      }),
    ).not.toThrow();
    expect(() =>
      assertQcDispositionDecision({
        exceptionState: "RESOLVED",
        exceptionDisposition: "HOLD",
        defectDisposition: "HOLD",
        blocksJob: true,
        defectQty: 2,
        operationQuantityId: "quantity-1",
      }),
    ).toThrow("ถูกแก้หรือปิดแล้ว");
    expect(() =>
      assertQcDispositionDecision({
        exceptionState: "OPEN",
        exceptionDisposition: "REWORK",
        defectDisposition: "HOLD",
        blocksJob: true,
        defectQty: 2,
        operationQuantityId: "quantity-1",
      }),
    ).toThrow("ไม่ได้อยู่ในสถานะ HOLD");
  });

  it("qtyGood เท่านั้นเดินเป้าและห้ามเกิน planned", () => {
    expect(() =>
      assertOutputDelta(
        { qtyPlanned: 10, qtyGood: 8, qtyScrap: 1, qtyRework: 0 },
        { qtyGood: 2, qtyScrap: 3, qtyRework: 1 },
      ),
    ).not.toThrow();
    expect(() =>
      assertOutputDelta(
        { qtyPlanned: 10, qtyGood: 8, qtyScrap: 0, qtyRework: 0 },
        { qtyGood: 3, qtyScrap: 0, qtyRework: 0 },
      ),
    ).toThrow("จำนวนดีเกินจำนวนเป้าหมายตามแผน");
  });

  it("คำนวณ due risk โดยไม่เดาวันที่เมื่อไม่มี deadline", () => {
    const now = new Date("2026-08-22T00:00:00.000Z");
    expect(dueRiskOf(null, "RELEASED", now)).toBe("UNSCHEDULED");
    expect(dueRiskOf(new Date("2026-08-21T00:00:00.000Z"), "RELEASED", now)).toBe(
      "OVERDUE",
    );
    expect(dueRiskOf(new Date("2026-08-23T00:00:00.000Z"), "RELEASED", now)).toBe(
      "AT_RISK",
    );
  });
});
