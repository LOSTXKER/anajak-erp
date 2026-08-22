/**
 * ใบตรวจรับของเข้า + ใบคืนของลูกค้า (FLOW-REDESIGN ก้อน 1)
 *
 * มตินับของ 2 จุด: ของเข้าโรงงาน (ที่นี่) + QC ก่อนแพ็ค (ก้อน 3) — ระหว่างทางไม่บังคับนับ
 * ชนิดใบ:
 * - CUSTOMER_GARMENT  รับเสื้อลูกค้าส่งมา (นับจริงต่อไซส์ + รูป + ตำหนิ)
 * - SEWING_GARMENT    รับเสื้อจากโรงเย็บ (โรงเย็บ = supplier — PO/GRN จริงอยู่ฝั่ง Stock)
 * - OUTSOURCE_RETURN  รับกลับงานจากร้านนอก (นับก่อนเข้า QC)
 * - CUSTOMER_RETURN   คืนของลูกค้า — ยอดคืน "หัก" จากยอดรับ (กระทบยอดรับ-คืน)
 *
 * ผลพวงอัตโนมัติ:
 * - ยอดรับสุทธิครบต่อรายการสินค้า → ติ๊ก OrderItemProduct.receivedInspected
 *   (ด่านพร้อมผลิตเช็ค "ของครบ" จาก flag นี้)
 * - เสื้อลูกค้าครบทุกรายการ → ขั้น GARMENT_RECEIVE ในใบผลิตปิดเอง
 * - นับขาด/เกิน/มีตำหนิ → กระดิ่งแจ้ง OWNER/MANAGER ทันที
 */

import { createHash } from "node:crypto";
import { badRequest, conflict, forbidden, internal } from "@/server/errors";
import { createAuditLog, createNotification } from "@/server/helpers";
import { addOrderRevision, finalizeProductionIfComplete } from "@/server/services/order-status";
import { RECEIPT_TYPE_LABELS, type ReceiptType } from "@/lib/goods-receipt";
// สูตรรับสุทธิ/ด่านกรอก/สรุปขาดเกิน แยกไป goods-receipt-plan.ts — unit test ได้ไม่ต้องมี DB
import {
  netReceivedByVariant,
  variantNetKey,
  receiptInspectionOfVariants,
  assertValidReceiptLines,
  summarizeReceiptLines,
} from "@/server/services/goods-receipt-plan";
import type { ExtendedPrismaClient, PrismaTx } from "@/lib/prisma";
import { lockOrderRow } from "@/server/services/order-cost";
import { firstPendingStepIdsByLane } from "@/lib/production-step-actions";
import { lockProductionTopology } from "@/server/services/production-topology-lock";
import {
  loadSpecializedOperation,
  recordSpecializedOperationEvent,
  recordSpecializedOperationOutput,
  type SpecializedOperation,
  type SpecializedQuantityOutput,
} from "@/server/services/manufacturing-operation-adapter";
import { executeManufacturingCommand } from "@/server/services/manufacturing-commands";
import { assertProductionV2ApiEnabled } from "@/server/services/production-v2-gate";

export { RECEIPT_TYPES, RECEIPT_TYPE_LABELS, type ReceiptType } from "@/lib/goods-receipt";

// ชนิดใบ → แหล่งเสื้อที่เกี่ยวข้อง (ใช้ prefill บรรทัด + ติ๊ก receivedInspected)
const SOURCE_BY_TYPE: Partial<Record<ReceiptType, string>> = {
  CUSTOMER_GARMENT: "CUSTOMER_PROVIDED",
  CUSTOMER_RETURN: "CUSTOMER_PROVIDED",
  SEWING_GARMENT: "CUSTOM_MADE",
};

// ============================================================
// prefill บรรทัดใบตรวจรับจากเนื้อออเดอร์ (นับจริง "ต่อไซส์")
// ============================================================

export interface ReceiptContextLine {
  orderItemProductId: string;
  description: string;
  size: string;
  color: string | null;
  qtyExpected: number; // ตามออเดอร์
  qtyReceivedNet: number; // รับแล้วสุทธิ (รับ − คืน) จากใบก่อนหน้า
  qtyReturnable: number; // ของเสียหรือส่วนเกินที่ยังคืนได้โดยไม่ถอนของดีที่ใช้ผลิต
}

type CustomerGarmentEvidenceRow = {
  orderItemProductId: string | null;
  size: string | null;
  color: string | null;
  qtyCounted: number;
  defectQty: number;
  receipt: { receiptType: string };
};

function customerGarmentReturnableByVariant(
  rows: readonly CustomerGarmentEvidenceRow[],
  plannedByVariant: ReadonlyMap<string, number>,
) {
  const totals = new Map<
    string,
    { received: number; defect: number; returned: number }
  >();
  for (const row of rows) {
    if (!row.orderItemProductId) continue;
    const key = variantNetKey(
      row.orderItemProductId,
      row.size,
      row.color,
    );
    const current = totals.get(key) ?? {
      received: 0,
      defect: 0,
      returned: 0,
    };
    if (row.receipt.receiptType === "CUSTOMER_GARMENT") {
      current.received += row.qtyCounted;
      current.defect += row.defectQty;
    } else if (row.receipt.receiptType === "CUSTOMER_RETURN") {
      current.returned += row.qtyCounted;
    }
    totals.set(key, current);
  }

  return new Map(
    [...totals].map(([key, total]) => {
      const planned = plannedByVariant.get(key) ?? 0;
      const outstandingDefect = Math.max(0, total.defect - total.returned);
      const returnsAfterDefects = Math.max(0, total.returned - total.defect);
      const usableReceived = Math.max(0, total.received - total.defect);
      const surplusUsable = Math.max(
        0,
        usableReceived - planned - returnsAfterDefects,
      );
      return [key, outstandingDefect + surplusUsable] as const;
    }),
  );
}

