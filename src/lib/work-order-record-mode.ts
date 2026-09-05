/**
 * โหมดจดของขั้นงาน — "กระดาษเป็นหลัก ระบบจดเฉพาะจุดที่การกดทำงานให้" (เบสเคาะ A 2026-09-05 · ROADMAP §A5)
 *
 * ที่มา: ค้นคว้า Printful/Printify/Printavo (bestos records research-paper-first-vs-step-ticks-2026-09-05.md)
 * โรงงานใหญ่ไม่ได้ "ติ๊ก" ทุกขั้น — จดเฉพาะจุดที่การจดทำงานอย่างอื่นให้ด้วย ที่เหลือเดินตามใบงานกระดาษ
 *
 *   screen = การกดทำงานให้: เบิกเสื้อ (ตัดยอด Anajak Stock) · ตรวจรับเสื้อลูกค้า (ใบตรวจรับ) · ร้านนอก (ของออกจากโรงงาน)
 *   auto   = ผ่านเองจากรอบพิมพ์ DTF (ปิดรอบพิมพ์ = ขั้นนี้ปิด ไม่ต้องกดซ้ำในใบ)
 *   paper  = ที่เหลือ (รีดร้อน · พรีทรีต · อบสี · พิมพ์พิเศษ · แพทเทิร์น · อื่น ๆ ที่ทำเอง) — ช่างติ๊ก/เขียนยอด/ลงชื่อบนใบสั่งงาน
 *            ระบบ "ถือว่าผ่าน" ตอนส่งเข้า QC (production.sendToQc) · หัวหน้าจดให้เองก่อนก็ได้จากเมนู "เพิ่มเติม"
 *
 * v1 เป็นกฎในโค้ดเหมือน work-order-standards — ถ้าจะให้ตั้งได้ต่อขั้นในสูตรขั้นงาน (RoutingOperation) เป็นงาน schema (⚠️ ถามก่อน)
 * pure — ไม่มี DOM/DB · ใช้ทั้ง client (ใบผลิต · หน้างาน · ใบสั่งงานกระดาษ) และ server (sendToQc)
 */

import { PAPER_DONE_PREFIX } from "@/lib/production-problem";
import { STEP_TYPE_LABELS, isOutsourceStep } from "@/lib/production-steps";

export type RecordMode = "screen" | "paper" | "auto";

export type RecordModeStep = {
  stepType: string;
  executionMode?: string | null;
  outsourceOrders?: readonly unknown[] | null;
};

export type RecordModeStatusStep = RecordModeStep & {
  status: string;
  notes?: string | null;
  customStepName?: string | null;
};

export const RECORD_MODE_LABEL: Record<RecordMode, string> = {
  screen: "จดในระบบ",
  paper: "จดบนกระดาษ",
  auto: "ผ่านเองจากรอบพิมพ์",
};

export function recordModeOf(step: RecordModeStep): RecordMode {
  if (isOutsourceStep(step.stepType) || step.executionMode === "OUTSOURCE" || (step.outsourceOrders?.length ?? 0) > 0) return "screen";
  switch (step.stepType) {
    case "GARMENT_PICK":
    case "GARMENT_RECEIVE":
      return "screen";
    case "DTF_PRINT":
      return "auto";
    default:
      return "paper";
  }
}

/** ทำไมจุดนี้ต้องแตะจอ — ประโยคในโซนลงมือ ให้ช่างรู้ว่ากดแล้วได้อะไร ไม่ใช่กดเพื่อจด */
export function whyRecordOnScreen(step: RecordModeStep): string | null {
  if (recordModeOf(step) !== "screen") return null;
  if (step.stepType === "GARMENT_PICK") return "กดเบิกแล้วระบบตัดยอดสต็อกใน Anajak Stock ให้เลย — ไม่ต้องไปตัดเอง";
  if (step.stepType === "GARMENT_RECEIVE") return "ใบตรวจรับคือหลักฐานว่าเสื้อลูกค้ามาครบ/สภาพเป็นยังไง — ใช้ตอบลูกค้าทีหลัง";
  return "ของออกจากโรงงาน — ระบบต้องรู้ว่าอยู่ร้านไหน กลับเมื่อไร";
}

