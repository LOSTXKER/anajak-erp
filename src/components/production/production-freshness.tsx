"use client";

import { RefreshCw, WifiOff } from "lucide-react";
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
  const title = stale
    ? "อัปเดตข้อมูลไม่สำเร็จ"
    : isFetching
      ? "กำลังตรวจข้อมูลล่าสุด"
      : "ระบบอัปเดตข้อมูลอัตโนมัติ";
  const detail = stale
    ? timestamp
      ? `ข้อมูลล่าสุด ${timestamp} · ระบบจะลองอีกครั้ง`
      : "กำลังลองเชื่อมต่อใหม่"
    : isFetching
      ? timestamp
        ? `ข้อมูลก่อนหน้า ${timestamp}`
        : "รอสักครู่"
      : timestamp
        ? `ตรวจล่าสุด ${timestamp} · ทุก ${intervalSeconds.toLocaleString("th-TH")} วินาที`
        : "กำลังเชื่อมต่อข้อมูล";

  return (
    <div
      data-production-freshness={stale ? "stale" : isFetching ? "fetching" : "fresh"}
      aria-busy={isFetching || undefined}
      className={cn(
        "inline-grid min-h-9 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 text-left tabular-nums",
        stale ? "text-amber-700 dark:text-amber-300" : "text-secondary",
        className,
      )}
    >
      {stale ? (
        <WifiOff className="row-span-2 h-4 w-4 shrink-0" aria-hidden="true" />
      ) : isFetching ? (
        <Spinner size="sm" className="row-span-2 text-blue-600 dark:text-blue-400" />
      ) : (
        <RefreshCw
          aria-hidden="true"
          className={cn(
            "row-span-2 h-4 w-4 shrink-0",
            liveSurface
              ? "text-green-600 dark:text-green-400"
              : "text-blue-600 dark:text-blue-400",
          )}
        />
      )}
      <span
        className={cn(
          "font-medium text-current",
          liveSurface ? "text-sm" : "text-xs leading-4",
        )}
      >
        {title}
      </span>
      <span
        className={cn(
          liveSurface ? "text-xs" : "text-2xs leading-4",
          stale ? "text-current" : "text-muted",
        )}
      >
        {detail}
      </span>
      {stale ? (
        <span className="sr-only" role="status">
          {title} {detail}
        </span>
      ) : null}
    </div>
  );
}
