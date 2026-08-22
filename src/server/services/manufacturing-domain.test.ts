import { describe, expect, it } from "vitest";

import {
  ManufacturingDomainError,
  assertRoutingConvergesToFinalPack,
  assertDefectDisposition,
  assertCompletionOwnerBelongsToOrder,
  assertExceptionTransition,
  assertOperationCompletable,
  assertOperationBelongsToProduction,
  assertPrintRunItemResult,
  assertOperationTransition,
  assertQuantityInvariant,
  assertReworkCompletion,
  assertReworkTransition,
  assertRoutingVersionMutable,
  assertWorkOrderTransition,
  evaluateOperationReadiness,
  forwardableQuantity,
  reportOperationOutput,
  resolveReworkOutput,
  validateRoutingGraph,
} from "./manufacturing-domain";

describe("manufacturing state transitions", () => {
  it("allows the canonical work-order path and rejects reopening completion", () => {
    expect(() => assertWorkOrderTransition("DRAFT", "RELEASED")).not.toThrow();
    expect(() => assertWorkOrderTransition("RELEASED", "IN_PROGRESS")).not.toThrow();
    expect(() => assertWorkOrderTransition("IN_PROGRESS", "COMPLETED")).not.toThrow();
    expect(() => assertWorkOrderTransition("COMPLETED", "IN_PROGRESS")).toThrow(
      "ใบผลิต เปลี่ยนจาก COMPLETED ไป IN_PROGRESS ไม่ได้",
    );
  });

  it("lets a running operation pause to READY but not jump back to PLANNED", () => {
    expect(() => assertOperationTransition("RUNNING", "READY")).not.toThrow();
    expect(() => assertOperationTransition("RUNNING", "PLANNED")).toThrow(
      "งานสถานี เปลี่ยนจาก RUNNING ไป PLANNED ไม่ได้",
    );
  });

  it("keeps exception and rework lifecycles ordered", () => {
    expect(() => assertExceptionTransition("OPEN", "ACKNOWLEDGED")).not.toThrow();
    expect(() => assertExceptionTransition("OPEN", "CLOSED")).toThrow();
    expect(() => assertReworkTransition("PLANNED", "RELEASED")).not.toThrow();
    expect(() => assertReworkTransition("IN_PROGRESS", "COMPLETED")).toThrow();
  });

  it("treats a repeated transition to the same state as an idempotent no-op", () => {
    expect(() => assertOperationTransition("READY", "READY")).not.toThrow();
  });
});

