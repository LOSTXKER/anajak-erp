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
} from "lucide-react";
import { trpc } from "@/lib/trpc";

// ─── Types ─────────────────────────────────────────────────

interface SyncTotals {
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  errors: string[];
}

type SyncPhase = "idle" | "syncing" | "done" | "error";

interface SyncDialogProps {
  open: boolean;
  onClose: () => void;
}

// ─── Component ─────────────────────────────────────────────

export function SyncDialog({ open, onClose }: SyncDialogProps) {
  const [phase, setPhase] = useState<SyncPhase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const logEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);

  // Progress state
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [recentProducts, setRecentProducts] = useState<string[]>([]);
  const [totals, setTotals] = useState<SyncTotals>({
    productsCreated: 0,
    productsUpdated: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
    errors: [],
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const syncPage = trpc.stockSync.syncPage.useMutation();

  // Reset all state
  const resetState = useCallback(() => {
    setPhase("idle");
    setElapsed(0);
    setShowErrors(false);
    setCurrentPage(0);
    setTotalPages(0);
    setTotalProducts(0);
    setProcessedCount(0);
    setRecentProducts([]);
    setTotals({ productsCreated: 0, productsUpdated: 0, variantsCreated: 0, variantsUpdated: 0, errors: [] });
    setErrorMessage(null);
    abortRef.current = false;
  }, []);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [recentProducts.length]);

  // Start the page-by-page sync
  const startSync = useCallback(async () => {
    resetState();
    setPhase("syncing");
    startTimeRef.current = Date.now();
    abortRef.current = false;

    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    let page = 1;
    let hasMore = true;
    const accumulated: SyncTotals = {
      productsCreated: 0,
      productsUpdated: 0,
      variantsCreated: 0,
      variantsUpdated: 0,
      errors: [],
    };

    try {
      while (hasMore && !abortRef.current) {
        setCurrentPage(page);

        const result = await syncPage.mutateAsync({ page });

        // Accumulate results
        accumulated.productsCreated += result.productsCreated;
        accumulated.productsUpdated += result.productsUpdated;
        accumulated.variantsCreated += result.variantsCreated;
        accumulated.variantsUpdated += result.variantsUpdated;
        accumulated.errors.push(...result.errors);

        setTotals({ ...accumulated });
        setTotalPages(result.totalPages);
        setTotalProducts(result.totalProducts);
        setProcessedCount((prev) => prev + result.syncedProducts.length);
        setRecentProducts((prev) =>
          [...prev, ...result.syncedProducts].slice(-20)
        );

        hasMore = result.hasMore;
        page++;
      }

      clearInterval(timerRef.current);
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      setPhase("done");

      // Invalidate product list cache
      utils.product.list.invalidate();
      utils.stockSync.status.invalidate();
    } catch (err) {
      clearInterval(timerRef.current);
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      setErrorMessage(err instanceof Error ? err.message : "เกิดข้อผิดพลาดไม่ทราบสาเหตุ");
      setPhase("error");
    }
  }, [resetState, syncPage, utils]);

  // Reset on open
  useEffect(() => {
    if (open && phase !== "syncing") {
      resetState();
    }
  }, [open, phase, resetState]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  if (!open) return null;

  // Inject keyframes
  if (typeof document !== "undefined" && !document.getElementById("sync-dialog-keyframes")) {
    const style = document.createElement("style");
    style.id = "sync-dialog-keyframes";
    style.textContent = `@keyframes dialogIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`;
    document.head.appendChild(style);
  }

  const totalChanges =
    totals.productsCreated + totals.productsUpdated + totals.variantsCreated + totals.variantsUpdated;
  const hasErrors = totals.errors.length > 0;

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
        {/* Close button */}
        {phase !== "syncing" && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <div className="p-6">
          {/* ─── Idle ─── */}
          {phase === "idle" && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
                <Cloud className="h-8 w-8 text-blue-500" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Sync จาก Anajak Stock
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                ดึงข้อมูลสินค้า, Variant, ราคา และสต็อกจาก Anajak Stock มาอัปเดตในระบบ ERP
              </p>
              <div className="mt-5 flex gap-3 justify-center">
                <Button variant="outline" onClick={onClose}>
                  ยกเลิก
                </Button>
                <Button onClick={startSync}>
                  <RefreshCw className="h-4 w-4" />
                  เริ่ม Sync
                </Button>
              </div>
            </div>
          )}

          {/* ─── Syncing ─── */}
          {phase === "syncing" && (
            <div className="text-center">
              {/* Spinner */}
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center">
                <div className="relative">
                  <div className="h-16 w-16 animate-spin rounded-full border-4 border-blue-100 border-t-blue-500 dark:border-slate-700 dark:border-t-blue-400" />
                  <RefreshCw className="absolute top-1/2 left-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-blue-500" />
                </div>
              </div>

              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                กำลัง Sync...
              </h2>

              {/* Progress counter */}
              {totalProducts > 0 && (
                <p className="mt-1 text-sm tabular-nums text-blue-600 dark:text-blue-400">
                  {processedCount}/{totalProducts} สินค้า
                  {totalPages > 1 && (
                    <span className="text-slate-400">
                      {" "}
                      (หน้า {currentPage}/{totalPages})
                    </span>
                  )}
                </p>
              )}

              {/* Progress bar */}
              {totalProducts > 0 && (
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${Math.min((processedCount / totalProducts) * 100, 100)}%` }}
                  />
                </div>
              )}

              {/* Live log */}
              {recentProducts.length > 0 && (
                <div className="mt-3 max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-left dark:border-slate-700 dark:bg-slate-800/50">
                  {recentProducts.map((name, i) => (
                    <p
                      key={i}
                      className={`truncate py-0.5 text-xs ${
                        i === recentProducts.length - 1
                          ? "font-medium text-slate-700 dark:text-slate-200"
                          : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      <CheckCircle2 className="mr-1 inline-block h-3 w-3 text-green-500" />
                      {name}
                    </p>
                  ))}
                  <div ref={logEndRef} />
                </div>
              )}

              {/* Elapsed */}
              <p className="mt-4 text-xs tabular-nums text-slate-400">
                เวลาที่ใช้: {elapsed} วินาที
              </p>
            </div>
          )}

          {/* ─── Done ─── */}
          {phase === "done" && (
            <div>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 dark:bg-green-950">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Sync สำเร็จ!
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  ใช้เวลา {elapsed} วินาที
                  {totalChanges === 0 && " — ข้อมูลเป็นปัจจุบันแล้ว"}
                </p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <StatCard icon={<Package className="h-4 w-4" />} label="สินค้าใหม่" value={totals.productsCreated} color="blue" />
                <StatCard icon={<Package className="h-4 w-4" />} label="สินค้าอัปเดต" value={totals.productsUpdated} color="indigo" />
                <StatCard icon={<Layers className="h-4 w-4" />} label="Variant ใหม่" value={totals.variantsCreated} color="purple" />
                <StatCard icon={<Layers className="h-4 w-4" />} label="Variant อัปเดต" value={totals.variantsUpdated} color="violet" />
              </div>

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
                    {showErrors ? <ChevronUp className="h-4 w-4 text-amber-500" /> : <ChevronDown className="h-4 w-4 text-amber-500" />}
                  </button>
                  {showErrors && (
                    <div className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                      {totals.errors.map((err, i) => (
                        <p key={i} className="py-0.5 text-xs text-amber-700 dark:text-amber-300">
                          • {err}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {totalChanges === 0 && !hasErrors && (
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

          {/* ─── Error ─── */}
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
              <p className="mt-1 text-xs text-slate-400">ตรวจสอบการเชื่อมต่อ API ที่หน้าตั้งค่า</p>

              <div className="mt-5 flex gap-3 justify-center">
                <Button variant="outline" onClick={onClose}>
                  ปิด
                </Button>
                <Button onClick={startSync}>
                  <RefreshCw className="h-4 w-4" />
                  ลองใหม่
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
  indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
  purple: "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
};

const iconColorMap: Record<string, string> = {
  blue: "text-blue-500",
  indigo: "text-indigo-500",
  purple: "text-purple-500",
  violet: "text-violet-500",
};

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
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
