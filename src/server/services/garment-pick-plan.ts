/**
 * ใบเบิกเสื้อ/คืนเศษ — สูตรตัดสินล้วน แยกจาก HTTP+tx ใน garment-pick.ts ให้ unit test ได้
 * (pattern qc-count/billing-payment: pure calc แยกจาก writes)
 *
 * กติกา: เบิกเกิน "ที่ต้องใช้" ได้ (เบิกเผื่อเสียคือเรื่องปกติ — Stock เป็นคนกันของไม่พอ) ·
 * คืนเกินยอดที่เบิกค้างอยู่ไม่ได้ (กันยอดสต๊อคบวม) · ข้อความ error คงเดิมเป๊ะ UI อ้างอยู่
 */
import { badRequest } from "@/server/errors";

// แถว MaterialUsage ที่ใช้รวมยอด — movementType: RETURN = คืน · อื่น (ISSUE) = เบิก
export interface PickUsageRow {
  productId: string;
  productVariantId: string | null;
  quantity: number;
  movementType: string;
}

// รวมยอดเบิก/คืนสะสมต่อ (สินค้า, variant) ลงบนแถวเบิกจากเนื้อออเดอร์ —
// usage ที่ key ไม่ตรงกับแถวไหนถูกทิ้งเงียบ (ของเก่าที่รายการออเดอร์เปลี่ยนไปแล้ว)
export function mergePickUsage<T extends { productId: string; variantId: string | null; qty: number }>(
  lines: T[],
  usages: PickUsageRow[]
): Array<T & { needed: number; issued: number; returned: number }> {
  const usageKey = (productId: string, variantId: string | null) =>
    `${productId}:${variantId ?? ""}`;
  const issuedByKey = new Map<string, number>();
  const returnedByKey = new Map<string, number>();
  for (const u of usages) {
    const key = usageKey(u.productId, u.productVariantId);
    const map = u.movementType === "RETURN" ? returnedByKey : issuedByKey;
    map.set(key, (map.get(key) ?? 0) + u.quantity);
  }
  return lines.map((l) => {
    const key = usageKey(l.productId, l.variantId);
    return {
      ...l,
      needed: l.qty,
      issued: issuedByKey.get(key) ?? 0,
      returned: returnedByKey.get(key) ?? 0,
    };
  });
}

// แผนเบิกรอบนี้: กรองบรรทัด qty ≤ 0 ทิ้ง (ช่องว่างบนฟอร์ม) → validate (sku ต้องอยู่ในรายการ
// เสื้อจากสต๊อคของออเดอร์ · จำนวนเต็ม) → คำนวณ stepDone: เบิกสุทธิสะสม (เบิก−คืน ทุกแถว
// ไม่ clamp — คืนเกินแถวหนึ่งหักยอดรวมตามจริง) + รอบนี้ ≥ ที่ต้องใช้ทั้งหมด = ขั้นเบิกเสร็จ
export function planGarmentIssue(
  stateLines: Array<{ sku: string; issued: number; returned: number; needed: number }>,
  inputLines: Array<{ sku: string; qty: number }>
): {
  requested: Array<{ sku: string; qty: number }>;
  issuedThisRound: number;
  neededTotal: number;
  stepDone: boolean;
} {
  const stateBySku = new Set(stateLines.map((l) => l.sku));
  const requested = inputLines.filter((l) => l.qty > 0);
  if (requested.length === 0) badRequest("ยังไม่ได้ระบุจำนวนที่เบิก");
  for (const line of requested) {
    if (!stateBySku.has(line.sku)) {
      badRequest(`รายการ ${line.sku} ไม่อยู่ในรายการเสื้อจากสต๊อคของออเดอร์นี้`);
    }
    if (!Number.isInteger(line.qty)) badRequest(`จำนวนเบิกของ ${line.sku} ต้องเป็นจำนวนเต็ม`);
  }
  const issuedTotalBefore = stateLines.reduce((s, l) => s + l.issued - l.returned, 0);
  const neededTotal = stateLines.reduce((s, l) => s + l.needed, 0);
  const issuedThisRound = requested.reduce((s, l) => s + l.qty, 0);
  return {
    requested,
    issuedThisRound,
    neededTotal,
    stepDone: issuedTotalBefore + issuedThisRound >= neededTotal,
  };
}

// แผนคืนเศษ: กรอง qty ≤ 0 ทิ้ง → validate ต่อบรรทัด (sku → จำนวนเต็ม → เพดานเบิกค้าง)
export function planGarmentReturn(
  stateLines: Array<{
    sku: string;
    productName: string;
    size: string;
    color: string | null;
    issued: number;
    returned: number;
  }>,
  inputLines: Array<{ sku: string; qty: number }>
): { requested: Array<{ sku: string; qty: number }>; returnedQty: number } {
  const stateBySku = new Map(stateLines.map((l) => [l.sku, l]));
  const requested = inputLines.filter((l) => l.qty > 0);
  if (requested.length === 0) badRequest("ยังไม่ได้ระบุจำนวนที่คืน");
  for (const line of requested) {
    const ref = stateBySku.get(line.sku);
    if (!ref) badRequest(`รายการ ${line.sku} ไม่อยู่ในรายการเสื้อจากสต๊อคของออเดอร์นี้`);
    if (!Number.isInteger(line.qty)) badRequest(`จำนวนคืนของ ${line.sku} ต้องเป็นจำนวนเต็ม`);
    const outstanding = ref.issued - ref.returned;
    if (line.qty > outstanding) {
      badRequest(
        `${ref.productName} ${ref.size}${ref.color ? `/${ref.color}` : ""}: คืนได้ไม่เกิน ${outstanding} ตัว (เบิกค้างอยู่)`
      );
    }
  }
  return { requested, returnedQty: requested.reduce((s, l) => s + l.qty, 0) };
}
