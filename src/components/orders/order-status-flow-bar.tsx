"use client";

import { cn } from "@/lib/utils";
import {
  INTERNAL_STATUS_LABELS,
  INTERNAL_STATUS_COLORS,
} from "@/lib/order-status";
import type { InternalStatus } from "@prisma/client";

/* ============================================================
   แถบสถานะเหนือตาราง — เรียงตามลำดับงานจริงตั้งแต่ร่างจนจบ (เบสเคาะ 2026-07-31 แบบ B)
   เดิมสถานะภายในเป็นชิป 14 ตัวซ่อนอยู่ในกล่องตัวกรองที่ต้องกดกางก่อน และกางแล้ว
   ดันตารางหนีลงไป · ยกขึ้นมาอยู่บนสุดเป็นตัวเลขที่อ่านได้ทันทีโดยไม่ต้องกดอะไรเลย

   กดการ์ด = กรองเฉพาะสถานะนั้น · กดการ์ดเดิมซ้ำ = ยกเลิกการกรอง (ไม่ต้องหาปุ่มล้าง)
   ============================================================ */

/** จุดสีของแต่ละสถานะ — ดึงจากชุดสีกลาง ไม่ตั้งสีใหม่ให้หลุดจากภาษาเดิมของระบบ */
const DOT_CLASS: Record<string, string> = {
  NEUTRAL: "bg-slate-400",
  ACCENT: "bg-blue-500",
  WARNING: "bg-amber-500",
  SUCCESS: "bg-green-500",
  DANGER: "bg-red-500",
};

function dotFor(status: InternalStatus) {
  const c = INTERNAL_STATUS_COLORS[status];
  if (!c) return DOT_CLASS.NEUTRAL;
  if (c.text.includes("green")) return DOT_CLASS.SUCCESS;
  if (c.text.includes("red")) return DOT_CLASS.DANGER;
  if (c.text.includes("amber") || c.text.includes("yellow")) return DOT_CLASS.WARNING;
  if (c.text.includes("blue")) return DOT_CLASS.ACCENT;
  return DOT_CLASS.NEUTRAL;
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
      className="card-surface -mx-1 flex gap-2 overflow-x-auto rounded-2xl px-3 py-3 [scrollbar-width:thin]"
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
              "min-h-11 shrink-0 rounded-xl px-3 py-2 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
              isOn
                ? "bg-blue-50 ring-1 ring-blue-500 dark:bg-blue-950/40 dark:ring-blue-400"
                : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800",
            )}
          >
            <span className="flex items-center gap-1.5 whitespace-nowrap text-2xs text-slate-600 dark:text-slate-400">
              <span
                aria-hidden
                className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotFor(status))}
              />
              {INTERNAL_STATUS_LABELS[status]}
            </span>
            <span
              className={cn(
                "mt-0.5 block text-lg font-semibold leading-tight tabular-nums",
                // ศูนย์ = ไม่มีงานค้างตรงนั้น จางไว้ไม่ให้แย่งสายตากับตัวเลขที่มีความหมาย
                count === 0
                  ? "text-slate-300 dark:text-slate-600"
                  : "text-slate-900 dark:text-white",
                isLoading && "opacity-50",
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
