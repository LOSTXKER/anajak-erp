/**
 * ใบตรวจรับของเข้า/ใบคืนลูกค้า — สูตรรับสุทธิ + ด่านกรอก + สรุปขาด/เกิน แยกจาก tx ใน
 * goods-receipt.ts ให้ unit test ได้ (pattern qc-count/billing-payment)
 *
 * รับสุทธิ = รับ − คืน (CUSTOMER_RETURN ติดลบ) — เดิมสูตรเขียนซ้ำ 2 จุด (prefill ต่อไซส์ +
 * ติ๊ก receivedInspected ต่อรายการสินค้า) รวมที่เดียวกัน drift
 */
import { badRequest } from "@/server/errors";

export interface ReceiptNetRow {
  orderItemProductId: string | null;
  size?: string | null;
  color?: string | null;
  qtyCounted: number;
  receiptType: string;
}

const signOf = (receiptType: string) => (receiptType === "CUSTOMER_RETURN" ? -1 : 1);

// key ต่อ (สินค้า, ไซส์, สี) — ใช้คู่กับ netReceivedByVariant
export const variantNetKey = (pid: string, size: string | null, color: string | null) =>
  `${pid}:${size ?? ""}:${color ?? ""}`;

// ยอดรับสุทธิต่อ (สินค้า, ไซส์, สี) — แถวไม่ผูกรายการสินค้า (pid null) ข้าม
export function netReceivedByVariant(rows: ReceiptNetRow[]): Map<string, number> {
  const net = new Map<string, number>();
  for (const r of rows) {
    if (!r.orderItemProductId) continue;
    const key = variantNetKey(r.orderItemProductId, r.size ?? null, r.color ?? null);
    net.set(key, (net.get(key) ?? 0) + signOf(r.receiptType) * r.qtyCounted);
  }
  return net;
}

// ยอดรับสุทธิต่อรายการสินค้า (รวมทุกไซส์/สี)
export function netReceivedByProduct(rows: ReceiptNetRow[]): Map<string, number> {
  const net = new Map<string, number>();
  for (const r of rows) {
    if (!r.orderItemProductId) continue;
    net.set(
      r.orderItemProductId,
      (net.get(r.orderItemProductId) ?? 0) + signOf(r.receiptType) * r.qtyCounted
    );
  }
  return net;
}

// ติ๊กตรวจรับ (ด่านพร้อมผลิตใช้ flag นี้): รับสุทธิครบยอด และยอดต้องมีจริง (>0 —
// รายการยอด 0 ห้ามติ๊กเองเงียบๆ) + โน้ตยอดล่าสุดไว้ดูบนการ์ด
export function receiptInspectionOf(
  net: number,
  totalQuantity: number
): { receivedInspected: boolean; receiveNote: string } {
  return {
    receivedInspected: net >= totalQuantity && totalQuantity > 0,
    receiveNote: `รับสุทธิ ${net}/${totalQuantity}`,
  };
}

export interface ReceiptCanonicalVariant {
  size: string | null;
  color: string | null;
  quantity: number;
}

/**
 * หลักฐานพร้อมผลิตต้องครบ "ทุกไซส์/สี" ไม่ใช่แค่ยอดรวมต่อสินค้า มิฉะนั้นรับ M เกิน
 * สามารถกลบ L ที่ยังขาดได้. รวม canonical key ซ้ำแบบ defensive เผื่อข้อมูล legacy.
 */
export function receiptInspectionOfVariants(
  orderItemProductId: string,
  variants: ReceiptCanonicalVariant[],
  netByVariant: ReadonlyMap<string, number>
): { receivedInspected: boolean; receiveNote: string } {
  const expectedByVariant = new Map<string, number>();
  for (const variant of variants) {
    const key = variantNetKey(orderItemProductId, variant.size, variant.color);
    expectedByVariant.set(key, (expectedByVariant.get(key) ?? 0) + variant.quantity);
  }

  let totalExpected = 0;
  let totalNet = 0;
  let everyVariantComplete = expectedByVariant.size > 0;
  for (const [key, expected] of expectedByVariant) {
    const net = netByVariant.get(key) ?? 0;
    totalExpected += expected;
    totalNet += net;
    if (net < expected) everyVariantComplete = false;
  }

  return {
    receivedInspected: totalExpected > 0 && everyVariantComplete,
    receiveNote: `รับสุทธิ ${totalNet}/${totalExpected}`,
  };
}

// ด่านกรอก: ทิ้งบรรทัดว่าง (นับ 0 + ตำหนิ 0) → ต้องเหลืออย่างน้อย 1 · จำนวนเต็ม · ห้ามติดลบ
// คืนบรรทัดที่ใช้จริง (ข้อความ error คงเดิมเป๊ะ)
export function assertValidReceiptLines<T extends { qtyCounted: number; defectQty: number }>(
  inputLines: T[],
  options: { preserveZeroLines?: boolean; allowAllZero?: boolean } = {}
): T[] {
  // validate ก่อน filter เพื่อไม่ให้ค่าติดลบ/ทศนิยมที่บังเอิญถูกทิ้งหลุดจาก service caller
  for (const l of inputLines) {
    if (!Number.isInteger(l.qtyCounted) || !Number.isInteger(l.defectQty)) {
      badRequest("จำนวนต้องเป็นจำนวนเต็ม");
    }
    if (l.qtyCounted < 0 || l.defectQty < 0) badRequest("จำนวนติดลบไม่ได้");
  }
  const lines = options.preserveZeroLines
    ? inputLines
    : inputLines.filter((l) => l.qtyCounted > 0 || l.defectQty > 0);
  if (lines.length === 0 || (!options.allowAllZero && lines.every((l) => l.qtyCounted === 0 && l.defectQty === 0))) {
    badRequest("ยังไม่ได้นับของ — ระบุจำนวนอย่างน้อย 1 บรรทัด");
  }
  return lines;
}

// สรุปใบ: ยอดนับ/ตำหนิรวม + รายการขาด/เกินเทียบที่คาด — เฉพาะใบรับ (ใบคืนลูกค้า
// ไม่มี concept ขาดเกิน) · ข้อความ "เกิน n"/"ขาด n" ใช้ทั้ง revision + กระดิ่งแอดมิน
export function summarizeReceiptLines(
  receiptType: string,
  lines: Array<{
    description: string;
    size?: string | null;
    color?: string | null;
    qtyExpected: number;
    qtyCounted: number;
    defectQty: number;
  }>
): { totalCounted: number; totalDefect: number; discrepancies: string[] } {
  const totalCounted = lines.reduce((s, l) => s + l.qtyCounted, 0);
  const totalDefect = lines.reduce((s, l) => s + l.defectQty, 0);
  const discrepancies =
    receiptType === "CUSTOMER_RETURN"
      ? []
      : lines
          .filter((l) => l.qtyCounted !== l.qtyExpected)
          .map((l) => {
            const diff = l.qtyCounted - l.qtyExpected;
            const sizeLabel = l.size ? ` ${l.size}${l.color ? `/${l.color}` : ""}` : "";
            return `${l.description}${sizeLabel}: ${diff > 0 ? `เกิน ${diff}` : `ขาด ${-diff}`}`;
          });
  return { totalCounted, totalDefect, discrepancies };
}
