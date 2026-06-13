// Multi-size matrix (FLOW-REDESIGN ก้อน 4 / P1.12) — กรอกหลายไซส์ในสินค้าเดียวเร็วๆ
// แทนการเพิ่มแถวสินค้าซ้ำต่อไซส์ · ไซส์ free-text (รู้จัก S/M/L/XL/2XL-5XL/FREE/ตัวเลข)

import type { VariantForm } from "@/types/order-form";

// ไซส์มาตรฐานที่โชว์เป็นช่องประจำ (เพิ่มไซส์อื่น XS/4XL/5XL/เด็ก/ตัวเลข ได้เอง)
export const STANDARD_SIZES = ["S", "M", "L", "XL", "2XL", "3XL"] as const;

/** สร้าง variants จาก [ไซส์, จำนวน][] + สีร่วม — เก็บเฉพาะไซส์ที่มีจำนวน > 0 (คงลำดับ) */
export function buildSizeVariants(sizeQty: [string, number][], color: string): VariantForm[] {
  const c = color.trim();
  return sizeQty
    .filter(([size, qty]) => size.trim() && qty > 0)
    .map(([size, qty]) => ({ size: size.trim(), color: c, quantity: qty }));
}

/** จำนวนรวมทุกไซส์ */
export function sumVariantQty(variants: { quantity: number }[]): number {
  return variants.reduce((s, v) => s + (Number(v.quantity) || 0), 0);
}

/** ไซส์ที่ต้องโชว์เป็นคอลัมน์ = มาตรฐาน + ไซส์ที่มีใน variants + ไซส์ที่ผู้ใช้เพิ่มเอง (ไม่ซ้ำ) */
export function matrixColumns(variants: VariantForm[], extraSizes: string[]): string[] {
  const seen = new Set<string>();
  const cols: string[] = [];
  for (const s of [...STANDARD_SIZES, ...variants.map((v) => v.size), ...extraSizes]) {
    const t = s.trim();
    if (t && !seen.has(t.toUpperCase())) {
      seen.add(t.toUpperCase());
      cols.push(t);
    }
  }
  return cols;
}
