/**
 * กติกาใบผลิตแบบฟอร์ม (ROADMAP §A9.2–A9.4 เบสอนุมัติ 2026-09-09) — pure ไม่แตะ Prisma
 *   · ปิดขั้นผ่าน updateStep ได้เมื่อติ๊กข้อกำหนดครบ (ขั้นที่ปิดผ่าน flow เฉพาะ — รอบพิมพ์ ใบตรวจรับ
 *     เบิกเสื้อ QC ร้านนอก — ไม่ผ่านด่านนี้: หลักฐานของ flow นั้นเป็นด่านอยู่แล้ว)
 *   · ยอดต่อแถว (ไซซ์/สี) ต่อขั้นเก็บใน OperationQuantity แถวชนิด VARIANT — ยอดรวมของขั้น = ผลบวก
 *   · ย้อนขั้นที่ปิดแล้ว = หัวหน้าเท่านั้น · ย้อนได้เฉพาะขั้นที่ปิดด้วยปุ่ม (ไม่มีหลักฐานจาก flow อื่น)
 *     และขั้นหลังจากนั้นยังไม่มีใครเริ่ม
 */
import { TRPCError } from "@trpc/server";
import { missingStandards, workOrderStandards } from "@/lib/work-order-standards";
import { FLOW_OWNED_STEP_TYPES } from "@/lib/production-steps";

export { FLOW_OWNED_STEP_TYPES };

function badRequest(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

export function assertStandardItem(stepType: string, item: string): void {
  if (!workOrderStandards(stepType).includes(item)) {
    badRequest("ข้อกำหนดนี้ไม่อยู่ในรายการของขั้นนี้ — โหลดหน้าใหม่แล้วลองอีกครั้ง");
  }
}

export function assertStandardsTicked(stepType: string, ticked: Iterable<string>): void {
  const missing = missingStandards(stepType, ticked);
  if (missing.length > 0) {
    badRequest(`ติ๊กข้อกำหนดให้ครบก่อนปิดขั้น — เหลืออีก ${missing.length} ข้อ`);
  }
}

export function assertStepReopenable(params: {
  step: { status: string; stepType: string; sortOrder: number };
  siblings: readonly { sortOrder: number; status: string }[];
  evidence: { outsourceOrders: number; goodsReceipts: number; printRunItems: number };
}): void {
  const { step, siblings, evidence } = params;
  if (step.status !== "COMPLETED") badRequest("ขั้นนี้ยังไม่ได้ปิด จึงไม่มีอะไรให้ย้อน");
  if (FLOW_OWNED_STEP_TYPES.has(step.stepType)) {
    badRequest("ขั้นนี้ปิดผ่านหลักฐานของระบบ (เบิก/ตรวจรับ/รอบพิมพ์) — ย้อนจากใบผลิตไม่ได้");
  }
  if (evidence.outsourceOrders > 0 || evidence.goodsReceipts > 0 || evidence.printRunItems > 0) {
    badRequest("ขั้นนี้มีใบส่งร้าน/ใบตรวจรับ/รอบพิมพ์ผูกอยู่ — ย้อนจากใบผลิตไม่ได้");
  }
  const started = siblings.some((s) => s.sortOrder > step.sortOrder && s.status !== "PENDING");
  if (started) badRequest("ขั้นถัดไปเริ่มทำแล้ว — ย้อนขั้นนี้ไม่ได้");
}

export interface PieceQtyRowInput {
  variantId: string;
  done: number;
  waste: number;
}

export interface PieceQtyVariant {
  id: string;
  productId: string;
  description: string;
  sku: string | null;
  size: string;
  color: string | null;
  quantity: number;
}

export interface PieceQtyLine {
  variantId: string;
  productId: string;
  scopeKey: string;
  description: string;
  sku: string | null;
  size: string;
  color: string | null;
  qtyPlanned: number;
  qtyGood: number;
  qtyScrap: number;
}

/** แปลงยอดต่อแถวจากฟอร์มเป็นแถว OperationQuantity + ยอดรวมของขั้น — ตรวจกรอบต่อแถวและต่อขั้น */
export function pieceQtyPlan(params: {
  rows: readonly PieceQtyRowInput[];
  variants: readonly PieceQtyVariant[];
  qtyTotal: number | null;
}): { lines: PieceQtyLine[]; qtyDone: number } {
  const byId = new Map(params.variants.map((v) => [v.id, v]));
  const seen = new Set<string>();
  const lines: PieceQtyLine[] = [];
  for (const row of params.rows) {
    const variant = byId.get(row.variantId);
    if (!variant) badRequest("แถวนี้ไม่อยู่ในรายการเสื้อของออเดอร์แล้ว — โหลดหน้าใหม่");
    if (seen.has(row.variantId)) badRequest("ส่งแถวเดียวกันซ้ำ");
    seen.add(row.variantId);
    if (row.done + row.waste > variant.quantity) {
      badRequest(`${variant.color ?? ""} ${variant.size} ทำแล้ว+เสีย เกิน ${variant.quantity} ตัว`.trim());
    }
    lines.push({
      variantId: variant.id,
      productId: variant.productId,
      scopeKey: `${variant.productId}:${variant.id}:NO_PRINT`,
      description: variant.description,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      qtyPlanned: variant.quantity,
      qtyGood: row.done,
      qtyScrap: row.waste,
    });
  }
  const qtyDone = lines.reduce((n, l) => n + l.qtyGood, 0);
  if (params.qtyTotal !== null && qtyDone > params.qtyTotal) {
    badRequest(`จำนวนทำแล้วเกินยอดขั้นผลิต — บันทึกได้ไม่เกิน ${params.qtyTotal} ตัว`);
  }
  return { lines, qtyDone };
}
