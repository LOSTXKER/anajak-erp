import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
        secondary: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        success: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
        warning: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
        destructive: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
        purple: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
        indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
        orange: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
        teal: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
        cyan: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
        outline: "border border-current bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