describe("routing graph", () => {
  it("returns a stable order while preserving parallel lanes", () => {
    expect(
      validateRoutingGraph(["prep", "dtf", "outsource", "press", "qc"], [
        { predecessorOperationId: "prep", successorOperationId: "press" },
        { predecessorOperationId: "dtf", successorOperationId: "press" },
        { predecessorOperationId: "outsource", successorOperationId: "qc" },
        { predecessorOperationId: "press", successorOperationId: "qc" },
      ]),
    ).toEqual(["prep", "dtf", "outsource", "press", "qc"]);
  });

  it("rejects a cycle", () => {
    expect(() =>
      validateRoutingGraph(["a", "b", "c"], [
        { predecessorOperationId: "a", successorOperationId: "b" },
        { predecessorOperationId: "b", successorOperationId: "c" },
        { predecessorOperationId: "c", successorOperationId: "a" },
      ]),
    ).toThrow("Routing มีวงวน");
  });

  it("rejects unknown, self and duplicate dependencies", () => {
    expect(() =>
      validateRoutingGraph(["a"], [
        { predecessorOperationId: "a", successorOperationId: "missing" },
      ]),
    ).toThrow("Dependency อ้างงานที่ไม่มี");
    expect(() =>
      validateRoutingGraph(["a"], [
        { predecessorOperationId: "a", successorOperationId: "a" },
      ]),
    ).toThrow("รอตัวเองไม่ได้");
    expect(() =>
      validateRoutingGraph(["a", "b"], [
        { predecessorOperationId: "a", successorOperationId: "b" },
        { predecessorOperationId: "a", successorOperationId: "b" },
      ]),
    ).toThrow("Dependency a → b ซ้ำ");
  });

  it("rejects an empty routing and duplicate operation ids", () => {
    expect(() => validateRoutingGraph([], [])).toThrow("อย่างน้อยหนึ่งงาน");
    expect(() => validateRoutingGraph(["a", "a"], [])).toThrow("งาน a ซ้ำ");
  });

  it("ยอมให้หลายสายงานทำขนานแล้วรวมกันที่ขั้นแพ็กสุดท้าย", () => {
    expect(
      assertRoutingConvergesToFinalPack(
        [
          { id: "prep", operationCode: "PREP" },
          { id: "dtf", operationCode: "DTF_PRINT" },
          { id: "outsource", operationCode: "OUTSOURCE" },
          { id: "press", operationCode: "HEAT_PRESS" },
          { id: "qc", operationCode: "FINAL_QC" },
          { id: "pack", operationCode: "FINAL_PACK" },
        ],
        [
          { predecessorOperationId: "prep", successorOperationId: "press" },
          { predecessorOperationId: "dtf", successorOperationId: "press" },
          { predecessorOperationId: "outsource", successorOperationId: "qc" },
          { predecessorOperationId: "press", successorOperationId: "qc" },
          { predecessorOperationId: "qc", successorOperationId: "pack" },
        ],
      ),
    ).toBe("pack");
  });

  it("บังคับให้มีขั้นแพ็กสุดท้ายเพียงหนึ่งขั้น", () => {
    expect(() =>
      assertRoutingConvergesToFinalPack(
        [{ id: "prep", operationCode: "PREP" }],
        [],
      ),
    ).toThrow("ขั้นแพ็กสุดท้ายเพียงหนึ่งขั้น");
    expect(() =>
      assertRoutingConvergesToFinalPack(
        [
          { id: "pack-a", operationCode: "FINAL_PACK" },
          { id: "pack-b", operationCode: "FINAL_PACK" },
        ],
        [],
      ),
    ).toThrow("ขั้นแพ็กสุดท้ายเพียงหนึ่งขั้น");
  });

  it("ปฏิเสธสายงานที่แยกขาดและไม่ส่งต่อถึงขั้นแพ็กสุดท้าย", () => {
    expect(() =>
      assertRoutingConvergesToFinalPack(
        [
          { id: "prep", operationCode: "PREP" },
          { id: "pack", operationCode: "FINAL_PACK" },
          { id: "detached", operationCode: "OUTSOURCE" },
        ],
        [{ predecessorOperationId: "prep", successorOperationId: "pack" }],
      ),
    ).toThrow("จุดจบมากกว่าหนึ่งจุด");
  });

  it("ปฏิเสธเส้นทางที่มีจุดจบที่สอง", () => {
    expect(() =>
      assertRoutingConvergesToFinalPack(
        [
          { id: "prep", operationCode: "PREP" },
          { id: "pack", operationCode: "FINAL_PACK" },
          { id: "handoff", operationCode: "OUTSOURCE" },
        ],
        [
          { predecessorOperationId: "prep", successorOperationId: "pack" },
          { predecessorOperationId: "prep", successorOperationId: "handoff" },
        ],
      ),
    ).toThrow("จุดจบมากกว่าหนึ่งจุด");
  });

  it("ปฏิเสธขั้นแพ็กที่ยังมีงานต่อท้าย", () => {
    expect(() =>
      assertRoutingConvergesToFinalPack(
        [
          { id: "prep", operationCode: "PREP" },
          { id: "pack", operationCode: "FINAL_PACK" },
          { id: "after-pack", operationCode: "CUSTOM" },
        ],
        [
          { predecessorOperationId: "prep", successorOperationId: "pack" },
          { predecessorOperationId: "pack", successorOperationId: "after-pack" },
        ],
      ),
    ).toThrow("ขั้นแพ็กสุดท้ายต้องเป็นขั้นจบ");
  });

  it("protects released routing versions", () => {
    expect(() => assertRoutingVersionMutable("DRAFT")).not.toThrow();
    expect(() => assertRoutingVersionMutable("RELEASED")).toThrow(
      "Routing เวอร์ชันที่ Release แล้วแก้ไม่ได้",
    );
  });
});

