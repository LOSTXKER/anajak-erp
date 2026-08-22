import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TINT } from "./tokens";

/**
 * Inline status / error banner — มาตรฐานกลางแทนกล่อง
 * `rounded-lg border border-red-200 bg-red-50 ...` ที่เขียนมือซ้ำหลายหน้า
 * (quotations, public portal). ใช้คู่กับ <QueryError> ที่หนักกว่าสำหรับ error เต็มหน้า.
 */

const alertVariants = cva(
  "flex gap-2 rounded-lg border p-3 text-sm leading-relaxed",
  {
    variants: { variant: TINT },
    defaultVariants: { variant: "info" },
  },
);

export interface AlertProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof alertVariants> {
  icon?: LucideIcon;
  title?: React.ReactNode;
}

/* forwardRef เพราะฟอร์มบางหน้าต้อง "เด้งโฟกัสมาที่กล่องสรุปข้อผิดพลาด" หลังกดส่ง
   (เช่น /orders/new) — ถ้าส่ง ref ไม่ได้ ต้องกลับไปเขียนกล่องเองเหมือนเดิม */
export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, icon: Icon, title, children, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />}
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
      </div>
    </div>
  ),
);
Alert.displayName = "Alert";

export { alertVariants };
