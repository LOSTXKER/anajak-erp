// ขั้นตอนผลิต — ป้ายกลาง + เลนต่อเทคนิค + ตัวแนะนำสายงานจากเนื้อออเดอร์จริง
// ความจริงโรงงาน (เบสเคาะ 2026-06-12): ทำเอง = DTF เท่านั้น (พิมพ์ฟิล์ม → รีดร้อน)
// DTG / สกรีน / ปัก / Sublimation / ตัดเย็บใหม่ / ป้ายคอเย็บติด = outsource ทั้งหมด
// งาน outsource กด "ผ่านรวด" ปิดขั้นได้เลย — ไม่บังคับเปิดใบส่งร้าน/ไม่เก็บค่าจ้าง
// (ต้นทุนต่องานไม่คิดในระบบนี้ — เบสคิดกำไรขาดทุนรายเดือนในระบบบัญชี)

export const STEP_TYPE_LABELS: Record<string, string> = {
  DTF_PRINT: "พิมพ์ฟิล์ม DTF",
  HEAT_PRESS: "รีดร้อน",
  DTG_PRETREAT: "พรีทรีตเสื้อ",
  DTG_PRINT: "พิมพ์ DTG (ร้านนอก)",
  CURING: "อบสี",
  GARMENT_PICK: "เบิกเสื้อจากสต๊อค",
  GARMENT_RECEIVE: "ตรวจรับเสื้อลูกค้า",
  PATTERN_MAKING: "ตัดแพทเทิร์น",
  SEWING: "ตัดเย็บใหม่ (ร้านนอก)",
  SCREEN_PRINTING: "สกรีน (ร้านนอก)",
  EMBROIDERY: "ปักลาย (ร้านนอก)",
  SUBLIMATION: "Sublimation (ร้านนอก)",
  SPECIAL_PRINT: "พิมพ์พิเศษ",
  TAGGING: "เย็บป้ายคอ (ร้านนอก)",
  PACKAGING: "แพ็ค",
  CUSTOM: "อื่นๆ",
};

// ลำดับตัวเลือกใน dropdown — เรียงตามลำดับงานจริง: เตรียมเสื้อ → เทคนิค → ปิดงาน
export const STEP_TYPE_OPTIONS = [
  "GARMENT_PICK",
  "GARMENT_RECEIVE",
  "SEWING",
  "DTF_PRINT",
  "HEAT_PRESS",
  "DTG_PRINT",
  "SCREEN_PRINTING",
  "EMBROIDERY",
  "SUBLIMATION",
  "TAGGING",
  "PACKAGING",
  "PATTERN_MAKING",
  "DTG_PRETREAT",
  "CURING",
  "SPECIAL_PRINT",
  "CUSTOM",
] as const;

// ───────────────────────── เลนต่อเทคนิค ─────────────────────────
// เลน = สายงานบนหน้าการผลิต (แท็บ/คอลัมน์) — งานหนึ่งใบโผล่ทุกเลนที่มันมีขั้นตอนค้าง

export type ProductionLane =
  | "PREP"
  | "CUTSEW"
  | "DTF"
  | "DTG"
  | "SILKSCREEN"
  | "EMBROIDERY"
  | "SUBLIMATION"
  | "LABEL"
  | "PACK"
  | "OTHER";

export const LANE_ORDER: ProductionLane[] = [
  "PREP",
  "CUTSEW",
  "DTF",
  "DTG",
  "SILKSCREEN",
  "EMBROIDERY",
  "SUBLIMATION",
  "LABEL",
  "PACK",
  "OTHER",
];

export const LANE_LABELS: Record<ProductionLane, string> = {
  PREP: "เตรียมเสื้อ",
  CUTSEW: "ตัดเย็บ",
  DTF: "DTF",
  DTG: "DTG",
  SILKSCREEN: "สกรีน",
  EMBROIDERY: "ปัก",
  SUBLIMATION: "Sublimation",
  LABEL: "ป้ายคอ",
  PACK: "แพ็ค",
  OTHER: "อื่นๆ",
};

// เลนที่งานทั้งสายเป็นร้านนอก (โชว์ป้าย "ร้านนอก" ที่หัวเลน)
// ตัดเย็บแยกเป็นเลนของตัวเอง (เบสระบุ: "ต้องมี module ขั้นตอนแยก เป็น outsource") —
// งาน lead time ยาวสุด ห้ามไปต่อคิวหลังขั้นเบิกสต๊อคในเลนเตรียมเสื้อ
export const OUTSOURCE_LANES: ReadonlySet<ProductionLane> = new Set([
  "CUTSEW",
  "DTG",
  "SILKSCREEN",
  "EMBROIDERY",
  "SUBLIMATION",
  "LABEL",
] as ProductionLane[]);

export const STEP_LANE: Record<string, ProductionLane> = {
  GARMENT_PICK: "PREP",
  GARMENT_RECEIVE: "PREP",
  SEWING: "CUTSEW",
  PATTERN_MAKING: "CUTSEW",
  DTF_PRINT: "DTF",
  HEAT_PRESS: "DTF",
  DTG_PRETREAT: "DTG",
  DTG_PRINT: "DTG",
  CURING: "DTG",
  SCREEN_PRINTING: "SILKSCREEN",
  EMBROIDERY: "EMBROIDERY",
  SUBLIMATION: "SUBLIMATION",
  TAGGING: "LABEL",
  PACKAGING: "PACK",
  SPECIAL_PRINT: "OTHER",
  CUSTOM: "OTHER",
};

