/**
 * จองสต๊อคฝั่ง Anajak Stock ตามออเดอร์ (FLOW-REDESIGN ก้อน 1 — เบสเคาะ 2026-06-12)
 *
 * กติกา:
 * - Stock เป็นเจ้าของตัวเลขจริง (คงเหลือ/จอง/หยิบได้) — ERP เป็นเจ้าของเหตุการณ์
 *   ยืนยันออเดอร์ → จองรายไซส์-สี (variant SKU) · ยกเลิก/ปิดงาน → ปลดจองส่วนที่เหลือ
 * - orderRef = orderNumber (คนคลังเห็นเลขออเดอร์ในแอป Stock ตรงกับใบงานจริง)
 * - การจองฝั่ง Stock เป็นแบบแทนที่ทั้งออเดอร์ (replace) — sync ซ้ำกี่ครั้งก็ได้ผลเท่าเดิม
 * - เรียก "นอก" $transaction เสมอ (HTTP ภายนอก ห้ามถือ lock DB) และห้าม throw —
 *   จองไม่สำเร็จไม่ block การเปลี่ยนสถานะ: บันทึก stockReservationError บนออเดอร์
 *   + แจ้งกระดิ่ง OWNER/MANAGER · ด่านพร้อมผลิตเป็นคนกั้นงานไม่ให้เข้าคิวช่าง
 */

import {
  getStockClientFromSettings,
  StockApiError,
  type StockApiClient,
} from "@/lib/stock-api";
import { createNotification } from "@/server/helpers";
import { addOrderRevision } from "@/server/services/order-status";
import type { ExtendedPrismaClient } from "@/lib/prisma";
import type { InternalStatus } from "@prisma/client";

import {
  buildReserveLines,
  toReserveLines,
} from "@/server/services/stock-reservation-plan";
import {
  getLocalDemoStockAvailability,
  isLocalDemoStockMode,
  lockLocalDemoStock,
} from "@/server/services/local-demo-stock";

export {
  buildReserveLines,
  toReserveLines,
  type BuildReserveLinesResult,
  type MirrorProduct,
  type MirrorVariant,
  type ReservableProduct,
  type ReservableVariant,
  type RichReserveLine,
} from "@/server/services/stock-reservation-plan";

export { STOCK_RESERVATION_PENDING_MESSAGE } from "@/lib/stock-reservation-state";

// แจ้งปัญหาจอง/ปลดจองให้คนที่สั่งงานคลังได้: เจ้าของ + ผู้จัดการ
const NOTIFY_ROLES = ["OWNER", "MANAGER"] as const;

const VERSIONED_RESERVE_STATUSES = new Set<InternalStatus>([
  "CONFIRMED",
  "DESIGNING",
  "DESIGN_APPROVED",
  "PRODUCTION_QUEUE",
  // พักงานยังถือภาระสต๊อคเดิมไว้ ห้ามปลดเพียงเพราะเปลี่ยนเป็น ON_HOLD
  "ON_HOLD",
]);
const VERSIONED_RELEASE_STATUSES = new Set<InternalStatus>([
  "DRAFT",
  "INQUIRY",
  "CANCELLED",
  "COMPLETED",
]);
const MAX_VERSIONED_RECONCILE_ATTEMPTS = 4;
const MANUAL_RESERVATION_CONFLICT_MESSAGE =
  "สถานะออเดอร์เริ่มผลิตแล้วระหว่างอัปเดตสต๊อค — ตรวจยอดจองใน Anajak Stock และแก้ไขด้วยมือก่อนทำต่อ";

// ============================================================
// sync / release
// ============================================================

export type ReservationOutcome =
  | { status: "reserved"; lineCount: number; totalQty: number }
  | { status: "released" }
  | { status: "skipped"; reason: string }
  | { status: "error"; message: string };

