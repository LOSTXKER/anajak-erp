import type { HTMLAttributes, ReactNode } from "react";
import { c } from "@/components/kit/kit";
import { cn } from "@/lib/utils";

interface OrderFormActionBarProps extends HTMLAttributes<HTMLDivElement> {
  summary: ReactNode;
  children: ReactNode;
}

/**
 * แถบสรุป+ปุ่มท้ายฟอร์มออเดอร์ชุดกลางสำหรับทั้ง create และ inline edit
 * หน้าตา .sbar ของต้นแบบ mockup-order-form-2026-09-18: การ์ดที่มีแถบท้าย .tfoot พื้นเทา
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
      className={cn(c("card sbar"), className)}
      {...props}
    >
      <div className={c("tfoot")}>
        {summary}
        <span className={c("grow")} />
        {children}
      </div>
    </div>
  );
}
