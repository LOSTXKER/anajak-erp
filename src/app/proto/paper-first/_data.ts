/**
 * ข้อมูลของหน้าลอง "กระดาษเป็นหลัก" — **ปลอมทั้งหมด ไม่ต่อฐานข้อมูล**
 * ใบตัวอย่างชุดเดียวกับ /proto/work-order (ORD-2608-0061 กรีนโลจิสติกส์ 240 ตัว · DTF + ปักแขน + ป้ายคอ)
 * เพิ่มเฉพาะสิ่งที่หน้าลองนี้เทียบ: ขั้นไหน "จดในระบบ" / "ตามกระดาษ" / "ผ่านเอง" และช่างต้องแตะจอกี่ครั้ง
 */

import { ITEMS, STEPS as BASE_STEPS, WORK_ORDER, type WorkStep } from "../work-order/_data";

export { ITEMS, WORK_ORDER };
export type { WorkStep };

export type Variant = "now" | "three" | "batch";

/** ทาง A: ขั้นนี้บันทึกที่ไหน */
export type RecordMode = "screen" | "paper" | "auto";

export const RECORD_MODE: Record<string, RecordMode> = {
  s1: "paper", // เตรียมเสื้อ
  s2: "auto", // พิมพ์ DTF — ผ่านเองเมื่อปิดรอบพิมพ์
  s3: "screen", // ปักแขน ร้านนอก
  s4: "paper", // รีดร้อน
  s5: "screen", // ป้ายคอ ร้านนอก
  s6: "screen", // QC
  s7: "screen", // แพ็ก
};

export const MODE_LABEL: Record<RecordMode, string> = {
  screen: "จดในระบบ",
  paper: "ตามกระดาษ",
  auto: "ผ่านเองจากรอบพิมพ์",
};

/** ทำไมจุดนี้ต้องจดในระบบ — ประโยคที่ขึ้นในโซนลงมือ */
export const WHY_SCREEN: Record<string, string> = {
  s3: "ของออกจากโรงงาน — ระบบต้องรู้ว่าอยู่ร้านไหน กลับเมื่อไร",
  s5: "ของออกจากโรงงาน — ระบบต้องรู้ว่าอยู่ร้านไหน กลับเมื่อไร",
  s6: "ยอดดี/เสียใช้สั่งงานแก้ทันที และเป็นตัวชี้วัด “ทำถูกครั้งแรก”",
  s7: "แพ็กเสร็จ = ออเดอร์พร้อมส่ง ปลดล็อกใบส่งของและออกบิล",
};

/** ปุ่มหลักของจุดที่จดในระบบ (ทาง A) */
export const SCREEN_ACTION: Record<string, string> = {
  s3: "รับของกลับ + ตรวจรับ",
  s5: "ตามร้าน / รับของกลับ",
  s6: "บันทึกผล QC",
  s7: "แพ็กเสร็จ พร้อมส่ง",
};

export const PAPER_NOTE = "ขั้นนี้เดินตามกระดาษ — ระบบถือว่าผ่านเมื่อ QC บันทึกผล ไม่ต้องกดอะไร";
export const AUTO_NOTE = "ปิดรอบพิมพ์ PR-2608-014 แล้ว 28 ส.ค. 11:30 — ขั้นนี้ผ่านเองจากรอบพิมพ์ ช่างไม่ต้องกดซ้ำ";
export const BATCH_NOTE = "ช่างไม่ต้องแตะจอ — หัวหน้ากรอกจากกระดาษตอนปิดวัน (กรอกล่าสุด 29 ส.ค. 17:30)";
export const PRINT_RUN = "PR-2608-014";

/** สวิตช์สถานะขอบ: ใบที่มีร้านนอก 2 ขั้น / ใบที่ทำเองทั้งหมด */
export function stepsFor(outsource: boolean): WorkStep[] {
  const list = outsource ? BASE_STEPS : BASE_STEPS.filter((s) => s.kind !== "outsource");
  return list.map((s, i) => ({ ...s, order: i + 1 }));
}

export function modeOf(variant: Variant, step: WorkStep): RecordMode {
  if (variant !== "three") return "screen";
  return RECORD_MODE[step.id] ?? "paper";
}

/** ปุ่มที่ระบบบังคับให้ช่างกดในขั้นนี้ (ใช้คำนวณ "ช่างแตะจอต่อใบ") */
export function requiredTaps(variant: Variant, step: WorkStep): string[] {
  if (variant === "batch") return [];
  if (variant === "now") {
    return step.kind === "outsource" ? ["ส่งร้าน", "รับกลับ", "ตรวจรับ"] : ["เริ่ม", "ปิดขั้นพร้อมยอด"];
  }
  const mode = modeOf(variant, step);
  if (mode !== "screen") return [];
  if (step.kind === "outsource") return ["ส่งร้าน", "รับกลับ + ตรวจรับ"];
  return [SCREEN_ACTION[step.id] ?? step.action];
}

