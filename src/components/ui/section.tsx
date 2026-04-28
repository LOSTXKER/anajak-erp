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
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <section
        ref={ref}
        className={cn(
          bordered &&
            "rounded-2xl border border-slate-200/60 bg-white dark:border-slate-800/60 dark:bg-slate-900/80",
          className
        )}
        {...props}
      >
        {(title || description || action) && (
          <header
            className={cn(
              "flex items-start justify-between gap-3",
              bordered
                ? compact
                  ? "px-5 pt-4 pb-2.5"
                  : "px-6 pt-5 pb-4"
                : "pb-3"
            )}
          >
            <div className="min-w-0 space-y-0.5">
              {title &&
                (compact ? (
                  <h2 className="text-[11.5px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {title}
                  </h2>
                ) : (
                  <h2 className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white">
                    {title}
                  </h2>
                ))}
              {description && (
                <p className="text-[13px] text-slate-500 dark:text-slate-400">
                  {description}
                </p>
              )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </header>
        )}
        <div
          className={cn(
            !flush && bordered && (compact ? "px-5 pb-5" : "px-6 pb-6"),
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
