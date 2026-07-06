/**
 * QC เชิงนับ — สูตรตัดสินล้วน แยกจาก tx ใน qc.ts ให้ unit test ได้
 * (pattern billing-payment: pure calc แยกจาก writes · เทสไม่ต้องมี DB)
 *
 * กติกาตาม flow ก้อน 3: มีของเสีย → กลับผลิต หรือ "รอของ" (ON_HOLD) เมื่อเสื้อสำรอง
 * ไม่พอ — เฉพาะงานเสื้อจากสต๊อคที่ระบบรู้ยอดจริง · ดีครบยอด → เข้าแพ็ค · ดีบางส่วน → ตรวจต่อ
 */
import { badRequest } from "@/server/errors";
import { QC_DEFECT_REASONS } from "@/lib/qc";

// เสื้อสำรองคงเหลือ = Σ max(0, เบิก − คืน − ต้องใช้) ต่อแถวเบิก
// แถวที่เบิกขาด (ติดลบ) นับเป็น 0 — ไม่เอาไปหักส่วนเกินของแถวอื่น
export function spareAvailableOf(
  lines: Array<{ issued: number; returned: number; needed: number }>
): number {
  return lines.reduce((s, l) => s + Math.max(0, l.issued - l.returned - l.needed), 0);
}

// ด่านกรอก: ของเสียเป็นจำนวนเต็ม >0 + สาเหตุต้องรู้จัก · ของดีเป็นจำนวนเต็ม ≥0 ·
// ต้องนับอย่างน้อย 1 ตัว — คืนยอดของเสียรวม (ข้อความ error คงเดิมเป๊ะ UI อ้างอยู่)
export function assertValidQcCounts(params: {
  qtyGood: number;
  defects: Array<{ qty: number; reason: string }>;
}): number {
  for (const d of params.defects) {
    if (!Number.isInteger(d.qty) || d.qty <= 0) {
      badRequest("จำนวนของเสียต้องเป็นจำนวนเต็มมากกว่า 0");
    }
    if (!(QC_DEFECT_REASONS as readonly string[]).includes(d.reason)) {
      badRequest(`ไม่รู้จักสาเหตุของเสีย: ${d.reason}`);
    }
  }
  if (!Number.isInteger(params.qtyGood) || params.qtyGood < 0) {
    badRequest("จำนวนของดีต้องเป็นจำนวนเต็มตั้งแต่ 0");
  }
  const qtyDefect = params.defects.reduce((s, d) => s + d.qty, 0);
  if (params.qtyGood === 0 && qtyDefect === 0) badRequest("ยังไม่ได้นับอะไรเลย");
  return qtyDefect;
}

// ด่านนับเกิน: ตรวจได้หลายรอบ ของดีสะสม+รอบนี้ห้ามเกินยอดงาน ·
// totalExpected = 0 (งานไม่รู้ยอด เช่น เปิดเบา) = นับอิสระ ไม่กั้น
export function assertQcNotOverCount(i: {
  totalExpected: number;
  checkedGood: number;
  qtyGood: number;
}): void {
  if (i.totalExpected > 0 && i.checkedGood + i.qtyGood > i.totalExpected) {
    badRequest(
      `นับเกินยอดงาน: ผ่านแล้ว ${i.checkedGood} จาก ${i.totalExpected} ตัว — รอบนี้ใส่ของดีได้อีกไม่เกิน ${i.totalExpected - i.checkedGood}`
    );
  }
}

// ทางไปต่อหลังบันทึกผลรอบนี้ (เรียกหลัง validate แล้ว — good/defect ไม่เป็น 0 พร้อมกัน):
// - มีของเสีย: สำรองพอ (หรือระบบไม่รู้ยอด = งานไม่มีแถวเบิกสต๊อค) → REWORK กลับผลิต ·
//   สำรองไม่พอ → HOLD_FOR_STOCK พักรอของ (งานแก้ห้ามเข้าคิวช่างทั้งที่ไม่มีเสื้อให้ทำ)
// - ดีล้วน: ครบยอด (หรือยอดงาน 0 = ไม่รู้ยอด) → PACK · ดีบางส่วน → STAY ตรวจต่อ
export type QcNextMove = "HOLD_FOR_STOCK" | "REWORK" | "PACK" | "STAY";
export function qcNextMove(i: {
  qtyGood: number;
  qtyDefect: number;
  totalExpected: number;
  // ของดีสะสมจากรอบก่อน (ไม่รวมรอบนี้)
  checkedGood: number;
  // งานมีแถวเบิกเสื้อจากสต๊อค — ระบบถึงรู้ยอดสำรองจริง ตัดสิน "รอของ" ได้
  hasFromStock: boolean;
  spareAvailable: number;
}): QcNextMove {
  if (i.qtyDefect > 0) {
    return i.hasFromStock && i.spareAvailable < i.qtyDefect ? "HOLD_FOR_STOCK" : "REWORK";
  }
  if (i.qtyGood > 0 && (i.totalExpected === 0 || i.checkedGood + i.qtyGood >= i.totalExpected)) {
    return "PACK";
  }
  return "STAY";
}
