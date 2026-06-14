import { INTERNAL_STATUS_LABELS, CUSTOMER_STATUS_COLORS } from "@/lib/order-status";
import { cn } from "@/lib/utils";

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
  const dotColor = isCancelled
    ? "bg-red-500"
    : (CUSTOMER_STATUS_COLORS as Record<string, { dot: string }>)[customerStatus]?.dot ??
      "bg-blue-500";

  return (
    <div className="card-surface rounded-2xl px-5 py-4">
      {/* on-path: ไม่มีหัว — progressbar ล้วน (ขั้นปัจจุบันเด่นในแถบบอกสถานะแล้ว เบสชี้ 2026-06-12)
          นอกเส้นทาง/ยกเลิก: โชว์ชื่อสถานะ เพราะแถบด้านล่างไม่ไฮไลต์ขั้นปัจจุบัน */}
      {!onPath && (
        <div className="mb-3 flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dotColor)} />
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            {currentLabel}
          </span>
        </div>
      )}

      {/* เส้นทางเต็ม — ป้ายครบทุกขั้น polish เบาตา */}
      <div
        role="progressbar"
        aria-label="สถานะคำสั่งซื้อ"
        aria-valuenow={onPath ? currentStepIndex + 1 : undefined}
        aria-valuemin={1}
        aria-valuemax={flowSteps.length}
        className="flex items-start gap-0 overflow-x-auto pb-0.5"
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
                      ? "text-[11px] font-semibold text-blue-600 dark:text-blue-400"
                      : isPast
                        ? "text-[10px] text-slate-400 dark:text-slate-500"
                        : "text-[10px] text-slate-300 dark:text-slate-600"
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

      {/* สถานะนอกเส้นทาง (พักงาน/สอบถามของงานสำเร็จรูป) — บอกตรงๆ แทนปล่อยให้แถบไม่ไฮไลต์ */}
      {!onPath && !isCancelled && (
        <p className="mt-3 border-t border-slate-100 pt-2.5 text-[12px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
          สถานะ &quot;{currentLabel}&quot; อยู่นอกเส้นทางหลักของงานชนิดนี้
        </p>
      )}
    </div>
  );
}
