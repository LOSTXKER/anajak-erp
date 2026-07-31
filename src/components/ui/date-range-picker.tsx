"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import { CalendarRange, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { controlShapeClass, type ControlShape } from "./native-select";
import { MONTHS, WEEKDAYS, buddhistYear, parseValue } from "./date-picker";

/* ============================================================
   ช่วงวันที่ + ปุ่มทางลัด (เบสสั่ง 2026-08-01 "เอา filter วันที่ออกมาข้างนอก
   และขอแบบเลือก เริ่มต้น ถึงวันที่ และมีปุ่มทางลัดแบบ เดือนนี้ ปีแล้ว ปีนี้ สัปดาห์นี้")

   เดิมเป็นช่องวันที่ 2 ช่องซ่อนอยู่ก้นกล่องตัวกรอง ต้องกดเปิดกล่องก่อนถึงจะเห็น
   และต้องเลือกวันเองทั้งสองช่องแม้จะอยากได้แค่ "เดือนนี้"

   ทางลัดคำนวณจากวันจริงทุกครั้งที่เปิด ไม่ได้ตรึงค่าไว้ตอนโหลดหน้า —
   เปิดเว็บค้างข้ามวันแล้วกด "วันนี้" ต้องได้วันใหม่ ไม่ใช่วันที่เปิดหน้า
   ============================================================ */

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

type Shortcut = { key: string; label: string; range: (now: Date) => [Date, Date] };

const SHORTCUTS: Shortcut[] = [
  { key: "today", label: "วันนี้", range: (n) => [n, n] },
  { key: "last7", label: "7 วันล่าสุด", range: (n) => [subDays(n, 6), n] },
  {
    key: "thisWeek",
    label: "สัปดาห์นี้",
    range: (n) => [startOfWeek(n, { weekStartsOn: 0 }), endOfWeek(n, { weekStartsOn: 0 })],
  },
  { key: "thisMonth", label: "เดือนนี้", range: (n) => [startOfMonth(n), endOfMonth(n)] },
  {
    key: "lastMonth",
    label: "เดือนที่แล้ว",
    range: (n) => [startOfMonth(subMonths(n, 1)), endOfMonth(subMonths(n, 1))],
  },
  { key: "thisYear", label: "ปีนี้", range: (n) => [startOfYear(n), endOfYear(n)] },
  {
    key: "lastYear",
    label: "ปีที่แล้ว",
    range: (n) => [startOfYear(subYears(n, 1)), endOfYear(subYears(n, 1))],
  },
];

/** ช่วงที่เลือกอยู่ตรงกับทางลัดไหน — ใช้ทั้งไฮไลต์ปุ่มและตั้งชื่อบนปุ่มหลัก
 *  ("เดือนนี้" อ่านเร็วกว่า "1 ส.ค. 2569 – 31 ส.ค. 2569") */
function matchShortcut(from: string, to: string): Shortcut | null {
  if (!from || !to) return null;
  const now = new Date();
  return (
    SHORTCUTS.find((s) => {
      const [a, b] = s.range(now);
      return fmt(a) === from && fmt(b) === to;
    }) ?? null
  );
}

const shortDate = (d: Date) =>
  `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${buddhistYear(d)}`;

function triggerLabel(from: string, to: string): string | null {
  const shortcut = matchShortcut(from, to);
  if (shortcut) return shortcut.label;
  const a = parseValue(from);
  const b = parseValue(to);
  if (a && b) {
    // ปีเดียวกันไม่ต้องเขียนปีสองรอบ — ประหยัดที่บนปุ่มโดยยังอ่านครบ
    if (a.getFullYear() === b.getFullYear()) {
      return `${a.getDate()} ${MONTHS[a.getMonth()].slice(0, 3)} – ${shortDate(b)}`;
    }
    return `${shortDate(a)} – ${shortDate(b)}`;
  }
  if (a) return `ตั้งแต่ ${shortDate(a)}`;
  if (b) return `ถึง ${shortDate(b)}`;
  return null;
}

