import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  /**
   * Legacy prop kept for backwards compatibility — ignored by the new minimal
   * design. Kept so existing call sites (`color="text-amber-600 bg-amber-50"`)
   * don't break.
   */
  color?: string;
  /** Optional small caption below the value. */
  caption?: string;
  /** Optional % change. Positive = green, negative = red. */
  change?: number;
  changeSuffix?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  caption,
  change,
}: StatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 dark:border-slate-800/60 dark:bg-slate-900/80">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
          {title}
        </p>
        {Icon && (
          <Icon
            className="h-4 w-4 text-slate-400 dark:text-slate-500"
            strokeWidth={1.75}
          />
        )}
      </div>
      <p className="mt-2.5 text-[28px] font-semibold leading-none tracking-tight tabular-nums text-slate-900 dark:text-white">
        {value}
      </p>
      <div className="mt-2 flex items-center gap-2 text-[12px]">
        {change !== undefined && (
          <span
            className={cn(
              "inline-flex items-center font-medium tabular-nums",
              change >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            )}
          >
            {change >= 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
        {caption && (
          <span className="text-slate-400 dark:text-slate-500">{caption}</span>
        )}
      </div>
    </div>
  );
}
