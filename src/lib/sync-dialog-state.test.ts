import { describe, expect, it } from "vitest";
import type { SyncPageResult } from "./stock-sync";
import {
  createInitialSyncDialogState,
  syncDialogReducer,
  type SyncDialogEvent,
  type SyncDialogPhase,
} from "./sync-dialog-state";

const pageResult: SyncPageResult = {
  productsCreated: 1,
  productsUpdated: 1,
  variantsCreated: 2,
  variantsUpdated: 0,
  errors: [],
  costDeviations: [],
  page: 1,
  totalPages: 1,
  totalProducts: 2,
  hasMore: false,
  syncedProducts: [
    {
      sku: "TS-001",
      name: "เสื้อทดสอบ",
      status: "created",
      variantCount: 2,
    },
    {
      sku: "TS-002",
      name: "เสื้อเดิม",
      status: "updated",
      variantCount: 0,
    },
  ],
};

function run(events: SyncDialogEvent[]) {
  return events.reduce(syncDialogReducer, createInitialSyncDialogState());
}

describe("syncDialogReducer", () => {
  it.each<{
    name: string;
    events: SyncDialogEvent[];
    expectedPhase: SyncDialogPhase;
  }>([
    {
      name: "idle → syncing → done",
      events: [
        { type: "START", mode: "full", resume: false },
        { type: "PAGE_STARTED", page: 1 },
        { type: "PAGE_SUCCEEDED", result: pageResult },
        { type: "FINISHED", elapsed: 3, cancelled: false },
      ],
      expectedPhase: "done",
    },
    {
      name: "idle → syncing → error",
      events: [
        { type: "START", mode: "incremental", resume: false },
        { type: "PAGE_STARTED", page: 2 },
        { type: "FAILED", elapsed: 4, message: "Stock ไม่ตอบ", page: 2 },
      ],
      expectedPhase: "error",
    },
    {
      name: "idle → syncing → cancelled",
      events: [
        { type: "START", mode: "full", resume: false },
        { type: "PAGE_STARTED", page: 1 },
        { type: "CANCEL_REQUESTED" },
        { type: "FINISHED", elapsed: 2, cancelled: true },
      ],
      expectedPhase: "cancelled",
    },
  ])("เปลี่ยนสถานะ $name โดยไม่ล้างความคืบหน้า", ({ events, expectedPhase }) => {
    const state = run(events);

    expect(state.phase).toBe(expectedPhase);
    expect(state.currentPage).toBeGreaterThan(0);
    if (expectedPhase === "done") {
      expect(state.processedCount).toBe(2);
      expect(state.totals.productsCreated).toBe(1);
    }
    if (expectedPhase === "cancelled") {
      expect(state.cancelRequested).toBe(true);
    }
  });

  it.each<SyncDialogPhase>(["syncing", "done", "error", "cancelled"])(
    "RESET จาก %s กลับค่าเริ่มต้นครบชุด",
    (phase) => {
      const dirty = {
        ...createInitialSyncDialogState(),
        phase,
        processedCount: 12,
        errorMessage: "ค้าง",
        cancelRequested: true,
        logEntries: [{ type: "error" as const, text: "ค้าง" }],
      };

      expect(syncDialogReducer(dirty, { type: "RESET" })).toEqual(
        createInitialSyncDialogState()
      );
    }
  );

  it("retry ต่อจากหน้าที่พังโดยเก็บยอดเดิมและสะสมผลหน้าถัดไป", () => {
    const failed = run([
      { type: "START", mode: "full", resume: false },
      { type: "PAGE_STARTED", page: 1 },
      { type: "PAGE_SUCCEEDED", result: { ...pageResult, hasMore: true } },
      { type: "FAILED", elapsed: 5, message: "หลุด", page: 2 },
    ]);
    const retried = [
      { type: "START", mode: "full", resume: true } as const,
      { type: "PAGE_STARTED", page: 2 } as const,
      { type: "PAGE_SUCCEEDED", result: { ...pageResult, page: 2 } } as const,
      { type: "FINISHED", elapsed: 2, cancelled: false } as const,
    ].reduce(syncDialogReducer, failed);

    expect(retried.phase).toBe("done");
    expect(retried.processedCount).toBe(4);
    expect(retried.totals.productsCreated).toBe(2);
    expect(retried.lastFailedPage).toBeNull();
  });
});
