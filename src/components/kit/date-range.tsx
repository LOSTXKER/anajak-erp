"use client";

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { c } from "@/components/kit/kit";
import { MONTHS, MONTHS_SHORT, WEEKDAYS } from "@/components/ui/date-picker";
import { BANGKOK_TZ } from "@/lib/utils";

/* ============================================================
   ตัวกรองช่วงวันที่ของชุดกลาง — ต้นแบบ mockup-orders-list-lite-2026-09-16 (เบสเคาะ "ทำจริงเลย")
   ปุ่มหน้าตาเหมือนช่องเลือก · กดแล้วมีช่วงสำเร็จรูปด้านซ้าย (กดแล้วกรองทันที) + ปฏิทินกดวันเริ่ม/วันจบ
   ค่าเข้าออกเป็น "YYYY-MM-DD" แบบเดียวกับ URL/tRPC · วันนี้คิดตามปฏิทินไทย · วันในอนาคตกดไม่ได้
   ============================================================ */

type Ymd = string;

const bangkokYmd = new Intl.DateTimeFormat("en-CA", { timeZone: BANGKOK_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** วันปฏิทิน (ไม่มีเวลา) → YYYY-MM-DD · ใช้ UTC ล้วนกันเขตเวลาเครื่องทำวันเลื่อน */
const ymdOf = (y: number, m: number, d: number): Ymd => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const partsOf = (value: Ymd) => {
  const [y, m, d] = value.split("-").map(Number);
  return { y: y!, m: m! - 1, d: d! };
};
const shiftDays = (value: Ymd, days: number) => {
  const { y, m, d } = partsOf(value);
  return ymdOf(y, m, d + days);
};
const shortLabel = (value: Ymd) => {
  const { m, d } = partsOf(value);
  return `${d} ${MONTHS_SHORT[m]}`;
};

function presetsOf(today: Ymd): { key: string; label: string; from: Ymd; to: Ymd }[] {
  const { y, m } = partsOf(today);
  return [
    { key: "today", label: "วันนี้", from: today, to: today },
    { key: "7", label: "7 วันล่าสุด", from: shiftDays(today, -6), to: today },
    { key: "30", label: "30 วันล่าสุด", from: shiftDays(today, -29), to: today },
    { key: "90", label: "90 วันล่าสุด", from: shiftDays(today, -89), to: today },
    { key: "month", label: "เดือนนี้", from: ymdOf(y, m, 1), to: today },
    { key: "last-month", label: "เดือนที่แล้ว", from: ymdOf(y, m - 1, 1), to: ymdOf(y, m, 0) },
  ];
}

/** ป้ายบนปุ่ม — ชื่อช่วงสำเร็จรูปถ้าตรง ("7 วันล่าสุด" อ่านเร็วกว่า "8 ก.ย. – 14 ก.ย.") */
export function dateRangeLabel(from: Ymd, to: Ymd, today: Ymd): string {
  if (!from && !to) return "ทุกช่วงวันที่";
  const preset = presetsOf(today).find((item) => item.from === from && item.to === to);
  if (preset) return preset.label;
  if (from && to) return from === to ? shortLabel(from) : `${shortLabel(from)} – ${shortLabel(to)}`;
  return from ? `ตั้งแต่ ${shortLabel(from)}` : `ถึง ${shortLabel(to)}`;
}

export function KitDateRange({
  from,
  to,
  onChange,
  label = "ช่วงวันที่",
}: {
  from: Ymd;
  to: Ymd;
  onChange: (from: Ymd, to: Ymd) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState(() => bangkokYmd.format(new Date()));
  const [draft, setDraft] = useState<{ a: Ymd; b: Ymd }>({ a: "", b: "" });
  const [cursor, setCursor] = useState(() => partsOf(today));

  const onOpenChange = (next: boolean) => {
    if (next) {
      // เปิดค้างข้ามวันแล้วกด "วันนี้" ต้องได้วันใหม่ — คิดวันนี้ใหม่ทุกครั้งที่เปิด
      const now = bangkokYmd.format(new Date());
      setToday(now);
      setDraft({ a: from, b: to });
      setCursor(partsOf(to || from || now));
    }
    setOpen(next);
  };
  const apply = (nextFrom: Ymd, nextTo: Ymd) => {
    onChange(nextFrom, nextTo);
    setOpen(false);
  };

  const presets = presetsOf(today);
  const end = draft.b || draft.a;
  const activePreset = draft.a ? presets.find((item) => item.from === draft.a && item.to === end) : undefined;
  const firstDow = new Date(Date.UTC(cursor.y, cursor.m, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
  const nextMonthStart = ymdOf(cursor.y, cursor.m + 1, 1);
  const moveMonth = (delta: number) => {
    const moved = new Date(Date.UTC(cursor.y, cursor.m + delta, 1));
    setCursor({ y: moved.getUTCFullYear(), m: moved.getUTCMonth(), d: 1 });
  };
  const pickDay = (day: Ymd) => {
    setDraft((current) => {
      if (!current.a || current.b) return { a: day, b: "" };
      return day < current.a ? { a: day, b: current.a } : { a: current.a, b: day };
    });
  };

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button type="button" className={c("sel dpb", (from || to) && "on")} aria-label={`${label}: ${dateRangeLabel(from, to, today)}`}>
          <Calendar aria-hidden="true" />
          <span>{dateRangeLabel(from, to, today)}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className={c("tokens dpop")} aria-label={label}>
          <div className={c("pre")}>
            {presets.map((preset) => (
              <button
                key={preset.key}
                type="button"
                aria-pressed={activePreset?.key === preset.key}
                onClick={() => apply(preset.from, preset.to)}
              >
                {preset.label}
              </button>
            ))}
            <button type="button" className={c("all")} aria-pressed={!draft.a} onClick={() => apply("", "")}>
              ทุกช่วงวันที่
            </button>
          </div>
          <div className={c("cal")}>
            <div className={c("mh")}>
              <button type="button" className={c("ibtn")} aria-label="เดือนก่อน" onClick={() => moveMonth(-1)}>
                <ChevronLeft aria-hidden="true" />
              </button>
              <b aria-live="polite">
                {MONTHS[cursor.m]} {cursor.y + 543}
              </b>
              <button
                type="button"
                className={c("ibtn")}
                aria-label="เดือนถัดไป"
                disabled={nextMonthStart > today}
                onClick={() => moveMonth(1)}
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
            <div className={c("wk")} aria-hidden="true">
              {WEEKDAYS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className={c("days")}>
              {Array.from({ length: firstDow }, (_, index) => (
                <span key={`blank-${index}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, index) => {
                const day = ymdOf(cursor.y, cursor.m, index + 1);
                const inRange = Boolean(draft.a) && day >= draft.a && day <= end;
                const edge = day === draft.a || day === draft.b;
                return (
                  <button
                    key={day}
                    type="button"
                    className={c("dday", inRange && "in", edge && "edge", day === draft.a && "s", day === end && "e", day === today && "td")}
                    aria-pressed={edge}
                    aria-label={`${index + 1} ${MONTHS[cursor.m]} ${cursor.y + 543}`}
                    disabled={day > today}
                    onClick={() => pickDay(day)}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
            <div className={c("ft")}>
              <span className={c("sum")} aria-live="polite">
                {draft.a ? (draft.b ? `${shortLabel(draft.a)} – ${shortLabel(draft.b)}` : `${shortLabel(draft.a)} · กดวันสุดท้าย`) : "กดวันเริ่ม"}
              </span>
              <Popover.Close asChild>
                <button type="button" className={c("btn sm")}>
                  ยกเลิก
                </button>
              </Popover.Close>
              <button type="button" className={c("btn primary sm")} disabled={!draft.a} onClick={() => apply(draft.a, end)}>
                ใช้ช่วงนี้
              </button>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
