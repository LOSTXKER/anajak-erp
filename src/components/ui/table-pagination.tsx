import { ChevronLeft, ChevronRight } from "lucide-react";
import { c } from "@/components/kit/kit";
import { pagerItems } from "@/lib/pager";

/* ============================================================
   แถบแบ่งหน้าท้ายตาราง — หน้าตาเดียวกับ .pager ของหน้าออเดอร์ (ชุด kit · 2026-09-17)
   ใช้หน้าตา `.pager` ของชุดกลาง: "แสดง 1–20 จาก 214" ซ้าย · เลขหน้า (1 2 3 … 11) ขวา (รวมสไตล์ 2026-09-17)
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
    <nav aria-label="การแบ่งหน้า" className={c("pager")}>
      <span>
        {from != null ? (
          <>
            แสดง <b>{from.toLocaleString("th-TH")}–{to?.toLocaleString("th-TH")}</b> จาก <b>{count}</b> {label}
          </>
        ) : (
          <>
            ทั้งหมด <b>{count}</b> {label}
          </>
        )}
      </span>
      <div className={c("pg")}>
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="หน้าก่อนหน้า">
          <ChevronLeft aria-hidden="true" />
        </button>
        {pagerItems(page, totalPages).map((item, index) =>
          item === "gap" ? (
            <span key={`gap-${index}`} className={c("dots")} aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              aria-current={item === page ? "page" : undefined}
              aria-label={`หน้า ${item}`}
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          ),
        )}
        <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="หน้าถัดไป">
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
