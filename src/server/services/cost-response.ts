const COST_FIELDS = ["unitCost", "totalCost", "costPrice"] as const;

/**
 * ตัด field ต้นทุนออกจาก API response จริง โดยคง shape ฝั่ง TypeScript ให้ caller เดิม
 * ที่มีสิทธิ์การเงินไม่ต้องแยกชนิดข้อมูลอีกชุด
 */
export function redactCostFields<T extends object>(
  value: T,
  canSeeCosts: boolean,
): T {
  if (canSeeCosts) return value;

  const redacted = { ...value } as T &
    Partial<Record<(typeof COST_FIELDS)[number], unknown>>;
  for (const field of COST_FIELDS) delete redacted[field];
  return redacted;
}
