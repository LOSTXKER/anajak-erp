import { BANGKOK_TZ } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;
// ไทยเป็น UTC+7 ตลอดปี (ไม่มี DST) — เที่ยงคืนวันที่ 1 เวลาไทย = 17:00 UTC ของวันก่อนหน้า
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const bangkokCalendar = new Intl.DateTimeFormat("en-CA", {
  timeZone: BANGKOK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type DateInput = Date | string | number;

/** วัน/เดือน/ปีที่คนไทยเห็นบนปฏิทิน ณ เวลานั้น (monthIndex 0-11 แบบ Date) */
function bangkokParts(date: Date): { year: number; monthIndex: number; day: number } {
  const parts = bangkokCalendar.formatToParts(date);
  const part = (type: "year" | "month" | "day") => Number(parts.find((p) => p.type === type)!.value);
  return { year: part("year"), monthIndex: part("month") - 1, day: part("day") };
}

function bangkokDayNumber(value: DateInput): number | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const { year, monthIndex, day } = bangkokParts(date);
  return Date.UTC(year, monthIndex, day) / DAY_MS;
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

/**
 * เที่ยงคืนวันที่ 1 ของเดือนไทย (monthIndex เลยขอบได้ เช่น -1 = ธ.ค. ปีก่อน)
 * เดิมทั้งสามตัวข้างล่างใช้ getFullYear()/getMonth() = เวลาเครื่อง — บน Vercel (UTC)
 * "เดือนนี้" จึงเริ่มนับตอน 07:00 น. ของวันที่ 1 ตามเวลาไทย ของที่เปิดก่อนหน้านั้นตกไปเดือนก่อน
 * (งวดภาษีมี bangkokMonthRange ของตัวเองที่ server/services/tax-report.ts — คณิตศาสตร์ชุดเดียวกัน)
 */
function bangkokMonthStart(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, 1) - BANGKOK_OFFSET_MS);
}

/** เส้นแบ่ง "เดือนนี้" ตามปฏิทินไทย — ของที่เปิดเที่ยงคืนวันที่ 1 ต้องอยู่ในเดือนนี้ */
export function getStartOfMonth(date?: Date): Date {
  const { year, monthIndex } = bangkokParts(date ?? new Date());
  return bangkokMonthStart(year, monthIndex);
}

export function getStartOfLastMonth(date?: Date): Date {
  const { year, monthIndex } = bangkokParts(date ?? new Date());
  return bangkokMonthStart(year, monthIndex - 1);
}

/** ช่วงเดือนไทย [start, end) ย้อนหลัง offset เดือน — ถังข้อมูลของกราฟรายเดือน */
export function getMonthRange(offset = 0, referenceDate?: Date): { start: Date; end: Date } {
  const { year, monthIndex } = bangkokParts(referenceDate ?? new Date());
  return {
    start: bangkokMonthStart(year, monthIndex - offset),
    end: bangkokMonthStart(year, monthIndex - offset + 1),
  };
}

/** เที่ยงคืนของวันตามเวลาไทย — เส้นแบ่ง "วันนี้" ของตัวเลขที่นับตามวันปฏิทิน */
export function startOfBangkokDay(reference: DateInput = new Date()): Date {
  return new Date(
    new Intl.DateTimeFormat("en-CA", { timeZone: BANGKOK_TZ }).format(new Date(reference)) + "T00:00:00+07:00",
  );
}

const bangkokDayMonth = new Intl.DateTimeFormat("th-TH", {
  month: "short",
  day: "numeric",
  timeZone: BANGKOK_TZ,
});
const bangkokDayMonthYear = new Intl.DateTimeFormat("th-TH", {
  year: "2-digit",
  month: "short",
  day: "numeric",
  timeZone: BANGKOK_TZ,
});

/**
 * กำหนดส่งรูปเดียวทั้งเว็บ: "18 ก.ย." ในปีนี้ · "18 ก.ย. 70" เมื่อข้ามปี
 * เดิมตาราง/แผงดูย่อ/หน้าออเดอร์ใช้คนละตัว (formatDateShort ไม่มีปี · formatDateCompact มีปีเสมอ)
 * ฟิลด์เดียวกันจึงอ่านได้คนละรูป และในตารางแยกงานข้ามปีไม่ออก
 * ใส่ปีเฉพาะตอนที่ต้องใช้จริง คอลัมน์แคบ ๆ จึงไม่ยาวขึ้นในแถวส่วนใหญ่
 * (reference ส่งเข้าได้เพื่อทดสอบ · ปกติเทียบกับ "ปีนี้" ตามปฏิทินไทย ค่าเท่ากันทั้ง server/browser)
 */
export function formatDueDate(value: DateInput, reference: DateInput = new Date()): string {
  const date = new Date(value);
  const sameYear = bangkokParts(date).year === bangkokParts(new Date(reference)).year;
  return (sameYear ? bangkokDayMonth : bangkokDayMonthYear).format(date);
}

/**
 * ช่วงวันที่จากตัวกรองปฏิทิน (YYYY-MM-DD ตามปฏิทินไทย) → เงื่อนไขวันที่ของ Prisma
 * ครอบทั้งวันสุดท้าย (ถึง 23:59:59.999 เวลาไทย) — เลือกวันเดียวต้องเห็นของวันนั้นครบ
 */
export function dateRangeFilter(
  from?: string | null,
  to?: string | null,
): { gte?: Date; lte?: Date } | undefined {
  if (!from && !to) return undefined;
  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = new Date(`${from}T00:00:00.000+07:00`);
  if (to) range.lte = new Date(`${to}T23:59:59.999+07:00`);
  return range;
}
