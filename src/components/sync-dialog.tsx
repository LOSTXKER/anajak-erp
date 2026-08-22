"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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

import { cn } from "@/lib/utils";
import { TINT } from "@/components/ui/tokens";

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
                <p className="mt-2 text-xs text-muted">
                  Sync ล่าสุด: {formatDateTime(syncStatus.lastSyncAt)}
                </p>
              )}

              {/* Mode buttons */}
              <div className="mt-5 space-y-2">
                <Button
                  onClick={() => startSync("full")}
                  className="w-full"
                >
                  <RefreshCw />
                  Sync ทั้งหมด
                </Button>

                {syncStatus?.lastSyncAt && (
                  <Button
                    variant="outline"
                    onClick={() => startSync("incremental")}
                    className="w-full"
                  >
                    <Zap />
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
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center text-blue-500 dark:text-blue-400">
                  <Spinner size="xl" />
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
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>{progressPct}%</span>
                    <span>{elapsed} วินาที</span>
                  </div>
                  <div
                    className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-border"
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
                <div className="mt-3 flex items-center justify-center gap-3 text-xs tabular-nums text-muted">
                  <span>
                    <Package className="mr-1 inline h-3 w-3" />
                    สินค้า{" "}
                    {totals.productsCreated + totals.productsUpdated}
                  </span>
                  <span className="text-divider">|</span>
                  <span>
                    <Layers className="mr-1 inline h-3 w-3" />
                    ตัวเลือก{" "}
                    {totals.variantsCreated + totals.variantsUpdated}
                  </span>
                  {totals.errors.length > 0 && (
                    <>
                      <span className="text-divider">|</span>
                      <span className="text-red-700 dark:text-red-300">
                        <AlertTriangle className="mr-1 inline h-3 w-3" />
                        {totals.errors.length}
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* Live log — always visible */}
              <div
                className={cn(TINT.neutral, "mt-4 max-h-44 overflow-y-auto rounded-lg border p-2 text-left")}
                role="log"
                aria-live="polite"
                aria-relevant="additions text"
              >
                {logEntries.length === 0 ? (
                  <div className="flex items-center gap-2 py-1 text-xs text-muted">
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
                              : "text-muted"
                          }`}
                        >
                          {isLast ? (
                            <span
                              className="inline-block h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-blue-400"
                            />
                          ) : (
                            <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-border-strong" />
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
                          className="flex items-start gap-2 py-1 text-xs text-red-700 dark:text-red-300"
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
                            ? "font-medium text-strong"
                            : "text-muted"
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
                            <span className="ml-1 text-muted">
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
                  className="text-muted"
                >
                  <Ban />
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
                />
                <StatCard
                  icon={<Package className="h-4 w-4" />}
                  label="สินค้าอัปเดต"
                  value={totals.productsUpdated}
                />
                <StatCard
                  icon={<Layers className="h-4 w-4" />}
                  label="ตัวเลือกใหม่"
                  value={totals.variantsCreated}
                />
                <StatCard
                  icon={<Layers className="h-4 w-4" />}
                  label="ตัวเลือกอัปเดต"
                  value={totals.variantsUpdated}
                />
              </div>

              {/* Errors */}
              {hasErrors && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "TOGGLE_ERRORS" })}
                    className={cn(TINT.warning, "flex min-h-11 w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors hover:bg-amber-100 dark:hover:bg-amber-950")}
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
                      className={cn(TINT.warning, "mt-2 max-h-32 overflow-y-auto rounded-lg border p-3")}
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
                <div className={cn(TINT.neutral, "mt-4 rounded-lg border p-3 text-center")}>
                  <p className="text-sm text-muted">
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
                <p className="mt-1 text-xs text-muted">
                  สำเร็จ {processedCount} สินค้า ก่อนเกิดข้อผิดพลาด
                </p>
              )}

              <p className="mt-2 text-xs text-muted">
                ตรวจสอบการเชื่อมต่อ API ที่หน้าตั้งค่า
              </p>

              <div className="mt-5 flex flex-col gap-2">
                {/* Retry from failed page */}
                {lastFailedPage && (
                  <Button onClick={() => startSync(mode, lastFailedPage)}>
                    <RefreshCw />
                    ลองใหม่ (ต่อจากหน้า {lastFailedPage})
                  </Button>
                )}
                {/* Retry from scratch */}
                <Button
                  variant={lastFailedPage ? "outline" : "default"}
                  onClick={() => startSync(mode)}
                >
                  <RefreshCw />
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

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted p-3 text-secondary">
      <div className="flex items-center gap-2">
        <span className="text-muted">{icon}</span>
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
