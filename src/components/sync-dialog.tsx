"use client";

import { useEffect, useState, useRef } from "react";
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

interface SyncResult {
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  errors: string[];
}

type SyncPhase = "idle" | "connecting" | "fetching" | "syncing" | "done" | "error";

interface SyncDialogProps {
  open: boolean;
  onClose: () => void;
  onSync: () => void;
  isPending: boolean;
  result: SyncResult | null;
  error: string | null;
}

// ─── Phase Config ──────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  connecting: "กำลังเชื่อมต่อ Anajak Stock...",
  fetching: "กำลังดึงข้อมูลสินค้า...",
  syncing: "กำลัง Sync สินค้าและ Variant...",
};

const PHASE_ORDER: SyncPhase[] = ["connecting", "fetching", "syncing"];

// ─── Component ─────────────────────────────────────────────

export function SyncDialog({
  open,
  onClose,
  onSync,
  isPending,
  result,
  error,
}: SyncDialogProps) {
  const [phase, setPhase] = useState<SyncPhase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const logEndRef = useRef<HTMLDivElement>(null);

  // ─── Poll sync progress from server ───────────────────────
  const { data: progress } = trpc.stockSync.syncProgress.useQuery(undefined, {
    enabled: isPending,
    refetchInterval: isPending ? 800 : false,
  });

  // Drive phase from server progress
  useEffect(() => {
    if (isPending && progress) {
      const serverPhase = progress.phase;
      if (serverPhase === "connecting" || serverPhase === "fetching" || serverPhase === "syncing") {
        setPhase(serverPhase);
      }
    }
  }, [isPending, progress]);

  // Start timer when syncing begins
  useEffect(() => {
    if (isPending) {
      startTimeRef.current = Date.now();
      setPhase("connecting");
      setElapsed(0);
      setShowErrors(false);

      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      return () => {
        clearInterval(timerRef.current);
      };
    }
  }, [isPending]);

  // When sync completes
  useEffect(() => {
    if (!isPending && (result || error)) {
      clearInterval(timerRef.current);
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      setPhase(error ? "error" : "done");
    }
  }, [isPending, result, error]);

  // Reset on open
  useEffect(() => {
    if (open && !isPending && !result && !error) {
      setPhase("idle");
      setElapsed(0);
    }
  }, [open, isPending, result, error]);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [progress?.recentProducts?.length]);

  if (!open) return null;

  // Inject keyframes (only once)
  if (typeof document !== "undefined" && !document.getElementById("sync-dialog-keyframes")) {
    const style = document.createElement("style");
    style.id = "sync-dialog-keyframes";
    style.textContent = `@keyframes dialogIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`;
    document.head.appendChild(style);
  }

  const totalChanges = result
    ? result.productsCreated +
      result.productsUpdated +
      result.variantsCreated +
      result.variantsUpdated
    : 0;

  const hasErrors = result && result.errors.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={phase === "done" || phase === "error" || phase === "idle" ? onClose : undefined}
      />

      {/* Dialog */}
      <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-slate-900" style={{ animation: "dialogIn 0.2s ease-out" }}>
        {/* Close button */}
        {(phase === "done" || phase === "error" || phase === "idle") && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <div className="p-6">
          {/* ─── Idle: Pre-sync confirmation ─── */}
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
                <Button onClick={onSync}>
                  <RefreshCw className="h-4 w-4" />
                  เริ่ม Sync
                </Button>
              </div>
            </div>
          )}

          {/* ─── In Progress ─── */}
          {(phase === "connecting" || phase === "fetching" || phase === "syncing") && (
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
              {progress && progress.totalCount > 0 && (
                <p className="mt-1 text-sm tabular-nums text-blue-600 dark:text-blue-400">
                  {progress.processedCount}/{progress.totalCount} สินค้า
                  {progress.totalPages > 1 && (
                    <span className="text-slate-400"> (หน้า {progress.currentPage}/{progress.totalPages})</span>
                  )}
                </p>
              )}

              {/* Phase steps */}
              <div className="mt-4 space-y-2 text-left">
                {PHASE_ORDER.map((phaseKey, i) => {
                  const phaseIndex = PHASE_ORDER.indexOf(phase as SyncPhase);
                  const isActive = phaseKey === phase;
                  const isDone = i < phaseIndex;

                  return (
                    <div
                      key={phaseKey}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                        isActive
                          ? "bg-blue-50 dark:bg-blue-950/50"
                          : isDone
                            ? "opacity-60"
                            : "opacity-30"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
                      ) : isActive ? (
                        <RefreshCw className="h-4 w-4 flex-shrink-0 animate-spin text-blue-500" />
                      ) : (
                        <div className="h-4 w-4 flex-shrink-0 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                      )}
                      <span
                        className={`text-sm ${
                          isActive
                            ? "font-medium text-blue-700 dark:text-blue-300"
                            : "text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {PHASE_LABELS[phaseKey]}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Current product */}
              {progress?.currentProduct && (
                <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2 dark:border-blue-900 dark:bg-blue-950/30">
                  <p className="truncate text-xs text-blue-600 dark:text-blue-400">
                    {progress.currentProduct}
                  </p>
                </div>
              )}

              {/* Live log of recent products */}
              {progress?.recentProducts && progress.recentProducts.length > 0 && (
                <div className="mt-3 max-h-32 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-left dark:border-slate-700 dark:bg-slate-800/50">
                  {progress.recentProducts.map((name, i) => (
                    <p
                      key={i}
                      className={`truncate py-0.5 text-xs ${
                        i === progress.recentProducts.length - 1
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

              {/* Elapsed time */}
              <p className="mt-4 text-xs tabular-nums text-slate-400">
                เวลาที่ใช้: {elapsed} วินาที
              </p>
            </div>
          )}

          {/* ─── Success ─── */}
          {phase === "done" && result && (
            <div>
              {/* Header */}
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

              {/* Stats Grid */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <StatCard
                  icon={<Package className="h-4 w-4" />}
                  label="สินค้าใหม่"
                  value={result.productsCreated}
                  color="blue"
                />
                <StatCard
                  icon={<Package className="h-4 w-4" />}
                  label="สินค้าอัปเดต"
                  value={result.productsUpdated}
                  color="indigo"
                />
                <StatCard
                  icon={<Layers className="h-4 w-4" />}
                  label="Variant ใหม่"
                  value={result.variantsCreated}
                  color="purple"
                />
                <StatCard
                  icon={<Layers className="h-4 w-4" />}
                  label="Variant อัปเดต"
                  value={result.variantsUpdated}
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
                        {result.errors.length} ข้อผิดพลาด
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
                      {result.errors.map((err, i) => (
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

              {/* No changes message */}
              {totalChanges === 0 && !hasErrors && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-700 dark:bg-slate-800/50">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    ไม่มีการเปลี่ยนแปลง — สินค้าทั้งหมดตรงกับ Anajak Stock แล้ว
                  </p>
                </div>
              )}

              {/* Close button */}
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
                {error || "เกิดข้อผิดพลาดไม่ทราบสาเหตุ"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                ตรวจสอบการเชื่อมต่อ API ที่หน้าตั้งค่า
              </p>

              <div className="mt-5 flex gap-3 justify-center">
                <Button variant="outline" onClick={onClose}>
                  ปิด
                </Button>
                <Button
                  onClick={() => {
                    setPhase("idle");
                    onSync();
                  }}
                >
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
