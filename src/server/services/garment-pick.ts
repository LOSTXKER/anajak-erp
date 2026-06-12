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
 * - HTTP ไป Stock อยู่นอก DB transaction · idempotencyKey กันยิงซ้ำ — บันทึกฝั่ง ERP
 *   ลบ-สร้างตาม docNumber (เรียกซ้ำด้วย key เดิมได้แถวชุดเดิม ไม่เบิ้ล)
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
import { addOrderRevision, finalizeProductionIfComplete } from "@/server/services/order-status";
import type { ExtendedPrismaClient } from "@/lib/prisma";

const GARMENT_UNIT = "ตัว";

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
  prisma: ExtendedPrismaClient,
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
  const usageKey = (productId: string, variantId: string | null) =>
    `${productId}:${variantId ?? ""}`;
  const issuedByKey = new Map<string, number>();
  const returnedByKey = new Map<string, number>();
  for (const u of usages) {
    const key = usageKey(u.productId, u.productVariantId);
    const map = u.movementType === "RETURN" ? returnedByKey : issuedByKey;
    map.set(key, (map.get(key) ?? 0) + u.quantity);
  }

  const lines: GarmentPickLine[] = built.lines.map((l) => {
    const key = usageKey(l.productId, l.variantId);
    return {
      ...l,
      needed: l.qty,
      issued: issuedByKey.get(key) ?? 0,
      returned: returnedByKey.get(key) ?? 0,
    };
  });

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
  userRole: string;
}

export async function issueGarments(
  prisma: ExtendedPrismaClient,
  params: IssueGarmentsParams,
  clientOverride?: StockApiClient | null
) {
  const production = await prisma.production.findUniqueOrThrow({
    where: { id: params.productionId },
    select: { id: true, orderId: true },
  });
  const step = await prisma.productionStep.findUniqueOrThrow({
    where: { id: params.stepId },
    select: { id: true, productionId: true, stepType: true, status: true, assignedToId: true },
  });
  if (step.productionId !== production.id) {
    badRequest("ขั้นตอนนี้ไม่อยู่ในใบผลิตนี้");
  }
  if (step.stepType !== "GARMENT_PICK") {
    badRequest("เบิกเสื้อได้เฉพาะขั้น 'เบิกเสื้อจากสต๊อค'");
  }
  // กติกาเดียวกับ updateStep: staff จับงานที่ยังไม่มีเจ้าของได้ (auto-claim) แต่ห้ามแตะงานคนอื่น
  let autoClaim = false;
  if (params.userRole === "PRODUCTION_STAFF") {
    if (step.assignedToId === null) autoClaim = true;
    else if (step.assignedToId !== params.userId) {
      forbidden("งานนี้ถูกมอบหมายให้คนอื่นแล้ว");
    }
  }

  const state = await getGarmentPickState(prisma, production.orderId);
  const stateBySku = new Map(state.lines.map((l) => [l.sku, l]));
  const requested = params.lines.filter((l) => l.qty > 0);
  if (requested.length === 0) badRequest("ยังไม่ได้ระบุจำนวนที่เบิก");
  for (const line of requested) {
    if (!stateBySku.has(line.sku)) {
      badRequest(`รายการ ${line.sku} ไม่อยู่ในรายการเสื้อจากสต๊อคของออเดอร์นี้`);
    }
    if (!Number.isInteger(line.qty)) badRequest(`จำนวนเบิกของ ${line.sku} ต้องเป็นจำนวนเต็ม`);
  }

  const client =
    clientOverride !== undefined ? clientOverride : await getStockClientFromSettings();
  if (!client) {
    badRequest("ยังไม่ได้ตั้งค่าเชื่อม Anajak Stock — ไปที่ Settings → Stock ก่อน");
  }

  // HTTP นอก tx — ของถูกตัดจริงฝั่ง Stock ก่อน แล้วค่อยบันทึกฝั่ง ERP
  // (พลาดกลางทาง: เรียกซ้ำด้วย idempotencyKey เดิม Stock คืนใบเดิม ERP บันทึกซ้ำแบบลบ-สร้าง)
  let docNumber: string;
  try {
    const movement = await client.createMovement({
      type: "ISSUE",
      refNo: state.orderNumber,
      idempotencyKey: params.idempotencyKey,
      note: `เบิกเสื้อใบผลิต (ออเดอร์ ${state.orderNumber})`,
      lines: requested.map((l) => ({
        sku: l.sku,
        qty: l.qty,
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

  const issuedTotalBefore = state.lines.reduce((s, l) => s + l.issued - l.returned, 0);
  const neededTotal = state.lines.reduce((s, l) => s + l.needed, 0);
  const issuedThisRound = requested.reduce((s, l) => s + l.qty, 0);
  const stepDone = issuedTotalBefore + issuedThisRound >= neededTotal;

  await prisma.$transaction(async (tx) => {
    // re-record แบบ idempotent ตามเลขเอกสาร — เรียกซ้ำไม่เบิ้ลแถว
    await tx.materialUsage.deleteMany({ where: { stockMovementRef: docNumber } });
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
  });

  return { docNumber, issuedQty: issuedThisRound, stepCompleted: stepDone };
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
  const production = await prisma.production.findUniqueOrThrow({
    where: { id: params.productionId },
    select: { id: true, orderId: true },
  });

  const state = await getGarmentPickState(prisma, production.orderId);
  const stateBySku = new Map(state.lines.map((l) => [l.sku, l]));
  const requested = params.lines.filter((l) => l.qty > 0);
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
      lines: requested.map((l) => ({
        sku: l.sku,
        qty: l.qty,
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

  const returnedQty = requested.reduce((s, l) => s + l.qty, 0);
  await prisma.$transaction(async (tx) => {
    await tx.materialUsage.deleteMany({ where: { stockMovementRef: docNumber } });
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
          note: params.note,
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
  });

  return { docNumber, returnedQty };
}
