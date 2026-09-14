import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* ============================================================
   การ์ดของหน้าแรก (รื้อ 2026-09-14) — หัวการ์ดทุกใบมีไอคอนในกล่องสี (เบสสั่ง)
   ผิวการ์ดใช้ card-surface กลาง (ขอบบาง ไม่มีเงา มุม 20px ตาม token ใหม่)
   ============================================================ */

export type HomeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "finance";

const ICON_TONE: Record<HomeTone, string> = {
  neutral: "bg-surface-muted text-secondary",
  brand: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  success: "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  danger: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  finance: "bg-module-finance-surface text-module-finance-text",
};

export function HomeIconTile({
  icon: Icon,
  tone = "neutral",
  size = "md",
  className,
}: {
  icon: LucideIcon;
  tone?: HomeTone;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg",
        size === "sm" ? "h-7 w-7" : "h-8 w-8",
        ICON_TONE[tone],
        className,
      )}
    >
      <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={1.75} />
    </span>
  );
}

export function HomeCard({
  id,
  title,
  icon,
  tone = "neutral",
  action,
  children,
  className,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  tone?: HomeTone;
  /** ของด้านขวาของหัวการ์ด — ชิปสถานะ/ตัวกรอง/ลิงก์ไปหน้าเต็ม */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className={cn("card-surface overflow-hidden rounded-2xl", className)}>
      <header className="flex flex-wrap items-center gap-3 px-4 pb-3 pt-4 sm:px-5">
        <h2 id={`${id}-title`} className="flex min-w-0 items-center gap-2.5 text-base font-semibold text-strong">
          <HomeIconTile icon={icon} tone={tone} />
          <span className="truncate">{title}</span>
        </h2>
        {action ? <div className="ml-auto flex flex-wrap items-center gap-2">{action}</div> : null}
      </header>
      {children}
    </section>
  );
}

/** ชิปสถานะสั้น ๆ บนหัวการ์ด/ในแถว — สีบอกความหมายจริงเท่านั้น */
export function HomeChip({
  tone = "neutral",
  dot = false,
  children,
  className,
}: {
  tone?: HomeTone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const TONE: Record<HomeTone, string> = {
    neutral: "bg-surface-muted text-secondary",
    brand: "bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200",
    success: "bg-green-50 text-green-800 dark:bg-green-950/50 dark:text-green-200",
    warning: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
    danger: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-200",
    finance: "bg-module-finance-surface text-module-finance-text",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums",
        TONE[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
