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

  // ไม่มีระยะขอบซ้าย-ขวา — หน้ารายการทุกหน้าเป็นตารางที่วางบนผืนหน้าโดยไม่มีกล่องครอบ
  // (UI-2026 เฟส 3) แถบนี้จึงต้องเสมอขอบเดียวกับเซลล์แรก/สุดท้ายของตาราง
  // ถ้าวันหนึ่งมีคนเอาไปใส่ในพาเนล ให้ห่อ div แล้วสั่ง padding ที่ตัวห่อ
  return (
    <nav aria-label="การแบ่งหน้า" className="flex items-center justify-between border-t border-divider py-3">
      <p className="text-xs tabular-nums text-muted">
        {from != null ? `แสดง ${from}–${to} จาก ${total} ${label}` : `ทั้งหมด ${total} ${label}`}
      </p>
      <div className="flex gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="หน้าก่อนหน้า"
        >
          <ChevronLeft />
        </Button>
        <span className="flex items-center px-2 text-xs text-muted">
          {page} / {totalPages}
        </span>
        <Button
          variant="ghost"
          size="sm"
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
