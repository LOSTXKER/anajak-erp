"use client";

import { AlertTriangle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn, formatTime } from "@/lib/utils";

export const PRODUCTION_REFRESH_INTERVAL_MS = 30_000;

export function oldestSuccessfulUpdate(...values: Array<number | undefined>) {
  const timestamps = values.filter((value): value is number => Boolean(value && value > 0));
  return timestamps.length > 0 ? Math.min(...timestamps) : 0;
}

export function ProductionFreshness({
  updatedAt,
  isFetching,
  stale,
  intervalMs = PRODUCTION_REFRESH_INTERVAL_MS,
  liveSurface = false,
  className,
}: {
  updatedAt: number;
  isFetching: boolean;
  stale: boolean;
  intervalMs?: number;
  liveSurface?: boolean;
  className?: string;
}) {
  const hasTimestamp = updatedAt > 0;
  const timestamp = hasTimestamp ? formatTime(updatedAt) : null;
  const intervalSeconds = Math.round(intervalMs / 1_000);
  const label = stale
    ? timestamp
      ? `ข้อมูลค้าง · ล่าสุด ${timestamp}`
      : "ข้อมูลค้าง · กำลังเชื่อมต่อใหม่"
    : isFetching
      ? "กำลังซิงก์ข้อมูล…"
      : timestamp
        ? `ซิงก์ล่าสุด ${timestamp}`
        : "กำลังเชื่อมต่อข้อมูล…";

  return (
    <div
      data-production-freshness={stale ? "stale" : isFetching ? "fetching" : "fresh"}
      aria-busy={isFetching || undefined}
      className={cn(
        "inline-flex min-h-5 items-center gap-1.5 text-xs tabular-nums",
        stale ? "text-amber-700 dark:text-amber-300" : "text-muted",
        className,
      )}
    >
      {stale ? (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : isFetching ? (
        <Spinner size="sm" className="text-blue-600 dark:text-blue-400" />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            liveSurface ? "bg-green-500" : "bg-blue-600 dark:bg-blue-400",
          )}
        />
      )}
      <span>{label}</span>
      {!stale && !isFetching && hasTimestamp ? (
        <span className="text-muted">· ทุก {intervalSeconds.toLocaleString("th-TH")} วิ</span>
      ) : null}
      {stale ? (
        <span className="sr-only" role="status">
          {label} ระบบจะลองเชื่อมต่อใหม่อัตโนมัติ
        </span>
      ) : null}
    </div>
  );
}
