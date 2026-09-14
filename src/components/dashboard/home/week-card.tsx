"use client";

import { CalendarDays } from "lucide-react";
import { FOCUS_BUTTON, INTERACTIVE_PRESSED } from "@/components/ui/tokens";
import { BANGKOK_TZ, cn } from "@/lib/utils";
import type { HomeWeek } from "@/server/services/home-overview";
import { HomeCard, HomeChip } from "./home-card";

const DAY_MS = 24 * 60 * 60 * 1000;
// ชื่อวันแบบย่อสุด (จ อ พ พฤ ศ ส อา) — ชื่อย่อของ Intl ภาษาไทยยังยาวเกินช่องกว้าง 40px
const WEEKDAY_TH: Record<string, string> = { Mon: "จ", Tue: "อ", Wed: "พ", Thu: "พฤ", Fri: "ศ", Sat: "ส", Sun: "อา" };
const weekdayEn = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: BANGKOK_TZ });
const weekday = { format: (date: Date) => WEEKDAY_TH[weekdayEn.format(date)] ?? weekdayEn.format(date) };
const dayOfMonth = new Intl.DateTimeFormat("th-TH", { day: "numeric", timeZone: BANGKOK_TZ });

/** กำหนดส่ง 7 วัน — กดวันไหน ตารางออเดอร์กรองตามวันนั้น (กดซ้ำเพื่อยกเลิก) */
export function WeekCard({
  week,
  now,
  selected,
  onSelect,
}: {
  week: HomeWeek;
  now: Date;
  selected: number | null;
  onSelect: (offset: number | null) => void;
}) {
  const max = Math.max(1, ...week.days.map((day) => day.count));
  return (
    <HomeCard
      id="home-week"
      title="กำหนดส่ง 7 วัน"
      icon={CalendarDays}
      tone="brand"
      action={week.overdue > 0 ? <HomeChip tone="danger">เลยกำหนด {week.overdue}</HomeChip> : undefined}
    >
      <div className="grid grid-cols-7 gap-1 px-3 pb-4 pt-1 sm:px-4" role="group" aria-label="จำนวนออเดอร์ที่ครบกำหนดแต่ละวัน">
        {week.days.map((day) => {
          const date = new Date(now.getTime() + day.offset * DAY_MS);
          const isToday = day.offset === 0;
          const active = selected === day.offset;
          return (
            <button
              key={day.offset}
              type="button"
              aria-pressed={active}
              aria-label={`${isToday ? "วันนี้" : weekday.format(date)} ${dayOfMonth.format(date)} มี ${day.count} ออเดอร์`}
              onClick={() => onSelect(active ? null : day.offset)}
              className={cn(
                FOCUS_BUTTON,
                INTERACTIVE_PRESSED,
                "flex flex-col items-center gap-1.5 rounded-xl px-1 pb-1 pt-2 text-xs transition-colors",
                active ? "bg-interactive-selected text-interactive-selected-text" : "text-muted",
              )}
            >
              <span className="flex h-14 w-full items-end justify-center" aria-hidden="true">
                <span
                  className={cn(
                    "block w-4 rounded-t-md rounded-b-sm",
                    day.count === 0 ? "bg-border" : isToday ? "bg-blue-600 dark:bg-blue-400" : "bg-border-strong",
                  )}
                  style={{ height: day.count === 0 ? 3 : Math.max(6, Math.round((day.count / max) * 52)) }}
                />
              </span>
              <span className={cn("text-sm font-semibold tabular-nums", day.count === 0 ? "text-muted" : "text-strong")}>{day.count}</span>
              <span className={cn("leading-4", isToday && "font-medium text-blue-700 dark:text-blue-300")}>
                <span className="block">{isToday ? "วันนี้" : weekday.format(date)}</span>
                <span className="block tabular-nums">{dayOfMonth.format(date)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </HomeCard>
  );
}
