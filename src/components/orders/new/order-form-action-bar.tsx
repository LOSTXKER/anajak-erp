import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface OrderFormActionBarProps extends HTMLAttributes<HTMLDivElement> {
  summary: ReactNode;
  children: ReactNode;
}

/**
 * แถบสรุป+ปุ่มท้ายฟอร์มออเดอร์ชุดกลางสำหรับทั้ง create และ inline edit
 * อยู่ใน document flow เสมอ — ห้ามทำ sticky ซ้อนเหนือช่องกรอก
 */
export function OrderFormActionBar({
  summary,
  children,
  className,
  ...props
}: OrderFormActionBarProps) {
  return (
    <div
      data-order-form-action-bar=""
      className={cn(
        "card-surface flex flex-wrap items-center gap-2 rounded-lg border-t border-slate-200 px-5 py-3 sm:px-6 dark:border-white/10",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{summary}</div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {children}
      </div>
    </div>
  );
}