export function laneOf(stepType: string): ProductionLane {
  return STEP_LANE[stepType] ?? "OTHER";
}

// ขั้นที่เป็นงานร้านนอก — มีปุ่ม "ส่งร้าน" (เปิดใบ outsource) และ "ผ่านรวด" (ปิดขั้นไม่ต้องกรอก)
export const OUTSOURCE_STEP_TYPES: ReadonlySet<string> = new Set([
  "DTG_PRINT",
  "SCREEN_PRINTING",
  "EMBROIDERY",
  "SUBLIMATION",
  "SEWING",
  "TAGGING",
]);

export function isOutsourceStep(stepType: string): boolean {
  return OUTSOURCE_STEP_TYPES.has(stepType);
}

// ───────────────────── สถานะใบงานร้านนอก (ที่เดียวทั้งระบบ) ─────────────────────
// เดิมประกาศซ้ำ 3 ที่ (dialog/บอร์ด/การ์ดสรุป) — เพิ่มสถานะใหม่แล้วลืมอัปเดตสำเนา = ปุ่มโชว์ผิด

export const OUTSOURCE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "ร่าง",
  SENT: "ส่งร้านแล้ว",
  IN_PROGRESS: "ร้านกำลังทำ",
  COMPLETED: "ร้านทำเสร็จ",
  RECEIVED_BACK: "รับกลับแล้ว รอ QC",
  QC_PASSED: "QC ผ่าน",
  QC_FAILED: "QC ไม่ผ่าน",
};

// งานที่ยังค้างอยู่กับร้าน/รอตัดสิน — ห้ามเปิดรอบใหม่ซ้อน/ห้ามผ่านรวดทับ
export const OUTSOURCE_ACTIVE_STATUSES = [
  "DRAFT",
  "SENT",
  "IN_PROGRESS",
  "COMPLETED",
  "RECEIVED_BACK",
];

// ───────────────────── ตัวแนะนำสายงานตอนเปิดใบผลิต ─────────────────────
// อ่านครบ 3 อย่างจากเนื้อออเดอร์ (เดิมดูแค่วิธีพิมพ์ — ใบผลิตเลยขาดงานเตรียมเสื้อ/ป้ายคอตลอด):
// 1. แหล่งเสื้อต่อรายการ (OrderItemProduct.itemSource) → สายเตรียมเสื้อ
// 2. วิธีพิมพ์ของลาย (OrderItemPrint.printType)        → สายเทคนิค
// 3. add-on ป้ายเย็บติด (OrderItemAddon.addonType)      → สายป้ายคอ
// ปิดท้ายด้วยแพ็คเสมอ

export type ProductionPlanInput = {
  printTypes: string[];
  itemSources?: (string | null)[];
  addonTypes?: string[];
};

// add-on ที่ต้องเย็บติดตัวเสื้อ → งอกขั้นเย็บป้าย (ร้านนอก) อัตโนมัติ
// addonType เป็น string อิสระ (แค็ตตาล็อกเพิ่มเองได้/พิมพ์มือได้) — จับทั้ง code มาตรฐาน
// และอะไรก็ตามที่ลงท้าย LABEL (เช่น WOVEN_LABEL ที่เพิ่มใหม่ใน Settings)
const SEWN_LABEL_ADDONS = new Set(["NECK_LABEL", "SIZE_LABEL", "CARE_LABEL"]);

function isSewnLabelAddon(addonType: string): boolean {
  return SEWN_LABEL_ADDONS.has(addonType) || /LABEL$/i.test(addonType.trim());
}

export function suggestProductionPlan(input: ProductionPlanInput): string[] {
  const steps: string[] = [];

  // 1) เตรียมเสื้อ — ตามแหล่งเสื้อที่มีจริงในออเดอร์
  const sources = new Set((input.itemSources ?? []).filter(Boolean));
  if (sources.has("FROM_STOCK")) steps.push("GARMENT_PICK");
  if (sources.has("CUSTOM_MADE")) steps.push("SEWING");
  if (sources.has("CUSTOMER_PROVIDED")) steps.push("GARMENT_RECEIVE");

  // 2) เทคนิคพิมพ์ — DTF ทำเอง 2 ขั้น · ที่เหลือ outsource ขั้นเดียว (ส่งร้าน/ผ่านรวด)
  const types = new Set(input.printTypes);
  const before = steps.length;
  if (types.has("DTF") || types.has("HEAT_TRANSFER")) {
    steps.push("DTF_PRINT", "HEAT_PRESS");
  }
  if (types.has("DTG")) steps.push("DTG_PRINT");
  if (types.has("SILK_SCREEN")) steps.push("SCREEN_PRINTING");
  if (types.has("EMBROIDERY")) steps.push("EMBROIDERY");
  if (types.has("SUBLIMATION")) steps.push("SUBLIMATION");
  // มีลายแต่ไม่รู้วิธีพิมพ์ → ชุด DTF (งานหลักของโรงงาน) · ไม่มีลายเลย = เสื้อเปล่า ไม่งอกสายพิมพ์
  if (types.size > 0 && steps.length === before) {
    steps.push("DTF_PRINT", "HEAT_PRESS");
  }

  // 3) ป้ายคอเย็บติด
  if ((input.addonTypes ?? []).some(isSewnLabelAddon)) {
    steps.push("TAGGING");
  }

  steps.push("PACKAGING");
  return steps;
}
