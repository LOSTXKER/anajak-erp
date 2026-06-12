// QC เชิงนับ (FLOW-REDESIGN ก้อน 3) — รหัสสาเหตุของเสีย ที่เดียวทั้งระบบ
// เก็บเป็นรหัสไม่ใช่ข้อความอิสระ → รวมยอด "สาเหตุไหนบ่อยสุด" รายเดือนได้

export const QC_DEFECT_REASONS = [
  "PRINT_PEEL", // รีดลอก/ฟิล์มหลุด
  "PRINT_MISPLACED", // พิมพ์เพี้ยน/ตำแหน่งผิด
  "COLOR_OFF", // สีเพี้ยน
  "GARMENT_DEFECT", // เสื้อเสีย (รู/รอยเปื้อน/ตำหนิผ้า)
  "SEWING_DEFECT", // เย็บ/ป้ายผิด
  "OTHER", // อื่นๆ (ระบุในหมายเหตุ)
] as const;

export type QcDefectReason = (typeof QC_DEFECT_REASONS)[number];

export const QC_DEFECT_REASON_LABELS: Record<QcDefectReason, string> = {
  PRINT_PEEL: "รีดลอก/ฟิล์มหลุด",
  PRINT_MISPLACED: "พิมพ์เพี้ยน/ตำแหน่งผิด",
  COLOR_OFF: "สีเพี้ยน",
  GARMENT_DEFECT: "เสื้อเสีย (รู/เปื้อน/ตำหนิผ้า)",
  SEWING_DEFECT: "เย็บ/ป้ายผิด",
  OTHER: "อื่นๆ",
};

export function qcReasonLabel(reason: string): string {
  return QC_DEFECT_REASON_LABELS[reason as QcDefectReason] ?? reason;
}