export function totalTaps(variant: Variant, steps: WorkStep[]): number {
  return steps.reduce((sum, s) => sum + requiredTaps(variant, s).length, 0);
}

/** ขั้นที่ควรเปิดให้ดูก่อนในแต่ละทาง */
export function defaultStepId(variant: Variant, steps: WorkStep[]): string {
  const want = variant === "three" ? "s6" : "s4";
  return steps.find((s) => s.id === want)?.id ?? steps[0]!.id;
}

/** QR จริงจากไลบรารี qrcode (ชี้ใบผลิตตัวอย่าง) — สร้างไว้ล่วงหน้า หน้าลองไม่ต้องรันไลบรารีเอง */
export const QR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="92" height="92" viewBox="0 0 29 29" shape-rendering="crispEdges"><path fill="#ffffff" d="M0 0h29v29H0z"/><path stroke="#000000" d="M0 0.5h7m2 0h1m2 0h1m3 0h1m2 0h1m2 0h7M0 1.5h1m5 0h1m1 0h1m1 0h2m1 0h1m1 0h3m1 0h2m1 0h1m5 0h1M0 2.5h1m1 0h3m1 0h1m2 0h1m2 0h1m1 0h1m3 0h2m2 0h1m1 0h3m1 0h1M0 3.5h1m1 0h3m1 0h1m2 0h5m4 0h1m3 0h1m1 0h3m1 0h1M0 4.5h1m1 0h3m1 0h1m1 0h1m2 0h2m2 0h2m2 0h2m1 0h1m1 0h3m1 0h1M0 5.5h1m5 0h1m5 0h2m1 0h2m2 0h2m1 0h1m5 0h1M0 6.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M12 7.5h2m2 0h2m2 0h1M0 8.5h1m1 0h1m1 0h1m1 0h1m3 0h2m2 0h4m1 0h2m3 0h1m2 0h1M0 9.5h1m1 0h2m1 0h1m3 0h2m2 0h1m2 0h1m3 0h3m2 0h1m2 0h1M3 10.5h1m1 0h2m2 0h2m1 0h2m3 0h1m4 0h1m3 0h3M1 11.5h1m1 0h2m3 0h4m1 0h1m2 0h3m5 0h1m2 0h1M1 12.5h1m1 0h1m2 0h1m1 0h3m1 0h1m1 0h1m2 0h1m2 0h3m2 0h1m1 0h2M1 13.5h2m2 0h1m2 0h1m4 0h2m1 0h2m2 0h4m1 0h1m2 0h1M3 14.5h1m2 0h1m2 0h2m3 0h1m5 0h2m2 0h2m1 0h2M0 15.5h1m1 0h2m4 0h1m4 0h1m2 0h2m2 0h4m1 0h1m1 0h1M0 16.5h2m4 0h3m1 0h1m3 0h4m1 0h5m1 0h1m1 0h2M3 17.5h1m3 0h2m1 0h1m6 0h2m2 0h2m2 0h2m1 0h1M0 18.5h1m1 0h1m2 0h3m1 0h3m1 0h1m2 0h1m5 0h1m4 0h2M1 19.5h1m1 0h2m4 0h1m6 0h3m4 0h1m1 0h1m1 0h1M0 20.5h1m1 0h1m2 0h2m1 0h1m1 0h1m4 0h3m1 0h6M8 21.5h1m1 0h1m1 0h2m2 0h2m1 0h2m3 0h1m1 0h3M0 22.5h7m7 0h1m2 0h4m1 0h1m1 0h2m1 0h2M0 23.5h1m5 0h1m6 0h2m1 0h3m1 0h1m3 0h2m1 0h1M0 24.5h1m1 0h3m1 0h1m1 0h5m1 0h4m2 0h5m2 0h2M0 25.5h1m1 0h3m1 0h1m2 0h1m2 0h3m1 0h3m5 0h1m1 0h3M0 26.5h1m1 0h3m1 0h1m1 0h2m4 0h1m5 0h1m2 0h3m2 0h1M0 27.5h1m5 0h1m2 0h3m3 0h1m1 0h1m1 0h4m4 0h1M0 28.5h7m1 0h2m1 0h1m3 0h3m1 0h2m2 0h2m2 0h2"/></svg>`;