describe("manufacturing ownership scope", () => {
  it("allows exactly one owner pointer only inside the same order/production scope", () => {
    expect(() =>
      assertCompletionOwnerBelongsToOrder({
        orderId: "order-1",
        ownerProductionOrderId: "order-1",
      }),
    ).not.toThrow();
    expect(() =>
      assertCompletionOwnerBelongsToOrder({
        orderId: "order-1",
        ownerProductionOrderId: "order-2",
      }),
    ).toThrow("ต้องอยู่ในออเดอร์เดียวกัน");
    expect(() =>
      assertOperationBelongsToProduction({
        productionId: "production-1",
        operationProductionId: "production-2",
      }),
    ).toThrow("ต้องอยู่ในใบผลิตเดียวกัน");
  });
});

describe("operation readiness", () => {
  it("is ready only when execution is enabled, blockers are clear and every predecessor completed", () => {
    expect(
      evaluateOperationReadiness({
        state: "PLANNED",
        executionEnabled: true,
        blockingExceptionCount: 0,
        predecessors: [
          { operationId: "prep", state: "COMPLETED" },
          { operationId: "dtf", state: "COMPLETED" },
        ],
      }),
    ).toEqual({
      ready: true,
      waitingOnOperationIds: [],
      blockedByException: false,
      executionDisabled: false,
    });
  });

  it("reports every incomplete predecessor and structured blocker", () => {
    expect(
      evaluateOperationReadiness({
        state: "BLOCKED",
        executionEnabled: true,
        blockingExceptionCount: 1,
        predecessors: [
          { operationId: "prep", state: "READY" },
          { operationId: "dtf", state: "RUNNING" },
        ],
      }),
    ).toEqual({
      ready: false,
      waitingOnOperationIds: ["prep", "dtf"],
      blockedByException: true,
      executionDisabled: false,
    });
  });

  it("keeps a READY/RUNNING job prerequisite-ready but never reopens terminal states", () => {
    expect(
      evaluateOperationReadiness({
        state: "READY",
        executionEnabled: true,
        blockingExceptionCount: 0,
        predecessors: [],
      }).ready,
    ).toBe(true);
    expect(
      evaluateOperationReadiness({
        state: "RUNNING",
        executionEnabled: true,
        blockingExceptionCount: 0,
        predecessors: [],
      }).ready,
    ).toBe(true);
    expect(
      evaluateOperationReadiness({
        state: "COMPLETED",
        executionEnabled: true,
        blockingExceptionCount: 0,
        predecessors: [],
      }).ready,
    ).toBe(false);
  });
});

