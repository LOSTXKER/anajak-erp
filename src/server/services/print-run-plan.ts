/**
 * รอบพิมพ์ฟิล์ม DTF — สูตรตัดสินล้วน แยกจาก lock+tx ใน print-run.ts ให้ unit test ได้
 * (pattern qc-count/billing-payment)
 *
 * กติกา: คิวโชว์เฉพาะงานไฟล์พร้อม+ยังพิมพ์ไม่ครบ+ไม่ติดรอบ active · พิมพ์เกินจำนวนงาน
 * ไม่ได้ (ฟิล์มเผื่อกรอกตอนปิดรอบ) · ขั้นปิดเมื่อจำนวนครบและไม่มีรอบ active อื่นค้าง
 */
import { badRequest } from "@/server/errors";

// เฟสออกแบบจบแล้ว = ไฟล์ใช้พิมพ์ได้ (ชุดเดียวกับ production-readiness)
export const PAST_DESIGN_PHASE = [
  "DESIGN_APPROVED",
  "PRODUCTION_QUEUE",
  "PRODUCING",
  "QUALITY_CHECK",
  "PACKING",
  "READY_TO_SHIP",
  "SHIPPED",
  "COMPLETED",
];

// ไฟล์พร้อมพิมพ์ = มีแบบอนุมัติแล้ว หรือออเดอร์เลยเฟสออกแบบมาแล้ว (งานไฟล์ลูกค้าพร้อมพิมพ์
// ข้ามขั้นออกแบบ — สถานะเป็นหลักฐานแทนใบแบบ)
export function isFileReadyForPrint(hasApprovedDesign: boolean, internalStatus: string): boolean {
  return hasApprovedDesign || PAST_DESIGN_PHASE.includes(internalStatus);
}

// ช่องในคิวพิมพ์ของขั้นหนึ่ง — null = ไม่โผล่ในคิว (ติดรอบ/ไฟล์ไม่พร้อม/ไม่รู้จำนวน/พิมพ์ครบแล้ว)
export function printQueueSlotOf(s: {
  inActiveRun: boolean;
  hasApprovedDesign: boolean;
  orderInternalStatus: string;
  qtyDone: number;
  qtyTotal: number | null; // ของขั้น — null ใช้ยอดรวมออเดอร์แทน
  orderQty: number;
}): { qtyTotal: number; remaining: number } | null {
  if (s.inActiveRun) return null;
  if (!isFileReadyForPrint(s.hasApprovedDesign, s.orderInternalStatus)) return null;
  const qtyTotal = s.qtyTotal ?? s.orderQty;
  if (qtyTotal <= 0) return null; // ไม่รู้จำนวน (ออเดอร์ไม่มีรายการ) — กัน entry ผีที่เข้ารอบไม่ได้
  const remaining = Math.max(0, qtyTotal - s.qtyDone);
  if (remaining === 0) return null; // พิมพ์ครบแล้ว (รอรอบเก่าปิดขั้น)
  return { qtyTotal, remaining };
}

// เรียงคิวตามกำหนดส่ง — งานไม่มีกำหนดไปท้ายคิว
export function compareDueDate(a: Date | null, b: Date | null): number {
  if (a && b) return a.getTime() - b.getTime();
  if (a) return -1;
  if (b) return 1;
  return 0;
}

// ด่านจำนวนตอนเปิดรอบ: จำนวนเต็ม >0 + ห้ามพิมพ์เกินจำนวนงาน (เมื่อรู้จำนวน) ·
// คืน seedQtyTotal ให้ขั้นที่ยังไม่เคยนับจำนวน — ตรรกะปิดเมื่อครบจะได้ทำงาน
export function planRunItemQty(i: {
  orderNumber: string;
  stepQtyDone: number;
  stepQtyTotal: number | null;
  orderQty: number;
  qty: number;
}): { seedQtyTotal: number | null } {
  if (!Number.isInteger(i.qty) || i.qty <= 0) {
    badRequest(`งาน ${i.orderNumber}: จำนวนพิมพ์ต้องเป็นจำนวนเต็มมากกว่า 0`);
  }
  const qtyTotal = i.stepQtyTotal ?? (i.orderQty > 0 ? i.orderQty : null);
  if (qtyTotal !== null && i.stepQtyDone + i.qty > qtyTotal) {
    badRequest(
      `งาน ${i.orderNumber}: พิมพ์เกินจำนวนงาน (เหลือ ${qtyTotal - i.stepQtyDone} จาก ${qtyTotal} — ฟิล์มเผื่อกรอกตอนปิดรอบ)`
    );
  }
  return { seedQtyTotal: i.stepQtyTotal === null ? qtyTotal : null };
}

// ปิดขั้น DTF_PRINT ได้ไหมหลังรอบนี้บวกยอดแล้ว: ไม่มีรอบ active อื่นค้าง + จำนวนครบ
// (qtyTotal null = ไม่รู้จำนวน — ปิดตามรอบไปเลย pattern เดิม)
export function shouldCloseStep(i: {
  qtyDone: number;
  qtyTotal: number | null;
  openRuns: number;
}): boolean {
  return i.openRuns === 0 && (i.qtyTotal === null || i.qtyDone >= i.qtyTotal);
}
