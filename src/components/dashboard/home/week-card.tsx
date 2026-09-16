"use client";

import { CalendarDays } from "lucide-react";
import { c, CardHead } from "@/components/kit/kit";
import { formatDateShort } from "@/lib/utils";
import type { HomeWeek } from "@/server/services/home-overview";

const DAY_MS = 24 * 60 * 60 * 1000;

/* กำหนดส่ง 7 วัน (ต้นแบบ wkbox) — กดวันไหน ตารางออเดอร์กรองตามวันนั้น (กดซ้ำเพื่อยกเลิก)
   แท่งของต้นแบบกว้างเต็มช่อง (ไม่เกิน 34px) สูง 8–82px และเป็นสีแบรนด์ทุกวัน
   ค่าพวกนี้สั่งตรงที่แท่งไว้ก่อน จนกว่า .week/.day ในชุดกลางจะย้ายมาใช้ค่าเดียวกัน */
const BAR_BOX_H = 82;
const BAR_MIN_H = 8;
const BAR_RANGE = 74;

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
            const label = isToday ? "วันนี้" : formatDateShort(date);
            return (
              <button
                key={day.offset}
                type="button"
                className={c("day", isToday && "now", day.count === 0 && "zero")}
                aria-pressed={active}
                aria-label={`${label} มี ${day.count} ออเดอร์`}
                onClick={() => onSelect(active ? null : day.offset)}
              >
                <span className={c("bar")} style={{ height: BAR_BOX_H }} aria-hidden="true">
                  <i
                    style={{
                      height: Math.round(BAR_MIN_H + (day.count / max) * BAR_RANGE),
                      width: "100%",
                      maxWidth: 34,
                      borderRadius: "8px 8px 4px 4px",
                      background: day.count === 0 ? "var(--line)" : "var(--accent)",
                      opacity: 0.85,
                      animationDelay: `${day.offset * 40}ms`,
                    }}
                  />
                </span>
                {/* วันที่ไม่มีงานเขียน "–" ไม่ใช่ 0 — ศูนย์ตัวโตอ่านแล้วสะดุดเหมือนมีของ */}
                <span className={c("n")}>{day.count || "–"}</span>
                <span className={c("lb")}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
