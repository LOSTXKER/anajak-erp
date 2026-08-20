import { createHash } from "node:crypto";
import { badRequest, conflict } from "@/server/errors";
import { validateDemoDatabaseUrl } from "@/lib/demo-seed-plan";
import type { PrismaTx } from "@/lib/prisma";
import {
  buildReserveLines,
  type RichReserveLine,
} from "@/server/services/stock-reservation-plan";

const ACTIVE_RESERVATION_STATUSES = [
  "CONFIRMED",
  "DESIGNING",
  "DESIGN_APPROVED",
  "PRODUCTION_QUEUE",
  "PRODUCING",
  "QUALITY_CHECK",
  "PACKING",
  "READY_TO_SHIP",
  "SHIPPED",
  "ON_HOLD",
] as const;

export type LocalDemoStockMode = "demo-local" | "api" | "unconfigured";

export type LocalDemoAvailability = {
  sku: string;
  onHand: number;
  reservedForOtherOrders: number;
  availableToThisOrder: number;
  remainingNeeded: number;
  shortage: number;
};

type LocalDemoLine = RichReserveLine & {
  needed: number;
  issued: number;
  returned: number;
};

type LocalDemoEnv = {
  [key: string]: string | undefined;
  ANAJAK_ERP_DEMO_MODE?: string;
  DATABASE_URL?: string;
};

export function isLocalDemoStockEnabled(
  env: LocalDemoEnv = process.env,
): boolean {
  if (env.ANAJAK_ERP_DEMO_MODE !== "1") return false;
  // ถ้าเปิด flag แล้วฐานไม่ใช่ local demo ต้องหยุดทันที ห้ามคืน false แล้วปล่อย
  // caller ไหลต่อไป production/API branch ซึ่งอาจเขียน error marker ลงฐานจริง
  validateDemoDatabaseUrl(env.DATABASE_URL);
  return true;
}

export const isLocalDemoStockMode = isLocalDemoStockEnabled;

export async function lockLocalDemoStock(tx: PrismaTx): Promise<void> {
  await tx.$queryRaw<Array<{ lock_result: string }>>`
    SELECT pg_advisory_xact_lock(
      hashtext('anajak:local-demo-stock'),
      hashtext('variants-and-derived-reservations')
    )::text AS lock_result
  `;
}

export function localDemoStockDocumentNumber(
  movementType: "ISSUE" | "RETURN",
  idempotencyKey: string,
): string {
  const digest = createHash("sha256").update(idempotencyKey).digest("hex");
  return `DEMO-${movementType}-${digest.slice(0, 12).toUpperCase()}`;
}

function assertVariantBackedLines(
  lines: Array<Pick<RichReserveLine, "sku" | "variantId">>,
): void {
  const productLevel = lines.find((line) => line.variantId === null);
  if (productLevel) {
    badRequest(
      `สต๊อก demo เบิก/จองระดับสินค้าไม่ได้ (${productLevel.sku}) — ต้องระบุไซส์และสีที่ตรงกับ variant`,
    );
  }
}

function usageKey(productId: string, variantId: string) {
  return `${productId}:${variantId}`;
}

function remainingBySku(
  lines: RichReserveLine[],
  usages: Array<{
    productId: string;
    productVariantId: string | null;
    quantity: number;
    movementType: string;
  }>,
): Map<string, number> {
  assertVariantBackedLines(lines);
  const netByVariant = new Map<string, number>();
  for (const usage of usages) {
    if (!usage.productVariantId) continue;
    const key = usageKey(usage.productId, usage.productVariantId);
    const direction = usage.movementType === "RETURN" ? -1 : 1;
    netByVariant.set(
      key,
      (netByVariant.get(key) ?? 0) + direction * usage.quantity,
    );
  }

  const result = new Map<string, number>();
  for (const line of lines) {
    const netIssued =
      netByVariant.get(usageKey(line.productId, line.variantId!)) ?? 0;
    result.set(
      line.sku,
      (result.get(line.sku) ?? 0) + Math.max(0, line.qty - netIssued),
    );
  }
  return result;
}

async function reservedForOtherOrdersBySku(
  tx: PrismaTx,
  currentOrderId: string,
): Promise<Map<string, number>> {
  const orders = await tx.order.findMany({
    where: {
      id: { not: currentOrderId },
      stockReservedAt: { not: null },
      internalStatus: { in: [...ACTIVE_RESERVATION_STATUSES] },
    },
    select: {
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
      productions: {
        select: {
          materialUsages: {
            select: {
              productId: true,
              productVariantId: true,
              quantity: true,
              movementType: true,
            },
          },
        },
      },
    },
  });

  const productIds = [
    ...new Set(
      orders.flatMap((order) =>
        order.items.flatMap((item) =>
          item.products
            .filter(
              (product) =>
                product.itemSource === "FROM_STOCK" && product.productId,
            )
            .map((product) => product.productId!),
        ),
      ),
    ),
  ];
  if (productIds.length === 0) return new Map();

  const mirror = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      sku: true,
      name: true,
      variants: { select: { id: true, sku: true, size: true, color: true } },
    },
  });
  const total = new Map<string, number>();
  for (const order of orders) {
    const products = order.items.flatMap((item) => item.products);
    const built = buildReserveLines(products, mirror);
    const usages = order.productions.flatMap(
      (production) => production.materialUsages,
    );
    for (const [sku, qty] of remainingBySku(built.lines, usages)) {
      total.set(sku, (total.get(sku) ?? 0) + qty);
    }
  }
  return total;
}

