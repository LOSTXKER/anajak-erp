import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpTip } from "@/components/ui/help-tip";
import {
  VISUAL_TONE_CLASSES,
  visualToneForLabel,
  type VisualTone,
} from "@/lib/visual-tone";

interface SectionProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode;
  meta?: React.ReactNode;
  help?: React.ReactNode;
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
  icon?: LucideIcon;
  tone?: VisualTone;
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
      meta,
      help,
      action,
      bordered = true,
      flush = false,
      compact = false,
      headingLevel = 2,
      icon: Icon,
      tone,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const Heading = headingLevel === 3 ? "h3" : "h2";
    const hasHeader = Boolean(title || meta || help || action);
    const resolvedTone = tone ?? visualToneForLabel(typeof title === "string" ? title : null);

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
            <div className="flex min-w-0 items-start gap-3">
              {Icon && !compact && (
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", VISUAL_TONE_CLASSES[resolvedTone].soft)} aria-hidden="true">
                  <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                </span>
              )}
              <div className="min-w-0 space-y-0.5">
              {title &&
                (compact ? (
                  <div className="flex items-center gap-1">
                    <Heading className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {title}
                    </Heading>
                    {help && <HelpTip label={typeof title === "string" ? title : "หัวข้อนี้"}>{help}</HelpTip>}
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Heading className="text-base font-semibold text-slate-900 dark:text-white">
                      {title}
                    </Heading>
                    {help && <HelpTip label={typeof title === "string" ? title : "หัวข้อนี้"}>{help}</HelpTip>}
                  </div>
                ))}
              {meta && <p className="text-xs text-muted">{meta}</p>}
              </div>
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