async function syncLocalDemoOrderStockReservation(
  prisma: ExtendedPrismaClient,
  params: { orderId: string; changedBy: string },
): Promise<ReservationOutcome> {
  return prisma.$transaction(async (tx) => {
    // ลำดับ lock ของเส้น reservation: order ปัจจุบัน → demo stock mutex เสมอ
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${params.orderId} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({
      where: { id: params.orderId },
      select: {
        id: true,
        orderNumber: true,
        internalStatus: true,
        stockReservedAt: true,
        items: {
          select: {
            products: {
              select: {
                itemSource: true,
                productId: true,
                description: true,
                variants: {
                  select: { size: true, color: true, quantity: true },
                },
              },
            },
          },
        },
      },
    });
    await lockLocalDemoStock(tx);

    const products = order.items.flatMap((item) => item.products);
    const fromStock = products.filter(
      (product) => product.itemSource === "FROM_STOCK" && product.productId,
    );
    const shouldRelease =
      VERSIONED_RELEASE_STATUSES.has(order.internalStatus) ||
      fromStock.length === 0;
    if (shouldRelease) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          stockReservedAt: null,
          stockReservationError: null,
          reservationExpiryWarnedAt: null,
        },
      });
      if (order.stockReservedAt) {
        await addOrderRevision(tx, {
          orderId: order.id,
          changedBy: params.changedBy,
          changeType: "STOCK",
          description: "ปลดจองสต๊อก demo local",
        });
        return { status: "released" };
}
      return { status: "skipped", reason: "ไม่มีรายการที่ต้องจอง" };
}

    if (!VERSIONED_RESERVE_STATUSES.has(order.internalStatus)) {
      await tx.order.update({
        where: { id: order.id },
        data: { stockReservationError: MANUAL_RESERVATION_CONFLICT_MESSAGE },
      });
      return { status: "error", message: MANUAL_RESERVATION_CONFLICT_MESSAGE };
}

    const mirror = await tx.product.findMany({
      where: {
        id: {
          in: [...new Set(fromStock.map((product) => product.productId!))],
        },
      },
      select: {
        id: true,
        sku: true,
        name: true,
        variants: { select: { id: true, sku: true, size: true, color: true } },
      },
    });
    const built = buildReserveLines(fromStock, mirror);
    // Local demo ต้องจองได้ครบทุก product/variant เท่านั้น — ถ้ายอม subset
    // GARMENT_PICK จะเห็นเฉพาะรายการที่ map ได้และอาจปิดขั้นทั้งที่เสื้ออีกตัวหายไป
    if (built.lines.length === 0 || built.problems.length > 0) {
      const message = `จองสต๊อก demo ไม่ได้ — ${built.problems.join(" · ") || "ไม่มีบรรทัดที่จองได้"}`;
      await tx.order.update({
        where: { id: order.id },
        data: { stockReservedAt: null, stockReservationError: message },
      });
      return { status: "error", message };
}

    const usages = await tx.materialUsage.findMany({
      where: { production: { orderId: order.id } },
      select: {
        productId: true,
        productVariantId: true,
        quantity: true,
        movementType: true,
      },
    });
    const usageByVariant = new Map<
      string,
      { issued: number; returned: number }
    >();
    for (const usage of usages) {
      const key = `${usage.productId}:${usage.productVariantId ?? ""}`;
      const totals = usageByVariant.get(key) ?? { issued: 0, returned: 0 };
      if (usage.movementType === "RETURN") totals.returned += usage.quantity;
      else totals.issued += usage.quantity;
      usageByVariant.set(key, totals);
    }
    const stateLines = built.lines.map((line) => {
      const totals = usageByVariant.get(
        `${line.productId}:${line.variantId ?? ""}`,
      ) ?? {
        issued: 0,
        returned: 0,
      };
      return { ...line, needed: line.qty, ...totals };
    });
    const availability = await getLocalDemoStockAvailability(
      tx,
      order.id,
      stateLines,
    );
    const shortages = availability.filter((line) => line.shortage > 0);
    if (shortages.length > 0) {
      const message = `จองสต๊อก demo ไม่ได้ — ${shortages
        .map((line) => `${line.sku} ขาด ${line.shortage} ตัว`)
        .join(" · ")}`;
      await tx.order.update({
        where: { id: order.id },
        data: { stockReservedAt: null, stockReservationError: message },
      });
      await addOrderRevision(tx, {
        orderId: order.id,
        changedBy: params.changedBy,
        changeType: "STOCK",
        description: message,
      });
      return { status: "error", message };
  }

    await tx.order.update({
      where: { id: order.id },
      data: {
        stockReservedAt: new Date(),
        stockReservationError: null,
        reservationExpiryWarnedAt: null,
      },
    });
    await addOrderRevision(tx, {
      orderId: order.id,
      changedBy: params.changedBy,
      changeType: "STOCK",
      description: `จองสต๊อก demo local ${built.lines.length} รายการ (${built.totalQty} ชิ้น)`,
    });
  return {
      status: "reserved",
      lineCount: built.lines.length,
      totalQty: built.totalQty,
  };
  });
}

