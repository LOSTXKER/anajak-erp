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

import { badRequest, forbidden } from "@/server/errors";
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
import { addOrderRevision, finalizeProductionIfComplete } from "@/server/services/order-status";
import type { ExtendedPrismaClient, PrismaTx } from "@/lib/prisma";

const GARMENT_UNIT = "ตัว";
const GARMENT_TRANSACTION_TIMEOUT_MS = 20_000;

function garmentIdempotencyMarker(
  movementType: "ISSUE" | "RETURN",
  idempotencyKey: string,
) {
  return `[erp-garment:${movementType}:${idempotencyKey}]`;
}

async function findRecordedGarmentMovement(
  tx: PrismaTx,
  params: {
    orderId: string;
    movementType: "ISSUE" | "RETURN";
    idempotencyKey: string;
  },
) {
  const marker = garmentIdempotencyMarker(params.movementType, params.idempotencyKey);
  const rows = await tx.materialUsage.findMany({
    where: {
      production: { orderId: params.orderId },
      movementType: params.movementType,
      note: { startsWith: marker },
    },
    select: { quantity: true, stockMovementRef: true },
  });
  const docNumber = rows.find((row) => row.stockMovementRef)?.stockMovementRef ?? null;
  if (!docNumber) return null;
  return {
    docNumber,
    quantity: rows.reduce((sum, row) => sum + row.quantity, 0),
  };
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
  orderId: string
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

  return { orderId, orderNumber: order.orderNumber, lines, problems: built.problems };
}

// ============================================================
// เบิกเสื้อ (ISSUE + orderRef → Stock ตัดยอดจองอัตโนมัติ)
// ============================================================

