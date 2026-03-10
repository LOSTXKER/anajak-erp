import { Card, CardContent } from "@/components/ui/card";
import { INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import { Check, XCircle } from "lucide-react";

interface OrderStatusBarProps {
  flowSteps: string[];
  currentStepIndex: number;
  internalStatus: string;
}

export function OrderStatusBar({ flowSteps, currentStepIndex, internalStatus }: OrderStatusBarProps) {
  const isCancelled = internalStatus === "CANCELLED";

  return (
    <Card>
      <CardContent className="py-4">
        <div
          role="progressbar"
          aria-label="สถานะคำสั่งซื้อ"
          aria-valuenow={currentStepIndex + 1}
          aria-valuemin={1}
          aria-valuemax={flowSteps.length}
          className="flex items-center gap-0 overflow-x-auto pb-1"
        >
          {flowSteps.map((step, i) => {
            const isPast = i < currentStepIndex;
            const isCurrent = i === currentStepIndex;
            const stepLabel = (INTERNAL_STATUS_LABELS as Record<string, string>)[step] ?? step;

            return (
              <div key={step} className="flex items-center" aria-label={`${stepLabel}: ${isPast ? "เสร็จสิ้น" : isCurrent ? "กำลังดำเนินการ" : "รอดำเนินการ"}`}>
                {/* Step circle */}
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      isCancelled && isCurrent
                        ? "bg-red-500 text-white"
                        : isPast
                          ? "bg-green-500 text-white"
                          : isCurrent
                            ? "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-950"
                            : "bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500"
                    }`}
                  >
                    {isPast ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : isCancelled && isCurrent ? (
                      <XCircle className="h-3.5 w-3.5" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={`max-w-[4.5rem] text-center text-[10px] leading-tight ${
                      isCurrent
                        ? "font-semibold text-blue-700 dark:text-blue-300"
                        : isPast
                          ? "font-medium text-green-700 dark:text-green-400"
                          : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {stepLabel}
                  </span>
                </div>

                {/* Connector line */}
                {i < flowSteps.length - 1 && (
                  <div
                    className={`mx-1 mt-[-1.25rem] h-0.5 w-6 shrink-0 sm:w-8 ${
                      isPast
                        ? "bg-green-500"
                        : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