export async function getLocalDemoStockAvailability(
  tx: PrismaTx,
  currentOrderId: string,
  lines: LocalDemoLine[],
): Promise<LocalDemoAvailability[]> {
  assertVariantBackedLines(lines);
  if (lines.length === 0) return [];

  const variants = await tx.productVariant.findMany({
    where: { id: { in: lines.map((line) => line.variantId!) } },
    select: { id: true, sku: true, stock: true, totalStock: true },
  });
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));
  const reservedForOther = await reservedForOtherOrdersBySku(
    tx,
    currentOrderId,
  );

  return lines.map((line) => {
    const variant = variantById.get(line.variantId!);
    if (!variant || variant.sku !== line.sku) {
      badRequest(`ไม่พบ variant สต๊อก demo ที่ตรงกับ ${line.sku}`);
    }
    if (variant.stock !== variant.totalStock) {
      badRequest(
        `${line.sku}: ยอด stock กับ totalStock ของฐาน demo ไม่ตรงกัน กรุณา reset demo ใหม่`,
      );
    }
    const onHand = variant.stock;
    const otherReserved = reservedForOther.get(line.sku) ?? 0;
    const availableToThisOrder = Math.max(0, onHand - otherReserved);
    const remainingNeeded = Math.max(
      0,
      line.needed - line.issued + line.returned,
    );
    return {
      sku: line.sku,
      onHand,
      reservedForOtherOrders: otherReserved,
      availableToThisOrder,
      remainingNeeded,
      shortage: Math.max(0, remainingNeeded - availableToThisOrder),
    };
  });
}

async function syncProductTotalStock(
  tx: PrismaTx,
  productIds: Iterable<string>,
) {
  for (const productId of new Set(productIds)) {
    const aggregate = await tx.productVariant.aggregate({
      where: { productId },
      _sum: { stock: true },
    });
    await tx.product.update({
      where: { id: productId },
      data: { totalStock: aggregate._sum.stock ?? 0 },
    });
  }
}

export async function applyLocalDemoStockMovement(
  tx: PrismaTx,
  params: {
    movementType: "ISSUE" | "RETURN";
    orderId: string;
    idempotencyKey: string;
    requested: Array<{ sku: string; qty: number }>;
    stateLines: LocalDemoLine[];
  },
): Promise<{ docNumber: string }> {
  // Defense in depth: helper ที่เขียนยอดต้อง fail-closed ด้วยตัวเอง ไม่พึ่ง caller
  // เลือก branch ถูก เพราะ caller ใหม่ในอนาคตอาจเรียกผิดขณะ DATABASE_URL ชี้ฐานจริง
  if (!isLocalDemoStockEnabled()) {
    badRequest("ใช้สต๊อกทดสอบได้เฉพาะโหมด demo บนฐาน local ที่กำหนดเท่านั้น");
  }
  assertVariantBackedLines(params.stateLines);
  const requestedBySku = new Map<string, number>();
  for (const line of params.requested) {
    if (!Number.isInteger(line.qty) || line.qty <= 0) {
      badRequest(`จำนวนของ ${line.sku} ต้องเป็นจำนวนเต็มที่มากกว่า 0`);
    }
    requestedBySku.set(
      line.sku,
      (requestedBySku.get(line.sku) ?? 0) + line.qty,
    );
  }
  const requestedLines = [...requestedBySku].map(([sku, qty]) => ({
    sku,
    qty,
  }));
  await lockLocalDemoStock(tx);

  const stateBySku = new Map(params.stateLines.map((line) => [line.sku, line]));
  if (params.movementType === "ISSUE") {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: params.orderId },
      select: { stockReservedAt: true, stockReservationError: true },
    });
    if (!order.stockReservedAt || order.stockReservationError) {
      badRequest(
        order.stockReservationError ||
          "ยังไม่ได้จองสต๊อก demo สำหรับออเดอร์นี้ — จองสต๊อกก่อนเบิก",
      );
    }
    const availability = await getLocalDemoStockAvailability(
      tx,
      params.orderId,
      params.stateLines,
    );
    const availabilityBySku = new Map(
      availability.map((line) => [line.sku, line]),
    );
    for (const requested of requestedLines) {
      const available =
        availabilityBySku.get(requested.sku)?.availableToThisOrder ?? 0;
      if (requested.qty > available) {
        conflict(
          `${requested.sku}: สต๊อก demo เบิกได้ ${available} ตัว (กันยอดจองของออเดอร์อื่นไว้แล้ว)`,
        );
      }
    }
  }

  const touchedProducts: string[] = [];
  for (const requested of requestedLines) {
    const line = stateBySku.get(requested.sku);
    if (!line || !line.variantId) {
      badRequest(`ไม่พบ variant สต๊อก demo ที่ตรงกับ ${requested.sku}`);
    }
    const variant = await tx.productVariant.findUnique({
      where: { id: line.variantId },
      select: { id: true, productId: true, stock: true, totalStock: true },
    });
    if (!variant)
      badRequest(`ไม่พบ variant สต๊อก demo ที่ตรงกับ ${requested.sku}`);

    if (variant.stock !== variant.totalStock) {
      badRequest(
        `${requested.sku}: ยอด stock กับ totalStock ของฐาน demo ไม่ตรงกัน กรุณา reset demo ใหม่`,
      );
    }
    const currentQty = variant.stock;
    const nextQty =
      params.movementType === "ISSUE"
        ? currentQty - requested.qty
        : currentQty + requested.qty;
    if (nextQty < 0) conflict(`${requested.sku}: สต๊อก demo ไม่พอเบิก`);
    await tx.productVariant.update({
      where: { id: variant.id },
      data: { stock: nextQty, totalStock: nextQty },
    });
    touchedProducts.push(variant.productId);
  }
  await syncProductTotalStock(tx, touchedProducts);

  return {
    docNumber: localDemoStockDocumentNumber(
      params.movementType,
      params.idempotencyKey,
    ),
  };
}
