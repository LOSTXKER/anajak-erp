import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inline status / error banner — มาตรฐานกลางแทนกล่อง
 * `rounded-lg border border-red-200 bg-red-50 ...` ที่เขียนมือซ้ำหลายหน้า
 * (quotations, public portal). ใช้คู่กับ <QueryError> ที่หนักกว่าสำหรับ error เต็มหน้า.
 */
const alertVariants = cva(
  "flex gap-2.5 rounded-xl border p-3 text-[13px] leading-relaxed",
  {
    variants: {
      variant: {
        info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200",
        success:
          "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200",
        warning:
          "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
        error:
          "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

export interface AlertProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof alertVariants> {
  icon?: LucideIcon;
  title?: React.ReactNode;
}

export function Alert({
  className,
  variant,
  icon: Icon,
  title,
  children,
  ...props
}: AlertProps) {
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />}
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
      </div>
    </div>
  );
}

export { alertVariants };
