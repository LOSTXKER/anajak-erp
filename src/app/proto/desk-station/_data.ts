/**
 * หน้าลอง "ใบผลิตหลังแบ่งตามที่ยืน" — ใช้ใบตัวอย่างเดิมของ /proto/work-order (ORD-2608-0061 · 7 ขั้น ครบทุกสถานะ)
 * เพิ่มแค่ "ขั้นนี้ทำที่สถานีไหน" + ประโยคบอกที่ยืน · ปลอมทั้งหมด ไม่ต่อฐานข้อมูล
 *
 * โครงที่เบสเคาะ 2026-09-03 ("เอา A" — แบ่งตามที่ยืน):
 *   จอสถานี /station      = ยืนหน้างาน → "ลงมือ" ทุกอย่างอยู่ที่นี่ที่เดียว (ช่างทุกคน + หัวหน้าตอนเดินโรงงาน)
 *   ใบผลิต /production/[id] = นั่งโต๊ะ → ดูทั้งใบ + วางแผน (ใคร/เมื่อไร/ร้านไหน) ไม่มีปุ่มลงมือ
 */

import { STEPS, WORK_ORDER, type WorkStep } from "../work-order/_data";

export type StationRef = { key: string; label: string };

/** ขั้นไหนขึ้นคิวที่สถานีไหน — ตามรายการสถานีจริงใน lib/station-desk.ts */
export const STATION_OF: Record<string, StationRef> = {
  s1: { key: "lane:PREP", label: "เตรียมเสื้อ" },
  s2: { key: "lane:DTF", label: "พิมพ์ DTF / รีดร้อน" },
  s3: { key: "outsource", label: "ร้านนอก" },
  s4: { key: "lane:DTF", label: "พิมพ์ DTF / รีดร้อน" },
  s5: { key: "outsource", label: "ร้านนอก" },
  s6: { key: "post:qc", label: "QC" },
  s7: { key: "post:pack", label: "แพ็กสุดท้าย" },
};

export function stationOf(step: WorkStep): StationRef {
  return STATION_OF[step.id] ?? { key: "lane:OTHER", label: "ขั้นพิเศษ" };
}

/** ลิงก์ที่ปุ่ม "ไปทำที่จอสถานี" จะพาไป — รูปแบบ URL ของจอสถานีจริง (`?st= &s=job &job= &step=`) */
export function stationHref(step: WorkStep): string {
  return `/station?st=${encodeURIComponent(stationOf(step).key)}&s=job&job=${WORK_ORDER.id}&step=${step.id}`;
}

export type Whereabouts = {
  /** ประโยคเดียวบอกว่างานอยู่ไหน ใครถือ — ชั้น 1 ของการ์ดที่ยืน */
  headline: string;
  /** บรรทัดรอง */
  detail: string | null;
  tone: "info" | "neutral" | "error" | "warning" | "success";
  /** ปุ่มวางแผนที่หัวหน้ามีบนโต๊ะ (ไม่ใช่ปุ่มลงมือ) */
  planActions: string[];
};

