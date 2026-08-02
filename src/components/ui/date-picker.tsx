"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCUS_BUTTON, FOCUS_FIELD, OVERLAY_PANEL, controlShapeClass, type ControlShape } from "./tokens";
import { CONTROL_H, CONTROL_H_SM, CONTROL_MIN_H } from "./control-size";

/* ============================================================
   ปฏิทินของเราเอง (เบสสั่ง 2026-07-31 "ปฏิทินใช้ฟอร์มของเว็บเราเอง")

   เดิมใช้ <input type="date"> ของเบราว์เซอร์ — ปฏิทินที่เด้งออกมาเป็นของ
   ระบบปฏิบัติการ: ฟอนต์ไม่ใช่ Prompt · เป็นปี ค.ศ. ขณะทั้งเว็บใช้ พ.ศ. ·
   หน้าตาต่างกันทุกเครื่อง · แก้อะไรไม่ได้เลย (อาการเดียวกับช่องเลือกที่แก้ไปแล้ว)

   เขียนปฏิทินเองด้วย date-fns ที่โปรเจกต์มีอยู่แล้ว — ไม่เพิ่ม dependency ใหม่
   ค่าที่รับ/ส่งออกยังเป็น "YYYY-MM-DD" เหมือน input เดิมทุกประการ
   เพื่อให้จุดที่เรียกใช้ไม่ต้องแก้ตรรกะอะไรเลย
   ============================================================ */

export const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
export const MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

/** ตัวย่อเดือนแบบที่คนไทยใช้จริง — ตัดคำเอาเองด้วย slice(0,3) จะได้ "มกร/กุม/สิง"
 *  ซึ่งไม่มีใครเขียนแบบนั้น (audit ก่อน merge จับได้) */
export const MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** ทั้งเว็บพูดเป็น พ.ศ. — ปฏิทินต้องพูดภาษาเดียวกัน ไม่งั้นคนกรอกผิดปีทั้งใบ */
export const buddhistYear = (d: Date) => d.getFullYear() + 543;

export function parseValue(value: string | undefined): Date | null {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

export function DatePicker({
  value,
  onChange,
  id,
  "aria-label": ariaLabel,
  placeholder = "เลือกวันที่",
  disabled,
  className,
  shape,
  clearable = true,
  required,
}: {
  /** "YYYY-MM-DD" — รูปแบบเดียวกับ <input type="date"> เดิม */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  "aria-label"?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  shape?: ControlShape;
  clearable?: boolean;
  /** ช่องที่บังคับกรอก — ซ่อนปุ่มล้าง + บอกโปรแกรมอ่านหน้าจอ
   *  ⚠️ ไม่บล็อกการส่งฟอร์มเหมือน <input required> เดิม (นี่คือปุ่ม ไม่ใช่ช่องกรอก)
   *  ฟอร์มที่พึ่ง required ต้องตรวจเองก่อน submit + รัดที่ zod ฝั่ง server */
  required?: boolean;
}) {
  const selected = parseValue(value);
  const canClear = clearable && !required;
  const [open, setOpen] = React.useState(false);
  const [cursor, setCursor] = React.useState<Date>(selected ?? new Date());

  // เปิดปฏิทินครั้งใหม่ ต้องเด้งไปเดือนของค่าที่เลือกอยู่ ไม่ใช่ค้างเดือนที่เลื่อนไว้รอบก่อน
  React.useEffect(() => {
    if (open) setCursor(selected ?? new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const today = startOfDay(new Date());

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            controlShapeClass(shape),
            CONTROL_H,
            "flex w-full items-center justify-between gap-2 border border-slate-200/70 bg-white px-3 py-1 text-base transition-colors",
            FOCUS_FIELD,
            "sm:text-sm disabled:cursor-not-allowed disabled:opacity-50",
            "dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100",
            className,
          )}
        >
          <span className={cn("truncate", !selected && "text-slate-500 dark:text-slate-400")}>
            {selected
              ? `${selected.getDate()} ${MONTHS[selected.getMonth()]} ${buddhistYear(selected)}`
              : placeholder}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {canClear && selected && !disabled && (
              <span
                role="button"
                tabIndex={0}
                aria-label="ล้างวันที่"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange("");
                  }
                }}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <CalendarDays className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          </span>
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            OVERLAY_PANEL,
            "z-50 w-[19rem] p-3",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "motion-reduce:animate-none",
          )}
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="เดือนก่อนหน้า"
              onClick={() => setCursor((c) => subMonths(c, 1))}
              className={cn(CONTROL_H_SM, "inline-flex w-11 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 sm:w-8 dark:hover:bg-slate-800")}
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
              className={cn(CONTROL_H_SM, "inline-flex w-11 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 sm:w-8 dark:hover:bg-slate-800")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="pb-1 text-center text-2xs font-medium text-slate-500 dark:text-slate-300"
              >
                {w}
              </div>
            ))}
            {days.map((day) => {
              const inMonth = isSameMonth(day, cursor);
              const isSelected = selected && isSameDay(day, selected);
              const isToday = isSameDay(day, today);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  aria-label={`${day.getDate()} ${MONTHS[day.getMonth()]} ${buddhistYear(day)}`}
                  aria-pressed={Boolean(isSelected)}
                  onClick={() => {
                    onChange(format(day, "yyyy-MM-dd"));
                    setOpen(false);
                  }}
                  className={cn(
                    CONTROL_H,
                    "flex items-center justify-center rounded-lg text-sm tabular-nums transition-colors",
                    FOCUS_BUTTON,
                    !inMonth && "text-slate-500 dark:text-slate-400",
                    inMonth && "text-slate-700 dark:text-slate-200",
                    !isSelected && "hover:bg-slate-100 dark:hover:bg-slate-800",
                    isToday &&
                      !isSelected &&
                      "font-semibold text-blue-600 dark:text-blue-400",
                    isSelected &&
                      "bg-blue-600 font-semibold text-white hover:bg-blue-700",
                  )}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex gap-2 border-t border-slate-200 pt-2 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                onChange(format(new Date(), "yyyy-MM-dd"));
                setOpen(false);
              }}
              className={cn(CONTROL_MIN_H, "flex-1 rounded-full text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40")}
            >
              วันนี้
            </button>
            {canClear && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className={cn(CONTROL_MIN_H, "flex-1 rounded-full text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800")}
              >
                ล้าง
              </button>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