export async function getReceiptContext(
  prisma: ExtendedPrismaClient,
  orderId: string,
  receiptType: ReceiptType
) {
  const source = SOURCE_BY_TYPE[receiptType];
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      items: {
        select: {
          products: {
            select: {
              id: true,
              itemSource: true,
              description: true,
              receivedInspected: true,
              variants: { select: { size: true, color: true, quantity: true } },
            },
          },
        },
      },
    },
  });

  const products = order.items
    .flatMap((it) => it.products)
    .filter((p) => !source || p.itemSource === source);

  // ยอดรับสุทธิเดิมต่อ (product, size, color) — รับ − คืน
  const evidenceReceiptTypes: ReceiptType[] =
    source === "CUSTOMER_PROVIDED"
      ? ["CUSTOMER_GARMENT", "CUSTOMER_RETURN"]
      : source === "CUSTOM_MADE"
        ? ["SEWING_GARMENT"]
        : ["CUSTOMER_GARMENT", "SEWING_GARMENT", "CUSTOMER_RETURN"];
  const prior = await prisma.goodsReceiptLine.findMany({
    where: {
      receipt: { orderId, receiptType: { in: evidenceReceiptTypes } },
      orderItemProductId: { in: products.map((p) => p.id) },
    },
    select: {
      orderItemProductId: true,
      size: true,
      color: true,
      qtyCounted: true,
      defectQty: true,
      receipt: { select: { receiptType: true } },
    },
  });
  const netByKey = netReceivedByVariant(
    prior.map((l) => ({
      orderItemProductId: l.orderItemProductId,
      size: l.size,
      color: l.color,
      qtyCounted: l.qtyCounted,
      receiptType: l.receipt.receiptType,
    }))
  );
  const plannedByVariant = new Map(
    products.flatMap((product) =>
      product.variants.map((variant) => [
        variantNetKey(product.id, variant.size, variant.color),
        variant.quantity,
      ] as const),
    ),
  );
  const returnableByKey = customerGarmentReturnableByVariant(
    prior,
    plannedByVariant,
  );

  const lines: ReceiptContextLine[] = products.flatMap((p) =>
    p.variants.map((v) => ({
      orderItemProductId: p.id,
      description: p.description,
      size: v.size,
      color: v.color,
      qtyExpected: v.quantity,
      qtyReceivedNet: netByKey.get(variantNetKey(p.id, v.size, v.color)) ?? 0,
      qtyReturnable:
        returnableByKey.get(variantNetKey(p.id, v.size, v.color)) ?? 0,
    }))
  );

  return { orderId: order.id, orderNumber: order.orderNumber, lines };
}

// ============================================================
// บันทึกใบตรวจรับ/ใบคืน
// ============================================================

export interface CreateReceiptLineInput {
  orderItemProductId?: string;
  description: string;
  size?: string;
  color?: string;
  qtyExpected: number;
  qtyCounted: number;
  defectQty: number;
  defectNote?: string;
}

export interface CreateReceiptParams {
  orderId: string;
  idempotencyKey: string;
  receiptType: ReceiptType;
  outsourceOrderId?: string;
  productionStepId?: string;
  operationJobId?: string;
  expectedRevision?: number;
  notes?: string;
  photoUrls: string[];
  lines: CreateReceiptLineInput[];
  userId: string;
  canSupervise?: boolean;
}

function sameOptionalText(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? null) === (right ?? null);
}

async function receiptQuantityOutputs(
  tx: PrismaTx,
  operationId: string,
  lines: CreateReceiptLineInput[],
): Promise<SpecializedQuantityOutput[]> {
  const quantityLines = await tx.operationQuantity.findMany({
    where: { productionStepId: operationId },
    select: {
      id: true,
      sourceOrderItemProductId: true,
      size: true,
      color: true,
      printPosition: true,
      qtyPlanned: true,
      qtyGood: true,
    },
  });
  const outputById = new Map<string, SpecializedQuantityOutput>();
  for (const line of lines) {
    const acceptedQty = Math.max(0, line.qtyCounted - line.defectQty);
    if (acceptedQty === 0) continue;
    const matches = quantityLines.filter(
      (quantityLine) =>
        quantityLine.sourceOrderItemProductId === line.orderItemProductId &&
        sameOptionalText(quantityLine.size, line.size) &&
        sameOptionalText(quantityLine.color, line.color) &&
        quantityLine.printPosition === null,
    );
    if (matches.length !== 1) {
      badRequest("จับคู่หลักฐานรับเสื้อกับ quantity line ไม่ได้แบบแน่นอน");
    }
    const current = outputById.get(matches[0]!.id);
    const qtyGood = Math.min(
      acceptedQty,
      Math.max(
        0,
        matches[0]!.qtyPlanned -
          matches[0]!.qtyGood -
          (current?.qtyGood ?? 0),
      ),
    );
    if (qtyGood === 0) continue;
    outputById.set(matches[0]!.id, {
      quantityLineId: matches[0]!.id,
      qtyGood: (current?.qtyGood ?? 0) + qtyGood,
      qtyScrap: 0,
      qtyRework: 0,
    });
  }
  return [...outputById.values()];
}

async function lockGoodsReceiptWriteChain(
  tx: PrismaTx,
  orderId: string,
) {
  // ใบรับเสื้ออาจปิด GARMENT_RECEIVE แล้ว finalizer ปิด PACKAGING compatibility ต่อ
  // จึง lock mutation set ทั้งใบตาม global order เดียวกับ QC/production writers:
  // steps (sorted) → productions (sorted) → order. Snapshot แรกใช้หาแถว lock เท่านั้น
  // และต้อง revalidate membership หลังได้ order lock เพื่อกัน production ใหม่แทรกระหว่างทาง
  await lockProductionTopology(tx, orderId);
  const before = await tx.production.findMany({
    where: { orderId },
    select: { id: true, steps: { select: { id: true } } },
  });
  const stepIds = [
    ...new Set(before.flatMap((production) => production.steps.map((step) => step.id))),
  ].sort();
  const productionIds = [...new Set(before.map((production) => production.id))].sort();

  for (const stepId of stepIds) {
    await tx.$queryRaw`SELECT id FROM production_steps WHERE id = ${stepId} FOR UPDATE`;
  }
  for (const productionId of productionIds) {
    await tx.$queryRaw`SELECT id FROM productions WHERE id = ${productionId} FOR UPDATE`;
  }
  await lockOrderRow(tx, orderId);

  const after = await tx.production.findMany({
    where: { orderId },
    select: { id: true, steps: { select: { id: true } } },
  });
  const lockedStepIds = [
    ...new Set(after.flatMap((production) => production.steps.map((step) => step.id))),
  ].sort();
  const lockedProductionIds = [...new Set(after.map((production) => production.id))].sort();
  if (
    JSON.stringify(stepIds) !== JSON.stringify(lockedStepIds) ||
    JSON.stringify(productionIds) !== JSON.stringify(lockedProductionIds)
  ) {
    conflict("ใบผลิตเปลี่ยนระหว่างบันทึกใบตรวจรับ กรุณากดบันทึกซ้ำ");
  }
  return tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { productionCompletionOwnerId: true },
  });
}

interface ReceiptStoredOutcome {
  requestFingerprint: string;
}

function goodsReceiptIdForRequest(orderId: string, idempotencyKey: string) {
  return `gr_${createHash("sha256")
    .update(`${orderId}:${idempotencyKey}`)
    .digest("hex")
    .slice(0, 32)}`;
}

