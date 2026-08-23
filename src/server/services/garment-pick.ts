/**
 * ใบเบิกเสื้อ + ใบคืนเศษ (FLOW-REDESIGN ก้อน 1 — ผูกขั้น GARMENT_PICK)
 *
 * flow: ยืนยันออเดอร์จองของไว้แล้ว (stock-reservation) → ช่างกด "เบิกเสื้อ" ที่ขั้น
 * GARMENT_PICK → ส่ง ISSUE + orderRef ไป Stock (ฝั่งโน้นตัดยอดจองของออเดอร์นี้อัตโนมัติ
 * + กันเบิกทับยอดจองงานอื่น) → บันทึก MaterialUsage (ISSUE) + เดินสถานะขั้น
 * เหลือเศษ (เผื่อเสีย 3%) → "คืนเศษ" ส่ง RETURN กลับสต๊อค + MaterialUsage (RETURN)
 *
 * กติกา:
 * - เบิกเกิน "ที่ต้องใช้" ได้ (เบิกเผื่อเสียคือเรื่องปกติ) — Stock เป็นคนกันของไม่พอ
 * - คืนเกินยอดที่เบิกค้างอยู่ไม่ได้ (กันยอดสต๊อคบวม)
 * - lock step/production → order แล้วอ่านสิทธิ์+ยอดสดก่อนยิง Stock; ต้องถือ lock ผ่าน HTTP
 *   เพื่อให้ request key ต่างกันไม่ตัด/คืนจาก snapshot เดียวกันพร้อมกัน
 * - idempotencyKey เดิมได้ docNumber เดิม; ถ้า ERP บันทึก doc นั้นแล้ว local write เป็น no-op
 * - ไม่มีเงินใน flow นี้ (มติเลิกคิดต้นทุนต่องาน 2026-06-12) — unitCost เก็บ 0
 */

import { createHash } from "node:crypto";
import { badRequest, conflict, forbidden, internal } from "@/server/errors";
import { DEFAULT_STOCK_LOCATION } from "@/lib/stock-constants";
import {
  getStockClientFromSettings,
  StockApiError,
  type StockApiClient,
} from "@/lib/stock-api";
import {
  buildReserveLines,
  type RichReserveLine,
} from "@/server/services/stock-reservation";
// สูตรตัดสินล้วน (รวมยอดเบิก/คืน · แผนเบิก+stepDone · ด่านคืนเกิน) — unit test ได้ไม่ต้องมี DB
import {
  mergePickUsage,
  planGarmentIssue,
  planGarmentReturn,
} from "@/server/services/garment-pick-plan";
import { firstPendingStepIdsByLane } from "@/lib/production-step-actions";
import {
  addOrderRevision,
  finalizeProductionIfComplete,
} from "@/server/services/order-status";
import { lockProductionTopology } from "@/server/services/production-topology-lock";
import { createAuditLog } from "@/server/helpers";
import {
  applyLocalDemoStockMovement,
  isLocalDemoStockEnabled,
} from "@/server/services/local-demo-stock";
import type { ExtendedPrismaClient, PrismaTx } from "@/lib/prisma";
import {
  loadSpecializedOperation,
  recordSpecializedOperationEvent,
  recordSpecializedOperationOutput,
  type SpecializedOperation,
  type SpecializedQuantityOutput,
} from "@/server/services/manufacturing-operation-adapter";

const GARMENT_UNIT = "ตัว";
const GARMENT_TRANSACTION_TIMEOUT_MS = 20_000;

