"use client";

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { FOCUS_INSET, RADIUS } from "@/components/ui/tokens";
import { STEP_STATUS_LABELS } from "@/lib/status-config";
import { STEP_TYPE_LABELS } from "@/lib/production-steps";
import { cn } from "@/lib/utils";
import type { ProductionStep } from "./types";

function stepLabel(step: ProductionStep) {
  return step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType;
}

function stepStatusLabel(step: ProductionStep) {
  return STEP_STATUS_LABELS[step.status as keyof typeof STEP_STATUS_LABELS] || step.status;
}

/**
 * รางบอกตำแหน่งของขั้นที่กำลังดู โดยใช้ขั้นผลิตจริงของใบนี้
 * เส้นเป็น neutral เสมอ เพราะใบผลิตหนึ่งใบอาจมีหลายเลนที่ทำพร้อมกันได้ — สีอยู่ที่ node
 * เพื่อบอกสถานะโดยไม่ทำให้เส้นดูเป็น dependency บังคับที่ข้อมูลไม่ได้รับรอง
 * node ไม่เป็นปุ่ม เพื่อลดความสับสนกับการเปลี่ยนสถานะ; การนำทางอยู่ที่ CTA ก่อนหน้า/ถัดไป
 */
export function ProductionRouteRail({
  steps,
  selectedStepId,
}: {
  steps: readonly ProductionStep[];
  selectedStepId: string;
}) {
  const railRef = useRef<HTMLOListElement>(null);
  const selectedIndex = Math.max(0, steps.findIndex((step) => step.id === selectedStepId));

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || rail.scrollWidth <= rail.clientWidth + 1) return;
    const selected = rail.querySelector<HTMLElement>("[aria-current='step']");
    if (!selected) return;
    rail.scrollLeft = selected.offsetLeft - rail.clientWidth / 2 + selected.offsetWidth / 2;
  }, [selectedIndex, steps.length]);

  if (steps.length === 0) return null;

  return (
    <section className="border-t border-divider px-4 py-4 sm:px-5" aria-labelledby="production-route-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="production-route-title" className="text-xs font-medium text-muted">
          เส้นทางการผลิต
        </h2>
        <span className="text-2xs tabular-nums text-muted">
          {steps.filter((step) => step.status === "COMPLETED").length} จาก {steps.length} ขั้น
        </span>
      </div>

      <ol
        ref={railRef}
        aria-label="เส้นทางการผลิต เลื่อนซ้ายขวาเพื่อดูทุกขั้น"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- รางเลื่อนได้ต้องรับโฟกัสเพื่อให้คีย์บอร์ดดูทุกขั้นได้
        tabIndex={0}
        className={cn("flex overflow-x-auto pb-1", RADIUS.item, FOCUS_INSET)}
      >
        {steps.map((step, index) => {
          const completed = step.status === "COMPLETED";
          const active = step.status === "IN_PROGRESS";
          const failed = step.status === "FAILED";
          const onHold = step.status === "ON_HOLD";
          const selected = step.id === selectedStepId;

          return (
            <li
              key={step.id}
              className={cn(
                "relative flex min-w-28 flex-1 flex-col items-stretch text-center",
                "before:absolute before:left-0 before:right-1/2 before:top-[11px] before:h-px before:bg-divider before:content-['']",
                "after:absolute after:left-1/2 after:right-0 after:top-[11px] after:h-px after:bg-divider after:content-['']",
                index === 0 && "before:hidden",
                index === steps.length - 1 && "after:hidden",
              )}
            >
              <div
                aria-current={selected ? "step" : undefined}
                aria-label={`${stepLabel(step)}: ${stepStatusLabel(step)}`}
                className={cn(
                  "relative z-[1] flex min-h-16 w-full flex-col items-center px-1 pb-1 text-center",
                  RADIUS.item,
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 text-2xs font-semibold tabular-nums transition-shadow",
                    completed && "border-green-600 bg-green-600 text-white dark:border-green-500 dark:bg-green-700",
                    active && "border-blue-600 bg-blue-600 text-white dark:border-blue-400",
                    failed && "border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200",
                    onHold && "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
                    !completed && !active && !failed && !onHold && "border-divider bg-bg text-muted",
                    selected && "ring-2 ring-blue-600 ring-offset-2 ring-offset-bg dark:ring-blue-400",
                  )}
                >
                  {completed ? <Check className="h-3 w-3" strokeWidth={3} /> : index + 1}
                </span>
                <span
                  className={cn(
                    "mt-1.5 text-xs font-medium leading-tight [overflow-wrap:anywhere]",
                    completed && "text-secondary",
                    active && "text-blue-700 dark:text-blue-300",
                    failed && "text-red-700 dark:text-red-300",
                    onHold && "text-amber-800 dark:text-amber-300",
                    !completed && !active && !failed && !onHold && "text-secondary",
                    selected && "font-semibold text-blue-700 dark:text-blue-300",
                  )}
                >
                  {stepLabel(step)}
                </span>
                <span className="mt-0.5 text-2xs leading-tight text-muted">
                  {stepStatusLabel(step)}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
