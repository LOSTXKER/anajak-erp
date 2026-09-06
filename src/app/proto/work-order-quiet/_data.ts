/**
 * ข้อมูลของหน้าลอง "ใบผลิตเงียบลง" — **ปลอมทั้งหมด ไม่ต่อฐานข้อมูล**
 * ใบตัวอย่างชุดเดียวกับ /proto/paper-first (ORD-2608-0061 กรีนโลจิสติกส์ 240 ตัว · 7 ขั้น)
 *
 * ต่างจาก paper-first ตรงเดียว: QC / แพ็ก ถูกทำให้เป็นขั้น "อื่นๆ" (CUSTOM) เหมือนฐานทดลองที่เบสเปิดดู 6 ก.ย.
 * → กติกาโหมดจดของจริงตกเป็น "จดบนกระดาษ" และป้ายสถานีขึ้น "อื่นๆ" — คงไว้ให้ทาง "ปัจจุบัน" เหมือนจอจริง
 */

import { RECORD_MODE, TICKET, stepsFor, type RecordMode, type WorkStep } from "../paper-first/_data";
import { WORK_ORDER, currentStep } from "../work-order/_data";

export { TICKET, WORK_ORDER, currentStep, stepsFor };
export type { RecordMode, WorkStep };

export type Variant = "now" | "cut" | "fold";

export const OPTIONS = [
  { value: "now", label: "ปัจจุบัน · โชว์ทุกอย่างที่ระบบรู้" },
  { value: "cut", label: "A · ตัดออก เหลือที่ต้องรู้" },
  { value: "fold", label: "B · พับไว้ กดกางค่อยเห็น" },
] as const;

export const VALUES = OPTIONS.map((o) => o.value) as readonly Variant[];

/** โหมดจดตามกติกาจริง (lib/work-order-record-mode) — QC/แพ็กเป็น CUSTOM จึงเป็นกระดาษ */
export function modeOf(step: WorkStep): RecordMode {
  if (step.kind === "qc" || step.kind === "pack") return "paper";
  return RECORD_MODE[step.id] ?? "paper";
}

export type StationKey = "prep" | "dtf" | "outsource" | "other";

/** ป้ายสถานีตามที่ของจริงคำนวณ (lib/station-desk.stationForStep) — "อื่นๆ" คือค่าสำรองตอนหาเลนไม่เจอ */
export function stationOf(step: WorkStep): { key: StationKey; label: string } {
  if (step.kind === "outsource") return { key: "outsource", label: "ร้านนอก" };
  if (step.id === "s1") return { key: "prep", label: "เตรียมเสื้อ" };
  if (step.id === "s2" || step.id === "s4") return { key: "dtf", label: "พิมพ์ DTF / รีดร้อน" };
  return { key: "other", label: "อื่นๆ" };
}

/**
 * บรรทัด "ตอนนี้: หลัง X → ก่อน Y" ตามที่ฟังก์ชันจริง (inferredStage) คำนวณกับใบนี้:
 * ดูเฉพาะขั้นที่จดในระบบ → ขั้นจดในระบบล่าสุดที่ปิด = พิมพ์ฟิล์ม DTF · ขั้นจดในระบบแรกที่ยังไม่ปิด = เตรียมเสื้อ (ติดปัญหา)
 * ผลคือประโยคที่อ่านแล้วงง ทั้งที่รีดไปครึ่งล็อตแล้ว — นี่คือเหตุผลที่ทาง A ตัดทิ้ง / ทาง B พับไว้
 */
export const INFERRED = {
  now: "หลังพิมพ์ฟิล์ม DTF → ก่อนเตรียมเสื้อ — เบิกจากสต๊อก",
  detail: (hasOutsource: boolean) => (hasOutsource ? "รีดร้อน / ตรวจ QC / แพ็กสุดท้าย ดูจากกระดาษ" : "รีดร้อน / ตรวจ QC / แพ็กสุดท้าย ดูจากกระดาษ"),
} as const;

/** ประโยคในโซนลงมือของขั้นที่จดในระบบ — ทาง A/B เขียนเป็นภาษาโรงงาน ไม่ใช่เหตุผลเชิงระบบ */
export const PLAIN_WHY: Record<string, string> = {
  s1: "กดเบิกแล้วสต็อกถูกตัดให้เลย",
  s3: "ของอยู่ที่ร้าน — บันทึกตอนส่งไปและตอนรับกลับ",
  s5: "ของอยู่ที่ร้าน — บันทึกตอนส่งไปและตอนรับกลับ",
};

export const PLAIN_ACTION: Record<string, string> = {
  s1: "เบิกที่เหลือ 60 ตัว",
  s3: "รับของกลับ + ตรวจรับ",
  s5: "ตามร้าน / รับของกลับ",
};

export const PAPER_PLAIN = "ทำตามใบสั่งงาน — ติ๊กและเขียนยอดบนกระดาษ ในระบบไม่ต้องกด";
export const AUTO_PLAIN = "ปิดรอบพิมพ์แล้ว 28 ส.ค. 11:30 — ขั้นนี้ผ่านเอง ไม่ต้องกด";

/** ศัพท์ภายในที่ทีมผลิตทักว่า "อะไรไม่รู้" — นับให้เห็นก่อนตัดสิน */
export const JARGON_VISIBLE: Record<Variant, string[]> = {
  now: ["จดในระบบ", "จดบนกระดาษ", "ถือว่าผ่าน", "อื่นๆ", "ตอนนี้: หลัง X → ก่อน Y", "ม็อกอัพอนุมัติ v3"],
  cut: ["ม็อกอัพ v3"],
  fold: ["ม็อกอัพ v3"],
};

export const JARGON_FOLDED: Record<Variant, string[]> = {
  now: [],
  cut: [],
  fold: ["จดในระบบ", "จดบนกระดาษ", "ตอนนี้: หลัง X → ก่อน Y", "อื่นๆ"],
};

/** จำนวนชิป/ป้ายที่เห็นทันทีในแท็บขั้นงาน (รายการซ้าย + แถบใบสั่งงาน + ขั้นที่เลือกขวา) */
export function chipCount(variant: Variant, steps: WorkStep[], selected: WorkStep): number {
  const live = (s: WorkStep) => s.state === "active" || s.state === "blocked" || s.state === "waiting";
  if (variant === "now") {
    const list = steps.reduce((n, s) => {
      const quiet = modeOf(s) === "paper" && s.state !== "done" && s.state !== "blocked";
      return n + (quiet ? 0 : 1) + 1 + 1 + (s.owner ? 1 : 0);
    }, 0);
    return list + 3 + 3;
  }
  const list = steps.reduce((n, s) => n + (live(s) && modeOf(s) !== "paper" ? 1 : 0), 0);
  return list + (live(selected) && modeOf(selected) !== "paper" ? 1 : 0);
}
