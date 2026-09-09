import { z } from "zod";
import type { PrismaTx } from "@/lib/prisma";
import { badRequest } from "@/server/errors";
import { addOrderRevision, transitionOrder } from "./order-status";
import { packingLineKey } from "./packing-readiness";

const goodLineSchema = z.object({ variantId: z.string(), qtyGood: z.number().int().nonnegative() });
const countSchema = z.object({
  kind: z.literal("LEGACY_QC_COUNT"), version: z.literal(1), qcRecordId: z.string(),
  scopeRevisionId: z.string().nullable(), unallocatedQtyGood: z.number().int().nonnegative().default(0), lines: z.array(goodLineSchema),
});
const returnSchema = z.object({
  kind: z.literal("LEGACY_QC_RETURN"), version: z.literal(1),
  sourceLines: z.array(z.object({ deliveryId: z.string(), deliveryLineId: z.string(), qty: z.number().int().positive() })),
  scopeLines: z.array(z.object({ variantId: z.string(), qtyExpected: z.number().int().positive() })),
});
type Revision = { id?: string; changeType: string; newValue: string | null };
export type QcGoodLine = z.infer<typeof goodLineSchema>;

function parseSnapshot<T>(schema: z.ZodType<T>, value: string | null): T {
  try { return schema.parse(JSON.parse(value ?? "null")); }
  catch { return badRequest("หลักฐาน QC ไม่สมบูรณ์ กรุณาให้ผู้ดูแลตรวจประวัติออเดอร์ก่อนนับหรือส่งของ"); }
}

export function qcReturnSnapshots(revisions: readonly Revision[]) {
  return revisions.filter((row) => row.changeType === "QC_RETURN")
    .map((row) => ({ id: row.id, ...parseSnapshot(returnSchema, row.newValue) }));
}

export const legacyQcEvidenceSelect = {
  items: { select: { products: { select: { id: true, description: true,
    variants: { select: { id: true, size: true, color: true, quantity: true } },
  } } } },
  qcRecords: { orderBy: { checkedAt: "desc" as const }, select: { id: true, qtyGood: true, qtyDefect: true } },
  revisions: { where: { changeType: { in: ["QC_COUNT", "QC_RETURN"] } }, orderBy: { version: "asc" as const },
    select: { id: true, changeType: true, newValue: true } },
};

/** Counts live with the order history and reference an existing QcRecord, independent of audit retention. */
export async function getLegacyQcEvidence(db: Pick<PrismaTx, "order">, orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, select: legacyQcEvidenceSelect });
  return legacyQcEvidence(order);
}

export function legacyQcEvidence(order: {
  items: { products: { id: string; description: string; variants: { id: string; size: string; color: string | null; quantity: number }[] }[] }[];
  qcRecords: { id: string; qtyGood: number; qtyDefect: number }[];
  revisions: Revision[];
}) {
  const latestReturn = qcReturnSnapshots(order.revisions).at(-1);
  const scopeRevisionId = latestReturn?.id ?? null;
  const scope = latestReturn ? new Map(latestReturn.scopeLines.map((line) => [line.variantId, line.qtyExpected])) : null;
  const recordById = new Map(order.qcRecords.map((record) => [record.id, record]));
  const counts = order.revisions.filter((revision) => revision.changeType === "QC_COUNT")
    .map((revision) => parseSnapshot(countSchema, revision.newValue))
    .filter((count) => count.scopeRevisionId === scopeRevisionId && recordById.has(count.qcRecordId));
  const countedIds = new Set<string>();
  const goodByVariant = new Map<string, number>();
  for (const count of counts) {
    if (countedIds.has(count.qcRecordId)) badRequest("พบหลักฐาน QC ซ้ำ กรุณาตรวจประวัติออเดอร์");
    countedIds.add(count.qcRecordId);
    if (count.lines.reduce((sum, line) => sum + line.qtyGood, count.unallocatedQtyGood ?? 0) !== recordById.get(count.qcRecordId)!.qtyGood) {
      badRequest("ยอดดีในหลักฐาน QC ไม่ตรงกับผลตรวจ กรุณาตรวจประวัติออเดอร์");
    }
    for (const line of count.lines) goodByVariant.set(line.variantId, (goodByVariant.get(line.variantId) ?? 0) + line.qtyGood);
  }
  const lines = order.items.flatMap((item) => item.products.flatMap((product) => product.variants
    .filter((variant) => (scope?.get(variant.id) ?? (scope ? 0 : variant.quantity)) > 0)
    .map((variant) => ({ variantId: variant.id, productId: product.id, description: product.description,
      size: variant.size, color: variant.color, qtyExpected: scope?.get(variant.id) ?? variant.quantity,
      checkedGood: goodByVariant.get(variant.id) ?? 0,
    }))));
  const records = order.qcRecords.filter((record) => countedIds.has(record.id));
  // Old aggregate-only partial counts cannot establish which sizes passed. Recount that stock once.
  const needsLegacyRecount = !latestReturn && order.qcRecords.some((record) => !countedIds.has(record.id) && record.qtyGood > 0);
  return { scopeRevisionId, isReturnInspection: Boolean(latestReturn), needsLegacyRecount, lines, records,
    totalExpected: lines.reduce((sum, line) => sum + line.qtyExpected, 0),
    checkedGood: records.reduce((sum, record) => sum + record.qtyGood, 0),
    checkedDefect: records.reduce((sum, record) => sum + record.qtyDefect, 0),
  };
}

