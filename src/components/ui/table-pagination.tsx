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

  // ยืนอยู่ "ใต้การ์ด" ไม่ใช่ในตาราง (UI-2026 เฟส 6 · เบสเคาะ "การ์ดครอบ" 2026-08-26)
  // จึงไม่มีเส้นบนแล้ว — ขอบล่างของการ์ดปิดตารางให้เรียบร้อยอยู่แล้ว
  // และเส้นบนตรงนี้เคยเป็น "เส้นปิดท้ายตาราง" โดยบังเอิญ ซึ่งหายไปเองเมื่อมีหน้าเดียว
  // (คอมโพเนนต์นี้ return null) ทำให้รายการสั้นจบกลางอากาศ — ตอนนี้ไม่พึ่งกันแล้ว
  // ไม่มีระยะขอบซ้าย-ขวา เพื่อให้เสมอขอบการ์ดที่อยู่ข้างบน
  return (
    <nav aria-label="การแบ่งหน้า" className="flex items-center justify-between pt-3">
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