async function releaseLocalDemoOrderStockReservation(
  prisma: ExtendedPrismaClient,
  params: { orderId: string; changedBy: string; reason: string },
): Promise<ReservationOutcome> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${params.orderId} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({
      where: { id: params.orderId },
      select: { id: true, stockReservedAt: true, stockReservationError: true },
    });
    await lockLocalDemoStock(tx);
    if (!order.stockReservedAt && !order.stockReservationError) {
      return { status: "skipped", reason: "ไม่มียอดจอง" };
    }
    await tx.order.update({
      where: { id: order.id },
      data: {
        stockReservedAt: null,
        stockReservationError: null,
        reservationExpiryWarnedAt: null,
      },
    });
    if (order.stockReservedAt) {
      await addOrderRevision(tx, {
        orderId: order.id,
        changedBy: params.changedBy,
        changeType: "STOCK",
        description: `ปลดจองสต๊อก demo local — ${params.reason}`,
      });
    }
    return { status: "released" };
  });
}

async function notifyReservationProblem(
  prisma: ExtendedPrismaClient,
  order: { id: string; orderNumber: string },
  title: string,
  message: string,
) {
  const staff = await prisma.user.findMany({
    where: { role: { in: [...NOTIFY_ROLES] }, isActive: true },
    select: { id: true },
  });
  for (const user of staff) {
    await createNotification(prisma, {
      userId: user.id,
      type: "SYSTEM",
      title,
      message,
      link: `/orders/${order.id}`,
      entityType: "ORDER",
      entityId: order.id,
    });
  }
}

async function resolveClient(
  clientOverride: StockApiClient | null | undefined,
): Promise<StockApiClient | null> {
  return clientOverride !== undefined
    ? clientOverride
    : getStockClientFromSettings();
}

async function loadReservationSnapshot(
  prisma: ExtendedPrismaClient,
  orderId: string,
) {
  return prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      updatedAt: true,
      internalStatus: true,
      stockReservedAt: true,
      stockReservationError: true,
      items: {
        select: {
          products: {
            select: {
              itemSource: true,
              productId: true,
              description: true,
              variants: {
                select: { size: true, color: true, quantity: true },
              },
            },
          },
        },
      },
    },
  });
}

type ReservationSnapshot = Awaited<ReturnType<typeof loadReservationSnapshot>>;
type ReservationStateUpdate = {
  stockReservedAt?: Date | null;
  stockReservationError?: string | null;
  reservationExpiryWarnedAt?: Date | null;
};

async function updateReservationStateIfCurrent(
  prisma: ExtendedPrismaClient,
  order: ReservationSnapshot,
  data: ReservationStateUpdate,
): Promise<boolean> {
  const updated = await prisma.order.updateMany({
    where: {
      id: order.id,
      updatedAt: order.updatedAt,
      internalStatus: order.internalStatus,
    },
    data,
  });
  return updated.count === 1;
}

async function markManualReservationConflict(
  prisma: ExtendedPrismaClient,
  order: ReservationSnapshot,
  changedBy: string,
): Promise<boolean> {
  const marked = await updateReservationStateIfCurrent(prisma, order, {
    stockReservationError: MANUAL_RESERVATION_CONFLICT_MESSAGE,
  });
  if (!marked) return false;
  await addOrderRevision(prisma, {
    orderId: order.id,
    changedBy,
    changeType: "STOCK",
    description: MANUAL_RESERVATION_CONFLICT_MESSAGE,
  });
  await notifyReservationProblem(
    prisma,
    order,
    `ต้องตรวจยอดจองสต๊อคด้วยมือ — ${order.orderNumber}`,
    MANUAL_RESERVATION_CONFLICT_MESSAGE,
  );
  return true;
}

/**
 * saveForm ส่ง version หลัง commit มาให้เส้นนี้: HTTP เกิดนอก transaction จึงใช้ CAS
 * หลัง response ทุกครั้ง ถ้า version/status เปลี่ยนระหว่างรอ จะ apply desired state ล่าสุดซ้ำ
 * แทนการปล่อย response เก่าเขียน DB หรือจองค่ารอบเก่ากลับเข้า Stock
 */