export function allocateLegacyQcGood(params: {
  lines: { variantId: string; qtyExpected: number; checkedGood: number }[];
  qtyGood: number; goodLines?: QcGoodLine[];
  defects: { variantId: string; qty: number }[];
  isReturnInspection?: boolean;
}): QcGoodLine[] {
  if (params.lines.length === 0) return [];
  const remaining = new Map(params.lines.map((line) => [line.variantId, Math.max(0, line.qtyExpected - line.checkedGood)]));
  const afterDefects = new Map(remaining);
  for (const defect of params.defects) {
    if (!remaining.has(defect.variantId)) badRequest("ของเสียไม่ได้อยู่ในขอบเขตตรวจรอบนี้");
    afterDefects.set(defect.variantId, Math.max(0, (afterDefects.get(defect.variantId) ?? 0) - defect.qty));
  }
  let lines = params.goodLines;
  if (!lines) {
    const available = [...afterDefects].filter(([, qty]) => qty > 0);
    if (params.qtyGood === 0) lines = [];
    else if (params.qtyGood === [...remaining.values()].reduce((sum, qty) => sum + qty, 0)) {
      lines = [...remaining].map(([variantId, qtyGood]) => ({ variantId, qtyGood }));
    } else if (params.qtyGood === available.reduce((sum, [, qty]) => sum + qty, 0)) {
      lines = available.map(([variantId, qtyGood]) => ({ variantId, qtyGood }));
    } else if (available.length === 1) lines = [{ variantId: available[0]![0], qtyGood: params.qtyGood }];
    else badRequest("ตรวจบางส่วนต้องระบุจำนวนดีตามสินค้า สี และไซซ์");
  }
  if (lines.reduce((sum, line) => sum + line.qtyGood, 0) !== params.qtyGood) badRequest("ยอดดีรายไซซ์ไม่ตรงกับยอดรวม QC");
  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line.variantId) || !remaining.has(line.variantId) || !Number.isInteger(line.qtyGood) || line.qtyGood < 0 || line.qtyGood > remaining.get(line.variantId)!) {
      badRequest("นับเกินยอดงานรายไซซ์ หรือสินค้าไม่ได้อยู่ในขอบเขตตรวจรอบนี้");
    }
    seen.add(line.variantId);
  }
  if (params.isReturnInspection) {
    for (const [variantId, qtyRemaining] of remaining) {
      const inspected = lines.filter((line) => line.variantId === variantId).reduce((sum, line) => sum + line.qtyGood, 0) +
        params.defects.filter((line) => line.variantId === variantId).reduce((sum, line) => sum + line.qty, 0);
      if (inspected > qtyRemaining) badRequest("จำนวนดีและเสียเกินจำนวนรับคืนรายไซซ์ที่ยังไม่ผ่านตรวจ");
    }
  }
  return lines.filter((line) => line.qtyGood > 0);
}

export async function recordLegacyQcCount(tx: PrismaTx, params: { orderId: string; userId: string; qcRecordId: string; scopeRevisionId: string | null; lines: QcGoodLine[]; qtyGood: number }) {
  await addOrderRevision(tx, { orderId: params.orderId, changedBy: params.userId, changeType: "QC_COUNT",
    description: `ตรวจ QC ผ่าน ${params.lines.reduce((sum, line) => sum + line.qtyGood, 0)} ตัวตามสินค้า/ไซซ์`,
    newValue: JSON.stringify({ kind: "LEGACY_QC_COUNT", version: 1, qcRecordId: params.qcRecordId, scopeRevisionId: params.scopeRevisionId, unallocatedQtyGood: params.qtyGood - params.lines.reduce((sum, line) => sum + line.qtyGood, 0), lines: params.lines }),
  });
}

