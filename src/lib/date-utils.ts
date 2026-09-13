import { BANGKOK_TZ } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;
const bangkokCalendar = new Intl.DateTimeFormat("en-CA", {
  timeZone: BANGKOK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type DateInput = Date | string | number;

function bangkokDayNumber(value: DateInput): number | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = bangkokCalendar.formatToParts(date);
  const part = (type: "year" | "month" | "day") => Number(parts.find((p) => p.type === type)!.value);
  return Date.UTC(part("year"), part("month") - 1, part("day")) / DAY_MS;
}

/** จำนวนวันตามปฏิทินไทย: วันนี้ = 0, พรุ่งนี้ = 1 โดยไม่ขึ้นกับเขตเวลาของเครื่องหรือชั่วโมงที่เหลือ */
export function differenceInBangkokDays(
  value: DateInput | null | undefined,
  reference: DateInput,
): number | null {
  if (value == null || value === "") return null;
  const target = bangkokDayNumber(value);
  const start = bangkokDayNumber(reference);
  return target === null || start === null ? null : target - start;
}

export function getStartOfMonth(date?: Date): Date {
  const d = date ?? new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function getStartOfLastMonth(date?: Date): Date {
  const d = date ?? new Date();
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}

export function getMonthRange(offset = 0, referenceDate?: Date): { start: Date; end: Date } {
  const d = referenceDate ?? new Date();
  const start = new Date(d.getFullYear(), d.getMonth() - offset, 1);
  const end = new Date(d.getFullYear(), d.getMonth() - offset + 1, 1);
  return { start, end };
}
