import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Minimal, low-noise badge palette.
 *
 * Aliases (purple/indigo/orange/teal/cyan) are kept so existing pages keep
 * working but they all map to muted neutral / semantic tones — no rainbow.
 */
const badgeVariants = cva(
  // ป้ายแบบชิป kit (2026-09-17 เบสสั่ง "ทุกหน้าให้เข้ากัน ใช้ component เดียวกัน"):
  // แคปซูลพื้นสีอ่อน + ตัวหนังสือสีเข้ม ตรง .chip ของหน้าออเดอร์/ผลิต
  // (แทนแบบวงแหวนบางของ UI-2026 เฟส 3 · โทนกลางยังเป็นเทา สีเก็บไว้ให้สถานะที่มีความหมาย)
  "inline-flex min-h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full font-medium leading-none tabular-nums",
  {
    variants: {
      variant: {
        default: "bg-surface-muted text-secondary",
        accent: "bg-blue-50 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
        success: "bg-green-50 text-green-700 dark:bg-green-400/15 dark:text-green-300",
        warning: "bg-amber-50 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
        destructive: "bg-red-50 text-red-700 dark:bg-red-400/15 dark:text-red-300",
        outline: "bg-transparent text-secondary ring-1 ring-inset ring-border",
        // Aliases — คงชื่อไว้ให้หน้าเดิมไม่พัง แต่ยุบให้เหลือความหมายเดียว
        secondary: "bg-surface-muted text-secondary",
        purple: "bg-surface-muted text-module-finance-text",
        indigo: "bg-surface-muted text-module-finance-text",
        orange: "bg-surface-muted text-module-product-text",
        teal: "bg-surface-muted text-module-production-text",
        cyan: "bg-surface-muted text-module-production-text",
      },
      size: {
        sm: "px-2 text-xs",
        md: "px-2 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
