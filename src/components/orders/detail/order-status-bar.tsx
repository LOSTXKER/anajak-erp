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
    <div className="card-surface rounded-2xl px-4 py-3">
      <div className="flex min-h-11 items-center gap-3 rounded-xl">
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dotColor)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">สถานะตอนนี้</p>
          {/* UX4.9: ไม่บอก "ถัดไป" ที่นี่ — การ์ดขั้นต่อไป (order-next-step) เป็นเสียงเดียว */}
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
            {currentLabel}
          </p>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">ขั้น {onPath ? currentStepIndex + 1 : "—"}/{flowSteps.length}</span>
      </div>

      {onPath && (
        <span
          className="sr-only"
          role="progressbar"
          aria-label="ความคืบหน้าคำสั่งซื้อ"
          aria-valuenow={currentStepIndex + 1}
          aria-valuemin={1}
          aria-valuemax={flowSteps.length}
          aria-valuetext={`${currentLabel} ขั้น ${currentStepIndex + 1} จาก ${flowSteps.length}`}
        />
      )}

      <ol
        aria-label="เส้นทางสถานะคำสั่งซื้อ"
        className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-[repeat(11,minmax(0,1fr))] dark:border-slate-800"
      >
        {flowSteps.map((step, i) => {
          const isPast = onPath && i < currentStepIndex;
          const isCurrent = onPath && i === currentStepIndex;
          const stepLabel =
            (INTERNAL_STATUS_LABELS as Record<string, string>)[step] ?? step;
          const stateLabel = isPast
            ? "เสร็จสิ้น"
            : isCurrent
              ? "กำลังดำเนินการ"
              : "รอดำเนินการ";

          return (
            <li
              key={step}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`${stepLabel}: ${stateLabel}`}
              className={cn(
                "flex min-w-0 items-center gap-2 rounded-xl px-2 py-2",
                isCurrent
                  ? isCancelled
                    ? "bg-red-50 dark:bg-red-950/25"
                    : "bg-blue-50 dark:bg-blue-950/25"
                  : "bg-slate-50/70 dark:bg-slate-900/60",
              )}
            >
              <span
                className={cn(
                  "shrink-0 rounded-full",
                  isCurrent
                    ? cn(
                        "h-2.5 w-2.5 ring-[3px]",
                        isCancelled
                          ? "bg-red-500 ring-red-100 dark:ring-red-500/20"
                          : "bg-blue-600 ring-blue-100 dark:bg-blue-500 dark:ring-blue-500/25",
                      )
                    : isPast
                      ? "h-2 w-2 bg-blue-500"
                      : "h-2 w-2 bg-slate-300 dark:bg-slate-700",
                )}
                aria-hidden="true"
              />
              <span
                className={cn(
                  "min-w-0 text-xs leading-tight",
                  isCurrent
                    ? isCancelled
                      ? "font-semibold text-red-700 dark:text-red-300"
                      : "font-semibold text-blue-700 dark:text-blue-300"
                    : isPast
                      ? "text-slate-700 dark:text-slate-300"
                      : "text-slate-500 dark:text-slate-400",
                )}
              >
                {stepLabel}
              </span>
            </li>
          );
        })}
      </ol>

      {!onPath && !isCancelled && (
        <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
          สถานะ &quot;{currentLabel}&quot; อยู่นอกเส้นทางหลักของงานชนิดนี้
        </p>
      )}
    </div>
  );
}