export async function openQcReturnInspection(tx: PrismaTx, params: {
  orderId: string; userId: string; reason: string; returnedLines?: { deliveryLineId: string; qty: number }[];
}) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: params.orderId }, select: {
    internalStatus: true, ...legacyQcEvidenceSelect,
    deliveries: { select: { id: true, status: true, lines: { select: { id: true, description: true, size: true, color: true, qty: true } } } },
  } });
  if (!["SHIPPED", "PACKING"].includes(order.internalStatus)) badRequest("เปิดตรวจรับคืนได้เมื่อผ่าน QC รอบก่อนแล้ว — ปิดการตรวจ/งานแก้รอบปัจจุบันก่อน");
  if (order.internalStatus === "PACKING") {
    const currentEvidence = legacyQcEvidence(order);
    if (currentEvidence.checkedGood < currentEvidence.totalExpected) badRequest("ตรวจ QC รอบปัจจุบันให้ครบก่อนเปิดรับคืนรอบใหม่");
  }
  const previous = qcReturnSnapshots(order.revisions).flatMap((revision) => revision.sourceLines);
  const returnedByLine = new Map<string, number>();
  for (const line of previous) returnedByLine.set(line.deliveryLineId, (returnedByLine.get(line.deliveryLineId) ?? 0) + line.qty);
  const deliveryLines = order.deliveries.filter((delivery) => ["SHIPPED", "DELIVERED", "RETURNED"].includes(delivery.status))
    .flatMap((delivery) => delivery.lines.map((line) => ({ ...line, deliveryId: delivery.id, status: delivery.status })));
  const requested = params.returnedLines ?? deliveryLines.filter((line) => line.status === "RETURNED")
    .map((line) => ({ deliveryLineId: line.id, qty: line.qty - (returnedByLine.get(line.id) ?? 0) })).filter((line) => line.qty > 0);
  if (requested.length === 0) badRequest("ระบุรายการและจำนวนที่รับคืนจริงก่อนเปิดตรวจ QC — ถ้าคืนทั้งกล่องให้บันทึกใบส่งเป็นตีกลับก่อน");
  const variants = order.items.flatMap((item) => item.products.flatMap((product) => product.variants.map((variant) => ({
    ...variant, key: packingLineKey(product.description, variant.size, variant.color),
  }))));
  const seen = new Set<string>();
  const scope = new Map<string, number>();
  const sourceLines = requested.map((input) => {
    const line = deliveryLines.find((candidate) => candidate.id === input.deliveryLineId);
    if (!line || seen.has(input.deliveryLineId) || !Number.isInteger(input.qty) || input.qty <= 0 || input.qty > line.qty - (returnedByLine.get(line.id) ?? 0)) {
      badRequest("จำนวนรับคืนเกินของที่ส่ง หรือรายการนี้ไม่ได้อยู่ในใบส่งของออเดอร์");
    }
    seen.add(input.deliveryLineId);
    const matches = variants.filter((variant) => variant.key === packingLineKey(line.description, line.size, line.color));
    if (matches.length !== 1) badRequest("รายการรับคืนต้องระบุสินค้า/ไซซ์ที่ตรงกับออเดอร์อย่างชัดเจน");
    const variant = matches[0]!;
    const qty = (scope.get(variant.id) ?? 0) + input.qty;
    if (qty > variant.quantity) badRequest("ยอดรับคืนรายไซซ์เกินยอดออเดอร์");
    scope.set(variant.id, qty);
    return { deliveryId: line.deliveryId, deliveryLineId: line.id, qty: input.qty };
  });
  const result = await transitionOrder(tx, { orderId: params.orderId, to: "QUALITY_CHECK", changedBy: params.userId, reason: params.reason });
  if (result.changed) await addOrderRevision(tx, { orderId: params.orderId, changedBy: params.userId, changeType: "QC_RETURN",
    description: `รับคืนตรวจ QC ${sourceLines.reduce((sum, line) => sum + line.qty, 0)} ตัว: ${params.reason}`,
    newValue: JSON.stringify({ kind: "LEGACY_QC_RETURN", version: 1, sourceLines,
      scopeLines: [...scope].map(([variantId, qtyExpected]) => ({ variantId, qtyExpected })) }),
  });
  return result;
}

export async function getQcReturnContext(db: Pick<PrismaTx, "order">, orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, select: {
    internalStatus: true,
    revisions: { where: { changeType: "QC_RETURN" }, select: { changeType: true, newValue: true } },
    deliveries: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, status: true, trackingNumber: true, recipientName: true, shippedAt: true,
      lines: { select: { id: true, description: true, size: true, color: true, qty: true } } } },
  } });
  const returned = qcReturnSnapshots(order.revisions).flatMap((revision) => revision.sourceLines);
  return { internalStatus: order.internalStatus,
    lines: order.deliveries.map((delivery, index) => ({ ...delivery, parcelLabel: `ใบส่งที่ ${index + 1}` })).filter((delivery) => ["SHIPPED", "DELIVERED", "RETURNED"].includes(delivery.status))
      .flatMap((delivery) => delivery.lines.map((line) => ({ deliveryLineId: line.id, description: line.description,
        size: line.size, color: line.color, recipientName: delivery.recipientName, trackingNumber: delivery.trackingNumber,
        parcelLabel: delivery.parcelLabel, shippedAt: delivery.shippedAt,
        wholeParcelReturned: delivery.status === "RETURNED",
        available: Math.max(0, line.qty - returned.filter((source) => source.deliveryLineId === line.id).reduce((sum, source) => sum + source.qty, 0)),
      }))).filter((line) => line.available > 0),
  };
}