function goodsReceiptRequestFingerprint(params: CreateReceiptParams) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        orderId: params.orderId,
        receiptType: params.receiptType,
        outsourceOrderId: params.outsourceOrderId ?? null,
        productionStepId: params.productionStepId ?? null,
        operationJobId: params.operationJobId ?? null,
        expectedRevision: params.expectedRevision ?? null,
        notes: params.notes ?? null,
        photoUrls: params.photoUrls,
        lines: params.lines.map((line) => ({
          orderItemProductId: line.orderItemProductId ?? null,
          description: line.description,
          size: line.size ?? null,
          color: line.color ?? null,
          qtyExpected: line.qtyExpected,
          qtyCounted: line.qtyCounted,
          defectQty: line.defectQty,
          defectNote: line.defectNote ?? null,
        })),
        userId: params.userId,
      })
    )
    .digest("hex");
}

function readReceiptStoredOutcome(value: unknown): ReceiptStoredOutcome | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.requestFingerprint === "string"
    ? { requestFingerprint: candidate.requestFingerprint }
    : null;
}

interface CanonicalReceiptProduct {
  id: string;
  itemSource: string | null;
  description: string;
  variants: Array<{ size: string; color: string | null; quantity: number }>;
}

interface CanonicalReceiptValidation {
  lines: CreateReceiptLineInput[];
  productIds: string[];
  products: CanonicalReceiptProduct[];
  priorNetByVariant: Map<string, number>;
}

function receiptTypeAppliesToProduct(receiptType: string, itemSource: string | null) {
  if (itemSource === "CUSTOMER_PROVIDED") {
    return receiptType === "CUSTOMER_GARMENT" || receiptType === "CUSTOMER_RETURN";
  }
  if (itemSource === "CUSTOM_MADE") return receiptType === "SEWING_GARMENT";
  return receiptType !== "CUSTOMER_RETURN";
}

async function validateCanonicalReceiptLines(
  tx: PrismaTx,
  params: Pick<
    CreateReceiptParams,
    "orderId" | "receiptType" | "productionStepId" | "operationJobId"
  >,
  inputLines: CreateReceiptLineInput[],
): Promise<CanonicalReceiptValidation> {
  const isVariantEvidence =
    params.receiptType === "CUSTOMER_GARMENT" ||
    params.receiptType === "CUSTOMER_RETURN" ||
    params.receiptType === "SEWING_GARMENT";
  const inputProductIds = [
    ...new Set(
      inputLines
        .map((line) => line.orderItemProductId)
        .filter((id): id is string => !!id),
    ),
  ];

  if (isVariantEvidence && inputLines.some((line) => !line.orderItemProductId)) {
    badRequest("ใบตรวจรับ/คืนต้องผูกทุกบรรทัดกับสินค้าในออเดอร์");
  }

  const products = await tx.orderItemProduct.findMany({
    where: params.productionStepId || params.operationJobId
      ? {
          orderItem: { orderId: params.orderId },
          itemSource: "CUSTOMER_PROVIDED",
        }
      : {
          id: { in: inputProductIds },
          orderItem: { orderId: params.orderId },
        },
    select: {
      id: true,
      itemSource: true,
      description: true,
      variants: { select: { size: true, color: true, quantity: true } },
    },
  });
  const productById = new Map(products.map((product) => [product.id, product]));
  if (inputProductIds.some((id) => !productById.has(id))) {
    badRequest("มีรายการตรวจรับที่ไม่ใช่สินค้าของออเดอร์นี้");
  }
  if ((params.productionStepId || params.operationJobId) && products.length === 0) {
    badRequest("ออเดอร์นี้ไม่มีรายการเสื้อที่ลูกค้าจัดส่งมา");
  }
  if (
    (params.receiptType === "CUSTOMER_GARMENT" || params.receiptType === "CUSTOMER_RETURN") &&
    products.some((product) => product.itemSource !== "CUSTOMER_PROVIDED")
  ) {
    badRequest("ใบรับ/คืนเสื้อลูกค้าใช้ได้เฉพาะสินค้าที่ลูกค้าจัดส่งมา");
  }
  if (
    params.receiptType === "SEWING_GARMENT" &&
    products.some((product) => product.itemSource !== "CUSTOM_MADE")
  ) {
    badRequest("ใบรับจากโรงเย็บใช้ได้เฉพาะรายการที่สั่งผลิตใหม่");
  }

  if (!isVariantEvidence) {
    return {
      lines: inputLines,
      productIds: inputProductIds,
      products,
      priorNetByVariant: new Map(),
    };
  }

  const canonicalByKey = new Map<
    string,
    { product: CanonicalReceiptProduct; size: string; color: string | null; quantity: number }
  >();
  for (const product of products) {
    for (const variant of product.variants) {
      const key = variantNetKey(product.id, variant.size, variant.color);
      if (canonicalByKey.has(key)) {
        badRequest(`รายการ ${product.description} มีไซส์/สีซ้ำ กรุณาแก้รายการออเดอร์ก่อนตรวจรับ`);
      }
      canonicalByKey.set(key, { product, ...variant });
    }
  }

  const priorRows = await tx.goodsReceiptLine.findMany({
    where: {
      orderItemProductId: { in: products.map((product) => product.id) },
      receipt: {
        orderId: params.orderId,
        receiptType: { in: ["CUSTOMER_GARMENT", "SEWING_GARMENT", "CUSTOMER_RETURN"] },
      },
    },
    select: {
      orderItemProductId: true,
      size: true,
      color: true,
      qtyCounted: true,
      defectQty: true,
      receipt: { select: { receiptType: true } },
    },
  });
  const priorNetByVariant = netReceivedByVariant(
    priorRows
      .filter((row) => {
        const product = row.orderItemProductId
          ? productById.get(row.orderItemProductId)
          : undefined;
        return !!product && receiptTypeAppliesToProduct(row.receipt.receiptType, product.itemSource);
      })
      .map((row) => ({
        orderItemProductId: row.orderItemProductId,
        size: row.size,
        color: row.color,
        qtyCounted: row.qtyCounted,
        receiptType: row.receipt.receiptType,
      })),
  );
  const plannedByVariant = new Map(
    [...canonicalByKey].map(([key, canonical]) => [key, canonical.quantity]),
  );
  const returnableByVariant = customerGarmentReturnableByVariant(
    priorRows,
    plannedByVariant,
  );

  const seenInputKeys = new Set<string>();
  const validatedLines = inputLines.map((line) => {
    const productId = line.orderItemProductId!;
    const key = variantNetKey(productId, line.size ?? null, line.color ?? null);
    if (seenInputKeys.has(key)) {
      badRequest("ใบตรวจรับมีไซส์/สีซ้ำกัน กรุณาโหลดรายการใหม่");
    }
    seenInputKeys.add(key);
    const canonical = canonicalByKey.get(key);
    if (!canonical) {
      badRequest("ไซส์/สีในใบตรวจรับไม่ตรงกับรายการออเดอร์ปัจจุบัน กรุณาโหลดรายการใหม่");
    }
    const priorNet = priorNetByVariant.get(key) ?? 0;
    if (params.receiptType === "CUSTOMER_RETURN") {
      const returnable = params.operationJobId
        ? returnableByVariant.get(key) ?? 0
        : Math.max(0, priorNet);
      if (line.qtyCounted > returnable) {
        badRequest(
          params.operationJobId
            ? "จำนวนคืนมากกว่าของเสียหรือส่วนเกินที่ยังคืนได้ในไซส์/สีนี้"
            : "จำนวนคืนมากกว่ายอดรับสุทธิของไซส์/สีนี้",
        );
      }
    } else {
      const remainingExpected = Math.max(0, canonical.quantity - priorNet);
      if (line.qtyExpected !== remainingExpected) {
        badRequest("ยอดที่คาดในใบตรวจรับเปลี่ยนไปแล้ว กรุณาโหลดรายการใหม่ก่อนบันทึก");
      }
    }
    return {
      ...line,
      description: canonical.product.description,
      size: canonical.size,
      color: canonical.color ?? undefined,
      qtyExpected: params.receiptType === "CUSTOMER_RETURN"
        ? 0
        : Math.max(0, canonical.quantity - priorNet),
    };
  });

  if (params.productionStepId || params.operationJobId) {
    if (
      seenInputKeys.size !== canonicalByKey.size ||
      [...canonicalByKey.keys()].some((key) => !seenInputKeys.has(key))
    ) {
      badRequest("จอสถานีต้องบันทึกผลนับให้ครบทุกไซส์/สี กรุณาโหลดรายการใหม่");
    }
    const totalActionable = [...canonicalByKey].reduce(
      (sum, [key, canonical]) =>
        sum +
        (params.receiptType === "CUSTOMER_RETURN"
          ? params.operationJobId
            ? returnableByVariant.get(key) ?? 0
            : Math.max(0, priorNetByVariant.get(key) ?? 0)
          : Math.max(
              0,
              canonical.quantity - (priorNetByVariant.get(key) ?? 0),
            )),
      0,
    );
    if (totalActionable === 0) {
      badRequest(
        params.receiptType === "CUSTOMER_RETURN"
          ? "ไม่มีของเสียหรือส่วนเกินค้างให้คืน"
          : "หลักฐานรับเสื้อครบแล้ว ให้ยืนยันหลักฐานเดิมแทนการสร้างใบนับ 0",
      );
    }
  }

  return {
    lines: validatedLines,
    productIds: [...new Set(validatedLines.map((line) => line.orderItemProductId!))],
    products,
    priorNetByVariant,
  };
}

