/** ค่ารีดร้อนของลาย — ใช้ทั้งจอสถานี ใบผลิต และการ์ดแบบ (ย้ายออกจาก station-garment-preview 2026-09-20) */
export interface PrintHeat {
  tempC: number | null;
  pressSec: number | null;
  pressure: string | null;
}

export function heatLabel(heat: PrintHeat | null | undefined): string | null {
  if (!heat) return null;
  const parts: string[] = [];
  if (heat.tempC != null) parts.push(`${heat.tempC}°C`);
  if (heat.pressSec != null) parts.push(`${heat.pressSec} วิ`);
  if (heat.pressure) parts.push(heat.pressure);
  return parts.length > 0 ? `รีด ${parts.join(" · ")}` : null;
}
