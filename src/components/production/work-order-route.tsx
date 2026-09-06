"use client";

/**
 * แผนที่เส้นทางงานของใบผลิต — สายที่เดินขนานกันอยู่คนละแถว เส้นวิ่งมารวมที่ขั้นที่ต้องรอกัน
 * (แบบ E "ตอนนี้ทำอะไร (รู้ทางขนาน)" · เบสเคาะ 2026-09-06)
 *
 * อ่านอย่างเดียว รับ steps + สถานะ "ตอนนี้" เป็น props · ผังมาจาก lib/work-order-route (pure, มี test)
 * คอลัมน์คี่ = ขั้น (ปุ่มกดเลือก) · คอลัมน์คู่ = เส้นเชื่อม · ขั้นบรรจบกินทุกแถว
 */

import { AlertTriangle, Check, Clock, Truck } from "lucide-react";
import type { ProductionStep } from "@/components/production/types";
import type { NowStep } from "@/lib/production-step-actions";
import { LANE_LABELS, OUTSOURCE_LANES, isOutsourceStep } from "@/lib/production-steps";
import { isInferredDone } from "@/lib/work-order-record-mode";
import { routeGrid, routeWaitingOn } from "@/lib/work-order-route";
import { FOCUS_BUTTON, RADIUS } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { stepLabel, viewOf, type StepView } from "./work-order-pieces";

/** รายชื่อที่รอ — ยาวเกินอ่านไม่ทัน ตัดที่ 2 ชื่อแล้วนับที่เหลือ */
export function shortWaitList(names: string[]): string {
  if (names.length <= 2) return names.join(" + ");
  return `${names.slice(0, 2).join(" + ")} และอีก ${names.length - 2} ขั้น`;
}

function NodeMark({ state, order, inferred, outsource }: { state: StepView["state"]; order: number; inferred: boolean; outsource: boolean }) {
  const base = "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums";
  if (state === "done") {
    return (
      <span className={cn(base, inferred ? "bg-surface-muted text-secondary ring-1 ring-inset ring-border" : "bg-green-600 text-white dark:bg-green-500")}>
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
      </span>
    );
  }
  if (state === "blocked") {
    return (
      <span className={cn(base, "bg-red-600 text-white")}>
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    );
  }
  if (state === "waiting") {
    const Icon = outsource ? Truck : Clock;
    return (
      <span className={cn(base, "bg-amber-500 text-white")}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    );
  }
  if (state === "active") return <span className={cn(base, "bg-blue-600 text-white")}>{order}</span>;
  return <span className={cn(base, "bg-surface-muted text-muted")}>{order}</span>;
}

export function RouteMap({
  steps,
  nowById,
  focusId,
  onFocus,
}: {
  steps: ProductionStep[];
  nowById: Map<string, NowStep<ProductionStep>>;
  /** ขั้นที่กดเลือกอยู่ (null = โหมด "ตอนนี้ทำอะไร") */
  focusId: string | null;
  onFocus: (id: string | null) => void;
}) {
  const grid = routeGrid(steps);
  const orderOf = new Map(steps.map((s, i) => [s.id, i + 1]));
  const nodeWidth = "minmax(150px,auto)";
  const template = Array.from({ length: grid.columns }, (_, i) => (i % 2 === 0 ? nodeWidth : "32px")).join(" ");

  return (
    <div className="overflow-x-auto pb-1">
      <div
        role="list"
        aria-label="เส้นทางงาน — สายที่เดินขนานกันอยู่คนละแถว"
        className="grid items-stretch gap-y-2"
        style={{ gridTemplateColumns: template, gridTemplateRows: `repeat(${grid.rows}, minmax(56px, auto))`, minWidth: `${grid.columns * 92}px` }}
      >
        {grid.links.map((l) => (
          <div key={l.key} aria-hidden="true" className="flex items-center" style={{ gridColumn: `${l.colStart} / ${l.colEnd}`, gridRow: `${l.rowStart} / ${l.rowEnd}` }}>
            <span className="h-0.5 w-full bg-border" />
          </div>
        ))}
        {grid.cells.map(({ step, lane, col, rowStart, rowEnd }) => {
          const now = nowById.get(step.id);
          const inferred = isInferredDone(step);
          const on = step.id === focusId;
          // ขั้นที่ยังรอสายอื่นบนเส้นทาง (หางงาน/ขั้นบรรจบ) = ยังไม่ถึงคิว แม้ระบบจะนับเป็นขั้นแรกของเลนตัวเอง
          const pending = step.status === "COMPLETED" || step.status === "FAILED" || step.status === "ON_HOLD" ? [] : routeWaitingOn(step, steps);
          const raw = viewOf(step, now);
          const view: StepView = pending.length > 0 && raw.state === "active" ? { state: "todo", label: "ยังไม่ถึง", chip: "neutral" } : raw;
          const isNow = view.state === "active" || view.state === "waiting" || view.state === "blocked";
          const caption =
            pending.length > 0
              ? `รอ ${shortWaitList(pending.map((p) => stepLabel(p)))}`
              : lane === null
                ? "รวมกัน"
                : OUTSOURCE_LANES.has(lane)
                  ? `ร้านนอก · ${LANE_LABELS[lane]}`
                  : LANE_LABELS[lane];
          return (
            <div key={step.id} role="listitem" className="flex items-center" style={{ gridColumn: col, gridRow: `${rowStart} / ${rowEnd}` }}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onFocus(on ? null : step.id)}
                className={cn(
                  RADIUS.item,
                  FOCUS_BUTTON,
                  "flex min-h-11 w-full items-center gap-2 border px-3 py-2 text-left text-sm transition-colors",
                  on ? "border-blue-600 bg-interactive-selected dark:border-blue-400" : isNow ? "border-border bg-surface hover:bg-interactive-hover" : "border-border bg-surface-muted/60 text-secondary hover:bg-interactive-hover",
                )}
              >
                <NodeMark state={view.state} order={orderOf.get(step.id) ?? 0} inferred={inferred} outsource={isOutsourceStep(step.stepType)} />
                <span className="min-w-0">
                  <span className={cn("block truncate", isNow || on ? "font-semibold text-strong" : "font-medium")}>{stepLabel(step)}</span>
                  <span className="block truncate text-xs text-muted" title={caption}>
                    {caption}
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
