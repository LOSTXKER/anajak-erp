"use client";

import { CalendarDays } from "lucide-react";
import { c, CardHead } from "@/components/kit/kit";
import { BANGKOK_TZ } from "@/lib/utils";
import type { HomeWeek } from "@/server/services/home-overview";

const DAY_MS = 24 * 60 * 60 * 1000;
// ชื่อวันแบบย่อสุด (จ อ พ พฤ ศ ส อา) — ชื่อย่อของ Intl ภาษาไทยยังยาวเกินช่องกว้าง 40px
const WEEKDAY_TH: Record<string, string> = { Mon: "จ", Tue: "อ", Wed: "พ", Thu: "พฤ", Fri: "ศ", Sat: "ส", Sun: "อา" };
const weekdayEn = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: BANGKOK_TZ });
const weekday = { format: (date: Date) => WEEKDAY_TH[weekdayEn.format(date)] ?? weekdayEn.format(date) };
const dayOfMonth = new Intl.DateTimeFormat("th-TH", { day: "numeric", timeZone: BANGKOK_TZ });

/** กำหนดส่ง 7 วัน (ต้นแบบ weekHTML) — กดวันไหน ตารางออเดอร์กรองตามวันนั้น (กดซ้ำเพื่อยกเลิก) */
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
    <section className={c("card")} aria-labelledby="home-week">
      <CardHead
        icon={CalendarDays}
        tone="blue"
        id="home-week"
        title="กำหนดส่ง 7 วัน"
        right={week.overdue > 0 ? <span className={c("chip bad")}>เลยกำหนด {week.overdue}</span> : undefined}
      />
      <div className={c("weekbox")}>
        <div className={c("week")} role="group" aria-label="จำนวนออเดอร์ที่ครบกำหนดแต่ละวัน">
          {week.days.map((day) => {
            const date = new Date(now.getTime() + day.offset * DAY_MS);
            const isToday = day.offset === 0;
            const active = selected === day.offset;
            return (
              <button
                key={day.offset}
                type="button"
                className={c("day", isToday && "now", day.count === 0 && "zero")}
                aria-pressed={active}
                aria-label={`${isToday ? "วันนี้" : weekday.format(date)} ${dayOfMonth.format(date)} มี ${day.count} ออเดอร์`}
                onClick={() => onSelect(active ? null : day.offset)}
              >
                <span className={c("bar")} aria-hidden="true">
                  <i
                    style={{
                      height: day.count === 0 ? 3 : Math.max(6, Math.round((day.count / max) * 52)),
                      animationDelay: `${day.offset * 40}ms`,
                    }}
                  />
                </span>
                <span className={c("n")}>{day.count}</span>
                <span className={c("lb")}>
                  <b>{isToday ? "วันนี้" : weekday.format(date)}</b>
                  {dayOfMonth.format(date)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
