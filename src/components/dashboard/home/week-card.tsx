"use client";

import { CalendarDays } from "lucide-react";
import { FOCUS_BUTTON, INTERACTIVE_PRESSED } from "@/components/ui/tokens";
import { BANGKOK_TZ, cn } from "@/lib/utils";
import type { HomeWeek } from "@/server/services/home-overview";
import { HomeCard, HomeChip } from "./home-card";
import styles from "./home.module.css";

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
      <div className={styles.week} role="group" aria-label="จำนวนออเดอร์ที่ครบกำหนดแต่ละวัน">
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
                styles.day,
              )}
            >
              <span className="flex h-14 w-full items-end justify-center" aria-hidden="true">
                <span
                  className={cn(
                    "block w-4 rounded-t-md rounded-b-sm",
                    day.count === 0 ? "bg-border" : isToday ? styles.dayBarToday : styles.dayBar,
                  )}
                  style={{ height: day.count === 0 ? 3 : Math.max(6, Math.round((day.count / max) * 52)) }}
                />
              </span>
              <span className={cn(styles.dayNumber, day.count === 0 && styles.dayZero)}>{day.count}</span>
              <span className={cn(styles.dayLabel, isToday && styles.dayToday)}>
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
