/**
 * QC เชิงนับ — สูตรตัดสินล้วน แยกจาก tx ใน qc.ts ให้ unit test ได้
 * (pattern billing-payment: pure calc แยกจาก writes · เทสไม่ต้องมี DB)
 *
 * กติกาตาม flow ก้อน 3: ของดียังไม่ครบและมีของเสีย → กลับผลิต หรือ "รอของ"
 * (ON_HOLD) เมื่อเสื้อสำรองไม่พอ · ของดีครบยอดแล้ว = ของเสียส่วนเกินเป็นของนอกยอดสั่ง/
 * เสื้อเผื่อ บันทึกสถิติไว้แต่เข้าแพ็คได้ · ดีบางส่วน → ตรวจต่อ
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
// - ของดีครบยอดที่ต้องส่งแล้ว: PACK ก่อน — defect ที่นับเพิ่มเป็นของนอกยอดสั่ง/เสื้อเผื่อ
//   จึงไม่ควรเปิดงานแก้ที่ไม่มีจำนวนของดีเหลือให้ตรวจซ้ำ
// - ของดียังไม่ครบและมีของเสีย: สำรองพอ (หรือระบบไม่รู้ยอด) → REWORK กลับผลิต ·
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
  const checkedGoodAfter = i.checkedGood + i.qtyGood;
  if (i.totalExpected > 0 && checkedGoodAfter >= i.totalExpected) {
    return "PACK";
  }
  if (i.qtyDefect > 0) {
    return i.hasFromStock && i.spareAvailable < i.qtyDefect ? "HOLD_FOR_STOCK" : "REWORK";
  }
  if (i.qtyGood > 0 && i.totalExpected === 0) {
    return "PACK";
  }
  return "STAY";
}

// ด่านสำหรับ recovery/manual status: เส้นปกติ createQcRecord เด้ง PACKING เองเมื่อครบ
// แต่ API เปลี่ยนสถานะมือยังต้องพิสูจน์ด้วย evidence ชุดเดียวกัน ห้ามมีแค่ qcRecord 1 แถว
export function assertQcReadyForPacking(params: {
  totalExpected: number;
  records: readonly { qtyGood: number; qtyDefect: number }[];
}): void {
  if (params.records.length === 0) {
    badRequest("ยังไม่เคยตรวจนับ QC — บันทึกผลตรวจให้ครบก่อนเข้าแพ็ก");
  }
  const checkedGood = params.records.reduce((sum, record) => sum + record.qtyGood, 0);
  // เมื่อของดีครบยอดที่ต้องส่งแล้ว defect เพิ่มเติมเป็นของนอกยอดสั่ง/เสื้อเผื่อ จึงไม่กั้นแพ็ค
  // (กั้นด้วย latest defect ต่อจะทำให้ติด QC ถาวร เพราะยอดดีเต็มแล้วและกรอกเพิ่มไม่ได้)
  if (params.totalExpected > 0 && checkedGood >= params.totalExpected) return;

  const latest = params.records[0]!;
  if (latest.qtyDefect > 0) {
    badRequest("QC รอบล่าสุดยังมีของเสีย — ปิดงานแก้และตรวจซ้ำก่อนเข้าแพ็ก");
  }
  if (params.totalExpected > 0 || checkedGood === 0) {
    const remaining = Math.max(0, params.totalExpected - checkedGood);
    badRequest(
      `QC ยังตรวจของดีไม่ครบ${params.totalExpected > 0 ? ` — เหลือ ${remaining} ตัว` : ""}`,
    );
  }
}
