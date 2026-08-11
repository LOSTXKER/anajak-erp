import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  bordered?: boolean;
  flush?: boolean;
  /**
   * Render the header as a small all-caps group-label (macOS System Settings
   * style) instead of a primary heading. Useful when several Sections stack in
   * a narrow column and the heading should feel like a quiet group divider
   * rather than a card title.
   */
  compact?: boolean;
  /** ใช้ 3 เมื่อนำ Section แบบไม่มีผิวไปเป็นกลุ่มย่อยภายใน Section หลัก */
  headingLevel?: 2 | 3;
}

/**
 * Lightweight container used across the dashboard for consistent section
 * headings. Replaces the heavier `Card + CardHeader + CardTitle` triplet
 * scattered through forms and detail pages.
 */
export const Section = React.forwardRef<HTMLDivElement, SectionProps>(
  (
    {
      title,
      description,
      action,
      bordered = true,
      flush = false,
      compact = false,
      headingLevel = 2,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const Heading = headingLevel === 3 ? "h3" : "h2";
    const hasHeader = Boolean(title || description || action);

    return (
      <section
        ref={ref}
        className={cn(
          bordered && "card-surface rounded-2xl",
          className
        )}
        {...props}
      >
        {hasHeader && (
          <header
            className={cn(
              "flex items-start justify-between gap-3",
              // ขอบ 28px (เบสเคาะ 2026-08-03 รอบ "ปรับสัดส่วน") — การ์ดกว้าง 1,024px
              // ขอบ 24px แน่นเกินสัดส่วน · หัวข้อ→เนื้อหา 20px ให้เป็นบันได 8/16/20/28
              bordered
                ? compact
                  ? "px-5 pt-4 pb-3"
                  : "px-7 pt-6 pb-5"
                : "pb-4"
            )}
          >
            <div className="min-w-0 space-y-0.5">
              {title &&
                (compact ? (
                  <Heading className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {title}
                  </Heading>
                ) : (
                  <Heading className="text-base font-semibold text-slate-900 dark:text-white">
                    {title}
                  </Heading>
                ))}
              {description && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {description}
                </p>
              )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </header>
        )}
        <div
          className={cn(
            !flush && bordered && (compact ? "px-5 pb-5" : "px-7 pb-7"),
            /* ไม่มีหัวการ์ด = ต้องเติมระยะบนเอง — ระยะบนของการ์ดมาจาก header (pt-6/pt-4) มาตลอด
               พอใช้ Section แบบไม่มีหัว (เกิดขึ้นครั้งแรกตอนทำแท็บ 2026-08-12 ที่ป้ายแท็บ
               ทำหน้าที่หัวข้อแทน) เนื้อในเลยชนขอบบนการ์ด — เบสเห็นจากจอจริง
               ใช้ค่าเดียวกับขอบข้าง/ล่าง ให้การ์ดมีขอบเท่ากันทั้งสี่ด้าน */
            !flush && bordered && !hasHeader && (compact ? "pt-5" : "pt-7"),
            !bordered && ""
          )}
        >
          {children}
        </div>
      </section>
    );
  }
);
Section.displayName = "Section";
