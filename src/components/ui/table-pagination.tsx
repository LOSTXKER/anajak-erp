import { Button } from "./button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TablePaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  label?: string;
  /** จำนวนต่อหน้า — ส่งมาแล้วจะบอก "แสดง 1–20 จาก 210" แทนยอดรวมเฉยๆ */
  limit?: number;
}

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

  return (
    <nav aria-label="การแบ่งหน้า" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 pt-4">
      <p className="text-xs tabular-nums text-secondary">
        {from != null ? `แสดง ${from}–${to} จาก ${total} ${label}` : `ทั้งหมด ${total} ${label}`}
      </p>
      <div className="ml-auto flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
        <Button
          variant="ghost"
          size="icon"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="หน้าก่อนหน้า"
        >
          <ChevronLeft />
        </Button>
        <span className="flex min-w-20 items-center justify-center gap-1.5 px-2 text-xs tabular-nums text-secondary">
          <span className="sr-only">หน้า</span><strong className="font-semibold text-strong">{page}</strong>
          <span aria-hidden="true">/</span><span className="sr-only">จาก</span>{totalPages}
        </span>
        <Button
          variant="ghost"
          size="icon"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="หน้าถัดไป"
        >
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
