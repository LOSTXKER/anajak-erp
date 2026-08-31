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
  { value: "current", label: "ตอนนี้" },
  { value: "soft", label: "A · กล่องจางลง" },
  { value: "flat", label: "B · ไม่มีกล่อง" },
  { value: "gray", label: "C · เทาหมด" },
] as const;

export type QuietLevel = (typeof QUIET_LEVELS)[number]["value"];

const TONES = ["brand", "production", "product", "finance", "system"] as const;

/** A — พื้นกล่องจางลงเหลือ 40% ที่เหลือกลืนไปกับผิวการ์ด (ไอคอนยังสีเดิม) */
const soft = TONES.map(
  (tone) => `
  [data-quiet="soft"] .bg-module-${tone}-surface {
    background-color: color-mix(
      in srgb,
      var(--color-module-${tone}-surface) 40%,
      transparent
    ) !important;
  }`,
).join("\n");

/** B — ไม่มีพื้นกล่อง เหลือไอคอนสีลอย */
const flat = TONES.map(
  (tone) => `
  [data-quiet="flat"] .bg-module-${tone}-surface { background-color: transparent !important; }`,
).join("\n");

/** C — เทาหมด สีหมวดหายทั้งกล่องและตัวหนังสือ เหลือสีไว้ให้สถานะ/ปุ่มหลักเท่านั้น */
const gray = TONES.map(
  (tone) => `
  [data-quiet="gray"] .bg-module-${tone}-surface { background-color: transparent !important; }
  [data-quiet="gray"] .text-module-${tone}-text { color: var(--color-muted) !important; }`,
).join("\n");

/* แกนที่ 2 — ถอนสีออกจากตัวเลขใหญ่ในการ์ดสรุป
   เลือกด้วย `.tabular-nums` เพราะตัวเลขในการ์ดสรุปมีคลาสนี้ ส่วนกล่องไอคอนไม่มี
   (ระดับ C ทำให้เทาอยู่แล้ว สวิตช์นี้จึงไม่มีผลเพิ่มตอนอยู่ที่ C) */
const plainNumbers = TONES.map(
  (tone) => `
  [data-nums="plain"] .tabular-nums.text-module-${tone}-text { color: var(--color-strong) !important; }`,
).join("\n");

/* เม็ดตัวเลขในแถบชิปกรองของหน้าผลิตใช้สีดิบ (red-50/amber-50/green-50) ไม่ได้ผ่าน
   token หมวด จึงต้องสั่งแยก ไม่งั้นพอเลือก "เทาหมด" จะเหลือเม็ดสีค้างอยู่สามอัน */
const lensPills = `
  [data-quiet="soft"] [data-lens-count] {
    background-color: color-mix(in srgb, currentColor 8%, transparent) !important;
  }
  [data-quiet="flat"] [data-lens-count] { background-color: transparent !important; }
  [data-quiet="gray"] [data-lens-count] {
    background-color: transparent !important;
    color: var(--color-muted) !important;
  }`;

export const QUIET_STYLE = `${soft}\n${flat}\n${gray}\n${plainNumbers}\n${lensPills}`;

export function QuietStyle() {
  return <style>{QUIET_STYLE}</style>;
}
