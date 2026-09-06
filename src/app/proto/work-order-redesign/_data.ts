/**
 * ข้อมูลของหน้าลอง "รื้อใบผลิตใหม่" — **ปลอมทั้งหมด ไม่ต่อฐานข้อมูล**
 * ใบตัวอย่าง + กติกาโหมดจด ยืมจาก /proto/work-order-quiet (ชุดเดียวกับ paper-first · QC/แพ็กเป็นขั้น "อื่นๆ" เหมือนฐานทดลอง)
 */

import { ITEMS, WORK_ORDER as BASE, type WorkItem } from "../work-order/_data";
import { AUTO_PLAIN, PAPER_PLAIN, PLAIN_ACTION, PLAIN_WHY, TICKET, currentStep, modeOf, stepsFor, type RecordMode, type WorkStep } from "../work-order-quiet/_data";

export { AUTO_PLAIN, ITEMS, PAPER_PLAIN, PLAIN_ACTION, PLAIN_WHY, TICKET, currentStep, modeOf, stepsFor };
export type { RecordMode, WorkItem, WorkStep };
export const WORK_ORDER = BASE;

export type Variant = "now" | "paper" | "one";

export const OPTIONS = [
  { value: "now", label: "ปัจจุบัน · แท็บ + 2 คอลัมน์" },
  { value: "paper", label: "C · จอเหมือนกระดาษ" },
  { value: "one", label: "D · ทีละขั้น" },
] as const;

export const VALUES = OPTIONS.map((o) => o.value) as readonly Variant[];

/** ชื่อสั้นของขั้นสำหรับแถบขั้น (D) — ยาวเต็มอยู่ในผืนใหญ่ */
export const SHORT_LABEL: Record<string, string> = {
  s1: "เตรียมเสื้อ",
  s2: "พิมพ์ฟิล์ม",
  s3: "ปักแขน",
  s4: "รีดร้อน",
  s5: "ป้ายคอ",
  s6: "ตรวจ QC",
  s7: "แพ็ก",
};

/** ตัวเลขก่อนตัดสิน — นับจากโครงจริงของแต่ละทาง */
export function decisionNumbers(variant: Variant, steps: WorkStep[]) {
  const n = steps.length;
  if (variant === "now") return { clicksToSeeAll: 1 + (n - 1), clicksToAct: 0, jargon: 6, likePaper: "ไม่" };
  if (variant === "paper") return { clicksToSeeAll: 0, clicksToAct: 0, jargon: 0, likePaper: "ใช่ ทั้งใบ" };
  return { clicksToSeeAll: n - 1, clicksToAct: 0, jargon: 0, likePaper: "เฉพาะขั้นที่เปิด" };
}
