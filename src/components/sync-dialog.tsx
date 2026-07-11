"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Package,
  Layers,
  ChevronDown,
  ChevronUp,
  Cloud,
  Zap,
  Ban,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatDateTime } from "@/lib/utils";
import type { SyncMode } from "@/lib/stock-sync";
import {
  createInitialSyncDialogState,
  syncDialogReducer,
} from "@/lib/sync-dialog-state";

interface SyncDialogProps {
  open: boolean;
  onClose: () => void;
}

// ─── Component ─────────────────────────────────────────────

export function SyncDialog({ open, onClose }: SyncDialogProps) {
  if (!open) return null;

  return <SyncDialogSession onClose={onClose} />;
}

function SyncDialogSession({ onClose }: Pick<SyncDialogProps, "onClose">) {
  const [state, dispatch] = useReducer(
    syncDialogReducer,
    undefined,
    createInitialSyncDialogState
  );
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const logEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    phase,
    mode,
    elapsed,
    showErrors,
    totalProducts,
    processedCount,
    totals,
    errorMessage,
    cancelRequested,
    activityStatus,
    logEntries,
    lastFailedPage,
  } = state;

  const utils = trpc.useUtils();
  const syncPage = trpc.stockSync.syncPage.useMutation();
  const { data: syncStatus } = trpc.stockSync.status.useQuery(undefined, {
    enabled: true,
  });

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [logEntries.length]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  // ─── Start sync ───────────────────────────────────────────
  const startSync = async (syncMode: SyncMode, startPage = 1) => {
    const resume = startPage > 1;
    dispatch({ type: "START", mode: syncMode, resume });
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    startTimeRef.current = Date.now();
    stopTimer();
    timerRef.current = setInterval(() => {
      dispatch({
        type: "TICK",
        elapsed: Math.floor((Date.now() - startTimeRef.current) / 1000),
      });
    }, 1000);

    let page = startPage;
    let hasMore = true;

    // For incremental mode, use lastSyncAt
    const updatedAfter =
      syncMode === "incremental" && syncStatus?.lastSyncAt
        ? new Date(syncStatus.lastSyncAt).toISOString()
        : null;

    try {
      while (hasMore && !abortController.signal.aborted) {
        dispatch({ type: "PAGE_STARTED", page });

        const pageResult = await syncPage.mutateAsync({
          page,
          mode: syncMode,
          updatedAfter,
        });

        dispatch({ type: "PAGE_SUCCEEDED", result: pageResult });

        hasMore = pageResult.hasMore;
        page++;
      }

      stopTimer();
      dispatch({
        type: "FINISHED",
        elapsed: Math.floor((Date.now() - startTimeRef.current) / 1000),
        cancelled: abortController.signal.aborted,
      });

      utils.product.list.invalidate();
      utils.stockSync.status.invalidate();
    } catch (err) {
      stopTimer();
      const msg =
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดไม่ทราบสาเหตุ";
      dispatch({
        type: "FAILED",
        elapsed: Math.floor((Date.now() - startTimeRef.current) / 1000),
        message: msg,
        page,
      });
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  };

  // ─── Cancel ───────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    dispatch({ type: "CANCEL_REQUESTED" });
    abortControllerRef.current?.abort();
  }, []);

  // Cleanup in-flight work on unmount.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      stopTimer();
    };
  }, [stopTimer]);

  const totalChanges =
    totals.productsCreated +
    totals.productsUpdated +
    totals.variantsCreated +
    totals.variantsUpdated;
  const hasErrors = totals.errors.length > 0;
  const isCancelled = phase === "cancelled";
  const progressPct =
    totalProducts > 0
      ? Math.min(Math.round((processedCount / totalProducts) * 100), 100)
      : 0;

  return (
    <Dialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen && phase !== "syncing") onClose();
      }}
    >
      <DialogContent
        className={`gap-0 sm:max-w-md ${phase === "syncing" ? "[&>button]:hidden" : ""}`}
        aria-busy={phase === "syncing"}
        onEscapeKeyDown={(event) => {
          if (phase === "syncing") event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (phase === "syncing") event.preventDefault();
        }}
      >
        <div>
          {/* ════════════════════════════════════════════════════
              IDLE — Mode selection
             ════════════════════════════════════════════════════ */}
          {phase === "idle" && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
                <Cloud className="h-8 w-8 text-blue-500" />
              </div>
              <DialogTitle className="text-center text-lg">
                Sync จาก Anajak Stock
              </DialogTitle>
              <DialogDescription className="mt-2 text-center">
                ดึงข้อมูลสินค้า, Variant, ราคา และสต็อกมาอัปเดตในระบบ ERP
              </DialogDescription>

              {/* Last sync info */}
              {syncStatus?.lastSyncAt && (
                <p className="mt-2 text-xs text-slate-400">
                  Sync ล่าสุด: {formatDateTime(syncStatus.lastSyncAt)}
                </p>
              )}

              {/* Mode buttons */}
              <div className="mt-5 space-y-2">
                <Button
                  onClick={() => startSync("full")}
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4" />
                  Sync ทั้งหมด
                </Button>

                {syncStatus?.lastSyncAt && (
                  <Button
                    variant="outline"
                    onClick={() => startSync("incremental")}
                    className="w-full"
                  >
                    <Zap className="h-4 w-4" />
                    Sync เฉพาะที่เปลี่ยน
                  </Button>
                )}

                <Button variant="ghost" onClick={onClose} className="w-full">
                  ยกเลิก
                </Button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════
              SYNCING — Progress
             ════════════════════════════════════════════════════ */}
          {phase === "syncing" && (
            <div>
              {/* Header */}
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center">
                  <div className="relative">
                    <div className="h-14 w-14 animate-spin rounded-full border-4 border-blue-100 border-t-blue-500 dark:border-slate-700 dark:border-t-blue-400" />
                    <RefreshCw className="absolute top-1/2 left-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-blue-500" />
                  </div>
                </div>

                {/* Dynamic activity status */}
                <DialogTitle className="text-center text-lg" aria-live="polite">
                  {activityStatus || "กำลัง Sync..."}
                </DialogTitle>

                {/* Mode badge */}
                <DialogDescription className="mt-1 text-center text-xs">
                  {mode === "full" ? "Sync ทั้งหมด" : "Sync เฉพาะที่เปลี่ยน"}
                </DialogDescription>

                {/* Counter */}
                {totalProducts > 0 && (
                  <p className="mt-2 text-sm font-medium tabular-nums text-blue-600 dark:text-blue-400">
                    {processedCount}/{totalProducts} สินค้า
                  </p>
                )}
              </div>

              {/* Progress bar */}
              {totalProducts > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{progressPct}%</span>
                    <span>{elapsed} วินาที</span>
                  </div>
                  <div
                    className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                    role="progressbar"
                    aria-label="ความคืบหน้าการ Sync"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progressPct}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Live running counters */}
              {(totals.productsCreated + totals.productsUpdated > 0 ||
                totals.variantsCreated + totals.variantsUpdated > 0) && (
                <div className="mt-3 flex items-center justify-center gap-3 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  <span>
                    <Package className="mr-1 inline h-3 w-3" />
                    สินค้า{" "}
                    {totals.productsCreated + totals.productsUpdated}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <span>
                    <Layers className="mr-1 inline h-3 w-3" />
                    ตัวเลือก{" "}
                    {totals.variantsCreated + totals.variantsUpdated}
                  </span>
                  {totals.errors.length > 0 && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">|</span>
                      <span className="text-red-500">
                        <AlertTriangle className="mr-1 inline h-3 w-3" />
                        {totals.errors.length}
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* Live log — always visible */}
              <div
                className="mt-4 max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-left dark:border-slate-700 dark:bg-slate-800/50"
                role="log"
                aria-live="polite"
                aria-relevant="additions text"
              >
                {logEntries.length === 0 ? (
                  <div className="flex items-center gap-2 py-1 text-xs text-slate-400">
                    <span
                      className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-400"
                    />
                    <span>กำลังเริ่มต้น...</span>
                  </div>
                ) : (
                  logEntries.map((entry, i) => {
                    const isLast = i === logEntries.length - 1;

                    // System info message
                    if (entry.type === "info") {
                      return (
                        <div
                          key={`log-${i}`}
                          className={`flex items-center gap-2 py-1 text-xs ${
                            isLast
                              ? "font-medium text-blue-600 dark:text-blue-400"
                              : "text-slate-400 dark:text-slate-500"
                          }`}
                        >
                          {isLast ? (
                            <span
                              className="inline-block h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-blue-400"
                            />
                          ) : (
                            <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />
                          )}
                          <span className="truncate">{entry.text}</span>
                        </div>
                      );
                    }

                    // Error message
                    if (entry.type === "error") {
                      return (
                        <div
                          key={`log-${i}`}
                          className="flex items-start gap-2 py-1 text-xs text-red-500"
                        >
                          <XCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{entry.text}</span>
                        </div>
                      );
                    }

                    // Product entry
                    const pe = entry.productEntry;
                    if (!pe) return null;
                    return (
                      <div
                        key={`log-${i}`}
                        className={`flex items-start gap-2 py-1 text-xs ${
                          isLast
                            ? "font-medium text-slate-700 dark:text-slate-200"
                            : "text-slate-400 dark:text-slate-500"
                        }`}
                      >
                        {pe.status === "error" ? (
                          <XCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-red-500" />
                        ) : pe.status === "created" ? (
                          <Package className="mt-0.5 h-3 w-3 flex-shrink-0 text-blue-500" />
                        ) : (
                          <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-green-500" />
                        )}
                        <span className="truncate">
                          {pe.sku} — {pe.name}
                          {pe.variantCount > 0 && (
                            <span className="ml-1 text-slate-400">
                              ({pe.variantCount} ตัวเลือก)
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={logEndRef} />
              </div>

              {/* Cancel button */}
              <div className="mt-4 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={cancelRequested}
                  className="text-slate-500"
                >
                  <Ban className="h-3.5 w-3.5" />
                  {cancelRequested ? "กำลังหยุด..." : "ยกเลิก"}
                </Button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════
              DONE — Summary
             ════════════════════════════════════════════════════ */}
          {(phase === "done" || phase === "cancelled") && (
            <div>
              <div className="text-center">
                <div
                  className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
                    isCancelled
                      ? "bg-amber-50 dark:bg-amber-950"
                      : "bg-green-50 dark:bg-green-950"
                  }`}
                >
                  {isCancelled ? (
                    <Ban className="h-8 w-8 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  )}
                </div>
                <DialogTitle className="text-center text-lg">
                  {isCancelled ? "Sync ถูกยกเลิก" : "Sync สำเร็จ!"}
                </DialogTitle>
                <DialogDescription className="mt-1 text-center">
                  ใช้เวลา {elapsed} วินาที
                  {!isCancelled &&
                    totalChanges === 0 &&
                    " — ข้อมูลเป็นปัจจุบันแล้ว"}
                </DialogDescription>
              </div>

              {/* Stats */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <StatCard
                  icon={<Package className="h-4 w-4" />}
                  label="สินค้าใหม่"
                  value={totals.productsCreated}
                  color="blue"
                />
                <StatCard
                  icon={<Package className="h-4 w-4" />}
                  label="สินค้าอัปเดต"
                  value={totals.productsUpdated}
                  color="indigo"
                />
                <StatCard
                  icon={<Layers className="h-4 w-4" />}
                  label="ตัวเลือกใหม่"
                  value={totals.variantsCreated}
                  color="purple"
                />
                <StatCard
                  icon={<Layers className="h-4 w-4" />}
                  label="ตัวเลือกอัปเดต"
                  value={totals.variantsUpdated}
                  color="violet"
                />
              </div>

              {/* Errors */}
              {hasErrors && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "TOGGLE_ERRORS" })}
                    className="flex min-h-11 w-full items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:hover:bg-amber-950"
                    aria-expanded={showErrors}
                    aria-controls="sync-error-list"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                        {totals.errors.length} ข้อผิดพลาด
                      </span>
                    </div>
                    {showErrors ? (
                      <ChevronUp className="h-4 w-4 text-amber-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-amber-500" />
                    )}
                  </button>
                  {showErrors && (
                    <div
                      id="sync-error-list"
                      className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/30"
                    >
                      {totals.errors.map((err, i) => (
                        <p
                          key={i}
                          className="py-0.5 text-xs text-amber-700 dark:text-amber-300"
                        >
                          • {err}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* No changes */}
              {totalChanges === 0 && !hasErrors && !isCancelled && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-700 dark:bg-slate-800/50">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    ไม่มีการเปลี่ยนแปลง — สินค้าทั้งหมดตรงกับ Anajak Stock แล้ว
                  </p>
                </div>
              )}

              <div className="mt-5 text-center">
                <Button onClick={onClose} className="min-w-[120px]">
                  ปิด
                </Button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════
              ERROR — with retry
             ════════════════════════════════════════════════════ */}
          {phase === "error" && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-950">
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
              <DialogTitle className="text-center text-lg">
                Sync ล้มเหลว
              </DialogTitle>
              <DialogDescription className="mt-2 text-center text-red-700 dark:text-red-400" role="alert">
                {errorMessage || "เกิดข้อผิดพลาดไม่ทราบสาเหตุ"}
              </DialogDescription>

              {/* Partial progress info */}
              {processedCount > 0 && (
                <p className="mt-1 text-xs text-slate-400">
                  สำเร็จ {processedCount} สินค้า ก่อนเกิดข้อผิดพลาด
                </p>
              )}

              <p className="mt-2 text-xs text-slate-400">
                ตรวจสอบการเชื่อมต่อ API ที่หน้าตั้งค่า
              </p>

              <div className="mt-5 flex flex-col gap-2">
                {/* Retry from failed page */}
                {lastFailedPage && (
                  <Button onClick={() => startSync(mode, lastFailedPage)}>
                    <RefreshCw className="h-4 w-4" />
                    ลองใหม่ (ต่อจากหน้า {lastFailedPage})
                  </Button>
                )}
                {/* Retry from scratch */}
                <Button
                  variant={lastFailedPage ? "outline" : "default"}
                  onClick={() => startSync(mode)}
                >
                  <RefreshCw className="h-4 w-4" />
                  เริ่มใหม่ทั้งหมด
                </Button>
                <Button variant="ghost" onClick={onClose}>
                  ปิด
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Stat Card ─────────────────────────────────────────────

const colorMap: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  indigo:
    "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  purple:
    "bg-slate-50 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
  violet:
    "bg-slate-50 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
};

const iconColorMap: Record<string, string> = {
  blue: "text-blue-500",
  indigo: "text-blue-500",
  purple: "text-slate-500",
  violet: "text-slate-500",
};

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`rounded-xl p-3 ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center gap-2">
        <span className={iconColorMap[color] || iconColorMap.blue}>{icon}</span>
        <span className="text-xs opacity-80">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
