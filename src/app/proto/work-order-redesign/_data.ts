/**
 * ข้อมูลของหน้าลอง "รื้อใบผลิตใหม่" — **ปลอมทั้งหมด ไม่ต่อฐานข้อมูล**
 * ใบตัวอย่าง + กติกาโหมดจด ยืมจาก /proto/work-order-quiet (ชุดเดียวกับ paper-first · QC/แพ็กเป็นขั้น "อื่นๆ" เหมือนฐานทดลอง)
 */

import { ITEMS, WORK_ORDER as BASE, type WorkItem } from "../work-order/_data";
import { AUTO_PLAIN, PAPER_PLAIN, PLAIN_ACTION, PLAIN_WHY, TICKET, currentStep, modeOf, stepsFor, type RecordMode, type WorkStep } from "../work-order-quiet/_data";

export { AUTO_PLAIN, ITEMS, PAPER_PLAIN, PLAIN_ACTION, PLAIN_WHY, TICKET, currentStep, modeOf, stepsFor };
export type { RecordMode, WorkItem, WorkStep };
export const WORK_ORDER = BASE;

export type Variant = "now" | "paper" | "one" | "flow";

export const OPTIONS = [
  { value: "now", label: "ปัจจุบัน · แท็บ + 2 คอลัมน์" },
  { value: "paper", label: "C · จอเหมือนกระดาษ" },
  { value: "one", label: "D · ทีละขั้น" },
  { value: "flow", label: "E · ตอนนี้ทำอะไร (รู้ทางขนาน)" },
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
  if (variant === "flow") return { clicksToSeeAll: 0, clicksToAct: 0, jargon: 0, likePaper: "ไม่ — เป็นแผนที่เส้นทาง" };
  return { clicksToSeeAll: n - 1, clicksToAct: 0, jargon: 0, likePaper: "เฉพาะขั้นที่เปิด" };
}

/* ───────────────────────── E · เส้นทางงานที่เดินขนานกัน ─────────────────────────
 * ของจริง (lib/production-step-actions.selectNowSteps) คิด "ขั้นที่ทำได้ตอนนี้" จากขั้นแรกที่ยังไม่ปิด
 * ของแต่ละสาย (lane) ไม่ใช่ขั้นถัดไปตามเลข · รีดร้อนมีด่านรอ "ฟิล์มเสร็จ ∧ เสื้อพร้อม" (evaluateHeatPressGate)
 * หน้าลองนี้จำลองกติกาเดียวกันกับใบตัวอย่าง 7 ขั้น — ไม่ได้คิดกติกาใหม่ */

export type LaneKey = "shirt" | "film" | "out-emb" | "out-label" | "main";

export const LANE_LABEL: Record<LaneKey, string> = {
  shirt: "เสื้อ",
  film: "ฟิล์ม DTF",
  "out-emb": "ร้านปัก",
  "out-label": "ร้านป้ายคอ",
  main: "รวมกัน",
};

export function laneOf(step: WorkStep): LaneKey {
  if (step.id === "s1") return "shirt";
  if (step.id === "s2") return "film";
  if (step.id === "s3") return "out-emb";
  if (step.id === "s5") return "out-label";
  return "main";
}

/** ขั้นนี้รอขั้นไหนบ้าง (จุดบรรจบ) — รีดร้อนรอเสื้อ+ฟิล์ม · QC รอรีดร้อน+ของร้านนอกทุกร้าน · แพ็กรอ QC */
export function dependsOn(step: WorkStep, steps: WorkStep[]): WorkStep[] {
  const byId = (id: string) => steps.find((s) => s.id === id);
  const pick = (...ids: string[]) => ids.map(byId).filter((s): s is WorkStep => !!s);
  if (step.id === "s4") return pick("s1", "s2");
  if (step.id === "s6") return pick("s4", "s3", "s5");
  if (step.id === "s7") return pick("s6");
  return [];
}

/** ขั้นที่ยังรออยู่ก่อนถึงคิว (ชื่อขั้นที่ยังไม่ปิด) */
export function waitingOn(step: WorkStep, steps: WorkStep[]): WorkStep[] {
  return dependsOn(step, steps).filter((d) => d.state !== "done");
}

/** "ตอนนี้ทำอะไรได้" — ขั้นที่ยังไม่ปิดและไม่ใช่ "ยังไม่ถึง" (สายไหนถึงคิวก็โผล่ พร้อมกันได้หลายสาย) */
export function nowSteps(steps: WorkStep[]): WorkStep[] {
  return steps.filter((s) => s.state !== "done" && s.state !== "todo");
}

/** ขั้นถัดไปที่ยังไม่ถึงคิว — ไว้บอกว่า "รออะไรอยู่" */
export function upcomingSteps(steps: WorkStep[]): WorkStep[] {
  return steps.filter((s) => s.state === "todo");
}
