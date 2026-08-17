export const PRODUCTION_DETAIL_TABS = [
  { key: "work", label: "ทำงาน" },
  { key: "inventory", label: "เบิกของ" },
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