async function garmentIssueQuantityOutputs(
  tx: PrismaTx,
  operationId: string,
  evidence: Array<{
    productId: string;
    size: string;
    color: string | null;
    qtyGood: number;
  }>,
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
  const sourceProductIds = [
    ...new Set(
      quantityLines
        .map((line) => line.sourceOrderItemProductId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const orderProducts = await tx.orderItemProduct.findMany({
    where: { id: { in: sourceProductIds } },
    select: { id: true, productId: true },
  });
  const inventoryProductByOrderProduct = new Map(
    orderProducts.map((product) => [product.id, product.productId]),
  );
  const outputs: SpecializedQuantityOutput[] = [];
  for (const item of evidence) {
    let remaining = item.qtyGood;
    const candidates = quantityLines
      .filter(
        (line) =>
          inventoryProductByOrderProduct.get(line.sourceOrderItemProductId ?? "") ===
            item.productId &&
          line.size === item.size &&
          (line.color ?? null) === (item.color ?? null) &&
          line.printPosition === null,
      )
      .sort((left, right) => left.id.localeCompare(right.id));
    for (const line of candidates) {
      const qtyGood = Math.min(remaining, Math.max(0, line.qtyPlanned - line.qtyGood));
      if (qtyGood > 0) {
        outputs.push({
          quantityLineId: line.id,
          qtyGood,
          qtyScrap: 0,
          qtyRework: 0,
        });
        remaining -= qtyGood;
      }
      if (remaining === 0) break;
    }
    if (remaining !== 0) {
      badRequest(`จับคู่หลักฐานเบิก SKU กับ quantity line ไม่ครบ (${item.size})`);
    }
  }
  return outputs;
}

function garmentIdempotencyMarker(
  movementType: "ISSUE" | "RETURN",
  idempotencyKey: string,
) {
  return `[erp-garment:${movementType}:${idempotencyKey}]`;
}

function canonicalGarmentLines(lines: Array<{ sku: string; qty: number }>) {
  const quantityBySku = new Map<string, number>();
  for (const line of lines) {
    if (line.qty <= 0) continue;
    quantityBySku.set(line.sku, (quantityBySku.get(line.sku) ?? 0) + line.qty);
  }
  return [...quantityBySku]
    .map(([sku, qty]) => ({ sku, qty }))
    .sort((left, right) =>
      left.sku < right.sku ? -1 : left.sku > right.sku ? 1 : 0,
    );
}

function garmentRequestFingerprint(params: {
  movementType: "ISSUE" | "RETURN";
  productionId: string;
  stepId?: string;
  operationJobId?: string;
  expectedRevision?: number;
  lines: Array<{ sku: string; qty: number }>;
  location: string;
  note?: string;
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        movementType: params.movementType,
        productionId: params.productionId,
        stepId: params.stepId ?? null,
        operationJobId: params.operationJobId ?? null,
        expectedRevision: params.expectedRevision ?? null,
        lines: canonicalGarmentLines(params.lines),
        location: params.location,
        note: params.note || null,
      }),
    )
    .digest("hex");
}

function garmentRequestMarker(
  movementType: "ISSUE" | "RETURN",
  idempotencyKey: string,
  requestFingerprint: string,
) {
  return `${garmentIdempotencyMarker(movementType, idempotencyKey)}[request:${requestFingerprint}]`;
}

function fingerprintFromGarmentNote(note: string | null | undefined) {
  return note?.match(/\[request:([a-f0-9]{64})\]/)?.[1] ?? null;
}

function stockGarmentIdempotencyKey(
  orderId: string,
  movementType: "ISSUE" | "RETURN",
  clientKey: string,
) {
  const digest = createHash("sha256")
    .update(JSON.stringify({ orderId, movementType, clientKey }))
    .digest("hex");
  return `erp-garment-${movementType.toLowerCase()}-${digest}`;
}

function assertRecordedGarmentFingerprint(
  rows: Array<{ note?: string | null }>,
  expectedFingerprint: string,
) {
  const stored = rows.map((row) => fingerprintFromGarmentNote(row.note));
  if (stored.some((fingerprint) => fingerprint === null)) {
    internal(
      "พบรายการเบิก/คืนเดิมแต่ไม่พบข้อมูลยืนยันคำขอ กรุณาแจ้งผู้ดูแลระบบ",
    );
  }
  const fingerprints = [...new Set(stored)];
  if (fingerprints.length !== 1 || fingerprints[0] !== expectedFingerprint) {
    conflict(
      "คำขอเบิก/คืน key นี้ถูกใช้กับข้อมูลคนละชุดแล้ว กรุณาเปิดรายการใหม่",
    );
  }
}

async function findRecordedGarmentMovement(
  tx: PrismaTx,
  params: {
    orderId: string;
    movementType: "ISSUE" | "RETURN";
    idempotencyKey: string;
    requestFingerprint: string;
  },
) {
  const marker = garmentIdempotencyMarker(
    params.movementType,
    params.idempotencyKey,
  );
  const rows = await tx.materialUsage.findMany({
    where: {
      production: { orderId: params.orderId },
      movementType: params.movementType,
      note: { startsWith: marker },
    },
    select: { quantity: true, stockMovementRef: true, note: true },
  });
  const docNumber =
    rows.find((row) => row.stockMovementRef)?.stockMovementRef ?? null;
  if (!docNumber) return null;
  const storedDocNumbers = rows.map((row) => row.stockMovementRef);
  const docNumbers = [...new Set(storedDocNumbers)];
  if (
    storedDocNumbers.some((storedDocNumber) => !storedDocNumber) ||
    docNumbers.length !== 1
  ) {
    internal("พบรายการเบิก/คืน key เดียวกันผูกหลายเอกสาร กรุณาแจ้งผู้ดูแลระบบ");
  }
  assertRecordedGarmentFingerprint(rows, params.requestFingerprint);
  return {
    docNumber,
    quantity: rows.reduce((sum, row) => sum + row.quantity, 0),
  };
}

async function ensureGarmentMovementAudit(
  tx: PrismaTx,
  params: {
    movementType: "ISSUE" | "RETURN";
    docNumber: string;
    productionId: string;
    userId: string;
    lines: Array<{ sku: string; qty: number }>;
    quantity: number;
    requestFingerprint: string;
    note?: string;
  },
) {
  const entityType =
    params.movementType === "ISSUE" ? "STOCK_ISSUE" : "STOCK_RETURN";
  const existing = await tx.auditLog.findFirst({
    where: {
      action: "CREATE",
      entityType,
      entityId: params.docNumber,
    },
    select: { id: true },
  });
  if (existing) return;

  await createAuditLog(tx, {
    userId: params.userId,
    action: "CREATE",
    entityType,
    entityId: params.docNumber,
    newValue: {
      productionId: params.productionId,
      lines: params.lines,
      quantity: params.quantity,
      requestFingerprint: params.requestFingerprint,
      ...(params.note ? { note: params.note } : {}),
    },
  });
}

// ============================================================
// สถานะเบิก/คืนของออเดอร์ (รวมทุกใบผลิตของออเดอร์ — กันเบิกซ้ำข้ามใบ)
// ============================================================

export interface GarmentPickLine extends RichReserveLine {
  needed: number; // จากเนื้อออเดอร์ (= qty ของ RichReserveLine)
  issued: number; // เบิกไปแล้วสุทธิตามเอกสาร ISSUE
  returned: number; // คืนแล้วตามเอกสาร RETURN
}

export interface GarmentPickState {
  orderId: string;
  orderNumber: string;
  lines: GarmentPickLine[];
  problems: string[];
}

export async function getGarmentPickState(
  prisma: PrismaTx,
  orderId: string,
): Promise<GarmentPickState> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      items: {
        select: {
          products: {
            select: {
              itemSource: true,
              productId: true,
              description: true,
              variants: { select: { size: true, color: true, quantity: true } },
            },
          },
        },
      },
    },
  });

  const fromStock = order.items
    .flatMap((it) => it.products)
    .filter((p) => p.itemSource === "FROM_STOCK" && p.productId);
  if (fromStock.length === 0) {
    return { orderId, orderNumber: order.orderNumber, lines: [], problems: [] };
  }

  const productIds = [...new Set(fromStock.map((p) => p.productId!))];
  const mirror = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      sku: true,
      name: true,
      variants: { select: { id: true, sku: true, size: true, color: true } },
    },
  });
  const built = buildReserveLines(fromStock, mirror);

  // ยอดเบิก/คืนสะสม — นับทุกใบผลิตของออเดอร์ (ออเดอร์มีหลายใบผลิตได้ ของชุดเดียวกัน)
  const usages = await prisma.materialUsage.findMany({
    where: {
      production: { orderId },
      productId: { in: productIds },
    },
    select: {
      productId: true,
      productVariantId: true,
      quantity: true,
      movementType: true,
    },
  });
  const lines: GarmentPickLine[] = mergePickUsage(built.lines, usages);

  return {
    orderId,
    orderNumber: order.orderNumber,
    lines,
    problems: built.problems,
  };
}