describe("manufacturing quantities", () => {
  const empty = { qtyPlanned: 10, qtyGood: 0, qtyScrap: 0, qtyRework: 0 };

  it("reports partial output without closing the operation", () => {
    expect(reportOperationOutput(empty, { qtyGood: 6, qtyScrap: 1, qtyRework: 1 })).toEqual({
      qtyPlanned: 10,
      qtyGood: 6,
      qtyScrap: 1,
      qtyRework: 1,
    });
  });

  it("keeps scrap as attempt history while replacement good units reach the target", () => {
    expect(
      reportOperationOutput(
        { qtyPlanned: 10, qtyGood: 8, qtyScrap: 2, qtyRework: 0 },
        { qtyGood: 2, qtyScrap: 0, qtyRework: 0 },
      ),
    ).toEqual({ qtyPlanned: 10, qtyGood: 10, qtyScrap: 2, qtyRework: 0 });
  });

  it("rejects fractions, negatives, empty reports and totals over plan", () => {
    expect(() => assertQuantityInvariant({ ...empty, qtyGood: 1.5 })).toThrow("จำนวนเต็ม");
    expect(() => assertQuantityInvariant({ ...empty, qtyScrap: -1 })).toThrow("ตั้งแต่ 0");
    expect(() =>
      reportOperationOutput(empty, { qtyGood: 0, qtyScrap: 0, qtyRework: 0 }),
    ).toThrow("อย่างน้อยหนึ่งรายการ");
    expect(() =>
      reportOperationOutput(empty, { qtyGood: 11, qtyScrap: 2, qtyRework: 0 }),
    ).toThrow("จำนวนดีเกิน");
  });

  it("moves rework to good or scrap only after a reinspection result", () => {
    const current = { qtyPlanned: 10, qtyGood: 6, qtyScrap: 3, qtyRework: 3 };
    expect(resolveReworkOutput({ current, qtyFromRework: 2, disposition: "GOOD" })).toEqual({
      qtyPlanned: 10,
      qtyGood: 8,
      qtyScrap: 3,
      qtyRework: 1,
    });
    expect(resolveReworkOutput({ current, qtyFromRework: 3, disposition: "SCRAP" })).toEqual({
      qtyPlanned: 10,
      qtyGood: 6,
      qtyScrap: 6,
      qtyRework: 0,
    });
    expect(() =>
      resolveReworkOutput({ current, qtyFromRework: 4, disposition: "GOOD" }),
    ).toThrow("มากกว่าจำนวนที่รอแก้");
  });

  it("allows completion only when all planned units are accounted and no rework remains", () => {
    expect(() =>
      assertOperationCompletable({ qtyPlanned: 10, qtyGood: 10, qtyScrap: 2, qtyRework: 0 }),
    ).not.toThrow();
    expect(() =>
      assertOperationCompletable({ qtyPlanned: 10, qtyGood: 8, qtyScrap: 2, qtyRework: 1 }),
    ).toThrow("ต้องตรวจซ้ำ");
    expect(() =>
      assertOperationCompletable({ qtyPlanned: 10, qtyGood: 9, qtyScrap: 3, qtyRework: 0 }),
    ).toThrow("จำนวนดียังไม่ครบ");
  });

  it("forwards good quantity only", () => {
    expect(
      forwardableQuantity({ qtyPlanned: 10, qtyGood: 6, qtyScrap: 2, qtyRework: 2 }),
    ).toBe(6);
  });
});

describe("quality and rework gates", () => {
  it("requires Hold/Rework/Scrap for every rejected quantity", () => {
    expect(() => assertDefectDisposition({ qtyDefect: 1, disposition: null })).toThrow(
      "ต้องเลือกพักงาน ส่งแก้ หรือคัดทิ้ง",
    );
    expect(() => assertDefectDisposition({ qtyDefect: 1, disposition: "REWORK" })).not.toThrow();
    expect(() => assertDefectDisposition({ qtyDefect: 0, disposition: null })).not.toThrow();
  });

  it("does not close required rework before a passed reinspection", () => {
    expect(() =>
      assertReworkCompletion({
        requiresReinspection: true,
        reinspectedAt: null,
        reinspectionPassed: null,
      }),
    ).toThrow("ต้องผ่านการตรวจซ้ำ");
    expect(() =>
      assertReworkCompletion({
        requiresReinspection: true,
        reinspectedAt: new Date("2026-08-22T00:00:00Z"),
        reinspectionPassed: true,
      }),
    ).not.toThrow();
  });

  it("returns typed domain codes to command adapters", () => {
    try {
      assertRoutingVersionMutable("RELEASED");
      throw new Error("expected guard to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ManufacturingDomainError);
      expect((error as ManufacturingDomainError).code).toBe("RELEASED_ROUTING_IMMUTABLE");
    }
  });
});

describe("DTF print-run results", () => {
  it("supports scrap then reprint until good reaches the original target", () => {
    expect(() =>
      assertPrintRunItemResult({ qty: 10, qtyGood: 8, qtyScrap: 2, qtyReprint: 2 }),
    ).not.toThrow();
    expect(() =>
      assertPrintRunItemResult({ qty: 10, qtyGood: 10, qtyScrap: 2, qtyReprint: 2 }),
    ).not.toThrow();
  });

  it("rejects good above target and reprint without a recorded scrap", () => {
    expect(() =>
      assertPrintRunItemResult({ qty: 10, qtyGood: 11, qtyScrap: 2, qtyReprint: 2 }),
    ).toThrow("เกินจำนวนเป้าหมาย");
    expect(() =>
      assertPrintRunItemResult({ qty: 10, qtyGood: 8, qtyScrap: 1, qtyReprint: 2 }),
    ).toThrow("ไม่เกินจำนวนฟิล์มเสีย");
  });
});