async function syncVersionedOrderStockReservation(
  prisma: ExtendedPrismaClient,
  params: { orderId: string; changedBy: string; expectedUpdatedAt: Date },
  clientOverride?: StockApiClient | null,
): Promise<ReservationOutcome> {
  let externalStateMayBeStale = false;

  for (
    let attempt = 0;
    attempt < MAX_VERSIONED_RECONCILE_ATTEMPTS;
    attempt += 1
  ) {
    const order = await loadReservationSnapshot(prisma, params.orderId);

    if (
      !VERSIONED_RESERVE_STATUSES.has(order.internalStatus) &&
      !VERSIONED_RELEASE_STATUSES.has(order.internalStatus)
    ) {
      // PRODUCING เป็นต้นไปอาจเริ่มเบิกและ consume reservation แล้ว: ห้าม replace/release
      // อัตโนมัติ เพราะจะสร้างยอดจองใหม่หรือปล่อยของที่ยังใช้จริง
      if (
        await markManualReservationConflict(prisma, order, params.changedBy)
      ) {
        return {
          status: "error",
          message: MANUAL_RESERVATION_CONFLICT_MESSAGE,
        };
      }
      continue;
    }

    const products = order.items.flatMap((item) => item.products);
    const fromStock = products.filter(
      (product) => product.itemSource === "FROM_STOCK" && product.productId,
    );
    const shouldReserve =
      VERSIONED_RESERVE_STATUSES.has(order.internalStatus) &&
      fromStock.length > 0;

    if (!shouldReserve) {
      const mustRelease = externalStateMayBeStale || !!order.stockReservedAt;
      if (!mustRelease) {
        const cleared = await updateReservationStateIfCurrent(prisma, order, {
          stockReservationError: null,
          reservationExpiryWarnedAt: null,
        });
        if (!cleared) continue;
        return { status: "skipped", reason: "ไม่มีรายการที่ต้องจอง" };
      }

      const client = await resolveClient(clientOverride);
      if (!client) {
        const message =
          "ปลดจองไม่ได้ — ยังไม่ได้ตั้งค่าเชื่อม Anajak Stock (ยอดจองอาจค้างอยู่ฝั่ง Stock)";
        const marked = await updateReservationStateIfCurrent(prisma, order, {
          stockReservationError: message,
        });
        if (!marked) {
          externalStateMayBeStale = true;
          continue;
        }
        return { status: "error", message };
      }

      try {
        await client.releaseReservations(order.orderNumber);
      } catch (err) {
        const message = `ปลดจองไม่สำเร็จ: ${
          err instanceof Error ? err.message : "unknown"
        } — ยอดจองอาจค้างอยู่ฝั่ง Stock`;
        const marked = await updateReservationStateIfCurrent(prisma, order, {
          stockReservationError: message,
        });
        if (!marked) {
          externalStateMayBeStale = true;
          continue;
        }
        await notifyReservationProblem(
          prisma,
          order,
          `ปลดจองสต๊อคไม่สำเร็จ — ${order.orderNumber}`,
          message,
        );
        return { status: "error", message };
      }

      const cleared = await updateReservationStateIfCurrent(prisma, order, {
        stockReservedAt: null,
        stockReservationError: null,
        reservationExpiryWarnedAt: null,
      });
      if (!cleared) {
        externalStateMayBeStale = true;
        continue;
      }
      await addOrderRevision(prisma, {
        orderId: order.id,
        changedBy: params.changedBy,
        changeType: "STOCK",
        description: `ปลดจองสต๊อค — reconcile สถานะ ${order.internalStatus}`,
      });
      return { status: "released" };
    }

    const client = await resolveClient(clientOverride);
    if (!client) {
      const message =
        "ยังไม่ได้ตั้งค่าเชื่อม Anajak Stock — ยังไม่ได้จองของ (ตั้งค่าที่ Settings → Stock)";
      const marked = await updateReservationStateIfCurrent(prisma, order, {
        stockReservationError: message,
      });
      if (!marked) continue;
      return { status: "skipped", reason: "ยังไม่ได้ตั้งค่า Stock API" };
    }

    const mirror = await prisma.product.findMany({
      where: {
        id: {
          in: [...new Set(fromStock.map((product) => product.productId!))],
        },
      },
      select: {
        id: true,
        sku: true,
        name: true,
        variants: { select: { id: true, sku: true, size: true, color: true } },
      },
    });
    const built = buildReserveLines(fromStock, mirror);
    if (built.lines.length === 0) {
      const message = `จองสต๊อคไม่ได้ — ${
        built.problems.join(" · ") || "ไม่มีบรรทัดที่จองได้"
      }`;
      const marked = await updateReservationStateIfCurrent(prisma, order, {
        stockReservationError: message,
      });
      if (!marked) continue;
      return { status: "error", message };
    }

    try {
      await client.reserveForOrder({
        orderRef: order.orderNumber,
        lines: toReserveLines(built.lines),
      });
    } catch (err) {
      const message =
        err instanceof StockApiError
          ? err.message
          : `เชื่อมต่อ Anajak Stock ไม่ได้ (${
              err instanceof Error ? err.message : "unknown"
            })`;
      const marked = await updateReservationStateIfCurrent(prisma, order, {
        stockReservationError: message,
      });
      if (!marked) {
        // timeout อาจเกิดหลัง Stock commit แล้ว จึงถือว่า external state ต้อง reconcile
        externalStateMayBeStale = true;
        continue;
      }
      await addOrderRevision(prisma, {
        orderId: order.id,
        changedBy: params.changedBy,
        changeType: "STOCK",
        description: `จองสต๊อคไม่สำเร็จ: ${message}`,
      });
      await notifyReservationProblem(
        prisma,
        order,
        `จองสต๊อคไม่สำเร็จ — ${order.orderNumber}`,
        message,
      );
      return { status: "error", message };
    }

    const marked = await updateReservationStateIfCurrent(prisma, order, {
      stockReservedAt: new Date(),
      stockReservationError: null,
      reservationExpiryWarnedAt: null,
    });
    if (!marked) {
      externalStateMayBeStale = true;
      continue;
    }
    const problemSuffix =
      built.problems.length > 0
        ? ` · หมายเหตุ: ${built.problems.join(" · ")}`
        : "";
    await addOrderRevision(prisma, {
      orderId: order.id,
      changedBy: params.changedBy,
      changeType: "STOCK",
      description: `จองสต๊อค ${built.lines.length} รายการ (${built.totalQty} ชิ้น)${problemSuffix}`,
    });
    return {
      status: "reserved",
      lineCount: built.lines.length,
      totalQty: built.totalQty,
    };
  }

  const latest = await loadReservationSnapshot(prisma, params.orderId);
  const message =
    "ออเดอร์ถูกแก้พร้อมกันหลายรอบระหว่างอัปเดตสต๊อค — ตรวจยอดจองแล้วกดจองใหม่";
  if (
    await updateReservationStateIfCurrent(prisma, latest, {
      stockReservationError: message,
    })
  ) {
    await notifyReservationProblem(
      prisma,
      latest,
      `ต้องตรวจยอดจองสต๊อค — ${latest.orderNumber}`,
      message,
    );
  }
  return { status: "error", message };
}

