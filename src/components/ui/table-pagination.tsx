import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { pagerItems } from "@/lib/pager";
import { FOCUS_BUTTON } from "@/components/ui/tokens";

/* ============================================================
   แถบแบ่งหน้าท้ายตาราง — หน้าตาเดียวกับ .pager ของหน้าออเดอร์ (ชุด kit · 2026-09-17)
   "แสดง 1–20 จาก 214" ซ้าย · เลขหน้า (1 2 3 … 11) ขวา · ตอบสนองตอนกด ไม่มีเอฟเฟกต์ตอนชี้
   ============================================================ */

interface TablePaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  label?: string;
  /** จำนวนต่อหน้า — ส่งมาแล้วจะบอก "แสดง 1–20 จาก 210" แทนยอดรวมเฉยๆ */
  limit?: number;
}

const PAGE_BUTTON = cn(
  "grid h-8 min-w-8 place-items-center rounded-lg px-2 text-xs tabular-nums text-secondary active:bg-interactive-pressed disabled:opacity-35 [&_svg]:size-4",
  FOCUS_BUTTON,
);

export function TablePagination({
  page,
  totalPages,
  total,
  onPageChange,
  label = "รายการ",
  limit,
}: TablePaginationProps) {
  if (totalPages <= 1) return null;
  const from = limit ? (page - 1) * limit + 1 : null;
  const to = limit ? Math.min(page * limit, total) : null;
  const count = total.toLocaleString("th-TH");

  return (
    <nav aria-label="การแบ่งหน้า" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-3">
      <p className="text-xs tabular-nums text-muted">
        {from != null ? (
          <>
            แสดง <b className="font-medium text-strong">{from.toLocaleString("th-TH")}–{to?.toLocaleString("th-TH")}</b> จาก{" "}
            <b className="font-medium text-strong">{count}</b> {label}
          </>
        ) : (
          <>
            ทั้งหมด <b className="font-medium text-strong">{count}</b> {label}
          </>
        )}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" className={PAGE_BUTTON} disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="หน้าก่อนหน้า">
          <ChevronLeft aria-hidden="true" />
        </button>
        {pagerItems(page, totalPages).map((item, index) =>
          item === "gap" ? (
            <span key={`gap-${index}`} className="grid w-5 place-items-center text-xs text-muted" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={cn(PAGE_BUTTON, item === page && "bg-blue-50 font-medium text-blue-700 dark:bg-blue-400/15 dark:text-blue-300")}
              aria-current={item === page ? "page" : undefined}
              aria-label={`หน้า ${item}`}
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          ),
        )}
        <button type="button" className={PAGE_BUTTON} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="หน้าถัดไป">
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