// ============================================================
// เบิกเสื้อ (ISSUE + orderRef → Stock ตัดยอดจองอัตโนมัติ)
// ============================================================

interface IssueGarmentsParams {
  productionId: string;
  stepId?: string;
  operationJobId?: string;
  expectedRevision?: number;
  lines: Array<{ sku: string; qty: number }>;
  idempotencyKey: string;
  fromLocation?: string;
  userId: string;
  // PERM: true = มีสิทธิ์งานหัวหน้า (แตะงานคนอื่นได้) · false = แตะเฉพาะงานตัวเอง/ยังไม่มีเจ้าของ
  canSupervise: boolean;
}

export async function issueGarments(
  prisma: ExtendedPrismaClient,
  params: IssueGarmentsParams,
  clientOverride?: StockApiClient | null,
) {
  return prisma.$transaction(
    async (tx) => {
    const targetStepId = params.operationJobId ?? params.stepId;
    if (!targetStepId) badRequest("ต้องระบุขั้นเบิกเสื้อ");
    if (params.operationJobId && params.stepId) {
      badRequest("ระบุ stepId และ operationJobId พร้อมกันไม่ได้");
    }
    if (params.operationJobId && params.expectedRevision === undefined) {
      badRequest("คำสั่ง Production V2 ต้องระบุ expectedRevision");
    }
    // สอง read แรกใช้หา lock scope เท่านั้น; คำสั่งจริงตัดสินจากข้อมูลที่อ่านซ้ำหลังถือ
    // topology mutex → steps ทั้งใบตาม id → production → order ครบแล้ว
    const stepReference = await tx.productionStep.findUniqueOrThrow({
      where: { id: targetStepId },
      select: { productionId: true },
    });
    const productionReference = await tx.production.findUniqueOrThrow({
      where: { id: stepReference.productionId },
      select: { orderId: true },
    });
    await lockProductionTopology(tx, productionReference.orderId);
    await tx.$queryRaw`SELECT id FROM production_steps WHERE production_id = ${stepReference.productionId} ORDER BY id FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM productions WHERE id = ${stepReference.productionId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${productionReference.orderId} FOR UPDATE`;

    const step = await tx.productionStep.findUniqueOrThrow({
      where: { id: targetStepId },
        select: {
          id: true,
          productionId: true,
          stepType: true,
          status: true,
          assignedToId: true,
          executionEnabled: true,
        },
    });
    if (step.productionId !== params.productionId) {
      badRequest("ขั้นตอนนี้ไม่อยู่ในใบผลิตนี้");
    }
    if (!params.operationJobId && step.executionEnabled) {
      badRequest(
        "ขั้นงานนี้ต้องทำจากโหมดสถานี กรุณาเปิดงานปัจจุบันแล้วลองอีกครั้ง",
      );
    }
    if (!params.operationJobId && step.stepType !== "GARMENT_PICK") {
      badRequest("เบิกเสื้อได้เฉพาะขั้น 'เบิกเสื้อจากสต๊อค'");
    }

    const production = await tx.production.findUniqueOrThrow({
      where: { id: params.productionId },
      select: { id: true, orderId: true },
    });
    if (production.orderId !== productionReference.orderId) {
      badRequest("โครงใบผลิตเปลี่ยนจากอีกหน้าจอแล้ว — กรุณาโหลดใหม่");
    }
    const canonicalLines = canonicalGarmentLines(params.lines);
    const fromLocation = params.fromLocation ?? DEFAULT_STOCK_LOCATION;
    const requestFingerprint = garmentRequestFingerprint({
      movementType: "ISSUE",
      productionId: production.id,
      stepId: step.id,
      operationJobId: params.operationJobId,
      expectedRevision: params.expectedRevision,
      lines: canonicalLines,
      location: fromLocation,
    });

    // กติกาเดียวกับ updateStep (PERM) แต่ตัดสินจาก assignee หลัง lock เท่านั้น
    let autoClaim = false;
    if (!params.operationJobId && !params.canSupervise) {
      if (step.assignedToId === null) autoClaim = true;
      else if (step.assignedToId !== params.userId) {
        forbidden("งานนี้ถูกมอบหมายให้คนอื่นแล้ว");
      }
    }

    // key เดิมที่ local transaction เคย commit แล้วต้องจบก่อน state-dependent plan:
    // RETURN รอบแรกอาจคืนเต็มเพดานจน plan รอบ retry ไม่ผ่าน ทั้งที่ Stock/ERP สำเร็จแล้ว
    const replay = await findRecordedGarmentMovement(tx, {
      orderId: production.orderId,
      movementType: "ISSUE",
      idempotencyKey: params.idempotencyKey,
      requestFingerprint,
    });
    if (replay) {
      await ensureGarmentMovementAudit(tx, {
        movementType: "ISSUE",
        docNumber: replay.docNumber,
        productionId: production.id,
        userId: params.userId,
        lines: params.lines,
        quantity: replay.quantity,
        requestFingerprint,
      });
      return {
        docNumber: replay.docNumber,
        issuedQty: replay.quantity,
        stepCompleted: step.status === "COMPLETED",
        alreadyRecorded: true,
      };
    }

    let operation: SpecializedOperation | null = null;
    if (params.operationJobId) {
      operation = await loadSpecializedOperation(tx, {
        operationJobId: params.operationJobId,
        expectedRevision: params.expectedRevision!,
        actorId: params.userId,
        canSupervise: params.canSupervise,
        requiredWorkCenterCode: "PREP",
        productionId: params.productionId,
      });
    }

    // replay ที่ commit แล้วต้องตอบซ้ำได้แม้ step เปลี่ยนสถานะภายหลัง แต่คำสั่งใหม่
    // ห้ามเขียนทับ exception/พักงาน และห้ามเบิกจาก deep-link ของขั้นอนาคต
    if (!operation && step.status === "FAILED") {
        badRequest(
          "เบิกเสื้อไม่ได้ — ขั้นนี้มีปัญหาและต้องให้หัวหน้าแก้ปัญหาก่อน",
        );
    }
    if (!operation && step.status === "ON_HOLD") {
      badRequest("เบิกเสื้อไม่ได้ — ขั้นนี้ถูกพักอยู่");
    }
    const siblings = operation ? [] : await tx.productionStep.findMany({
      where: { productionId: production.id },
      select: {
        id: true,
        stepType: true,
        status: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    if (!operation && !firstPendingStepIdsByLane(siblings).has(step.id)) {
      badRequest("เบิกเสื้อไม่ได้ — ขั้นก่อนหน้าในสายงานเดียวกันยังไม่เสร็จ");
    }

    // replay ด้านบนเป็น no-op ที่ local commit แล้ว; operation ใหม่ต้องอ่านสถานะสดหลัง order
    // lock และหยุดก่อน Stock side effect หากงานถูกพัก/ยกเลิกหรือออกจากช่วงผลิตแล้ว
    const liveOrder = await tx.order.findUniqueOrThrow({
      where: { id: production.orderId },
      select: { internalStatus: true },
    });
    if (liveOrder.internalStatus !== "PRODUCING") {
      badRequest("เบิกเสื้อไม่ได้ — ออเดอร์ไม่ได้อยู่ในสถานะกำลังผลิต");
    }

    const state = await getGarmentPickState(tx, production.orderId);
    const stateBySku = new Map(state.lines.map((line) => [line.sku, line]));
      const {
        requested,
        issuedThisRound,
        neededTotal,
        fulfilledTotal,
        stepDone,
      } = planGarmentIssue(state.lines, params.lines);
      const fulfilledBefore = state.lines.reduce(
        (sum, line) =>
          sum + Math.min(line.needed, Math.max(0, line.issued - line.returned)),
        0,
      );
      let docNumber: string;
      let duplicated = false;
      if (isLocalDemoStockEnabled()) {
        const movement = await applyLocalDemoStockMovement(tx, {
          movementType: "ISSUE",
          orderId: production.orderId,
          idempotencyKey: stockGarmentIdempotencyKey(
            production.orderId,
            "ISSUE",
            params.idempotencyKey,
          ),
          requested,
          stateLines: state.lines,
        });
        docNumber = movement.docNumber;
      } else {
    const client =
          clientOverride !== undefined
            ? clientOverride
            : await getStockClientFromSettings();
    if (!client) {
          badRequest(
            "ยังไม่ได้ตั้งค่าเชื่อม Anajak Stock — ไปที่ Settings → Stock ก่อน",
          );
    }
    try {
      const movement = await client.createMovement({
        type: "ISSUE",
        refNo: state.orderNumber,
        idempotencyKey: stockGarmentIdempotencyKey(
          production.orderId,
          "ISSUE",
          params.idempotencyKey,
        ),
        note: `เบิกเสื้อใบผลิต (ออเดอร์ ${state.orderNumber})`,
        lines: requested.map((line) => ({
          sku: line.sku,
          qty: line.qty,
          fromLocation,
          orderRef: state.orderNumber,
        })),
      });
      docNumber = movement.data.docNumber;
      duplicated = movement.data.duplicated === true;
    } catch (err) {
      if (err instanceof StockApiError) badRequest(err.message);
      badRequest(
            `เชื่อมต่อ Anajak Stock ไม่ได้ (${err instanceof Error ? err.message : "unknown"})`,
      );
    }
      }

    // local transaction เดิมบันทึก usage+step+revision พร้อมกัน: พบ doc แล้วแปลว่า commit
    // รอบแรกครบทั้งก้อน จึงต้อง no-op ไม่ increment qtyDone/revision ซ้ำ
    const recorded = await tx.materialUsage.findMany({
      where: {
        productionId: production.id,
        stockMovementRef: docNumber,
        movementType: "ISSUE",
      },
      select: { quantity: true, note: true },
    });
    if (recorded.length > 0) {
      assertRecordedGarmentFingerprint(recorded, requestFingerprint);
        const recordedQuantity = recorded.reduce(
          (sum, usage) => sum + usage.quantity,
          0,
        );
      await ensureGarmentMovementAudit(tx, {
        movementType: "ISSUE",
        docNumber,
        productionId: production.id,
        userId: params.userId,
        lines: params.lines,
        quantity: recordedQuantity,
        requestFingerprint,
      });
      return {
        docNumber,
        issuedQty: recordedQuantity,
        stepCompleted: step.status === "COMPLETED",
        alreadyRecorded: true,
      };
    }
    if (duplicated) {
      conflict(
        `การเบิกนี้ถูกส่งไป Stock แล้ว (${docNumber}) แต่ ERP ไม่มีหลักฐานยืนยันรายการเดิม — ตรวจสอบเอกสารที่ Stock ก่อนสร้างคำขอใหม่`,
      );
    }

    for (const line of requested) {
      const ref = stateBySku.get(line.sku)!;
      await tx.materialUsage.create({
        data: {
          productionId: production.id,
          productionStepId: step.id,
          productId: ref.productId,
          productVariantId: ref.variantId,
          quantity: line.qty,
          unit: GARMENT_UNIT,
          movementType: "ISSUE",
            note: garmentRequestMarker(
              "ISSUE",
              params.idempotencyKey,
              requestFingerprint,
            ),
          stockMovementRef: docNumber,
          deductedAt: new Date(),
        },
      });
    }

    // เดินสถานะขั้น: เบิกครบ = เสร็จ · เบิกบางส่วน = กำลังทำ (ขั้นที่ปิดไปแล้วไม่ถอย)
    // qty บนขั้นวิ่งตามยอดเบิกจริง — บอกบนบอร์ดได้ว่าเบิกถึงไหน
    if (operation) {
      const quantityEvidence = requested.flatMap((line) => {
        const ref = stateBySku.get(line.sku)!;
        const fulfilledBeforeLine = Math.min(
          ref.needed,
          Math.max(0, ref.issued - ref.returned),
        );
        const fulfilledAfterLine = Math.min(
          ref.needed,
          Math.max(0, ref.issued + line.qty - ref.returned),
        );
        const qtyGood = fulfilledAfterLine - fulfilledBeforeLine;
        return qtyGood > 0
          ? [{
              productId: ref.productId,
              size: ref.size,
              color: ref.color,
              qtyGood,
            }]
          : [];
      });
      const quantityLines = await garmentIssueQuantityOutputs(
        tx,
        operation.id,
        quantityEvidence,
      );
      await recordSpecializedOperationOutput(tx, {
        operation,
        commandId: `garment-issue:${stockGarmentIdempotencyKey(
          production.orderId,
          "ISSUE",
          params.idempotencyKey,
        )}`,
        actorId: params.userId,
        eventType: "MATERIAL_ISSUED",
        delta: {
          qtyGood: fulfilledTotal - fulfilledBefore,
          qtyScrap: 0,
          qtyRework: 0,
        },
        quantityLines,
        payload: { docNumber, issuedQty: issuedThisRound },
      });
    } else if (step.status !== "COMPLETED") {
      await tx.productionStep.update({
        where: { id: step.id },
        data: {
            // แสดงยอดที่ครบตามใบงาน ไม่ใช่ยอดหยิบจริงซึ่งอาจเผื่อเสียเกิน qtyTotal
            qtyDone: fulfilledTotal,
          qtyTotal: neededTotal > 0 ? neededTotal : null,
          ...(autoClaim ? { assignedToId: params.userId } : {}),
          ...(stepDone
            ? { status: "COMPLETED", completedAt: new Date() }
            : { status: "IN_PROGRESS", startedAt: new Date() }),
        },
      });
      if (stepDone) {
        await finalizeProductionIfComplete(tx, {
          productionId: production.id,
          changedBy: params.userId,
        });
      }
    }

    await addOrderRevision(tx, {
      orderId: production.orderId,
      changedBy: params.userId,
      changeType: "STOCK",
      description: `เบิกเสื้อจากสต๊อค ${issuedThisRound} ตัว (${docNumber})`,
    });
    await ensureGarmentMovementAudit(tx, {
      movementType: "ISSUE",
      docNumber,
      productionId: production.id,
      userId: params.userId,
      lines: canonicalLines,
      quantity: issuedThisRound,
      requestFingerprint,
    });

    return {
      docNumber,
      issuedQty: issuedThisRound,
      stepCompleted: stepDone,
      alreadyRecorded: false,
    };
    },
    { timeout: GARMENT_TRANSACTION_TIMEOUT_MS },
  );
}

// ============================================================
// คืนเศษกลับสต๊อค (RETURN)
// ============================================================

interface ReturnGarmentsParams {
  productionId: string;
  operationJobId?: string;
  expectedRevision?: number;
  lines: Array<{ sku: string; qty: number }>;
  note?: string;
  idempotencyKey: string;
  toLocation?: string;
  userId: string;
  canSupervise?: boolean;
}

export async function returnGarments(
  prisma: ExtendedPrismaClient,
  params: ReturnGarmentsParams,
  clientOverride?: StockApiClient | null,
) {
  return prisma.$transaction(
    async (tx) => {
    // RETURN ไม่มี stepId แต่ยังใช้ topology mutex ก่อน row lock เพื่อไม่กลับลำดับกับ
    // production writer อื่น; read แรกมีไว้หา order scope เท่านั้น
    const reference = await tx.production.findUniqueOrThrow({
      where: { id: params.productionId },
      select: { orderId: true },
    });
    await lockProductionTopology(tx, reference.orderId);
    if (params.operationJobId) {
      await tx.$queryRaw`SELECT id FROM production_steps WHERE id = ${params.operationJobId} FOR UPDATE`;
    }
    await tx.$queryRaw`SELECT id FROM productions WHERE id = ${params.productionId} FOR UPDATE`;
    const production = await tx.production.findUniqueOrThrow({
      where: { id: params.productionId },
      select: { id: true, orderId: true },
    });
    if (production.orderId !== reference.orderId) {
      badRequest("โครงใบผลิตเปลี่ยนจากอีกหน้าจอแล้ว — กรุณาโหลดใหม่");
    }
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${production.orderId} FOR UPDATE`;
    if (!params.operationJobId) {
      const v2Operation = await tx.productionStep.findFirst({
        where: {
          productionId: production.id,
          executionEnabled: true,
        },
        select: { id: true },
      });
      if (v2Operation) {
        badRequest(
          "งานนี้ต้องคืนเสื้อจากงานปัจจุบันในโหมดสถานี",
        );
      }
    }
    const canonicalLines = canonicalGarmentLines(params.lines);
    const toLocation = params.toLocation ?? DEFAULT_STOCK_LOCATION;
    const requestFingerprint = garmentRequestFingerprint({
      movementType: "RETURN",
      productionId: production.id,
      operationJobId: params.operationJobId,
      expectedRevision: params.expectedRevision,
      lines: canonicalLines,
      location: toLocation,
      note: params.note,
    });

    const replay = await findRecordedGarmentMovement(tx, {
      orderId: production.orderId,
      movementType: "RETURN",
      idempotencyKey: params.idempotencyKey,
      requestFingerprint,
    });
    if (replay) {
      await ensureGarmentMovementAudit(tx, {
        movementType: "RETURN",
        docNumber: replay.docNumber,
        productionId: production.id,
        userId: params.userId,
        lines: params.lines,
        quantity: replay.quantity,
        requestFingerprint,
        note: params.note,
      });
      return {
        docNumber: replay.docNumber,
        returnedQty: replay.quantity,
        alreadyRecorded: true,
      };
    }

    let operation: SpecializedOperation | null = null;
    if (params.operationJobId) {
      if (params.expectedRevision === undefined) {
        badRequest("คำสั่ง Production V2 ต้องระบุ expectedRevision");
      }
      operation = await loadSpecializedOperation(tx, {
        operationJobId: params.operationJobId,
        expectedRevision: params.expectedRevision,
        actorId: params.userId,
        canSupervise: params.canSupervise === true,
        requiredWorkCenterCode: "PREP",
        productionId: params.productionId,
        allowInactiveExecutionScope: true,
      });
    }

    const state = await getGarmentPickState(tx, production.orderId);
    const stateBySku = new Map(state.lines.map((line) => [line.sku, line]));
      const { requested, returnedQty } = planGarmentReturn(
        state.lines,
        params.lines,
      );
      let docNumber: string;
      let duplicated = false;
      if (isLocalDemoStockEnabled()) {
        const movement = await applyLocalDemoStockMovement(tx, {
          movementType: "RETURN",
          orderId: production.orderId,
          idempotencyKey: stockGarmentIdempotencyKey(
            production.orderId,
            "RETURN",
            params.idempotencyKey,
          ),
          requested,
          stateLines: state.lines,
        });
        docNumber = movement.docNumber;
      } else {
    const client =
          clientOverride !== undefined
            ? clientOverride
            : await getStockClientFromSettings();
    if (!client) {
          badRequest(
            "ยังไม่ได้ตั้งค่าเชื่อม Anajak Stock — ไปที่ Settings → Stock ก่อน",
          );
    }
    try {
      const movement = await client.createMovement({
        type: "RETURN",
        refNo: state.orderNumber,
        idempotencyKey: stockGarmentIdempotencyKey(
          production.orderId,
          "RETURN",
          params.idempotencyKey,
        ),
            note:
              params.note || `คืนเศษเข้าสต๊อค (ออเดอร์ ${state.orderNumber})`,
        lines: requested.map((line) => ({
          sku: line.sku,
          qty: line.qty,
          toLocation,
          orderRef: state.orderNumber,
        })),
      });
      docNumber = movement.data.docNumber;
      duplicated = movement.data.duplicated === true;
    } catch (err) {
      if (err instanceof StockApiError) badRequest(err.message);
      badRequest(
            `เชื่อมต่อ Anajak Stock ไม่ได้ (${err instanceof Error ? err.message : "unknown"})`,
      );
    }
      }

    const recorded = await tx.materialUsage.findMany({
      where: {
        productionId: production.id,
        stockMovementRef: docNumber,
        movementType: "RETURN",
      },
      select: { quantity: true, note: true },
    });
    if (recorded.length > 0) {
      assertRecordedGarmentFingerprint(recorded, requestFingerprint);
        const recordedQuantity = recorded.reduce(
          (sum, usage) => sum + usage.quantity,
          0,
        );
      await ensureGarmentMovementAudit(tx, {
        movementType: "RETURN",
        docNumber,
        productionId: production.id,
        userId: params.userId,
        lines: params.lines,
        quantity: recordedQuantity,
        requestFingerprint,
        note: params.note,
      });
      return {
        docNumber,
        returnedQty: recordedQuantity,
        alreadyRecorded: true,
      };
    }
    if (duplicated) {
      conflict(
        `การคืนนี้ถูกส่งไป Stock แล้ว (${docNumber}) แต่ ERP ไม่มีหลักฐานยืนยันรายการเดิม — ตรวจสอบเอกสารที่ Stock ก่อนสร้างคำขอใหม่`,
      );
    }

    for (const line of requested) {
      const ref = stateBySku.get(line.sku)!;
      await tx.materialUsage.create({
        data: {
          productionId: production.id,
          productionStepId: params.operationJobId,
          productId: ref.productId,
          productVariantId: ref.variantId,
          quantity: line.qty,
          unit: GARMENT_UNIT,
          movementType: "RETURN",
          note: `${garmentRequestMarker("RETURN", params.idempotencyKey, requestFingerprint)}${params.note ? `\n${params.note}` : ""}`,
          stockMovementRef: docNumber,
          deductedAt: new Date(),
        },
      });
    }
    if (operation) {
      await recordSpecializedOperationEvent(tx, {
        operation,
        commandId: `garment-return:${stockGarmentIdempotencyKey(
          production.orderId,
          "RETURN",
          params.idempotencyKey,
        )}`,
        actorId: params.userId,
        eventType: "MATERIAL_RETURNED",
        payload: { docNumber, returnedQty },
      });
    }
    await addOrderRevision(tx, {
      orderId: production.orderId,
      changedBy: params.userId,
      changeType: "STOCK",
      description: `คืนเศษเข้าสต๊อค ${returnedQty} ตัว (${docNumber})${params.note ? ` — ${params.note}` : ""}`,
    });
    await ensureGarmentMovementAudit(tx, {
      movementType: "RETURN",
      docNumber,
      productionId: production.id,
      userId: params.userId,
      lines: canonicalLines,
      quantity: returnedQty,
      requestFingerprint,
      note: params.note,
    });

    return { docNumber, returnedQty, alreadyRecorded: false };
    },
    { timeout: GARMENT_TRANSACTION_TIMEOUT_MS },
  );
}
