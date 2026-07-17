import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
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
  /**
   * สีตัวเลขหลักตามความหมาย — "muted" ไว้สำหรับเลขศูนย์จริง
   * (จางแต่ยังผ่าน contrast 3:1 สำหรับตัวเลขใหญ่ — ห้ามจางกว่า slate-400)
   */
  tone?: "default" | "danger" | "warning" | "success" | "muted";
  /** ครอบการ์ดทั้งใบเป็นลิงก์ — พื้นที่ hover = พื้นที่กด */
  href?: string;
  /** Optional small caption below the value. */
  caption?: ReactNode;
  /** Optional % change. Positive = green, negative = red. */
  change?: number;
  changeSuffix?: string;
  className?: string;
  /** override สไตล์ตัวเลข เช่น "text-xl" สำหรับแถวสถิติรองที่ไม่ควรแย่งสายตา */
  valueClassName?: string;
}

const TONE_CLASSES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-slate-900 dark:text-white",
  danger: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  success: "text-green-600 dark:text-green-400",
  muted: "text-slate-400 dark:text-slate-500",
};

export function StatCard({
  title,
  value,
  icon: Icon,
  tone = "default",
  href,
  caption,
  change,
  className,
  valueClassName,
}: StatCardProps) {
  const card = (
    <div
      className={cn(
        "card-surface rounded-2xl p-5",
        href && "card-surface-hover",
        !href && className
      )}
    >
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
      <p
        className={cn(
          "mt-2.5 text-[28px] font-semibold leading-none tracking-tight tabular-nums",
          TONE_CLASSES[tone],
          valueClassName
        )}
      >
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

  if (!href) return card;

  return (
    <Link
      href={href}
      aria-label={`ดูรายการ ${title}: ${value}`}
      className={cn(
        "block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950",
        className
      )}
    >
      {card}
    </Link>
  );
}
