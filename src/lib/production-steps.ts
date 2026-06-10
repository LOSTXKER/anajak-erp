// ขั้นตอนผลิต — ป้ายกลาง + ตัวแนะนำขั้นตอนตามวิธีพิมพ์จริงของออเดอร์
// (เดิม default เป็นชุดโรงเย็บ ตัดแพทเทิร์น→เย็บ ทั้งที่งานจริงคือ DTF 70% / DTG 30%)

export const STEP_TYPE_LABELS: Record<string, string> = {
  DTF_PRINT: "พิมพ์ฟิล์ม DTF",
  HEAT_PRESS: "รีดร้อน",
  DTG_PRETREAT: "พรีทรีตเสื้อ",
  DTG_PRINT: "พิมพ์ DTG",
  CURING: "อบสี",
  PATTERN_MAKING: "ตัดแพทเทิร์น",
  SCREEN_PRINTING: "สกรีน",
  TAGGING: "เย็บป้าย",
  PACKAGING: "แพ็ค",
  EMBROIDERY: "ปักลาย",
  SPECIAL_PRINT: "พิมพ์พิเศษ",
  SEWING: "เย็บ",
  CUSTOM: "อื่นๆ",
};

// ลำดับตัวเลือกใน dropdown — งานหลักของโรงงานขึ้นก่อน
export const STEP_TYPE_OPTIONS = [
  "DTF_PRINT",
  "HEAT_PRESS",
  "DTG_PRETREAT",
  "DTG_PRINT",
  "CURING",
  "SCREEN_PRINTING",
  "EMBROIDERY",
  "SPECIAL_PRINT",
  "PATTERN_MAKING",
  "SEWING",
  "TAGGING",
  "PACKAGING",
  "CUSTOM",
] as const;

// แนะนำขั้นตอนผลิตจากวิธีพิมพ์ที่มีจริงในออเดอร์ (OrderItemPrint.printType)
// ไม่รู้วิธีพิมพ์ = ชุด DTF (งาน 70% ของโรงงาน) · ปิดท้ายด้วยแพ็คเสมอ
export function suggestStepsFromPrintTypes(printTypes: string[]): string[] {
  const types = new Set(printTypes);
  const steps: string[] = [];

  if (types.has("DTF") || types.has("HEAT_TRANSFER")) {
    steps.push("DTF_PRINT", "HEAT_PRESS");
  }
  if (types.has("DTG")) {
    steps.push("DTG_PRETREAT", "DTG_PRINT", "CURING");
  }
  if (types.has("SILK_SCREEN")) {
    steps.push("SCREEN_PRINTING"); // outsource ร้านนอก — ผูกใบ outsource ที่ขั้นตอนนี้
  }
  if (types.has("EMBROIDERY")) {
    steps.push("EMBROIDERY");
  }
  if (types.has("SUBLIMATION")) {
    steps.push("SPECIAL_PRINT");
  }

  if (steps.length === 0) {
    steps.push("DTF_PRINT", "HEAT_PRESS");
  }
  steps.push("PACKAGING");
  return steps;
}
