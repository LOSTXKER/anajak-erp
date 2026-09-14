"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { FOCUS_BUTTON, INTERACTIVE_PRESSED } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

/* ============================================================
   แถบแบ่งหน้าท้ายตารางออเดอร์ (ต้นแบบรอบ 2 .pager · 2026-09-15)
   "แสดง 1–20 จาก 214" ซ้าย · เลขหน้าขวา (1 2 3 … 11) · พื้นจมเหมือนหัวตาราง ปิดท้ายการ์ดเสมอ
   ============================================================ */

/** เลขหน้าที่โชว์: หน้าแรก · รอบหน้าปัจจุบัน · หน้าสุดท้าย · ช่องว่างเป็น "…" */
export function pagerItems(page: number, pages: number): (number | "gap")[] {
  if (pages <= 7) return Array.from({ length: Math.max(1, pages) }, (_, index) => index + 1);
  const start = Math.max(2, Math.min(page - 1, pages - 3));
  const end = Math.min(pages - 1, Math.max(page + 1, 3));
  const items: (number | "gap")[] = [1];
  if (start > 2) items.push("gap");
  for (let value = start; value <= end; value += 1) items.push(value);
  if (end < pages - 1) items.push("gap");
  items.push(pages);
  return items;
}

const PAGE_BUTTON = cn(
  FOCUS_BUTTON,
  INTERACTIVE_PRESSED,
  "flex h-10 min-w-10 items-center justify-center rounded-lg px-2 text-xs tabular-nums text-secondary disabled:pointer-events-none disabled:opacity-40 sm:h-8 sm:min-w-8",
);

export function OrdersPager({
  page,
  pages,
  total,
  limit,
  onPageChange,
}: {
  page: number;
  pages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}) {
  const lastPage = Math.max(1, pages);
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <nav
      aria-label="การแบ่งหน้า"
      className="flex flex-wrap items-center gap-2 border-t border-divider bg-surface-muted px-4 py-2.5 text-xs tabular-nums text-secondary sm:px-[1.125rem]"
    >
      <p>
        แสดง{" "}
        <span className="font-medium text-strong">
          {from.toLocaleString("th-TH")}–{to.toLocaleString("th-TH")}
        </span>{" "}
        จาก <span className="font-medium text-strong">{total.toLocaleString("th-TH")}</span>
      </p>
      <div className="flex w-full items-center gap-1 sm:ml-auto sm:w-auto">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="หน้าก่อนหน้า"
          className={PAGE_BUTTON}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        {pagerItems(page, lastPage).map((item, index) =>
          item === "gap" ? (
            <span key={`gap-${index}`} aria-hidden="true" className="w-5 text-center text-muted">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === page ? "page" : undefined}
              aria-label={`หน้า ${item}`}
              className={cn(
                PAGE_BUTTON,
                item === page && "bg-blue-100 font-medium text-blue-800 dark:bg-blue-950/60 dark:text-blue-200",
              )}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= lastPage}
          aria-label="หน้าถัดไป"
          className={PAGE_BUTTON}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