export const PAPER_STEP_NOTE = "ขั้นนี้จดบนใบสั่งงาน — ช่างติ๊กข้อกำหนด เขียนยอด ลงชื่อบนกระดาษ · ระบบจะถือว่าผ่านตอนส่งเข้า QC";

/** บรรทัดที่ server ต่อท้าย notes ตอนถือว่าผ่าน — จอใช้แยก "ถือว่าผ่าน" (เทา) ออกจาก "ผ่านแล้ว" (เขียว) */
export function paperDoneMarker(reason = "ปิดให้ตอนส่งเข้า QC"): string {
  return `${PAPER_DONE_PREFIX}${reason}`;
}

export function isInferredDone(step: { status: string; notes?: string | null }): boolean {
  if (step.status !== "COMPLETED") return false;
  return step.notes?.split("\n").some((line) => line.trim().startsWith(PAPER_DONE_PREFIX)) ?? false;
}

const LIVE = new Set(["PENDING", "IN_PROGRESS"]);

/** ขั้นจดบนกระดาษที่ยังเปิดอยู่ — คือขั้นที่ sendToQc จะปิดให้เป็น "ถือว่าผ่าน" */
export function paperStepsToClose<S extends RecordModeStatusStep>(steps: readonly S[]): S[] {
  return steps.filter((s) => recordModeOf(s) === "paper" && LIVE.has(s.status));
}

/** ขั้นที่กั้นการส่งเข้า QC — ทุกขั้นที่ไม่ใช่กระดาษต้องปิดในระบบก่อน และห้ามมีขั้นติดปัญหา/พัก */
export function stepsBlockingQc<S extends RecordModeStatusStep>(steps: readonly S[]): S[] {
  return steps.filter((s) => s.status !== "COMPLETED" && !(recordModeOf(s) === "paper" && LIVE.has(s.status)));
}

/** ส่งเข้า QC ได้ไหม — มีขั้นจริงอย่างน้อย 1 · ทุกขั้นที่จดในระบบ/ผ่านเองปิดแล้ว · เหลือแต่ขั้นกระดาษที่จะถือว่าผ่าน */
export function canSendToQc<S extends RecordModeStatusStep>(steps: readonly S[]): boolean {
  return steps.length > 0 && stepsBlockingQc(steps).length === 0 && paperStepsToClose(steps).length > 0;
}

function labelOf(step: RecordModeStatusStep): string {
  return step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType;
}

/**
 * ช่วงงานที่ระบบอนุมานได้จากจุดที่จด — ไม่ใช่สถานะที่ใครกด (ใบผลิตโชว์เป็น "ตอนนี้: หลัง X → ก่อน Y")
 * ขั้นกระดาษไม่มีสถานะสด จึงบอกได้แค่ "อยู่ระหว่าง" จุดที่จดล่าสุดกับจุดถัดไป
 */
export function inferredStage<S extends RecordModeStatusStep>(steps: readonly S[]): { now: string; detail: string | null } | null {
  const recorded = steps.filter((s) => recordModeOf(s) !== "paper");
  const paper = steps.filter((s) => recordModeOf(s) === "paper" && !isInferredDone(s) && s.status !== "COMPLETED");
  if (steps.length === 0) return null;
  if (steps.every((s) => s.status === "COMPLETED")) return { now: "ผลิตครบ → รอ QC", detail: null };
  const lastDone = [...recorded].reverse().find((s) => s.status === "COMPLETED");
  const nextOpen = recorded.find((s) => s.status !== "COMPLETED");
  const from = lastDone ? `หลัง${labelOf(lastDone)}` : "เริ่มงาน";
  const to = nextOpen ? `ก่อน${labelOf(nextOpen)}` : "ก่อน QC";
  const detail = paper.length > 0 ? `${paper.map(labelOf).join(" / ")} ดูจากกระดาษ` : null;
  return { now: `${from} → ${to}`, detail };
}
