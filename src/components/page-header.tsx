import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  children?: ReactNode;
}

export function PageHeader({
  title,
  description,
  action,
  breadcrumb,
  children,
}: PageHeaderProps) {
  return (
    <div className="space-y-4">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1 text-[12.5px] text-slate-500 dark:text-slate-400"
        >
          {breadcrumb.map((item, idx) => {
            const isLast = idx === breadcrumb.length - 1;
            return (
              <span key={`${item.label}-${idx}`} className="flex items-center gap-1">
                {item.href && !isLast ? (
                  <Link
                    href={item.href}
                    className="transition-colors hover:text-slate-900 dark:hover:text-white"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    className={
                      isLast
                        ? "text-slate-700 dark:text-slate-300"
                        : "text-slate-500 dark:text-slate-400"
                    }
                  >
                    {item.label}
                  </span>
                )}
                {!isLast && (
                  <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600" />
                )}
              </span>
            );
          })}
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-slate-900 dark:text-white">
            {title}
          </h1>
          {description && (
            <p className="text-[14px] text-slate-500 dark:text-slate-400">
              {description}
            </p>
          )}
        </div>
        {action && (
          // flex-wrap: หน้าออเดอร์ยัดป้ายสถานะ+ปุ่มหลายชิ้นในแถวนี้ — จอเล็กต้องห่อ ไม่ล้น
          <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
        )}
      </div>
      {children}
    </div>
  );
}