interface IssueGarmentsParams {
  productionId: string;
  stepId: string;
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
  clientOverride?: StockApiClient | null
) {
  return prisma.$transaction(async (tx) => {
    // ลำดับเดียวกับ updateStep/finalizer: step → production → order. order lock เป็นตัว
    // serialize ยอด MaterialUsage รวมทุกใบผลิตของออเดอร์เดียวกัน และต้องถือผ่าน Stock HTTP
    await tx.$queryRaw`SELECT id FROM production_steps WHERE id = ${params.stepId} FOR UPDATE`;
    const step = await tx.productionStep.findUniqueOrThrow({
      where: { id: params.stepId },
      select: { id: true, productionId: true, stepType: true, status: true, assignedToId: true },
    });
    if (step.productionId !== params.productionId) {
      badRequest("ขั้นตอนนี้ไม่อยู่ในใบผลิตนี้");
    }
    if (step.stepType !== "GARMENT_PICK") {
      badRequest("เบิกเสื้อได้เฉพาะขั้น 'เบิกเสื้อจากสต๊อค'");
    }

    await tx.$queryRaw`SELECT id FROM productions WHERE id = ${params.productionId} FOR UPDATE`;
    const production = await tx.production.findUniqueOrThrow({
      where: { id: params.productionId },
      select: { id: true, orderId: true },
    });
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${production.orderId} FOR UPDATE`;

    // กติกาเดียวกับ updateStep (PERM) แต่ตัดสินจาก assignee หลัง lock เท่านั้น
    let autoClaim = false;
    if (!params.canSupervise) {
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
    });
    if (replay) {
      return {
        docNumber: replay.docNumber,
        issuedQty: replay.quantity,
        stepCompleted: step.status === "COMPLETED",
        alreadyRecorded: true,
      };
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
    const { requested, issuedThisRound, neededTotal, stepDone } = planGarmentIssue(
      state.lines,
      params.lines
    );
    const client =
      clientOverride !== undefined ? clientOverride : await getStockClientFromSettings();
    if (!client) {
      badRequest("ยังไม่ได้ตั้งค่าเชื่อม Anajak Stock — ไปที่ Settings → Stock ก่อน");
    }

    let docNumber: string;
    try {
      const movement = await client.createMovement({
        type: "ISSUE",
        refNo: state.orderNumber,
        idempotencyKey: params.idempotencyKey,
        note: `เบิกเสื้อใบผลิต (ออเดอร์ ${state.orderNumber})`,
        lines: requested.map((line) => ({
          sku: line.sku,
          qty: line.qty,
          fromLocation: params.fromLocation ?? DEFAULT_STOCK_LOCATION,
          orderRef: state.orderNumber,
        })),
      });
      docNumber = movement.data.docNumber;
    } catch (err) {
      if (err instanceof StockApiError) badRequest(err.message);
      badRequest(
        `เชื่อมต่อ Anajak Stock ไม่ได้ (${err instanceof Error ? err.message : "unknown"})`
      );
    }

    // local transaction เดิมบันทึก usage+step+revision พร้อมกัน: พบ doc แล้วแปลว่า commit
    // รอบแรกครบทั้งก้อน จึงต้อง no-op ไม่ increment qtyDone/revision ซ้ำ
    const recorded = await tx.materialUsage.findMany({
      where: { stockMovementRef: docNumber, movementType: "ISSUE" },
      select: { quantity: true },
    });
    if (recorded.length > 0) {
      return {
        docNumber,
        issuedQty: recorded.reduce((sum, usage) => sum + usage.quantity, 0),
        stepCompleted: step.status === "COMPLETED",
        alreadyRecorded: true,
      };
    }

    for (const line of requested) {
      const ref = stateBySku.get(line.sku)!;
      await tx.materialUsage.create({
        data: {
          productionId: production.id,
          productId: ref.productId,
          productVariantId: ref.variantId,
          quantity: line.qty,
          unit: GARMENT_UNIT,
          movementType: "ISSUE",
          note: garmentIdempotencyMarker("ISSUE", params.idempotencyKey),
          stockMovementRef: docNumber,
          deductedAt: new Date(),
        },
      });
    }

    // เดินสถานะขั้น: เบิกครบ = เสร็จ · เบิกบางส่วน = กำลังทำ (ขั้นที่ปิดไปแล้วไม่ถอย)
    // qty บนขั้นวิ่งตามยอดเบิกจริง — บอกบนบอร์ดได้ว่าเบิกถึงไหน
    if (step.status !== "COMPLETED") {
      await tx.productionStep.update({
        where: { id: step.id },
        data: {
          qtyDone: { increment: issuedThisRound },
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

    return {
      docNumber,
      issuedQty: issuedThisRound,
      stepCompleted: stepDone,
      alreadyRecorded: false,
    };
  }, { timeout: GARMENT_TRANSACTION_TIMEOUT_MS });
}

// ============================================================
// คืนเศษกลับสต๊อค (RETURN)
// ============================================================

interface ReturnGarmentsParams {
  productionId: string;
  lines: Array<{ sku: string; qty: number }>;
  note?: string;
  idempotencyKey: string;
  toLocation?: string;
  userId: string;
}

export async function returnGarments(
  prisma: ExtendedPrismaClient,
  params: ReturnGarmentsParams,
  clientOverride?: StockApiClient | null
) {
  return prisma.$transaction(async (tx) => {
    // RETURN ไม่มี stepId จึงเริ่มที่ production แล้วใช้ order lock serialize ยอดรวมทุกใบผลิต
    await tx.$queryRaw`SELECT id FROM productions WHERE id = ${params.productionId} FOR UPDATE`;
    const production = await tx.production.findUniqueOrThrow({
      where: { id: params.productionId },
      select: { id: true, orderId: true },
    });
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${production.orderId} FOR UPDATE`;

    const replay = await findRecordedGarmentMovement(tx, {
      orderId: production.orderId,
      movementType: "RETURN",
      idempotencyKey: params.idempotencyKey,
    });
    if (replay) {
      return {
        docNumber: replay.docNumber,
        returnedQty: replay.quantity,
        alreadyRecorded: true,
      };
    }

    const state = await getGarmentPickState(tx, production.orderId);
    const stateBySku = new Map(state.lines.map((line) => [line.sku, line]));
    const { requested, returnedQty } = planGarmentReturn(state.lines, params.lines);
    const client =
      clientOverride !== undefined ? clientOverride : await getStockClientFromSettings();
    if (!client) {
      badRequest("ยังไม่ได้ตั้งค่าเชื่อม Anajak Stock — ไปที่ Settings → Stock ก่อน");
    }

    let docNumber: string;
    try {
      const movement = await client.createMovement({
        type: "RETURN",
        refNo: state.orderNumber,
        idempotencyKey: params.idempotencyKey,
        note: params.note || `คืนเศษเข้าสต๊อค (ออเดอร์ ${state.orderNumber})`,
        lines: requested.map((line) => ({
          sku: line.sku,
          qty: line.qty,
          toLocation: params.toLocation ?? DEFAULT_STOCK_LOCATION,
          orderRef: state.orderNumber,
        })),
      });
      docNumber = movement.data.docNumber;
    } catch (err) {
      if (err instanceof StockApiError) badRequest(err.message);
      badRequest(
        `เชื่อมต่อ Anajak Stock ไม่ได้ (${err instanceof Error ? err.message : "unknown"})`
      );
    }

    const recorded = await tx.materialUsage.findMany({
      where: { stockMovementRef: docNumber, movementType: "RETURN" },
      select: { quantity: true },
    });
    if (recorded.length > 0) {
      return {
        docNumber,
        returnedQty: recorded.reduce((sum, usage) => sum + usage.quantity, 0),
        alreadyRecorded: true,
      };
    }

    for (const line of requested) {
      const ref = stateBySku.get(line.sku)!;
      await tx.materialUsage.create({
        data: {
          productionId: production.id,
          productId: ref.productId,
          productVariantId: ref.variantId,
          quantity: line.qty,
          unit: GARMENT_UNIT,
          movementType: "RETURN",
          note: `${garmentIdempotencyMarker("RETURN", params.idempotencyKey)}${params.note ? `\n${params.note}` : ""}`,
          stockMovementRef: docNumber,
          deductedAt: new Date(),
        },
      });
    }
    await addOrderRevision(tx, {
      orderId: production.orderId,
      changedBy: params.userId,
      changeType: "STOCK",
      description: `คืนเศษเข้าสต๊อค ${returnedQty} ตัว (${docNumber})${params.note ? ` — ${params.note}` : ""}`,
    });

    return { docNumber, returnedQty, alreadyRecorded: false };
  }, { timeout: GARMENT_TRANSACTION_TIMEOUT_MS });
}
