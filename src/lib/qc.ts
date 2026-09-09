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

export const QC_REWORK_STEP_NAME = "งานแก้ (QC ไม่ผ่าน)";
export function isQcReworkStep(step: { stepType: string; customStepName?: string | null }): boolean {
  return step.stepType === "CUSTOM" && step.customStepName === QC_REWORK_STEP_NAME;
}

/** เสื้อสำรองแทนกันได้เฉพาะสินค้า สี และไซซ์เดียวกัน รวมคำขอที่ใช้สต๊อกกองเดียวกันก่อนเทียบ. */
export function qcStockAvailability(
  lines: readonly { variantId: string; stockKey: string | null; spareAvailable: number }[],
  defects: readonly { variantId?: string; qty: number }[],
): { required: number; available: number; shortage: number } {
  const byVariant = new Map(lines.map((line) => [line.variantId, line]));
  const requested = new Map<string, { required: number; available: number }>();
  for (const defect of defects) {
    const line = byVariant.get(defect.variantId ?? "");
    if (!line?.stockKey) continue;
    const previous = requested.get(line.stockKey);
    requested.set(line.stockKey, {
      required: (previous?.required ?? 0) + defect.qty,
      available: line.spareAvailable,
    });
  }
  return [...requested.values()].reduce<{ required: number; available: number; shortage: number }>((total, line) => ({
    required: total.required + line.required,
    available: total.available + line.available,
    shortage: total.shortage + Math.max(0, line.required - line.available),
  }), { required: 0, available: 0, shortage: 0 });
}
