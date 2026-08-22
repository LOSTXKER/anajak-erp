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

export function OrderStatusFilter({
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
    if (selected) {
      const selectedStatus = selected as InternalStatus;
      return [selectedStatus, ...visible.filter((status) => status !== selectedStatus)].slice(0, 4);
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
      <div className="hidden xl:block">
        <OrderStatusFlowBar
          counts={counts}
          selected={selected}
          onSelect={onSelect}
          isLoading={isLoading}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 xl:hidden">
        <button
          type="button"
          aria-pressed={!selected}
          onClick={() => onSelect("")}
          className={cn(
            "group inline-flex min-h-11 items-center gap-2 border-b-2 bg-transparent px-1 text-sm transition-colors",
            FOCUS_BUTTON,
            !selected
              ? "border-slate-900 font-semibold text-strong dark:border-white"
              : "border-transparent font-medium text-muted hover:text-secondary active:text-strong",
          )}
        >
          ทั้งหมด
          <span className="text-xs tabular-nums text-muted group-hover:text-secondary group-active:text-secondary">
            {countLabel(allCount)}
          </span>
        </button>

        {quickStatuses.map((status, index) => {
          const active = selected === status;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(active ? "" : status)}
              className={cn(
                "group inline-flex min-h-11 items-center gap-2 border-b-2 bg-transparent px-1 text-sm transition-colors",
                index >= 2 && "max-sm:hidden",
                FOCUS_BUTTON,
                active
                  ? "border-slate-900 font-semibold text-strong dark:border-white"
                  : "border-transparent font-medium text-muted hover:text-secondary active:text-strong",
              )}
            >
              {INTERNAL_STATUS_LABELS[status]}
              <span className="text-xs tabular-nums text-muted group-hover:text-secondary group-active:text-secondary">
                {countLabel(counts?.[status])}
              </span>
            </button>
          );
        })}

        <details ref={detailsRef} className="group w-full">
          <summary
            ref={summaryRef}
            className={cn(
              RADIUS.item,
              FOCUS_BUTTON,
              "flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 border-b border-divider bg-transparent px-1 text-sm font-medium text-secondary transition-colors hover:text-strong active:text-strong sm:w-fit sm:justify-start [&::-webkit-details-marker]:hidden",
            )}
          >
            ทุกสถานะ
            <ChevronDown className="h-4 w-4 text-muted transition-transform group-hover:text-secondary group-active:text-secondary group-open:rotate-180" />
          </summary>
          <div className="mt-3 w-full max-w-full border-t border-divider pt-3">
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