export function DateRangePicker({
  from,
  to,
  onChange,
  shape,
  className,
  align = "start",
  placeholder = "ช่วงวันที่",
}: {
  /** "YYYY-MM-DD" หรือ "" — รูปแบบเดียวกับที่ URL/tRPC ใช้อยู่ */
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  shape?: ControlShape;
  className?: string;
  align?: "start" | "center" | "end";
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  // ค่าระหว่างเลือก — ยังไม่ส่งออกจนกว่าจะครบคู่ ไม่งั้นตารางรีเฟรชกลางคันตอนเพิ่งคลิกวันแรก
  const [draftStart, setDraftStart] = React.useState<Date | null>(null);
  const [hovered, setHovered] = React.useState<Date | null>(null);
  const [cursor, setCursor] = React.useState<Date>(
    parseValue(from) ?? parseValue(to) ?? new Date(),
  );

  React.useEffect(() => {
    if (open) {
      setCursor(parseValue(from) ?? parseValue(to) ?? new Date());
      setDraftStart(null);
      setHovered(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selFrom = parseValue(from);
  const selTo = parseValue(to);
  const label = triggerLabel(from, to);
  const activeShortcut = matchShortcut(from, to);

  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  // ช่วงที่จะระบายสี: ระหว่างเลือกใช้ draft + ตำแหน่งเมาส์ ให้เห็นล่วงหน้าว่าจะได้ช่วงไหน
  const previewRange: [Date, Date] | null = draftStart
    ? hovered
      ? draftStart <= hovered
        ? [draftStart, hovered]
        : [hovered, draftStart]
      : [draftStart, draftStart]
    : selFrom && selTo
      ? [selFrom, selTo]
      : null;

  function pickDay(day: Date) {
    if (!draftStart) {
      setDraftStart(day);
      return;
    }
    // คลิกย้อนหลังกว่าวันแรก = ผู้ใช้ตั้งใจเลือกจากหลังไปหน้า สลับให้เอง
    const [a, b] = draftStart <= day ? [draftStart, day] : [day, draftStart];
    onChange(fmt(a), fmt(b));
    setDraftStart(null);
    setOpen(false);
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="ช่วงวันที่"
          className={cn(
            controlShapeClass(shape),
            "flex h-11 min-h-11 items-center gap-2 border border-slate-200/70 bg-white px-3 text-sm transition-colors",
            "focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/15",
            "sm:h-9 sm:min-h-9 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100",
            className,
          )}
        >
          <CalendarRange className="h-4 w-4 shrink-0 text-slate-400" />
          <span className={cn("truncate", !label && "text-slate-400")}>
            {label ?? placeholder}
          </span>
          {label && (
            <span
              role="button"
              tabIndex={0}
              aria-label="ล้างช่วงวันที่"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange("", "");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange("", "");
                }
              }}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            "overlay-surface z-50 w-[19.5rem] rounded-2xl p-3",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "motion-reduce:animate-none",
          )}
        >
          {/* ทางลัด — งานส่วนใหญ่อยากได้ช่วงมาตรฐาน ไม่ได้อยากไล่จิ้มปฏิทิน */}
          <div className="flex flex-wrap gap-1.5 pb-3">
            {SHORTCUTS.map((s) => {
              const isOn = activeShortcut?.key === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    const [a, b] = s.range(new Date());
                    onChange(fmt(a), fmt(b));
                    setDraftStart(null);
                    setOpen(false);
                  }}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs transition-colors",
                    isOn
                      ? "bg-blue-600 font-medium text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          <div className="mb-2 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
            <button
              type="button"
              aria-label="เดือนก่อนหน้า"
              onClick={() => setCursor((c) => subMonths(c, 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold">
              {MONTHS[cursor.getMonth()]} {buddhistYear(cursor)}
            </p>
            <button
              type="button"
              aria-label="เดือนถัดไป"
              onClick={() => setCursor((c) => addMonths(c, 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-0.5" onMouseLeave={() => setHovered(null)}>
            {WEEKDAYS.map((w) => (
              <div key={w} className="pb-1 text-center text-2xs font-medium text-slate-400">
                {w}
              </div>
            ))}
            {days.map((day) => {
              const inMonth = isSameMonth(day, cursor);
              const inRange =
                previewRange &&
                isWithinInterval(day, { start: previewRange[0], end: previewRange[1] });
              const isEdgeStart = previewRange && isSameDay(day, previewRange[0]);
              const isEdgeEnd = previewRange && isSameDay(day, previewRange[1]);
              const isEdge = isEdgeStart || isEdgeEnd;
              const isToday = isSameDay(day, startOfDay(new Date()));
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  aria-label={`${day.getDate()} ${MONTHS[day.getMonth()]} ${buddhistYear(day)}`}
                  onMouseEnter={() => setHovered(day)}
                  onClick={() => pickDay(day)}
                  className={cn(
                    "flex h-9 items-center justify-center text-sm tabular-nums transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                    // ระบายพื้นช่วงให้ต่อกันเป็นแถบเดียว หัวท้ายโค้งมน
                    inRange && !isEdge && "bg-blue-50 dark:bg-blue-950/40",
                    isEdgeStart && !isEdgeEnd && "rounded-l-lg",
                    isEdgeEnd && !isEdgeStart && "rounded-r-lg",
                    isEdge && "rounded-lg bg-blue-600 font-semibold text-white",
                    !inRange && "rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800",
                    !inMonth && !isEdge && "text-slate-300 dark:text-slate-600",
                    inMonth && !isEdge && "text-slate-700 dark:text-slate-200",
                    isToday && !isEdge && "font-semibold text-blue-600 dark:text-blue-400",
                  )}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200 pt-2 text-xs dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">
              {draftStart
                ? `เริ่ม ${shortDate(draftStart)} — เลือกวันสิ้นสุด`
                : (label ?? "ยังไม่ได้เลือกช่วง")}
            </span>
            <button
              type="button"
              onClick={() => {
                onChange("", "");
                setDraftStart(null);
                setOpen(false);
              }}
              className="shrink-0 rounded-full px-3 py-1 font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              ล้าง
            </button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
