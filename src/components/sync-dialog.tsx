"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Package,
  Layers,
  X,
  ChevronDown,
  ChevronUp,
  Cloud,
  Zap,
  Ban,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatDateTime } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────

interface SyncProductEntry {
  sku: string;
  name: string;
  status: "created" | "updated" | "error";
  variantCount: number;
  error?: string;
}

interface SyncTotals {
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  errors: string[];
}

interface LogEntry {
  type: "info" | "product" | "error";
  text: string;
  productEntry?: SyncProductEntry;
}

type SyncPhase = "idle" | "syncing" | "done" | "error";
type SyncMode = "full" | "incremental";

interface SyncDialogProps {
  open: boolean;
  onClose: () => void;
}

// ─── Component ─────────────────────────────────────────────

export function SyncDialog({ open, onClose }: SyncDialogProps) {
  const [phase, setPhase] = useState<SyncPhase>("idle");
  const [mode, setMode] = useState<SyncMode>("full");
  const [elapsed, setElapsed] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const logEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);

  // Progress
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [recentProducts, setRecentProducts] = useState<SyncProductEntry[]>([]);
  const [totals, setTotals] = useState<SyncTotals>({
    productsCreated: 0,
    productsUpdated: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
    errors: [],
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  // Real-time activity status & log
  const [activityStatus, setActivityStatus] = useState("");
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

  // For retry: remember where we stopped
  const [lastFailedPage, setLastFailedPage] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const syncPage = trpc.stockSync.syncPage.useMutation();
  const { data: syncStatus } = trpc.stockSync.status.useQuery(undefined, {
    enabled: open,
  });

  // ─── Reset ────────────────────────────────────────────────
  const resetState = useCallback(() => {
    setPhase("idle");
    setElapsed(0);
    setShowErrors(false);
    setCurrentPage(0);
    setTotalPages(0);
    setTotalProducts(0);
    setProcessedCount(0);
    setRecentProducts([]);
    setTotals({
      productsCreated: 0,
      productsUpdated: 0,
      variantsCreated: 0,
      variantsUpdated: 0,
      errors: [],
    });
    setErrorMessage(null);
    setCancelled(false);
    setLastFailedPage(null);
    setActivityStatus("");
    setLogEntries([]);
    abortRef.current = false;
  }, []);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logEntries.length]);

  // ─── Log helper ──────────────────────────────────────────
  const pushLog = useCallback(
    (type: LogEntry["type"], text: string, productEntry?: SyncProductEntry) => {
      setLogEntries((prev) => [...prev, { type, text, productEntry }].slice(-50));
    },
    []
  );

  // ─── Start sync ───────────────────────────────────────────
  const startSync = useCallback(
    async (syncMode: SyncMode, startPage = 1) => {
      if (startPage === 1) resetState();
      setMode(syncMode);
      setPhase("syncing");
      setCancelled(false);
      abortRef.current = false;
      startTimeRef.current = Date.now();

      // Immediate activity feedback
      setActivityStatus("กำลังเชื่อมต่อ Anajak Stock...");
      setLogEntries([{ type: "info", text: "กำลังเชื่อมต่อ Anajak Stock..." }]);

      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      let page = startPage;
      let hasMore = true;
      const accumulated: SyncTotals =
        startPage > 1
          ? { ...totals }
          : {
              productsCreated: 0,
              productsUpdated: 0,
              variantsCreated: 0,
              variantsUpdated: 0,
              errors: [],
            };

      // For incremental mode, use lastSyncAt
      const updatedAfter =
        syncMode === "incremental" && syncStatus?.lastSyncAt
          ? new Date(syncStatus.lastSyncAt).toISOString()
          : null;

      try {
        while (hasMore && !abortRef.current) {
          setCurrentPage(page);

          // Activity: fetching page
          setActivityStatus("กำลังดึงรายการสินค้า...");
          pushLog("info", "กำลังดึงรายการสินค้าจาก Stock...");

          const pageResult = await syncPage.mutateAsync({
            page,
            mode: syncMode,
            updatedAfter,
          });

          // Activity: processing result
          const count = pageResult.syncedProducts.length;
          const variantTotal = pageResult.variantsCreated + pageResult.variantsUpdated;
          setActivityStatus(
            `กำลังบันทึก ${count} สินค้า...`
          );
          pushLog(
            "info",
            `พบ ${count} สินค้า${variantTotal > 0 ? `, ${variantTotal} ตัวเลือก` : ""}`
          );

          // Push individual product entries to log
          for (const entry of pageResult.syncedProducts) {
            pushLog("product", "", entry);
          }

          // Push errors to log
          for (const err of pageResult.errors) {
            pushLog("error", err);
          }

          // Accumulate
          accumulated.productsCreated += pageResult.productsCreated;
          accumulated.productsUpdated += pageResult.productsUpdated;
          accumulated.variantsCreated += pageResult.variantsCreated;
          accumulated.variantsUpdated += pageResult.variantsUpdated;
          accumulated.errors.push(...pageResult.errors);

          setTotals({ ...accumulated });
          setTotalPages(pageResult.totalPages);
          setTotalProducts(pageResult.totalProducts);
          setProcessedCount((prev) => prev + pageResult.syncedProducts.length);
          setRecentProducts((prev) =>
            [...prev, ...pageResult.syncedProducts].slice(-30)
          );

          hasMore = pageResult.hasMore;
          if (hasMore) {
            setActivityStatus("กำลังดึงสินค้าเพิ่มเติม...");
          }
          page++;
        }

        clearInterval(timerRef.current);
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));

        if (abortRef.current) {
          setCancelled(true);
          setActivityStatus("Sync ถูกยกเลิก");
          pushLog("info", "Sync ถูกยกเลิก");
          setPhase("done");
        } else {
          setActivityStatus("Sync สำเร็จ!");
          pushLog("info", "Sync สำเร็จ!");
          setPhase("done");
        }

        utils.product.list.invalidate();
        utils.stockSync.status.invalidate();
      } catch (err) {
        clearInterval(timerRef.current);
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        const msg =
          err instanceof Error ? err.message : "เกิดข้อผิดพลาดไม่ทราบสาเหตุ";
        setErrorMessage(msg);
        setActivityStatus("เกิดข้อผิดพลาด");
        pushLog("error", msg);
        setLastFailedPage(page);
        setPhase("error");
      }
    },
    [resetState, pushLog, syncPage, utils, syncStatus?.lastSyncAt, totals]
  );

  // ─── Cancel ───────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    abortRef.current = true;
  }, []);

  // Reset on open
  useEffect(() => {
    if (open && phase !== "syncing") {
      resetState();
    }
  }, [open, phase, resetState]);

  // Cleanup timer
  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  if (!open) return null;

  // Inject keyframes
  if (
    typeof document !== "undefined" &&
    !document.getElementById("sync-dialog-keyframes")
  ) {
    const style = document.createElement("style");
    style.id = "sync-dialog-keyframes";
    style.textContent = `@keyframes dialogIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}@keyframes logPulse{0%{opacity:0;transform:translateY(4px)}100%{opacity:1;transform:translateY(0)}}@keyframes dotPulse{0%,100%{opacity:.3}50%{opacity:1}}`;
    document.head.appendChild(style);
  }

  const totalChanges =
    totals.productsCreated +
    totals.productsUpdated +
    totals.variantsCreated +
    totals.variantsUpdated;
  const hasErrors = totals.errors.length > 0;
  const progressPct =
    totalProducts > 0
      ? Math.min(Math.round((processedCount / totalProducts) * 100), 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={phase !== "syncing" ? onClose : undefined}
      />

      {/* Dialog */}
      <div
        className="relative mx-4 w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        style={{ animation: "dialogIn 0.2s ease-out" }}
      >
        {/* Close */}
        {phase !== "syncing" && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <div className="p-6">
          {/* ════════════════════════════════════════════════════
              IDLE — Mode selection
             ════════════════════════════════════════════════════ */}
          {phase === "idle" && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
                <Cloud className="h-8 w-8 text-blue-500" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Sync จาก Anajak Stock
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                ดึงข้อมูลสินค้า, Variant, ราคา และสต็อกมาอัปเดตในระบบ ERP
              </p>

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
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {activityStatus || "กำลัง Sync..."}
                </h2>

                {/* Mode badge */}
                <p className="mt-1 text-xs text-slate-400">
                  {mode === "full" ? "Sync ทั้งหมด" : "Sync เฉพาะที่เปลี่ยน"}
                </p>

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
                  <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
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
              <div className="mt-4 max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-left dark:border-slate-700 dark:bg-slate-800/50">
                {logEntries.length === 0 ? (
                  <div className="flex items-center gap-2 py-1 text-xs text-slate-400">
                    <span
                      className="inline-block h-2 w-2 rounded-full bg-blue-400"
                      style={{ animation: "dotPulse 1.2s ease-in-out infinite" }}
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
                          style={isLast ? { animation: "logPulse 0.3s ease-out" } : undefined}
                        >
                          {isLast ? (
                            <span
                              className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-blue-400"
                              style={{ animation: "dotPulse 1.2s ease-in-out infinite" }}
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
                          style={isLast ? { animation: "logPulse 0.3s ease-out" } : undefined}
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
                        style={isLast ? { animation: "logPulse 0.3s ease-out" } : undefined}
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
                  disabled={abortRef.current}
                  className="text-slate-500"
                >
                  <Ban className="h-3.5 w-3.5" />
                  {abortRef.current
                    ? "กำลังหยุด..."
                    : "ยกเลิก"}
                </Button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════
              DONE — Summary
             ════════════════════════════════════════════════════ */}
          {phase === "done" && (
            <div>
              <div className="text-center">
                <div
                  className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
                    cancelled
                      ? "bg-amber-50 dark:bg-amber-950"
                      : "bg-green-50 dark:bg-green-950"
                  }`}
                >
                  {cancelled ? (
                    <Ban className="h-8 w-8 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  )}
                </div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {cancelled ? "Sync ถูกยกเลิก" : "Sync สำเร็จ!"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  ใช้เวลา {elapsed} วินาที
                  {!cancelled &&
                    totalChanges === 0 &&
                    " — ข้อมูลเป็นปัจจุบันแล้ว"}
                </p>
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
                    onClick={() => setShowErrors(!showErrors)}
                    className="flex w-full items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:hover:bg-amber-950"
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
                    <div className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
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
              {totalChanges === 0 && !hasErrors && !cancelled && (
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
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Sync ล้มเหลว
              </h2>
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {errorMessage || "เกิดข้อผิดพลาดไม่ทราบสาเหตุ"}
              </p>

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
      </div>
    </div>
  );
}

// ─── Stat Card ─────────────────────────────────────────────

const colorMap: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  indigo:
    "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
  purple:
    "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
  violet:
    "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
};

const iconColorMap: Record<string, string> = {
  blue: "text-blue-500",
  indigo: "text-indigo-500",
  purple: "text-purple-500",
  violet: "text-violet-500",
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