/**
 * จอง/จองใหม่ตามเนื้อออเดอร์ปัจจุบัน (แทนที่ยอดจองเดิมทั้งออเดอร์) — เรียกหลังยืนยันออเดอร์
 * และหลังแก้รายการช่วงที่ยังไม่เริ่มผลิต · ออเดอร์ไม่มีของจากสต๊อคแล้ว = ปลดจองเดิมอัตโนมัติ
 */
export async function syncOrderStockReservation(
  prisma: ExtendedPrismaClient,
  params: { orderId: string; changedBy: string; expectedUpdatedAt?: Date },
  clientOverride?: StockApiClient | null,
): Promise<ReservationOutcome> {
  try {
    if (isLocalDemoStockMode()) {
      return await syncLocalDemoOrderStockReservation(prisma, params);
    }
    if (params.expectedUpdatedAt) {
      return await syncVersionedOrderStockReservation(
        prisma,
        {
          orderId: params.orderId,
          changedBy: params.changedBy,
          expectedUpdatedAt: params.expectedUpdatedAt,
        },
        clientOverride,
      );
    }
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: params.orderId },
      select: {
        id: true,
        orderNumber: true,
        stockReservedAt: true,
        items: {
          select: {
            products: {
              select: {
                itemSource: true,
                productId: true,
                description: true,
                variants: {
                  select: { size: true, color: true, quantity: true },
                },
              },
            },
          },
        },
      },
    });

    const products = order.items.flatMap((it) => it.products);
    const fromStock = products.filter(
      (p) => p.itemSource === "FROM_STOCK" && p.productId,
    );

    // ไม่มีของจากสต๊อค: เคยจองไว้ → ปลดทิ้ง (รายการถูกแก้ออก) · ไม่เคย → ไม่ต้องทำอะไร
    if (fromStock.length === 0) {
      if (!order.stockReservedAt) {
        // saveForm ตั้ง pending marker ก่อนออกจาก transaction เพื่อกันเปิดผลิตระหว่าง
        // รอ HTTP; ถ้ารายการใหม่ไม่มีของสต๊อคเลย ต้องล้าง marker นี้ด้วย
        await prisma.order.update({
          where: { id: order.id },
          data: {
            stockReservationError: null,
            reservationExpiryWarnedAt: null,
          },
        });
        return { status: "skipped", reason: "ไม่มีรายการจากสต๊อค" };
      }
      return releaseOrderStockReservation(
        prisma,
        {
          orderId: params.orderId,
          changedBy: params.changedBy,
          reason: "รายการจากสต๊อคถูกแก้ออก",
        },
        clientOverride,
      );
    }

    const client = await resolveClient(clientOverride);
    if (!client) {
      // มีของจากสต๊อคแต่ยังไม่ได้ต่อท่อ — จดบนออเดอร์ให้เห็น (ไม่แจ้งกระดิ่ง กัน spam ช่วงยังไม่ตั้งค่า)
      await prisma.order.update({
        where: { id: order.id },
        data: {
          stockReservationError:
            "ยังไม่ได้ตั้งค่าเชื่อม Anajak Stock — ยังไม่ได้จองของ (ตั้งค่าที่ Settings → Stock)",
        },
      });
      return { status: "skipped", reason: "ยังไม่ได้ตั้งค่า Stock API" };
    }

    const mirror = await prisma.product.findMany({
      where: { id: { in: [...new Set(fromStock.map((p) => p.productId!))] } },
      select: {
        id: true,
        sku: true,
        name: true,
        variants: { select: { id: true, sku: true, size: true, color: true } },
      },
    });

    const built = buildReserveLines(fromStock, mirror);
    if (built.lines.length === 0) {
      const message = `จองสต๊อคไม่ได้ — ${built.problems.join(" · ") || "ไม่มีบรรทัดที่จองได้"}`;
      await prisma.order.update({
        where: { id: order.id },
        data: { stockReservationError: message },
      });
      return { status: "error", message };
    }

    try {
      await client.reserveForOrder({
        orderRef: order.orderNumber,
        lines: toReserveLines(built.lines),
      });
    } catch (err) {
      const message =
        err instanceof StockApiError
          ? err.message
          : `เชื่อมต่อ Anajak Stock ไม่ได้ (${err instanceof Error ? err.message : "unknown"})`;
      await prisma.order.update({
        where: { id: order.id },
        data: { stockReservationError: message },
      });
      await addOrderRevision(prisma, {
        orderId: order.id,
        changedBy: params.changedBy,
        changeType: "STOCK",
        description: `จองสต๊อคไม่สำเร็จ: ${message}`,
      });
      await notifyReservationProblem(
        prisma,
        order,
        `จองสต๊อคไม่สำเร็จ — ${order.orderNumber}`,
        message,
      );
      return { status: "error", message };
    }

    await prisma.order.update({
      where: { id: order.id },
      // จองใหม่ = เริ่มนับอายุการจองใหม่ → ล้างธงเตือนใกล้ปลดด้วย (auto-release)
      data: {
        stockReservedAt: new Date(),
        stockReservationError: null,
        reservationExpiryWarnedAt: null,
      },
    });
    const problemSuffix =
      built.problems.length > 0
        ? ` · หมายเหตุ: ${built.problems.join(" · ")}`
        : "";
    await addOrderRevision(prisma, {
      orderId: order.id,
      changedBy: params.changedBy,
      changeType: "STOCK",
      description: `จองสต๊อค ${built.lines.length} รายการ (${built.totalQty} ชิ้น)${problemSuffix}`,
    });
    return {
      status: "reserved",
      lineCount: built.lines.length,
      totalQty: built.totalQty,
    };
  } catch (err) {
    // ห้าม throw — สถานะออเดอร์เปลี่ยนสำเร็จไปแล้ว อย่าทำให้ mutation ที่ commit แล้วล้ม
    console.error("syncOrderStockReservation error:", err);
    return {
      status: "error",
      message: err instanceof Error ? err.message : "unknown error",
    };
  }
}

