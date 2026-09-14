/** ป้ายชนิดงานพิมพ์ (ไทย) — printType เป็น String อิสระ ไม่ใช่ enum */
export const PRINT_LABELS: Record<string, string> = {
  DTF: "DTF",
  DTG: "DTG",
  SILK_SCREEN: "สกรีน",
  SUBLIMATION: "ซับ",
  HEAT_TRANSFER: "รีดร้อน",
  EMBROIDERY: "ปัก",
};

/** ชนิดงานพิมพ์ของออเดอร์ — มีหลายชนิด = "ผสม" · ไม่มีลาย = null (ไม่โชว์ป้าย) */
export function printLabelOf(types: Iterable<string>): string | null {
  const set = new Set(types);
  if (set.size === 0) return null;
  if (set.size === 1) {
    const [type] = set;
    return PRINT_LABELS[type] ?? type;
  }
  return "ผสม";
}
