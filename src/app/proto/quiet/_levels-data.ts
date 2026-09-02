/**
 * ระดับความ "ดัง" ของสีหมวดในหน้าลอง "หรี่สี" — แยกไฟล์จาก `_levels.tsx` เพราะไฟล์นั้นเป็น "use client"
 * และ `view/page.tsx` (server component) ต้องอ่านค่านี้เป็นข้อมูลจริง ไม่ใช่ client reference
 */
export const QUIET_LEVELS = [
  { value: "current", label: "ตอนนี้ (แบบ B)" },
  { value: "gray", label: "ถ้าอยากคลีนกว่านี้อีก · เทาหมด" },
] as const;

export type QuietLevel = (typeof QUIET_LEVELS)[number]["value"];
