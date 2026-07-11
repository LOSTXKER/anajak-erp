import type {
  SyncMode,
  SyncPageResult,
  SyncProductEntry,
} from "@/lib/stock-sync";

export type SyncDialogPhase =
  | "idle"
  | "syncing"
  | "done"
  | "error"
  | "cancelled";

export interface SyncTotals {
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  errors: string[];
}

export interface SyncLogEntry {
  type: "info" | "product" | "error";
  text: string;
  productEntry?: SyncProductEntry;
}

export interface SyncDialogState {
  phase: SyncDialogPhase;
  mode: SyncMode;
  elapsed: number;
  showErrors: boolean;
  currentPage: number;
  totalPages: number;
  totalProducts: number;
  processedCount: number;
  recentProducts: SyncProductEntry[];
  totals: SyncTotals;
  errorMessage: string | null;
  cancelRequested: boolean;
  activityStatus: string;
  logEntries: SyncLogEntry[];
  lastFailedPage: number | null;
}

export type SyncDialogEvent =
  | { type: "RESET" }
  | { type: "START"; mode: SyncMode; resume: boolean }
  | { type: "TICK"; elapsed: number }
  | { type: "PAGE_STARTED"; page: number }
  | { type: "PAGE_SUCCEEDED"; result: SyncPageResult }
  | { type: "CANCEL_REQUESTED" }
  | { type: "FINISHED"; elapsed: number; cancelled: boolean }
  | { type: "FAILED"; elapsed: number; message: string; page: number }
  | { type: "TOGGLE_ERRORS" };

const CONNECTING_MESSAGE = "กำลังเชื่อมต่อ Anajak Stock...";
const MAX_LOG_ENTRIES = 50;
const MAX_RECENT_PRODUCTS = 30;

export function createInitialSyncDialogState(): SyncDialogState {
  return {
    phase: "idle",
    mode: "full",
    elapsed: 0,
    showErrors: false,
    currentPage: 0,
    totalPages: 0,
    totalProducts: 0,
    processedCount: 0,
    recentProducts: [],
    totals: {
      productsCreated: 0,
      productsUpdated: 0,
      variantsCreated: 0,
      variantsUpdated: 0,
      errors: [],
    },
    errorMessage: null,
    cancelRequested: false,
    activityStatus: "",
    logEntries: [],
    lastFailedPage: null,
  };
}

function appendLogs(
  current: SyncLogEntry[],
  entries: SyncLogEntry[]
): SyncLogEntry[] {
  return [...current, ...entries].slice(-MAX_LOG_ENTRIES);
}

function pageLogEntries(result: SyncPageResult): SyncLogEntry[] {
  const variantTotal = result.variantsCreated + result.variantsUpdated;
  const count = result.syncedProducts.length;

  return [
    {
      type: "info",
      text: `พบ ${count} สินค้า${variantTotal > 0 ? `, ${variantTotal} ตัวเลือก` : ""}`,
    },
    ...result.syncedProducts.map((productEntry) => ({
      type: "product" as const,
      text: "",
      productEntry,
    })),
    ...result.errors.map((text) => ({ type: "error" as const, text })),
  ];
}

export function syncDialogReducer(
  state: SyncDialogState,
  event: SyncDialogEvent
): SyncDialogState {
  switch (event.type) {
    case "RESET":
      return createInitialSyncDialogState();

    case "START": {
      const base = event.resume ? state : createInitialSyncDialogState();
      return {
        ...base,
        phase: "syncing",
        mode: event.mode,
        elapsed: 0,
        showErrors: false,
        errorMessage: null,
        cancelRequested: false,
        activityStatus: CONNECTING_MESSAGE,
        logEntries: [{ type: "info", text: CONNECTING_MESSAGE }],
        lastFailedPage: null,
      };
    }

    case "TICK":
      return state.phase === "syncing"
        ? { ...state, elapsed: event.elapsed }
        : state;

    case "PAGE_STARTED":
      if (state.phase !== "syncing") return state;
      return {
        ...state,
        currentPage: event.page,
        activityStatus: "กำลังดึงรายการสินค้า...",
        logEntries: appendLogs(state.logEntries, [
          { type: "info", text: "กำลังดึงรายการสินค้าจาก Stock..." },
        ]),
      };

    case "PAGE_SUCCEEDED": {
      if (state.phase !== "syncing") return state;
      const { result } = event;
      const count = result.syncedProducts.length;

      return {
        ...state,
        totalPages: result.totalPages,
        totalProducts: result.totalProducts,
        processedCount: state.processedCount + count,
        recentProducts: [
          ...state.recentProducts,
          ...result.syncedProducts,
        ].slice(-MAX_RECENT_PRODUCTS),
        totals: {
          productsCreated:
            state.totals.productsCreated + result.productsCreated,
          productsUpdated:
            state.totals.productsUpdated + result.productsUpdated,
          variantsCreated:
            state.totals.variantsCreated + result.variantsCreated,
          variantsUpdated:
            state.totals.variantsUpdated + result.variantsUpdated,
          errors: [...state.totals.errors, ...result.errors],
        },
        activityStatus: result.hasMore
          ? "กำลังดึงสินค้าเพิ่มเติม..."
          : `กำลังบันทึก ${count} สินค้า...`,
        logEntries: appendLogs(state.logEntries, pageLogEntries(result)),
      };
    }

    case "CANCEL_REQUESTED":
      if (state.phase !== "syncing" || state.cancelRequested) return state;
      return {
        ...state,
        cancelRequested: true,
        activityStatus: "กำลังหยุดหลังจบสินค้าชุดนี้...",
      };

    case "FINISHED":
      if (state.phase !== "syncing") return state;
      return {
        ...state,
        phase: event.cancelled ? "cancelled" : "done",
        elapsed: event.elapsed,
        cancelRequested: event.cancelled,
        activityStatus: event.cancelled ? "Sync ถูกยกเลิก" : "Sync สำเร็จ!",
        logEntries: appendLogs(state.logEntries, [
          {
            type: "info",
            text: event.cancelled ? "Sync ถูกยกเลิก" : "Sync สำเร็จ!",
          },
        ]),
      };

    case "FAILED":
      if (state.phase !== "syncing") return state;
      return {
        ...state,
        phase: "error",
        elapsed: event.elapsed,
        errorMessage: event.message,
        cancelRequested: false,
        activityStatus: "เกิดข้อผิดพลาด",
        lastFailedPage: event.page,
        logEntries: appendLogs(state.logEntries, [
          { type: "error", text: event.message },
        ]),
      };

    case "TOGGLE_ERRORS":
      return { ...state, showErrors: !state.showErrors };
  }
}
