"use client";

import { cn } from "@/lib/utils";
import {
  INTERNAL_STATUS_LABELS,
  INTERNAL_STATUS_COLORS,
} from "@/lib/order-status";
import type { InternalStatus } from "@prisma/client";

/* ============================================================
   การ์ดสถานะงานเหนือตาราง — เรียงเป็นตารางตามลำดับงานจริงตั้งแต่ร่างจนจบ

   เบสส่งภาพระบบเก่ามาให้ดูแล้วสั่ง "อยากลองเอา card สถานะไว้ด้านบนแบบนี้"
   (2026-08-01) แล้วเคาะทรง B จาก mockup: เรียงเป็นตารางเห็นครบ 14 สถานะ
   พร้อมกันเหมือนระบบเก่า แต่ชื่อกับเลขอยู่บรรทัดเดียว —
   ระบบเก่าการ์ดสูงมากจนกิน ~520px จากจอ ~700px ตารางเหลือที่ 1-2 แถว

   แสดงครบทุกใบรวมที่เป็น 0 (ไม่พับ) — เบสต้องการเห็นภาพรวมทั้งกระดาน
   กดการ์ด = กรองเฉพาะสถานะนั้น · กดการ์ดเดิมซ้ำ = ยกเลิกการกรอง
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
  return (
    <div
      role="group"
      aria-label="กรองตามสถานะงาน"
      className={cn(
        "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7",
        isLoading && "opacity-60",
      )}
    >
      {STATUS_ORDER.map((status) => {
        const count = counts?.[status] ?? 0;
        const isOn = selected === status;
        return (
          <button
            key={status}
            type="button"
            aria-pressed={isOn}
            onClick={() => onSelect(isOn ? "" : status)}
            className={cn(
              "card-surface flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition-shadow",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
              isOn
                ? "bg-blue-50 ring-1 ring-blue-500 dark:bg-blue-950/40 dark:ring-blue-400"
                : "card-surface-hover",
            )}
          >
            <span
              className={cn(
                "flex min-w-0 items-center gap-1.5 text-xs leading-tight",
                isOn
                  ? "font-medium text-blue-700 dark:text-blue-300"
                  : "text-slate-600 dark:text-slate-400",
              )}
            >
              <span
                aria-hidden
                className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotFor(status))}
              />
              <span className="truncate">{INTERNAL_STATUS_LABELS[status]}</span>
            </span>
            <span
              className={cn(
                "shrink-0 text-lg font-semibold leading-none tabular-nums",
                // ศูนย์ = ไม่มีงานค้างตรงนั้น จางไว้ไม่ให้แย่งสายตากับตัวเลขที่มีความหมาย
                count === 0
                  ? "text-slate-300 dark:text-slate-600"
                  : "text-slate-900 dark:text-white",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
