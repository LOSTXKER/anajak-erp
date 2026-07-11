import { INTERNAL_STATUS_LABELS, CUSTOMER_STATUS_COLORS } from "@/lib/order-status";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

// แถบสถานะ (polish 2026-06-12 — เบสชี้ว่า 11 จุดป้ายเท่ากันหมดดูรก):
// แสดงครบทุกขั้นตลอด แต่จัด hierarchy ให้เบาตา — หัวสั้นบอกสถานะปัจจุบัน+ขั้น x/y
// ขั้นปัจจุบันเด่น (น้ำเงิน+ring) · ที่ผ่าน/ยังไม่ถึง ป้ายเล็กจางลง · สถานะนอกเส้นทางบอกตรงๆ

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
  const isCancelled = internalStatus === "CANCELLED";
  const onPath = currentStepIndex >= 0;
  const currentLabel =
    (INTERNAL_STATUS_LABELS as Record<string, string>)[internalStatus] ?? internalStatus;
  const nextStep = onPath ? flowSteps[currentStepIndex + 1] : null;
  const nextLabel = nextStep
    ? (INTERNAL_STATUS_LABELS as Record<string, string>)[nextStep] ?? nextStep
    : null;
  const dotColor = isCancelled
    ? "bg-red-500"
    : (CUSTOMER_STATUS_COLORS as Record<string, { dot: string }>)[customerStatus]?.dot ??
      "bg-blue-500";

  return (
    <details className="group card-surface rounded-2xl px-4 py-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-details-marker]:hidden">
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dotColor)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">สถานะตอนนี้</p>
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
            {currentLabel}
            {nextLabel && (
              <span className="font-normal text-slate-500 dark:text-slate-400">
                {" "}→ ถัดไป {nextLabel}
              </span>
            )}
          </p>
        </div>
        <span className="hidden text-xs text-slate-500 sm:inline dark:text-slate-400">
          ดูเส้นทางทั้งหมด
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>

      <div
        role="progressbar"
        aria-label="สถานะคำสั่งซื้อ"
        aria-valuenow={onPath ? currentStepIndex + 1 : undefined}
        aria-valuemin={1}
        aria-valuemax={flowSteps.length}
        className="mt-3 flex items-start gap-0 overflow-x-auto border-t border-slate-100 pt-4 dark:border-slate-800"
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
              <div className="flex min-w-[3.25rem] flex-col items-center gap-2">
                <div className="flex h-3 items-center">
                  <span
                    className={cn(
                      "shrink-0 rounded-full transition-colors",
                      isCurrent
                        ? cn(
                            "h-2.5 w-2.5 ring-[3px]",
                            isCancelled
                              ? "bg-red-500 ring-red-100 dark:ring-red-500/20"
                              : "bg-blue-600 ring-blue-100 dark:bg-blue-500 dark:ring-blue-500/25"
                          )
                        : isPast
                          ? "h-2 w-2 bg-blue-500"
                          : "h-2 w-2 bg-slate-200 dark:bg-slate-700"
                    )}
                  />
                </div>
                <span
                  className={cn(
                    "max-w-[5rem] text-center leading-tight",
                    isCurrent
                      ? "text-xs font-semibold text-blue-700 dark:text-blue-300"
                      : isPast
                        ? "text-xs text-slate-600 dark:text-slate-400"
                        : "text-xs text-slate-500 dark:text-slate-400"
                  )}
                >
                  {stepLabel}
                </span>
              </div>
              {i < flowSteps.length - 1 && (
                <div
                  className={cn(
                    "mt-[5px] h-0.5 flex-1 rounded-full transition-colors",
                    isPast ? "bg-blue-500" : "bg-slate-200 dark:bg-slate-700"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {!onPath && !isCancelled && (
        <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
          สถานะ &quot;{currentLabel}&quot; อยู่นอกเส้นทางหลักของงานชนิดนี้
        </p>
      )}
    </details>
  );
}