async function assertReturnDoesNotInvalidateActiveProduction(
  tx: PrismaTx,
  params: {
    orderId: string;
    lines: CreateReceiptLineInput[];
    products: CanonicalReceiptProduct[];
    priorNetByVariant: Map<string, number>;
  },
) {
  const afterReturn = new Map(params.priorNetByVariant);
  for (const line of params.lines) {
    const key = variantNetKey(
      line.orderItemProductId!,
      line.size ?? null,
      line.color ?? null,
    );
    afterReturn.set(key, (afterReturn.get(key) ?? 0) - line.qtyCounted);
  }
  const affectedIds = new Set(params.lines.map((line) => line.orderItemProductId!));
  const wouldInvalidate = params.products
    .filter((product) => affectedIds.has(product.id))
    .some(
      (product) =>
        !receiptInspectionOfVariants(product.id, product.variants, afterReturn)
          .receivedInspected,
    );
  if (!wouldInvalidate) return;

  // lock topology ถูกถืออยู่แล้ว: ตรวจสถานะใน transaction เดียวกันและ reject ทั้งใบ
  // แทนการ reopen ขั้นย้อนหลังที่อาจปล่อยงาน downstream ไปแล้ว.
  const [activeProductions, advancedSteps] = await Promise.all([
    tx.production.count({
      // conservative: เมื่อเปิดใบผลิตแล้ว แม้ step ยัง PENDING ก็ห้ามถอน
      // readiness evidence ใต้ฝ่าเดียว; ไม่ reopen workflow อัตโนมัติ.
      where: { orderId: params.orderId },
    }),
    tx.productionStep.count({
      where: {
        production: { orderId: params.orderId },
        status: { not: "PENDING" },
      },
    }),
  ]);
  if (activeProductions > 0 || advancedSteps > 0) {
    conflict("คืนรายการนี้ไม่ได้ เพราะหลักฐานตรวจรับถูกใช้เดินงานผลิตแล้ว ให้หัวหน้าจัดการด้วยกระบวนการแก้ไขแทน");
  }
}

// อัปเดต receivedInspected ของรายการสินค้าตามยอดรับสุทธิล่าสุด — เรียกใน tx เดียวกับใบ
async function refreshReceivedInspected(tx: PrismaTx, orderId: string, productIds: string[]) {
  if (productIds.length === 0) return;
  const products = await tx.orderItemProduct.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      itemSource: true,
      variants: { select: { size: true, color: true, quantity: true } },
    },
  });
  const lines = await tx.goodsReceiptLine.findMany({
    where: {
      orderItemProductId: { in: productIds },
      receipt: { orderId, receiptType: { in: ["CUSTOMER_GARMENT", "SEWING_GARMENT", "CUSTOMER_RETURN"] } },
    },
    select: {
      orderItemProductId: true,
      size: true,
      color: true,
      qtyCounted: true,
      receipt: { select: { receiptType: true } },
    },
  });
  for (const p of products) {
    const relevantTypes =
      p.itemSource === "CUSTOMER_PROVIDED"
        ? new Set(["CUSTOMER_GARMENT", "CUSTOMER_RETURN"])
        : p.itemSource === "CUSTOM_MADE"
          ? new Set(["SEWING_GARMENT"])
          : new Set(["CUSTOMER_GARMENT", "SEWING_GARMENT"]);
    const netByVariant = netReceivedByVariant(
      lines
        .filter(
          (line) =>
            line.orderItemProductId === p.id && relevantTypes.has(line.receipt.receiptType),
        )
        .map((line) => ({
          orderItemProductId: line.orderItemProductId,
          size: line.size,
          color: line.color,
          qtyCounted: line.qtyCounted,
          receiptType: line.receipt.receiptType,
        })),
    );
    await tx.orderItemProduct.update({
      where: { id: p.id },
      data: receiptInspectionOfVariants(p.id, p.variants, netByVariant),
    });
  }
}

