"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INTERNAL_STATUS_LABELS,
  INTERNAL_STATUS_COLORS,
} from "@/lib/order-status";
import type { InternalStatus } from "@prisma/client";

/* ============================================================
   แถบสถานะงานเหนือตาราง — เรียงตามลำดับงานจริงตั้งแต่ร่างจนจบ (เบสเคาะ 2026-07-31)

   รอบแรกทำเป็นการ์ดสูง 62px เรียงกัน 14 ใบ → กว้างเกินพื้นที่จริงของเบส (~950px
   หลังหักแถบเมนูซ้าย) จนมีแถบเลื่อนแนวนอนโผล่และการ์ดสุดท้ายถูกตัดครึ่ง
   รอบนี้เป็นชิปเตี้ย 34px ชื่อกับเลขอยู่บรรทัดเดียว ขึ้นได้ครบโดยไม่ต้องเลื่อน

   สถานะที่ไม่มีงาน (8 จาก 14 ในข้อมูลจริง) พับเก็บหลังปุ่มเดียว — ไม่ได้หายไปไหน
   กดดูได้ทุกเมื่อ · ตัวที่กำลังเลือกอยู่ไม่ถูกพับแม้จะเป็น 0 ไม่งั้นตัวเลือกหายจากจอ

   กดชิป = กรองเฉพาะสถานะนั้น · กดชิปเดิมซ้ำ = ยกเลิกการกรอง
   ============================================================ */

function dotFor(status: InternalStatus) {
  const c = INTERNAL_STATUS_COLORS[status];
  if (!c) return "bg-slate-400";
  if (c.text.includes("green")) return "bg-green-500";
  if (c.text.includes("red")) return "bg-red-500";
  if (c.text.includes("amber") || c.text.includes("yellow")) return "bg-amber-500";
  if (c.text.includes("blue")) return "bg-blue-500";
  return "bg-slate-400";
}

const STATUS_ORDER = Object.keys(INTERNAL_STATUS_LABELS) as InternalStatus[];

export function OrderStatusFlowBar({
  counts,
  selected,
  onSelect,
  isLoading,
}: {
  /** จำนวนงานต่อสถานะ — นับจากตัวกรองอื่นที่เปิดอยู่ แต่ไม่รวมตัวสถานะเอง */
  counts: Record<string, number> | undefined;
  selected: string;
  onSelect: (status: string) => void;
  isLoading?: boolean;
}) {
  const [showEmpty, setShowEmpty] = useState(false);

  const withWork = STATUS_ORDER.filter(
    (s) => (counts?.[s] ?? 0) > 0 || s === selected,
  );
  const empty = STATUS_ORDER.filter((s) => !withWork.includes(s));
  const visible = showEmpty ? STATUS_ORDER : withWork;

  return (
    <div
      role="group"
      aria-label="กรองตามสถานะงาน"
      className={cn(
        "card-surface flex flex-wrap items-center gap-1.5 rounded-2xl px-3 py-2.5",
        isLoading && "opacity-60",
      )}
    >
      {visible.map((status) => {
        const count = counts?.[status] ?? 0;
        const isOn = selected === status;
        return (
          <button
            key={status}
            type="button"
            aria-pressed={isOn}
            onClick={() => onSelect(isOn ? "" : status)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-xs transition-colors sm:min-h-8",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
              isOn
                ? "bg-blue-50 font-medium text-blue-700 ring-1 ring-blue-500 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-400"
                : "bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800/40 dark:text-slate-300 dark:hover:bg-slate-800",
            )}
          >
            <span
              aria-hidden
              className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotFor(status))}
            />
            <span className="whitespace-nowrap">
              {INTERNAL_STATUS_LABELS[status]}
            </span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                count === 0 && !isOn && "text-slate-300 dark:text-slate-600",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}

      {empty.length > 0 && (
        <button
          type="button"
          onClick={() => setShowEmpty((v) => !v)}
          aria-expanded={showEmpty}
          className="inline-flex min-h-11 items-center gap-1 rounded-full px-2.5 text-xs text-slate-500 transition-colors hover:bg-slate-50 sm:min-h-8 dark:text-slate-400 dark:hover:bg-slate-800/40"
        >
          {showEmpty ? "ซ่อนสถานะที่ไม่มีงาน" : `+${empty.length} สถานะที่ไม่มีงาน`}
          <ChevronDown
            aria-hidden
            className={cn("h-3.5 w-3.5 transition-transform", showEmpty && "rotate-180")}
          />
        </button>
      )}
    </div>
  );
}
