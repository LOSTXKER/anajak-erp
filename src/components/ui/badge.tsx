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
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        accent:
          "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
        success:
          "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300",
        warning:
          "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
        destructive:
          "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
        outline:
          "border border-slate-200 bg-transparent text-slate-700 dark:border-slate-700 dark:text-slate-300",
        // Aliases — same as default to keep palette small
        secondary:
          "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        purple:
          "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
        indigo:
          "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
        orange:
          "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
        teal:
          "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        cyan:
          "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      },
      size: {
        sm: "px-2 py-0 text-xs",
        md: "px-2.5 py-0.5 text-xs",
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