interface StationReceiptStep {
  id: string;
  productionId: string;
  assignedToId: string | null;
  status: string;
}

async function assertLegacyStationTargetIsNotV2(
  tx: PrismaTx,
  productionStepId: string,
): Promise<void> {
  const target = await tx.productionStep.findUniqueOrThrow({
    where: { id: productionStepId },
    select: { executionEnabled: true },
  });
  if (target.executionEnabled) {
    badRequest(
      "ขั้นงานนี้ต้องทำจากโหมดสถานี กรุณาเปิดงานปัจจุบันแล้วลองอีกครั้ง",
    );
  }
}

async function assertStationReceiptStep(
  tx: PrismaTx,
  params: {
    stepId: string;
    orderId: string;
    userId: string;
    canSupervise?: boolean;
    allowCompletedReplay?: boolean;
  },
): Promise<StationReceiptStep> {
  const target = await tx.productionStep.findUniqueOrThrow({
    where: { id: params.stepId },
    select: {
      id: true,
      productionId: true,
      stepType: true,
      status: true,
      assignedToId: true,
      executionEnabled: true,
      production: {
        select: {
          orderId: true,
          steps: {
            select: { id: true, stepType: true, status: true, sortOrder: true },
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          },
        },
      },
    },
  });
  if (target.executionEnabled) {
    badRequest(
      "ขั้นงานนี้ต้องทำจากโหมดสถานี กรุณาเปิดงานปัจจุบันแล้วลองอีกครั้ง",
    );
  }
  if (target.production.orderId !== params.orderId || target.stepType !== "GARMENT_RECEIVE") {
    badRequest("ขั้นตรวจรับนี้ไม่ตรงกับใบผลิตและออเดอร์ที่เปิดอยู่");
  }
  if (
    target.assignedToId &&
    target.assignedToId !== params.userId &&
    !params.canSupervise
  ) {
    forbidden("ขั้นตรวจรับนี้มีผู้รับผิดชอบคนอื่นอยู่");
  }
  if (target.status === "COMPLETED" && params.allowCompletedReplay) return target;

  const order = await tx.order.findUniqueOrThrow({
    where: { id: params.orderId },
    select: { internalStatus: true },
  });
  if (order.internalStatus !== "PRODUCING") {
    badRequest("รับเสื้อจากจอสถานีได้เฉพาะออเดอร์ที่กำลังผลิต");
  }
  if (target.status === "FAILED" || target.status === "ON_HOLD") {
    badRequest("ขั้นตรวจรับนี้มีปัญหาค้างอยู่ — ให้หัวหน้าแก้สถานะก่อนบันทึกรับเสื้อ");
  }
  if (target.status === "COMPLETED") badRequest("ขั้นตรวจรับนี้เสร็จแล้ว");
  if (!firstPendingStepIdsByLane(target.production.steps).has(target.id)) {
    badRequest("ยังรับเสื้อในขั้นนี้ไม่ได้ — ขั้นก่อนหน้าในสายงานเดียวกันยังไม่เสร็จ");
  }
  return target;
}

