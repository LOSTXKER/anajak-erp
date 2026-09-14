"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { c } from "@/components/orders/orders-ui";

/* ============================================================
   แถบแบ่งหน้าท้ายตาราง — ต้นแบบ .pager (รื้อ 2026-09-15)
   "แสดง 1–20 จาก 214" ซ้าย · เลขหน้าขวา (1 2 3 … 11) · พื้นจมปิดท้ายการ์ด
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
    <div className={c("pager")}>
      <span>
        แสดง{" "}
        <b>
          {from.toLocaleString("th-TH")}–{to.toLocaleString("th-TH")}
        </b>{" "}
        จาก <b>{total.toLocaleString("th-TH")}</b>
      </span>
      <nav className={c("pg")} aria-label="หน้า">
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="หน้าก่อน">
          <ChevronLeft aria-hidden="true" />
        </button>
        {pagerItems(page, lastPage).map((item, index) =>
          item === "gap" ? (
            <span key={`gap-${index}`} className={c("dots")} aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === page ? "page" : undefined}
              aria-label={`หน้า ${item}`}
            >
              {item}
            </button>
          ),
        )}
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= lastPage} aria-label="หน้าถัดไป">
          <ChevronRight aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}
