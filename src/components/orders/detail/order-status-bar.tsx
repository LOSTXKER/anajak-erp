"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { INTERNAL_STATUS_LABELS, CUSTOMER_STATUS_COLORS } from "@/lib/order-status";
import { cn } from "@/lib/utils";

// แถบสถานะแบบกระชับ (redesign 2026-06-11 — เบสชี้: 11 จุดเรียงยาวตัวจิ๋วอ่านยาก):
// ปกติเห็นแค่ pill "● สถานะปัจจุบัน · ขั้น x/y" — อยากเห็นทั้งเส้นค่อยกดกาง
// สถานะนอกเส้นทาง (พักงาน/ยกเลิก/READY_MADE ค้างสอบถาม) แสดง label ตรงๆ ไม่ใบ้ขั้นผิดๆ

interface OrderStatusBarProps {
  flowSteps: string[];
  currentStepIndex: number;
  internalStatus: string;
  customerStatus: string;
}

export function OrderStatusBar({
  flowSteps,
  currentStepIndex,
  internalStatus,
  customerStatus,
}: OrderStatusBarProps) {
  const [expanded, setExpanded] = useState(false);
  const isCancelled = internalStatus === "CANCELLED";
  const onPath = currentStepIndex >= 0;
  const currentLabel =
    (INTERNAL_STATUS_LABELS as Record<string, string>)[internalStatus] ?? internalStatus;
  const dotColor = isCancelled
    ? "bg-red-500"
    : (CUSTOMER_STATUS_COLORS as Record<string, { dot: string }>)[customerStatus]?.dot ??
      "bg-blue-500";

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* แถวกระชับ — กดเพื่อกาง/พับเส้นทางเต็ม */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dotColor)} />
          <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
            {currentLabel}
          </span>
          {onPath && !isCancelled && (
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              ขั้น {currentStepIndex + 1}/{flowSteps.length}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-slate-400">
          {expanded ? "ซ่อนเส้นทาง" : "ดูเส้นทางงาน"}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")}
          />
        </span>
      </button>

      {/* เส้นทางเต็ม — โชว์เมื่อกดกางเท่านั้น */}
      {expanded && (
        <div
          role="progressbar"
          aria-label="สถานะคำสั่งซื้อ"
          aria-valuenow={onPath ? currentStepIndex + 1 : undefined}
          aria-valuemin={1}
          aria-valuemax={flowSteps.length}
          className="flex items-start gap-0 overflow-x-auto border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800"
        >
          {flowSteps.map((step, i) => {
            const isPast = onPath && i < currentStepIndex;
            const isCurrent = onPath && i === currentStepIndex;
            const stepLabel =
              (INTERNAL_STATUS_LABELS as Record<string, string>)[step] ?? step;

            return (
              <div
                key={step}
                className="flex flex-1 items-start"
                aria-label={`${stepLabel}: ${isPast ? "เสร็จสิ้น" : isCurrent ? "กำลังดำเนินการ" : "รอดำเนินการ"}`}
              >
                <div className="flex min-w-[3rem] flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "flex h-2 w-2 shrink-0 items-center justify-center rounded-full transition-colors",
                      isCancelled && isCurrent
                        ? "bg-red-500"
                        : isPast
                          ? "bg-blue-600 dark:bg-blue-500"
                          : isCurrent
                            ? "ring-2 ring-blue-600 ring-offset-2 ring-offset-white bg-blue-600 dark:ring-blue-500 dark:ring-offset-slate-900 dark:bg-blue-500"
                            : "bg-slate-200 dark:bg-slate-700"
                    )}
                  />
                  <span
                    className={cn(
                      "max-w-[5rem] text-center text-[10.5px] leading-tight",
                      isCurrent
                        ? "font-semibold text-slate-900 dark:text-white"
                        : isPast
                          ? "font-medium text-slate-700 dark:text-slate-300"
                          : "text-slate-400 dark:text-slate-500"
                    )}
                  >
                    {stepLabel}
                  </span>
                </div>
                {i < flowSteps.length - 1 && (
                  <div
                    className={cn(
                      "mt-[3px] h-px flex-1 transition-colors",
                      isPast ? "bg-blue-600 dark:bg-blue-500" : "bg-slate-200 dark:bg-slate-700"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* สถานะนอกเส้นทาง (พัก/สอบถามของงานสำเร็จรูป) — บอกตรงๆ แทนปล่อยให้แถบไม่ไฮไลต์ */}
      {expanded && !onPath && !isCancelled && (
        <p className="border-t border-slate-100 px-4 py-2.5 text-[12px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
          สถานะปัจจุบัน &quot;{currentLabel}&quot; อยู่นอกเส้นทางหลักของงานชนิดนี้ — ดูการ์ด
          &quot;ขั้นถัดไป&quot; ว่าต้องทำอะไรต่อ
        </p>
      )}
    </div>
  );
}