export async function createGoodsReceipt(
  prisma: ExtendedPrismaClient,
  params: CreateReceiptParams
) {
  if (params.operationJobId) assertProductionV2ApiEnabled();
  const stationInspection =
    (params.receiptType === "CUSTOMER_GARMENT" &&
      !!(params.productionStepId || params.operationJobId)) ||
    (params.receiptType === "CUSTOMER_RETURN" &&
      !!params.operationJobId);
  const lines = assertValidReceiptLines(params.lines, {
    preserveZeroLines: stationInspection,
    // รับเสื้อ 0 ตัวเป็น shortage evidence ได้ แต่ใบคืนต้องมีของที่คืนจริงเสมอ.
    allowAllZero:
      stationInspection && params.receiptType === "CUSTOMER_GARMENT",
  });
  const receiptId = goodsReceiptIdForRequest(params.orderId, params.idempotencyKey);
  const requestFingerprint = goodsReceiptRequestFingerprint({ ...params, lines });

  const typeLabel = RECEIPT_TYPE_LABELS[params.receiptType];

  const result = await prisma.$transaction(async (tx) => {
    const productionOwner = await lockGoodsReceiptWriteChain(tx, params.orderId);

    // retry หลัง response หลุดต้องตอบผลเดิมก่อนเช็กสถานะสด: รอบแรกอาจปิดขั้น/ดันงานต่อแล้ว
    const replay = await tx.goodsReceipt.findUnique({
      where: { id: receiptId },
      include: { lines: true },
    });
    if (replay) {
      const audit = await tx.auditLog.findFirst({
        where: {
          action: "CREATE",
          entityType: "GOODS_RECEIPT",
          entityId: replay.id,
        },
        select: { newValue: true },
      });
      const stored = readReceiptStoredOutcome(audit?.newValue);
      if (!stored) {
        internal("พบใบตรวจรับเดิมแต่ไม่พบข้อมูลยืนยันคำขอ กรุณาแจ้งผู้ดูแลระบบ");
      }
      if (stored.requestFingerprint !== requestFingerprint) {
        conflict("คำขอบันทึกใบตรวจรับนี้ถูกใช้กับข้อมูลคนละชุดแล้ว กรุณากดบันทึกเป็นใบใหม่");
      }
      return {
        receipt: replay,
        alreadyRecorded: true,
        summary: summarizeReceiptLines(params.receiptType, replay.lines),
      };
    }

    if (!params.operationJobId && productionOwner.productionCompletionOwnerId) {
      badRequest(
        "งานนี้ต้องบันทึกการรับของจากงานปัจจุบันในโหมดสถานี",
      );
    }
    if (params.productionStepId) {
      await assertLegacyStationTargetIsNotV2(tx, params.productionStepId);
    }

    await tx.order.findUniqueOrThrow({
      where: { id: params.orderId },
      select: { id: true },
    });

    // ใบผูก outsource ต้องเป็นของจริงและอยู่ใต้ออเดอร์เดียวกัน — schema ไม่มี FK
    // จึงตรวจหลัง lock และ commit พร้อมใบ ไม่ใช้ snapshot นอก transaction
    let outsourceProductionStepId: string | null = null;
    if (params.outsourceOrderId) {
      if (params.receiptType !== "OUTSOURCE_RETURN") {
        badRequest("ผูกใบ outsource ได้เฉพาะใบตรวจนับชนิดรับกลับร้านนอก");
      }
      const outsource = await tx.outsourceOrder.findUnique({
        where: { id: params.outsourceOrderId },
        select: {
          productionStepId: true,
          productionStep: {
            select: { production: { select: { orderId: true } } },
          },
        },
      });
      if (!outsource) badRequest("ไม่พบใบ outsource ที่อ้างถึง");
      if (outsource.productionStep.production.orderId !== params.orderId) {
        badRequest("ใบ outsource ที่อ้างถึงไม่ใช่ของออเดอร์นี้");
      }
      outsourceProductionStepId = outsource.productionStepId;
    }

    if (params.productionStepId && params.operationJobId) {
      badRequest("ระบุ productionStepId และ operationJobId พร้อมกันไม่ได้");
    }
    if (
      (params.productionStepId || params.operationJobId) &&
      params.receiptType !== "CUSTOMER_GARMENT" &&
      !(params.operationJobId && params.receiptType === "CUSTOMER_RETURN")
    ) {
      badRequest("ขั้นสถานีนี้รองรับเฉพาะการรับหรือคืนเสื้อลูกค้า");
    }
    if (params.operationJobId && params.expectedRevision === undefined) {
      badRequest("คำสั่ง Production V2 ต้องระบุ expectedRevision");
    }

    let stationStep: StationReceiptStep | null = null;
    let operation: SpecializedOperation | null = null;
    if (params.productionStepId) {
      stationStep = await assertStationReceiptStep(tx, {
        stepId: params.productionStepId,
        orderId: params.orderId,
        userId: params.userId,
        canSupervise: params.canSupervise,
      });
    }
    if (params.operationJobId) {
      operation = await loadSpecializedOperation(tx, {
        operationJobId: params.operationJobId,
        expectedRevision: params.expectedRevision!,
        actorId: params.userId,
        canSupervise: params.canSupervise === true,
        requiredWorkCenterCode: "PREP",
        orderId: params.orderId,
      });
    }

    // ใช้ canonical product/variant + ยอดสุทธิสดหลังถือ order/topology lock เสมอ.
    // Station ต้องส่งครบทุกไซส์/สี รวมแถวที่นับได้ 0 เพื่อเก็บ shortage evidence.
    const validated = await validateCanonicalReceiptLines(tx, params, lines);
    const receiptLines = validated.lines;
    const productIds = validated.productIds;
    if (params.receiptType === "CUSTOMER_RETURN") {
      if (!params.operationJobId) {
        await assertReturnDoesNotInvalidateActiveProduction(tx, {
          orderId: params.orderId,
          lines: receiptLines,
          products: validated.products,
          priorNetByVariant: validated.priorNetByVariant,
        });
      }
    }
    const summary = summarizeReceiptLines(params.receiptType, receiptLines);

    const created = await tx.goodsReceipt.create({
      data: {
        id: receiptId,
        orderId: params.orderId,
        productionStepId:
          params.operationJobId ??
          params.productionStepId ??
          outsourceProductionStepId,
        receiptType: params.receiptType,
        outsourceOrderId: params.outsourceOrderId,
        notes: params.notes,
        photoUrls: params.photoUrls,
        receivedById: params.userId,
        lines: {
          create: receiptLines.map((l) => ({
            orderItemProductId: l.orderItemProductId,
            description: l.description,
            size: l.size,
            color: l.color,
            qtyExpected: l.qtyExpected,
            qtyCounted: l.qtyCounted,
            defectQty: l.defectQty,
            defectNote: l.defectNote,
          })),
        },
      },
      include: { lines: true },
    });

    // ยอดรับสุทธิ → ติ๊กตรวจรับต่อรายการสินค้า (ด่านพร้อมผลิตใช้ flag นี้)
    if (params.receiptType !== "OUTSOURCE_RETURN") {
      await refreshReceivedInspected(tx, params.orderId, productIds);
    }

    if (operation) {
      const eventInput = {
        operation,
        commandId: `goods-receipt:${receiptId}`,
        actorId: params.userId,
        eventType:
          params.receiptType === "CUSTOMER_RETURN"
            ? ("MATERIAL_RETURNED" as const)
            : ("RECEIPT_RECORDED" as const),
        payload: {
          receiptId: created.id,
          receiptType: params.receiptType,
          qtyCounted: summary.totalCounted,
          qtyDefect: summary.totalDefect,
        },
      };
      if (params.receiptType === "CUSTOMER_GARMENT") {
        const quantityLines = await receiptQuantityOutputs(
          tx,
          operation.id,
          receiptLines,
        );
        const qtyGood = quantityLines.reduce(
          (sum, line) => sum + line.qtyGood,
          0,
        );
        if (qtyGood > 0) {
          await recordSpecializedOperationOutput(tx, {
            ...eventInput,
            delta: { qtyGood, qtyScrap: 0, qtyRework: 0 },
            quantityLines,
          });
        } else {
          await recordSpecializedOperationEvent(tx, eventInput);
        }
      } else {
        await recordSpecializedOperationEvent(tx, eventInput);
      }
    }

    // เสื้อลูกค้าครบทุกรายการ → ขั้นตรวจรับเสื้อลูกค้า (GARMENT_RECEIVE) ปิดเอง
    if (params.receiptType === "CUSTOMER_GARMENT") {
      const remaining = await tx.orderItemProduct.count({
        where: {
          orderItem: { orderId: params.orderId },
          itemSource: "CUSTOMER_PROVIDED",
          receivedInspected: false,
        },
      });
      // การปิดขั้นเป็น semantic Station command เท่านั้น: caller ทั่วไปที่จงใจไม่ส่ง
      // productionStepId บันทึกได้แค่ ledger evidence ห้ามปิด GARMENT_RECEIVE ทุกใบผลิต
      if (remaining === 0 && stationStep) {
        const steps = await tx.productionStep.findMany({
          where: {
            id: stationStep.id,
            stepType: "GARMENT_RECEIVE",
            status: { in: ["PENDING", "IN_PROGRESS"] },
          },
          select: { id: true, productionId: true },
        });
        for (const s of steps) {
          await tx.productionStep.update({
            where: { id: s.id },
            data: {
              status: "COMPLETED",
              completedAt: new Date(),
              ...(stationStep.assignedToId === null ? { assignedToId: params.userId } : {}),
            },
          });
          await finalizeProductionIfComplete(tx, {
            productionId: s.productionId,
            changedBy: params.userId,
          });
        }
      } else if (stationStep) {
        // ใบรับบางส่วน/นับได้ศูนย์คือหลักฐานว่าช่างเริ่มตรวจจริงแล้ว จึงต้องขึ้น
        // "กำลังทำ" ใน Station ไม่ใช่กลับไปกองพร้อมถัดไปทั้งที่มี owner/receipt แล้ว.
        await tx.productionStep.update({
          where: { id: stationStep.id },
          data: {
            ...(stationStep.status === "PENDING"
              ? { status: "IN_PROGRESS" as const, startedAt: new Date() }
              : {}),
            ...(stationStep.assignedToId === null
              ? { assignedToId: params.userId }
              : {}),
          },
        });
      }
    }

    const summaryParts = [
      `${typeLabel} ${summary.totalCounted} ตัว`,
      ...(summary.totalDefect > 0 ? [`ตำหนิ ${summary.totalDefect}`] : []),
      ...(summary.discrepancies.length > 0
        ? [`ขาด/เกิน: ${summary.discrepancies.join(" · ")}`]
        : []),
    ];
    await addOrderRevision(tx, {
      orderId: params.orderId,
      changedBy: params.userId,
      changeType: "STOCK",
      description: summaryParts.join(" — "),
    });
    await tx.order.update({
      where: { id: params.orderId },
      data: { updatedAt: new Date() },
      select: { id: true },
    });

    // audit เป็นหลักฐาน durable ของ fingerprint และต้อง rollback พร้อมใบเสมอ
    await createAuditLog(tx, {
      userId: params.userId,
      action: "CREATE",
      entityType: "GOODS_RECEIPT",
      entityId: created.id,
      newValue: {
        orderId: params.orderId,
        receiptType: params.receiptType,
        lineCount: created.lines.length,
        productionStepId:
          params.operationJobId ?? params.productionStepId ?? null,
        operationJobId: params.operationJobId ?? null,
        requestFingerprint,
      },
    });

    return { receipt: created, alreadyRecorded: false, summary };
  });
  const { receipt, alreadyRecorded, summary } = result;
  const { totalDefect, discrepancies } = summary;

  // ขาด/เกิน/ตำหนิ → แจ้งแอดมิน (OWNER/MANAGER) ทันที — นอก tx (กระดิ่งพังต้องไม่ล้มใบ)
  // replay key เดิมไม่ส่งซ้ำ และ notification failure ห้ามเปลี่ยน receipt ที่ commit แล้วเป็น error
  if (!alreadyRecorded && (discrepancies.length > 0 || totalDefect > 0)) {
    try {
      const order = await prisma.order.findUniqueOrThrow({
        where: { id: params.orderId },
        select: { id: true, orderNumber: true, title: true },
      });
      const problems = [
        ...discrepancies,
        ...(totalDefect > 0 ? [`ตำหนิรวม ${totalDefect} ตัว`] : []),
      ];
      const staff = await prisma.user.findMany({
        where: { role: { in: ["OWNER", "MANAGER"] }, isActive: true, id: { not: params.userId } },
        select: { id: true },
      });
      for (const u of staff) {
        await createNotification(prisma, {
          userId: u.id,
          type: "ORDER",
          title: `ตรวจรับของมีปัญหา — ${order.orderNumber}`,
          message: `${typeLabel}: ${problems.join(" · ")} (${order.title})`,
          link: `/orders/${order.id}`,
          entityType: "ORDER",
          entityId: order.id,
        });
      }
    } catch (error) {
      console.error("goods receipt notification error:", error);
    }
  }

  return { ...receipt, alreadyRecorded };
}

