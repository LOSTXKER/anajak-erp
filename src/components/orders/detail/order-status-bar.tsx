import { INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import { cn } from "@/lib/utils";

interface OrderStatusBarProps {
  flowSteps: string[];
  currentStepIndex: number;
  internalStatus: string;
}

export function OrderStatusBar({
  flowSteps,
  currentStepIndex,
  internalStatus,
}: OrderStatusBarProps) {
  const isCancelled = internalStatus === "CANCELLED";

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
      <div
        role="progressbar"
        aria-label="สถานะคำสั่งซื้อ"
        aria-valuenow={currentStepIndex + 1}
        aria-valuemin={1}
        aria-valuemax={flowSteps.length}
        className="flex items-start gap-0 overflow-x-auto"
      >
        {flowSteps.map((step, i) => {
          const isPast = i < currentStepIndex;
          const isCurrent = i === currentStepIndex;
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
                    isPast
                      ? "bg-blue-600 dark:bg-blue-500"
                      : "bg-slate-200 dark:bg-slate-700"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
