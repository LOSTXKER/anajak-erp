import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpTip } from "@/components/ui/help-tip";
import type { VisualTone } from "@/lib/visual-tone";

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
  /** ค่าเริ่มต้นของ bordered section คือ panel; ใช้ plain เฉพาะกลุ่มย่อยใน panel แม่ */
  surface?: "plain" | "card";
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
      surface,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const Heading = headingLevel === 3 ? "h3" : "h2";
    const hasHeader = Boolean(title || meta || help || action);
    const isCard = surface === "card" || (surface !== "plain" && bordered);
    return (
      <section
        ref={ref}
        className={cn(
          isCard ? "card-surface overflow-hidden rounded-2xl" : bordered && "border-b border-divider pb-6",
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
              isCard
                ? cn("px-5 pt-4", compact ? "pb-3" : "pb-4", flush && "border-b border-divider")
                : compact ? "pb-3" : "pb-4"
            )}
          >
            <div className="flex min-w-0 items-start gap-3">
              {Icon && !compact && (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center text-muted" aria-hidden="true">
                  <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                </span>
              )}
              <div className="min-w-0 space-y-0.5">
              {title &&
                (compact ? (
                  <div className="flex items-center gap-1">
                    <Heading className="text-xs font-medium text-muted">
                      {title}
                    </Heading>
                    {help && <HelpTip label={typeof title === "string" ? title : "หัวข้อนี้"}>{help}</HelpTip>}
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Heading className="text-base font-semibold text-strong">
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
            !flush && isCard && "px-5 pb-5",
            !flush && isCard && !hasHeader && "pt-5"
          )}
        >
          {children}
        </div>
      </section>
    );
  }
);
Section.displayName = "Section";
