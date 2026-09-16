import { differenceInBangkokDays } from "@/lib/date-utils";

/* ============================================================
   เส้นสีขอบซ้ายของแถวตาราง — กติกาเดียวทั้งเว็บ (เบสสั่ง 2026-09-16)
   แดง = เลยกำหนดแล้ว · ส้ม = เหลือไม่เกิน 2 วัน · งานที่ปิดแล้วไม่ต้องมีเส้น
   เส้นเป็นตัวช่วยกวาดสายตา ข้อความในแถวยังบอกเหตุผลเสมอ (ไม่ใช้สีเป็นข้อมูลเดี่ยว)
   ============================================================ */

export type RowTone = "danger" | "warning" | null;

export function dueRowTone(due: Date | string | null | undefined, settled: boolean): RowTone {
  if (settled || !due) return null;
  const days = differenceInBangkokDays(due, Date.now());
  if (days === null) return null;
  if (days < 0) return "danger";
  if (days <= 2) return "warning";
  return null;
}

/** หนังสือรับรองหัก ณ ที่จ่าย: ยังไม่ได้ใบและผ่านมาเกิน 30 วัน = ต้องตามแล้ว */
export function whtRowTone(certNumber: string | null | undefined, paidAt: Date | string): RowTone {
  if (certNumber) return null;
  const days = differenceInBangkokDays(paidAt, Date.now());
  return days !== null && days <= -30 ? "warning" : null;
}
