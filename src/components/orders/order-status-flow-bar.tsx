"use client";

import { cn } from "@/lib/utils";
import {
  INTERNAL_STATUS_LABELS,
  INTERNAL_STATUS_COLORS,
  INTERNAL_STATUS_STAGES,
} from "@/lib/order-status";
import type { InternalStatus } from "@prisma/client";
import { FOCUS_BUTTON } from "@/components/ui/tokens";

/* ============================================================
   แถบเส้นทางงานเหนือตาราง (เบสเคาะแบบ C 2026-08-01)

   อ่านซ้ายไปขวาเป็นเส้นทางงานจริง: รับงาน → ออกแบบ → ผลิต → ส่งของ → ปิดงาน
   ตอบคำถาม "ตอนนี้งานกองอยู่ช่วงไหนของสายการผลิต" ได้ในตาเดียว —
   ซึ่งการ์ดเรียงตารางรอบก่อนตอบไม่ได้ เพราะสายตาต้องไล่อ่านทีละใบ

   ที่มา: รอบก่อนเป็นการ์ดตาราง 14 ใบ 3 แถว — 11 ใบเป็นเลข 0 แต่กินที่เท่าใบที่มีงานจริง
   แถวสุดท้ายเหลือ 4 ใบไม่เต็มแถว และการ์ดกว้าง 300px มีแค่ชื่อกับเลข ช่องว่างเวิ้งว้าง
   แบบนี้สูง ~95px (จาก ~210px)

   จอแคบสลับเป็นการ์ดเรียง 2 คอลัมน์เอง — 14 ช่องในแนวนอนบนมือถือแคบจนกดไม่ถูก
   (วัดจากความกว้างพื้นที่จริงด้วย @container ไม่ใช่ความกว้างหน้าต่าง)
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

const STATUS_ORDER = INTERNAL_STATUS_STAGES.flatMap(
  (s) => s.statuses,
) as InternalStatus[];

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
  const countOf = (s: InternalStatus) => counts?.[s] ?? 0;
  // แถบสัดส่วนเทียบกับสถานะที่มีงานเยอะสุด — บอก "กองอยู่ตรงไหน" โดยไม่ต้องอ่านเลข
  const max = Math.max(1, ...STATUS_ORDER.map(countOf));
  const columns = { gridTemplateColumns: `repeat(${STATUS_ORDER.length}, minmax(0, 1fr))` };

  return (
    <div className={cn("@container", isLoading && "opacity-60")}>
      {/* ── เส้นทางงาน (พื้นที่กว้างพอ) ── */}
      <div
        role="group"
        aria-label="กรองตามสถานะงาน"
        className="card-surface hidden rounded-2xl px-3 py-3 @2xl:block"
      >
        <div className="grid gap-1.5" style={columns}>
          {INTERNAL_STATUS_STAGES.map((stage) => (
            <p
              key={stage.label}
              style={{ gridColumn: `span ${stage.statuses.length}` }}
              className="border-b-2 border-slate-100 pb-1 text-center text-2xs font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:text-slate-500"
            >
              {stage.label}
            </p>
          ))}
        </div>

        <div className="mt-2 grid gap-1.5" style={columns}>
          {STATUS_ORDER.map((status) => {
            const count = countOf(status);
            const isOn = selected === status;
            return (
              <button
                key={status}
                type="button"
                aria-pressed={isOn}
                title={`${INTERNAL_STATUS_LABELS[status]} · ${count} งาน`}
                onClick={() => onSelect(isOn ? "" : status)}
                className={cn(
                  "rounded-lg px-1 py-1.5 text-center transition-colors",
                  FOCUS_BUTTON,
                  isOn
                    ? "bg-blue-50 ring-1 ring-blue-500 dark:bg-blue-950/40 dark:ring-blue-400"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
                )}
              >
                <span
                  className={cn(
                    "block text-lg font-semibold leading-none tabular-nums",
                    count === 0
                      ? "font-normal text-slate-300 dark:text-slate-600"
                      : isOn
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-slate-900 dark:text-white",
                  )}
                >
                  {count}
                </span>
                <span
                  className={cn(
                    "mt-1 block truncate text-2xs leading-tight",
                    isOn
                      ? "font-medium text-blue-700 dark:text-blue-300"
                      : "text-slate-500 dark:text-slate-400",
                  )}
                >
                  {INTERNAL_STATUS_LABELS[status]}
                </span>
                <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <span
                    className={cn("block h-full rounded-full", dotFor(status))}
                    style={{ width: `${Math.round((count / max) * 100)}%` }}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── จอแคบ: การ์ดเรียง 2 คอลัมน์ (14 ช่องแนวนอนกดไม่ถูกบนมือถือ) ── */}
      <div
        role="group"
        aria-label="กรองตามสถานะงาน"
        className="grid grid-cols-2 gap-2 @2xl:hidden"
      >
        {STATUS_ORDER.map((status) => {
          const count = countOf(status);
          const isOn = selected === status;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={isOn}
              onClick={() => onSelect(isOn ? "" : status)}
              className={cn(
                "card-surface flex min-h-11 items-center justify-between gap-2 rounded-2xl px-3 py-2 text-left",
                FOCUS_BUTTON,
                isOn &&
                  "bg-blue-50 ring-1 ring-blue-500 dark:bg-blue-950/40 dark:ring-blue-400",
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
                  "shrink-0 text-base font-semibold leading-none tabular-nums",
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
    </div>
  );
}