/**
 * ปิด GARMENT_RECEIVE จาก ledger เดิมโดยไม่สร้างใบ 0 แถว เช่นฝ่ายขายรับครบจากหน้าออเดอร์
 * ก่อนช่างเปิด Station. เป็น semantic command แยกจาก create เพื่อไม่ปลอมหลักฐานนับซ้ำ
 */
export async function confirmCustomerGarmentEvidence(
  prisma: ExtendedPrismaClient,
  params: {
    productionStepId?: string;
    operationJobId?: string;
    expectedRevision?: number;
    commandId?: string;
    userId: string;
    canSupervise?: boolean;
  },
) {
  if (params.operationJobId) assertProductionV2ApiEnabled();
  const targetId = params.operationJobId ?? params.productionStepId;
  if (!targetId || (params.operationJobId && params.productionStepId)) {
    badRequest("ต้องระบุขั้นเดิมหรือ Operation Job อย่างใดอย่างหนึ่ง");
  }
  if (
    params.operationJobId &&
    (params.expectedRevision === undefined || !params.commandId)
  ) {
    badRequest("Production V2 ต้องระบุ commandId และ expectedRevision");
  }
  const reference = await prisma.productionStep.findUniqueOrThrow({
    where: { id: targetId },
    select: { production: { select: { id: true, orderId: true } } },
  });
  const orderId = reference.production.orderId;

  const execute = async (tx: PrismaTx) => {
    await lockGoodsReceiptWriteChain(tx, orderId);
    const operation = params.operationJobId
      ? await loadSpecializedOperation(tx, {
          operationJobId: params.operationJobId,
          expectedRevision: params.expectedRevision!,
          actorId: params.userId,
          canSupervise: params.canSupervise ?? false,
          requiredWorkCenterCode: "PREP",
          orderId,
          allowedStates: ["READY", "RUNNING"],
        })
      : null;
    const target = operation
      ? null
      : await assertStationReceiptStep(tx, {
          stepId: params.productionStepId!,
          orderId,
          userId: params.userId,
          canSupervise: params.canSupervise,
          allowCompletedReplay: true,
        });
    if (target?.status === "COMPLETED") {
      return { ...target, alreadyCompleted: true };
    }

    const customerProductIds = await tx.orderItemProduct.findMany({
      where: {
        orderItem: { orderId },
        itemSource: "CUSTOMER_PROVIDED",
      },
      select: { id: true },
    });
    if (customerProductIds.length === 0) {
      badRequest("ออเดอร์นี้ไม่มีรายการเสื้อที่ลูกค้าจัดส่งมา");
    }
    // ห้ามเชื่อ cache เดิม: เวอร์ชันเก่าเคยติ๊กจากยอดรวมต่อสินค้าและงาน manual
    // อาจทิ้ง true ทั้งที่บางไซส์ขาด. คำนวณ ledger ต่อ variant สดหลัง lock ก่อนปิดขั้น.
    await refreshReceivedInspected(
      tx,
      orderId,
      customerProductIds.map((product) => product.id),
    );
    const customerProducts = await tx.orderItemProduct.findMany({
      where: { id: { in: customerProductIds.map((product) => product.id) } },
      select: { id: true, receivedInspected: true },
    });
    if (customerProducts.some((product) => !product.receivedInspected)) {
      badRequest("หลักฐานรับเสื้อลูกค้ายังไม่ครบ กรุณานับและบันทึกรายการที่เหลือก่อน");
    }

    if (operation) {
      const evidenceProducts = await tx.orderItemProduct.findMany({
        where: { id: { in: customerProductIds.map((product) => product.id) } },
        select: {
          id: true,
          variants: { select: { size: true, color: true, quantity: true } },
        },
      });
      const evidenceLines = await tx.goodsReceiptLine.findMany({
        where: {
          orderItemProductId: {
            in: customerProductIds.map((product) => product.id),
          },
          receipt: {
            orderId,
            receiptType: { in: ["CUSTOMER_GARMENT", "CUSTOMER_RETURN"] },
          },
        },
        select: {
          orderItemProductId: true,
          size: true,
          color: true,
          qtyCounted: true,
          defectQty: true,
          receipt: { select: { receiptType: true } },
        },
      });
      const acceptedNetByVariant = new Map<string, number>();
      for (const line of evidenceLines) {
        if (!line.orderItemProductId) continue;
        const key = variantNetKey(
          line.orderItemProductId,
          line.size ?? null,
          line.color ?? null,
        );
        const signedAccepted = line.receipt.receiptType === "CUSTOMER_RETURN"
          ? -line.qtyCounted
          : Math.max(0, line.qtyCounted - line.defectQty);
        acceptedNetByVariant.set(
          key,
          (acceptedNetByVariant.get(key) ?? 0) + signedAccepted,
        );
      }
      const evidenceQty = evidenceProducts.reduce(
        (productSum, product) =>
          productSum + product.variants.reduce(
            (sum, variant) =>
              sum + Math.min(
                variant.quantity,
                Math.max(
                  0,
                  acceptedNetByVariant.get(
                    variantNetKey(product.id, variant.size, variant.color),
                  ) ?? 0,
                ),
              ),
            0,
          ),
        0,
      );
      const currentQuantityLines = await tx.operationQuantity.findMany({
        where: { productionStepId: operation.id },
        select: {
          id: true,
          sourceOrderItemProductId: true,
          size: true,
          color: true,
          printPosition: true,
          qtyPlanned: true,
          qtyGood: true,
        },
      });
      const remainingQty = Math.max(0, operation.qtyPlanned - operation.qtyGood);
      let allocatableRemaining = remainingQty;
      const quantityLines: SpecializedQuantityOutput[] = [];
      let alreadyCreditedQty = 0;
      for (const product of evidenceProducts) {
        for (const variant of product.variants) {
          const matches = currentQuantityLines.filter(
            (line) =>
              line.sourceOrderItemProductId === product.id &&
              sameOptionalText(line.size, variant.size) &&
              sameOptionalText(line.color, variant.color) &&
              line.printPosition === null,
          );
          if (matches.length !== 1) {
            badRequest("จับคู่หลักฐานเสื้อลูกค้ากับ quantity line ไม่ได้แบบแน่นอน");
          }
          const line = matches[0]!;
          alreadyCreditedQty += line.qtyGood;
          const acceptedQty = Math.max(
            0,
            acceptedNetByVariant.get(
              variantNetKey(product.id, variant.size, variant.color),
            ) ?? 0,
          );
          const qtyGood = Math.min(
            Math.max(
              0,
              Math.min(variant.quantity, line.qtyPlanned, acceptedQty) - line.qtyGood,
            ),
            allocatableRemaining,
          );
          if (qtyGood > 0) {
            quantityLines.push({
              quantityLineId: line.id,
              qtyGood,
              qtyScrap: 0,
              qtyRework: 0,
            });
            allocatableRemaining -= qtyGood;
          }
        }
      }
      const creditedQty = quantityLines.reduce((sum, line) => sum + line.qtyGood, 0);
      const eventInput = {
        operation,
        commandId: `confirm-customer-evidence:${params.commandId}`,
        actorId: params.userId,
        eventType: "RECEIPT_RECORDED" as const,
        payload: {
          evidenceConfirmed: true,
          evidenceQty,
          alreadyCreditedQty,
          creditedQty,
        },
      };
      const updated = creditedQty > 0
        ? await recordSpecializedOperationOutput(tx, {
            ...eventInput,
            delta: { qtyGood: creditedQty, qtyScrap: 0, qtyRework: 0 },
            quantityLines,
          })
        : await recordSpecializedOperationEvent(tx, eventInput);
      return {
        ...updated,
        alreadyCompleted: false,
        alreadyRecorded: false,
        evidenceQty,
        creditedQty,
      };
    }

    const completedAt = new Date();
    const step = await tx.productionStep.update({
      where: { id: target!.id },
      data: {
        status: "COMPLETED",
        completedAt,
        ...(target!.assignedToId === null ? { assignedToId: params.userId } : {}),
      },
      select: {
        id: true,
        productionId: true,
        status: true,
        assignedToId: true,
        completedAt: true,
      },
    });
    await finalizeProductionIfComplete(tx, {
      productionId: target!.productionId,
      changedBy: params.userId,
    });
    await createAuditLog(tx, {
      userId: params.userId,
      action: "UPDATE",
      entityType: "PRODUCTION_STEP",
      entityId: target!.id,
      oldValue: {
        status: target!.status,
        assignedToId: target!.assignedToId,
      },
      newValue: {
        source: "STATION",
        operation: "CONFIRM_CUSTOMER_GARMENT_EVIDENCE",
        status: "COMPLETED",
        assignedToId: step.assignedToId,
      },
      reason: "ยืนยันจากหลักฐานใบรับเสื้อลูกค้าที่บันทึกไว้แล้ว",
    });
    return { ...step, alreadyCompleted: false };
  };

  if (params.operationJobId) {
    return executeManufacturingCommand(
      prisma,
      "confirmCustomerGarmentEvidence",
      {
        commandId: params.commandId!,
        expectedRevision: params.expectedRevision!,
        actorId: params.userId,
        operationJobId: params.operationJobId,
      },
      async (tx) => {
        const result = await execute(tx);
        return {
          productionId: reference.production.id,
          productionStepId: params.operationJobId,
          result,
        };
      },
    );
  }
  return prisma.$transaction(execute);
}

export async function listGoodsReceipts(prisma: ExtendedPrismaClient, orderId: string) {
  return prisma.goodsReceipt.findMany({
    where: { orderId },
    orderBy: { receivedAt: "desc" },
    include: {
      lines: true,
      receivedBy: { select: { id: true, name: true } },
    },
  });
}
