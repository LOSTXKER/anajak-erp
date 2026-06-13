// นโยบายค่าแก้แบบเกินโควตา (FLOW-REDESIGN ก้อน 4 — เบสเคาะ 2026-06-14)
//
// ฟรี 2 รอบ · เกินคิด 100฿/รอบ — แต่ **เด้งให้พนักงานกดเอง ไม่คิดอัตโนมัติ** ("มันแล้วแต่"
// เบสเคาะ: ความจริงหน้างานลื่นไหล บางรอบช่างพลาดเอง/แก้นิดเดียว → คนตัดสินว่าจะคิดไหม)
//
// นับ "รอบแก้" จากจำนวนเวอร์ชันแบบที่อัป — v1 = ต้นฉบับ (รวมในราคางาน ไม่ใช่รอบแก้) ·
// v2, v3, ... = รอบแก้ (ครอบทุกการแก้ ไม่ว่าลูกค้ากดผ่านลิงก์หรือทักไลน์แล้วช่างอัปใหม่)

export const FREE_REVISION_ROUNDS = 2;
export const REVISION_FEE_PER_ROUND = 100; // บาท/รอบ
export const REVISION_FEE_TYPE = "DESIGN_REVISION"; // feeType บน OrderFee (แถวเดียวต่อออเดอร์)

export interface RevisionOverage {
  versionCount: number; // จำนวนเวอร์ชันแบบทั้งหมด
  revisionRounds: number; // รอบแก้ (ไม่นับต้นฉบับ v1)
  freeRounds: number; // โควตาฟรี
  chargeableRounds: number; // รอบที่เกินโควตา (ที่คิดเงินได้)
  fee: number; // ค่าแก้แบบที่ควรคิดรวม (บาท)
}

export function computeRevisionOverage(versionCount: number): RevisionOverage {
  const safeCount = Math.max(0, Math.floor(versionCount || 0));
  const revisionRounds = Math.max(0, safeCount - 1);
  const chargeableRounds = Math.max(0, revisionRounds - FREE_REVISION_ROUNDS);
  return {
    versionCount: safeCount,
    revisionRounds,
    freeRounds: FREE_REVISION_ROUNDS,
    chargeableRounds,
    fee: chargeableRounds * REVISION_FEE_PER_ROUND,
  };
}
