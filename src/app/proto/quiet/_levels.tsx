"use client";

/**
 * บันไดความ "ดัง" ของสีประจำหมวด — วางทับด้วย CSS ในขอบเขตของหน้าลองเท่านั้น
 *
 * ทำไมใช้ CSS ทับ ไม่ใช่วาด component ใหม่:
 * สีหมวดทั้งเว็บออกมาจากที่เดียวคือ `VISUAL_TONE_CLASSES` ใน `src/lib/visual-tone.ts`
 * (กล่องไอคอน = `.bg-module-*-surface` · ตัวหนังสือ/ตัวเลข = `.text-module-*-text`)
 * หน้าลองนี้จึงเรนเดอร์ **component ตัวจริงทุกชิ้น** แล้วเปลี่ยนแค่สีที่ทาลงไป —
 * สิ่งที่เห็นจึงเท่ากับผลของการแก้ `visual-tone.ts` ที่เดียวจริง ๆ ไม่ใช่ของจำลอง
 *
 * แยกเป็นสองแกนโดยตั้งใจ ไม่มัดรวมเป็นแบบ A/B/C:
 *  · แกนที่ 1 (level) = "กล่องไอคอน" ดังแค่ไหน — ไล่เบาลงเป็นขั้น ๆ
 *  · แกนที่ 2 (nums)  = "ตัวเลขใหญ่ในการ์ดสรุป" ยังเป็นสีหมวดไหม
 * เพราะสองอย่างนี้ดังคนละแบบ และเลือกแยกกันได้จริงตอนลงของจริง
 *
 * ⚠️ `!important` ใช้ได้เพราะนี่คือหน้าลอง — ตอนลงของจริงจะไปแก้ที่ token ไม่ใช่ทับด้วย CSS
 */

export const QUIET_LEVELS = [
  { value: "current", label: "ตอนนี้ (แบบ B)" },
  { value: "gray", label: "ถ้าอยากคลีนกว่านี้อีก · เทาหมด" },
] as const;

export type QuietLevel = (typeof QUIET_LEVELS)[number]["value"];

const TONES = ["brand", "production", "product", "finance", "system"] as const;

/* ระดับ "กล่องจางลง" กับ "ไม่มีกล่อง" ถูกถอดออกจากหน้านี้ 2026-08-31 หลังเบสเคาะ B
   แล้วลงของจริง — กล่องไม่มีอยู่ในโค้ดแล้ว ปุ่มพวกนั้นจึงกดแล้วไม่เกิดอะไรขึ้น
   เก็บไว้จะกลายเป็นหน้าลองที่โกหก · เหลือไว้เฉพาะขั้นที่ยังเดินต่อได้จริง */

/** เทาหมด — สีหมวดหายจากไอคอนและตัวเลข เหลือสีไว้ให้สถานะ/ปุ่มหลักเท่านั้น */
const gray = TONES.map(
  (tone) => `
  [data-quiet="gray"] .text-module-${tone}-text { color: var(--color-muted) !important; }`,
).join("\n");

/* แกนที่ 2 — ถอนสีออกจากตัวเลขใหญ่ในการ์ดสรุป (ยังไม่ได้เคาะ)
   เลือกด้วย `.tabular-nums` เพราะตัวเลขในการ์ดสรุปมีคลาสนี้ ส่วนไอคอนไม่มี */
const plainNumbers = TONES.map(
  (tone) => `
  [data-nums="plain"] .tabular-nums.text-module-${tone}-text { color: var(--color-strong) !important; }`,
).join("\n");

/** เม็ดตัวเลขในแถบชิปกรองหน้าผลิตใช้สีดิบ ไม่ได้ผ่าน token หมวด จึงต้องสั่งแยก */
const lensPills = `
  [data-quiet="gray"] [data-lens-count] { color: var(--color-muted) !important; }`;

export const QUIET_STYLE = `${gray}\n${plainNumbers}\n${lensPills}`;

export function QuietStyle() {
  return <style>{QUIET_STYLE}</style>;
}
