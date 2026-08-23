"use client";

import { useMemo, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ChevronDown } from "lucide-react";
import type { InternalStatus } from "@prisma/client";
import { OrderStatusFlowBar } from "@/components/orders/order-status-flow-bar";
import {
  INTERNAL_STATUS_EXCEPTIONS,
  INTERNAL_STATUS_LABELS,
  INTERNAL_STATUS_STAGES,
} from "@/lib/order-status";
import { cn } from "@/lib/utils";
import { FOCUS_BUTTON, OVERLAY_PANEL } from "@/components/ui/tokens";

const QUICK_STATUS_LIMIT = 4;
const QUICK_STATUS_ORDER = [
  "ON_HOLD",
  "PRODUCING",
  "QUALITY_CHECK",
  "PACKING",
  "READY_TO_SHIP",
  "PRODUCTION_QUEUE",
  "DESIGNING",
  "INQUIRY",
  "CONFIRMED",
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
  const [open, setOpen] = useState(false);
  const allCount = counts
    ? ALL_STATUSES.reduce((sum, status) => sum + (counts[status] ?? 0), 0)
    : total;

  const quickStatuses = useMemo(() => {
    const visible = QUICK_STATUS_ORDER.filter(
      (status) => (counts?.[status] ?? 0) > 0 || selected === status,
    );
    if (selected) {
      const selectedStatus = selected as InternalStatus;
      return [selectedStatus, ...visible.filter((status) => status !== selectedStatus)].slice(
        0,
        QUICK_STATUS_LIMIT,
      );
    }
    return visible.slice(0, QUICK_STATUS_LIMIT);
  }, [counts, selected]);

  const selectFromExpanded = (status: string) => {
    onSelect(status);
    setOpen(false);
  };

  return (
    <section
      aria-label="กรองตามสถานะ"
      className={cn(
        "relative",
        isLoading && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          aria-pressed={!selected}
          onClick={() => onSelect("")}
          className={cn(
            "group hidden min-h-11 items-center gap-2 border-b-2 bg-transparent px-1 text-sm transition-colors sm:inline-flex",
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

        {quickStatuses.map((status) => {
          const active = selected === status;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(active ? "" : status)}
              className={cn(
                "group hidden min-h-11 items-center gap-2 border-b-2 bg-transparent px-1 text-sm transition-colors sm:inline-flex",
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

        <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
          <PopoverPrimitive.Trigger asChild>
            <button
              type="button"
              className={cn(
                FOCUS_BUTTON,
                "group flex min-h-11 w-full items-center justify-center gap-2 border-b border-divider bg-transparent px-1 text-sm font-medium text-secondary transition-colors hover:text-strong active:text-strong sm:w-fit sm:justify-start",
              )}
            >
              <span className="sm:hidden">
                {selected
                  ? `สถานะ: ${INTERNAL_STATUS_LABELS[selected as InternalStatus]}`
                  : "สถานะ: ทั้งหมด"}
              </span>
              <span className="hidden sm:inline">ทุกสถานะ</span>
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "h-4 w-4 text-muted transition-transform group-hover:text-secondary group-active:text-secondary",
                  open && "rotate-180",
                )}
              />
            </button>
          </PopoverPrimitive.Trigger>
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              align="start"
              sideOffset={8}
              collisionPadding={12}
              className={cn(
                OVERLAY_PANEL,
                "z-50 w-[min(48rem,calc(100vw-1.5rem))] p-4",
                "max-h-[min(34rem,calc(100dvh-8rem))] overflow-y-auto overscroll-contain",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                "motion-reduce:animate-none",
              )}
            >
              <OrderStatusFlowBar
                counts={counts}
                selected={selected}
                onSelect={selectFromExpanded}
                isLoading={isLoading}
              />
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
      </div>
    </section>
  );
}