/** งานอยู่ไหนตอนนี้ — คำตอบที่คนนั่งโต๊ะต้องได้ใน 3 วิ แทนปุ่มลงมือที่ย้ายไปจอสถานี */
export function whereabouts(step: WorkStep): Whereabouts {
  const st = stationOf(step);
  switch (step.state) {
    case "done":
      return { headline: `ผ่านแล้ว ${step.completedAt ?? ""}`.trim(), detail: step.owner ? `โดย ${step.owner} · ที่สถานี${st.label}` : null, tone: "success", planActions: [] };
    case "active":
      return {
        headline: `กำลังทำอยู่ที่สถานี${st.label}`,
        detail: step.owner ? `${step.owner} รับงานตั้งแต่ ${step.startedAt ?? "—"}` : "ยังไม่มีคนรับ — รอช่างหยิบจากคิว",
        tone: "info",
        planActions: ["เปลี่ยนคนทำ", "เลื่อนควรเสร็จ"],
      };
    case "blocked":
      return step.kind === "outsource"
        ? { headline: `ของยังไม่กลับจากร้าน ${step.outsource?.vendor ?? ""}`, detail: `เลยนัดรับแล้ว — ตามของ หรือนัดใหม่จากโต๊ะนี้ · ตรวจรับตอนของมาถึงทำที่สถานี${st.label}`, tone: "error", planActions: ["นัดรับใหม่", "เปลี่ยนร้าน"] }
        : { headline: `ติดปัญหาอยู่ที่สถานี${st.label}`, detail: `${step.owner ?? "ช่าง"} แจ้งไว้ — หัวหน้าตัดสินใจได้จากจอสถานี (แก้ให้) หรือแก้แผนจากโต๊ะนี้`, tone: "error", planActions: ["เปลี่ยนคนทำ", "พักขั้นนี้"] };
    case "waiting":
      return {
        headline: `อยู่ที่ร้าน ${step.outsource?.vendor ?? "ร้านนอก"}`,
        detail: `นัดรับ ${step.outsource?.backLabel ?? "—"} · พอของมาถึง ช่างตรวจรับที่สถานี${st.label}`,
        tone: "warning",
        planActions: ["นัดรับใหม่", "เปลี่ยนร้าน"],
      };
    default:
      return {
        headline: `ยังไม่ถึง — จะขึ้นคิวที่สถานี${st.label}`,
        detail: "ขึ้นคิวเองเมื่อขั้นก่อนหน้าผ่าน · วางแผนล่วงหน้าได้: ใครทำ ควรเสร็จเมื่อไร",
        tone: "neutral",
        planActions: ["มอบหมายล่วงหน้า", "เลื่อนควรเสร็จ"],
      };
  }
}

/** โครง "แบ่งตามที่ยืน" — ตารางที่จะลง SPEC.md เมื่อเบสเคาะหน้าตา */
export const STRUCTURE = [
  {
    who: "ช่าง (ทุกคน)",
    where: "ยืนหน้าเครื่อง / จอทัชโรงงาน",
    page: "จอสถานี /station",
    can: "เลือกสถานี → หยิบงานจากคิว → ลงมือ (เริ่ม · ลงยอด · ปิดขั้น · เบิกเสื้อ · ตรวจรับของกลับ · แจ้งปัญหา) · ล็อกอินแล้วตกที่หน้านี้เลย",
  },
  {
    who: "หัวหน้าผลิต ตอนเดินโรงงาน",
    where: "จอเดียวกับช่าง",
    page: "จอสถานี /station (แผงสถานี)",
    can: "เห็นทุกสถานี ทุกคน · “แก้ให้” ทุกการ์ด (ลงยอดแทน · เปลี่ยนคน · พัก · เรียงคิว · ข้าม)",
  },
  {
    who: "หัวหน้าผลิต / เบส ตอนนั่งโต๊ะ",
    where: "คอม",
    page: "หน้าการผลิต /production → ใบผลิต /production/[id]",
    can: "ดูทั้งใบ · วางแผน (มอบหมาย · ควรเสร็จ · ส่งร้านนอก/นัดรับ/เปลี่ยนร้าน · เสื้อ-วัตถุดิบ · ต้นทุน) · **ไม่มีปุ่มลงมือ** — ทุกขั้นบอกว่าอยู่ที่สถานีไหน ใครถือ + ปุ่ม “ไปทำที่จอสถานี” พาไปงานนั้นตรง ๆ",
  },
] as const;

export const ENTRANCES = [
  "เมนูซ้ายเพิ่ม “จอสถานี” ใต้ “การผลิต” — ไม่ต้องรู้ว่ามีปุ่มเล็ก ๆ ซ่อนอยู่",
  "ช่างที่มีแค่สิทธิ์ผลิต ล็อกอินแล้วตกที่ /station ทันที (หัวหน้ายังตกที่แดชบอร์ดเหมือนเดิม)",
  "ในใบผลิต ทุกขั้นมีปุ่ม “ไปทำที่จอสถานี” ที่พาไปงานนั้นในสถานีนั้นตรง ๆ (URL จอสถานีรองรับอยู่แล้ว)",
] as const;

export { STEPS, WORK_ORDER };
export type { WorkStep };