/** ปลดจองทั้งออเดอร์ (ยกเลิก/ปิดงาน/รายการจากสต๊อคถูกแก้ออก) — ของที่เบิกไปแล้วไม่ได้รับผลกระทบ */
export async function releaseOrderStockReservation(
  prisma: ExtendedPrismaClient,
  params: { orderId: string; changedBy: string; reason: string },
  clientOverride?: StockApiClient | null,
): Promise<ReservationOutcome> {
  try {
    if (isLocalDemoStockMode()) {
      return await releaseLocalDemoOrderStockReservation(prisma, params);
    }
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: params.orderId },
      select: {
        id: true,
        orderNumber: true,
        stockReservedAt: true,
        stockReservationError: true,
      },
    });

    // ไม่เคยจอง + ไม่มี error ค้าง = ไม่มีอะไรต้องปลด
    if (!order.stockReservedAt && !order.stockReservationError) {
      return { status: "skipped", reason: "ไม่มียอดจอง" };
    }

    const client = await resolveClient(clientOverride);
    if (!client) {
      if (order.stockReservedAt) {
        // เคยจองจริงแต่ตอนนี้ต่อท่อไม่ได้ — ยอดจองค้างฝั่ง Stock จะขวางงานอื่น ต้องมีคนตามแก้
        const message =
          "ปลดจองไม่ได้ — ยังไม่ได้ตั้งค่าเชื่อม Anajak Stock (ยอดจองค้างอยู่ฝั่ง Stock)";
        await prisma.order.update({
          where: { id: order.id },
          data: { stockReservationError: message },
        });
        return { status: "error", message };
      }
      // มีแต่ error ค้าง (ไม่เคยจองสำเร็จ) — ล้างทิ้งได้เลย
      await prisma.order.update({
        where: { id: order.id },
        data: { stockReservationError: null },
      });
      return { status: "released" };
    }

    try {
      await client.releaseReservations(order.orderNumber);
    } catch (err) {
      const message = `ปลดจองไม่สำเร็จ: ${err instanceof Error ? err.message : "unknown"} — ยอดจองค้างอยู่ฝั่ง Stock`;
      await prisma.order.update({
        where: { id: order.id },
        data: { stockReservationError: message },
      });
      await notifyReservationProblem(
        prisma,
        order,
        `ปลดจองสต๊อคไม่สำเร็จ — ${order.orderNumber}`,
        `${message} (${params.reason})`,
      );
      return { status: "error", message };
    }

    // ปลดแบบ atomic — ชิงสิทธิ์ด้วย stockReservedAt!=null กัน sweep ซ้อน (cron+list) ปลด/แจ้ง/จดประวัติซ้ำ
    // (HTTP release ด้านบน idempotent: ปลด orderRef เดิมซ้ำไม่ลดของเกิน — แต่ฝั่ง DB ต้องนับ/จดครั้งเดียว)
    const cleared = await prisma.order.updateMany({
      where: { id: order.id, stockReservedAt: { not: null } },
      data: {
        stockReservedAt: null,
        stockReservationError: null,
        reservationExpiryWarnedAt: null,
      },
    });
    if (cleared.count === 0) {
      if (order.stockReservedAt) {
        // ตอนอ่านยังจองอยู่ แต่หายไประหว่างนั้น = มีรอบอื่นปลดไปก่อน — ไม่ใช่เราปลด ไม่จดประวัติ/ไม่นับ
        return { status: "skipped", reason: "ปลดไปแล้วระหว่างนั้น" };
      }
      // เคส error-only (ไม่เคยจองสำเร็จ แค่มี error ค้าง) — เคลียร์ error ทิ้งได้เลย
      await prisma.order.update({
        where: { id: order.id },
        data: { stockReservationError: null },
      });
      return { status: "released" };
    }
    await addOrderRevision(prisma, {
      orderId: order.id,
      changedBy: params.changedBy,
      changeType: "STOCK",
      description: `ปลดจองสต๊อค — ${params.reason}`,
    });
    return { status: "released" };
  } catch (err) {
    console.error("releaseOrderStockReservation error:", err);
    return {
      status: "error",
      message: err instanceof Error ? err.message : "unknown error",
    };
  }
}
