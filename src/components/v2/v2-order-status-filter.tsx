"use client";

import { useMemo, useRef } from "react";
import { ChevronDown } from "lucide-react";
import type { InternalStatus } from "@prisma/client";
import { OrderStatusFlowBar } from "@/components/orders/order-status-flow-bar";
import {
  INTERNAL_STATUS_EXCEPTIONS,
  INTERNAL_STATUS_LABELS,
  INTERNAL_STATUS_STAGES,
} from "@/lib/order-status";
import { cn } from "@/lib/utils";
import { FOCUS_BUTTON, RADIUS } from "@/components/ui/tokens";

const QUICK_STATUS_ORDER = [
  "INQUIRY",
  "CONFIRMED",
  "DESIGNING",
  "PRODUCING",
  "PACKING",
  "READY_TO_SHIP",
  "ON_HOLD",
] as const satisfies ReadonlyArray<InternalStatus>;

const ALL_STATUSES = [
  ...INTERNAL_STATUS_STAGES.flatMap((stage) => stage.statuses),
  ...INTERNAL_STATUS_EXCEPTIONS,
] as const satisfies ReadonlyArray<InternalStatus>;

function countLabel(count: number | undefined) {
  return count === undefined ? "—" : count.toLocaleString("th-TH");
}

export function V2OrderStatusFilter({
  counts,
  total,
  selected,
  onSelect,
  isLoading,
}: {
  counts: Record<string, number> | undefined;
  total: number | undefined;
  selected: string;
  onSelect: (status: string) => void;
  isLoading?: boolean;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const allCount = counts
    ? ALL_STATUSES.reduce((sum, status) => sum + (counts[status] ?? 0), 0)
    : total;

  const quickStatuses = useMemo(() => {
    const visible = QUICK_STATUS_ORDER.filter(
      (status) => (counts?.[status] ?? 0) > 0 || selected === status,
    );
    if (selected && !visible.includes(selected as (typeof QUICK_STATUS_ORDER)[number])) {
      return [selected as InternalStatus, ...visible].slice(0, 4);
    }
    return visible.slice(0, 4);
  }, [counts, selected]);

  const selectFromExpanded = (status: string) => {
    onSelect(status);
    detailsRef.current?.removeAttribute("open");
    requestAnimationFrame(() => summaryRef.current?.focus());
  };

  return (
    <section aria-label="กรองตามสถานะ" className={cn("space-y-2", isLoading && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={!selected}
          onClick={() => onSelect("")}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors",
            FOCUS_BUTTON,
            !selected
              ? "bg-blue-600 text-white"
              : "bg-surface hairline-ring text-secondary hover:bg-slate-50 hover:text-strong dark:hover:bg-white/[0.06]",
          )}
        >
          ทั้งหมด
          <span className={cn("text-xs tabular-nums", !selected ? "text-blue-100" : "text-muted")}>
            {countLabel(allCount)}
          </span>
        </button>

        {quickStatuses.map((status) => {
          const active = selected === status;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(active ? "" : status)}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-sm transition-colors",
                FOCUS_BUTTON,
                active
                  ? "bg-blue-50 font-medium text-blue-700 hairline-ring dark:bg-blue-950/50 dark:text-blue-300"
                  : "bg-surface hairline-ring text-secondary hover:bg-slate-50 hover:text-strong dark:hover:bg-white/[0.06]",
              )}
            >
              {INTERNAL_STATUS_LABELS[status]}
              <span className="text-xs tabular-nums text-muted">
                {countLabel(counts?.[status])}
              </span>
            </button>
          );
        })}

        <details ref={detailsRef} className="group w-full">
          <summary
            ref={summaryRef}
            className={cn(
              RADIUS.pill,
              FOCUS_BUTTON,
              "bg-surface hairline-ring flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 px-3.5 text-sm font-medium text-secondary transition-colors hover:bg-slate-50 hover:text-strong sm:w-fit sm:justify-start dark:hover:bg-white/[0.06] [&::-webkit-details-marker]:hidden",
            )}
          >
            ทุกสถานะ
            <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 w-full max-w-full rounded-2xl bg-slate-50/80 p-3 dark:bg-white/[0.03]">
            <OrderStatusFlowBar
              counts={counts}
              selected={selected}
              onSelect={selectFromExpanded}
              isLoading={isLoading}
            />
          </div>
        </details>
      </div>
    </section>
  );
}
