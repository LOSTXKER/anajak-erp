export const PRODUCTION_DETAIL_TABS = [
  { key: "work", label: "ทำงาน" },
  { key: "inventory", label: "เบิกของ" },
  // ฝ่ายผลิตต้องเห็นม็อกอัพที่ลูกค้าอนุมัติแบบเต็มทุกด้าน + สเปกรีด โดยไม่ต้องเปิด
  // หน้าออเดอร์หรือถือใบกระดาษ (2026-08-22) — อ่านอย่างเดียว ไม่มีอัป/อนุมัติที่นี่
  { key: "mockup", label: "ม็อกอัพ" },
  { key: "history", label: "ขั้นตอนทั้งหมด" },
] as const;

export type ProductionDetailTab = (typeof PRODUCTION_DETAIL_TABS)[number]["key"];

export const PRODUCTION_DETAIL_DEFAULT_TAB: ProductionDetailTab = "work";

export function normalizeProductionDetailTab(
  value: string | null | undefined,
): ProductionDetailTab | null {
  return PRODUCTION_DETAIL_TABS.some((tab) => tab.key === value)
    ? (value as ProductionDetailTab)
    : null;
}
