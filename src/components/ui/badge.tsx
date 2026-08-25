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
  // ป้ายเป็น "วงแหวนบาง + ตัวหนังสือสี" ไม่ใช่แคปซูลพื้นสี (UI-2026 เฟส 3 · เบสเคาะจาก mockup)
  //
  // ทำไม: ป้ายถูกเรียกใช้ 99 จุดทั่วเว็บ ในตารางเดียวจึงมีแคปซูลพื้นสีเรียงกันหลายใบ
  // จนกลายเป็นพรมสี — พอทุกอย่างมีสี ก็ไม่มีอะไรเด่น และของที่ควรสะดุดตาจริง
  // (เลยกำหนด/ค้างชำระ) แข่งไม่ขึ้น · เอาพื้นออกเหลือวงแหวน สีเลยกลับมาทำงาน
  //
  // ใช้ ring แทน border เพื่อไม่ให้ขนาดป้ายขยับ (border กินพื้นที่ layout)
  // มุม 6px ตามบันไดของชิ้นเล็ก — rounded-full สงวนไว้ให้ชิปกรองเท่านั้น
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md font-medium ring-1 ring-inset transition-colors",
  {
    variants: {
      variant: {
        default: "bg-transparent text-secondary ring-border",
        accent: "bg-transparent text-blue-700 ring-blue-600/30 dark:text-blue-300 dark:ring-blue-400/30",
        success: "bg-transparent text-green-700 ring-green-600/30 dark:text-green-300 dark:ring-green-400/30",
        warning: "bg-transparent text-amber-700 ring-amber-600/35 dark:text-amber-300 dark:ring-amber-400/30",
        destructive: "bg-transparent text-red-700 ring-red-600/30 dark:text-red-300 dark:ring-red-400/30",
        outline: "bg-transparent text-secondary ring-border",
        // Aliases — คงชื่อไว้ให้หน้าเดิมไม่พัง แต่ยุบให้เหลือความหมายเดียว
        secondary: "bg-transparent text-secondary ring-border",
        purple: "bg-transparent text-module-finance-text ring-module-finance-border",
        indigo: "bg-transparent text-module-finance-text ring-module-finance-border",
        orange: "bg-transparent text-module-product-text ring-module-product-border",
        teal: "bg-transparent text-module-production-text ring-module-production-border",
        cyan: "bg-transparent text-module-production-text ring-module-production-border",
      },
      size: {
        sm: "px-2 py-0 text-xs",
        md: "px-2 py-0.5 text-xs",
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
