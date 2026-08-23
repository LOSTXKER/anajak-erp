import type { PrismaTx } from "@/lib/prisma";
import { badRequest } from "@/server/errors";

type PackingDimension = string | null | undefined;

export interface PackingOrderShape {
  items: ReadonlyArray<{
    products: ReadonlyArray<{
      description: string;
      variants: ReadonlyArray<{
        size: PackingDimension;
        color: PackingDimension;
        quantity: number;
      }>;
    }>;
  }>;
  deliveries: ReadonlyArray<{
    status: string;
    lines: ReadonlyArray<{
      description: string;
      size: PackingDimension;
      color: PackingDimension;
      qty: number;
    }>;
  }>;
}

export interface PackingEvidenceLine {
  key: string;
  description: string;
  size: string | null;
  color: string | null;
  ordered: number;
  packed: number;
  remaining: number;
}

export interface PackingEvidence {
  hasNonReturnedDelivery: boolean;
  hasOrderedVariantQuantity: boolean;
  isReadyToShip: boolean;
  totalOrdered: number;
  totalPacked: number;
  totalRemaining: number;
  lines: PackingEvidenceLine[];
}

export interface IncomingPackingLine {
  description: string;
  size?: PackingDimension;
  color?: PackingDimension;
  qty: number;
}

export interface PackingOverflow {
  line: IncomingPackingLine;
  ordered: number;
  alreadyPacked: number;
  incomingQty: number;
  remaining: number;
}

export interface V2FinalPackLedgerLine {
  description: string;
  size: string | null;
  color: string | null;
  qtyPlanned: number;
  qtyGood: number;
  qtyRework: number;
}

export interface V2FinalPackLedger {
  workOrderId: string;
  workOrderNumber: string;
  operationJobId: string;
  operationState: string;
  isReadyToShip: boolean;
  lines: V2FinalPackLedgerLine[];
}

type V2FinalPackOrderShape = {
  productionCompletionOwnerId: string | null;
  productions: ReadonlyArray<{ id: string; workOrderNumber: string | null }>;
  productionCompletionOwner: {
    id: string;
    workOrderNumber: string | null;
    completionOwnerStepId: string | null;
    steps: ReadonlyArray<{
      id: string;
      operationState: string;
      quantities: ReadonlyArray<V2FinalPackLedgerLine>;
    }>;
  } | null;
};

const normalizePackingDimension = (value?: PackingDimension) =>
  (value ?? "").trim().toLowerCase();

// แหล่งเดียวของ identity แถวนับแพ็ค: สินค้าคนละรุ่นต้องไม่หักยอดแทนกัน แม้ไซส์/สีตรงกัน
// ขณะเดียวกันเว้นวรรค/ตัวพิมพ์ไม่ทำให้ชื่อเดียวกันกลายเป็นคนละแถว
export const packingLineKey = (
  description: string,
  size?: PackingDimension,
  color?: PackingDimension,
) =>
  `${description.trim().toLowerCase()}|${normalizePackingDimension(size)}|${normalizePackingDimension(color)}`;

// Pure evidence builder ใช้ร่วมทั้งหน้าบริบทแพ็ค, ด่านสร้างใบส่ง และด่านพร้อมส่ง
// ใบตีกลับไม่ใช่หลักฐานของที่ยังแพ็คอยู่ จึงตัดทั้งจำนวนใบและจำนวนตัวออกตรงนี้จุดเดียว
export function packingEvidenceFromOrder(order: PackingOrderShape): PackingEvidence {
  const nonReturnedDeliveries = order.deliveries.filter(
    (delivery) => delivery.status !== "RETURNED",
  );

  const packedByKey = new Map<string, number>();
  for (const delivery of nonReturnedDeliveries) {
    for (const line of delivery.lines) {
      const key = packingLineKey(line.description, line.size, line.color);
      packedByKey.set(key, (packedByKey.get(key) ?? 0) + line.qty);
    }
  }

  const orderedByKey = new Map<
    string,
    {
      description: string;
      size: string | null;
      color: string | null;
      ordered: number;
    }
  >();
  for (const item of order.items) {
    for (const product of item.products) {
      for (const variant of product.variants) {
        if (variant.quantity <= 0) continue;
        const key = packingLineKey(product.description, variant.size, variant.color);
        const current = orderedByKey.get(key);
        if (current) {
          current.ordered += variant.quantity;
        } else {
          orderedByKey.set(key, {
            description: product.description,
            size: variant.size ?? null,
            color: variant.color ?? null,
            ordered: variant.quantity,
          });
        }
      }
    }
  }

  const lines = [...orderedByKey.entries()].map(([key, row]) => {
    const packed = packedByKey.get(key) ?? 0;
    return {
      key,
      ...row,
      packed,
      remaining: Math.max(0, row.ordered - packed),
    };
  });
  const totalOrdered = lines.reduce((sum, line) => sum + line.ordered, 0);
  const totalPacked = lines.reduce((sum, line) => sum + line.packed, 0);
  const totalRemaining = lines.reduce((sum, line) => sum + line.remaining, 0);
  const hasNonReturnedDelivery = nonReturnedDeliveries.length > 0;
  const hasOrderedVariantQuantity = totalOrdered > 0;

  return {
    hasNonReturnedDelivery,
    hasOrderedVariantQuantity,
    isReadyToShip:
      hasNonReturnedDelivery &&
      (!hasOrderedVariantQuantity || totalRemaining === 0),
    totalOrdered,
    totalPacked,
    totalRemaining,
    lines,
  };
}

// เช็ก candidate หลายแถวแบบ running total เพื่อกัน duplicate key ใน request เดียวหลุดเพดาน
export function findPackingOverflow(
  evidence: PackingEvidence,
  incomingLines: readonly IncomingPackingLine[],
): PackingOverflow | null {
  const orderedByKey = new Map(
    evidence.lines.map((line) => [line.key, line.ordered] as const),
  );
  const packedByKey = new Map(
    evidence.lines.map((line) => [line.key, line.packed] as const),
  );

  for (const line of incomingLines) {
    const key = packingLineKey(line.description, line.size, line.color);
    const ordered = orderedByKey.get(key);
    // ของแถม/รายการพิเศษที่ไม่มี variant ในออเดอร์ยังบันทึกได้ แต่ไม่นับแทนของที่สั่ง
    if (ordered === undefined) continue;
    const alreadyPacked = packedByKey.get(key) ?? 0;
    const remaining = Math.max(0, ordered - alreadyPacked);
    if (line.qty > remaining) {
      return {
        line,
        ordered,
        alreadyPacked,
        incomingQty: line.qty,
        remaining,
      };
    }
    packedByKey.set(key, alreadyPacked + line.qty);
  }

  return null;
}

export function v2FinalPackLedgerFromOrder(
  order: V2FinalPackOrderShape,
): V2FinalPackLedger | null {
  if (!order.productions || order.productions.length === 0) return null;
  if (order.productions.length !== 1) {
    badRequest(
      "ออเดอร์มีใบสั่งผลิต V2 มากกว่าหนึ่งใบ แต่ยังไม่มีการแบ่งจำนวนสำหรับปิดงาน",
    );
  }
  const workOrder = order.productions[0]!;
  const owner = order.productionCompletionOwner;
  if (
    !order.productionCompletionOwnerId ||
    order.productionCompletionOwnerId !== workOrder.id ||
    !owner ||
    owner.id !== workOrder.id
  ) {
    badRequest("ใบสั่งผลิตยังไม่มีเจ้าของการปิดงานที่แน่นอน — ส่งของไม่ได้");
  }
  if (!owner.workOrderNumber || owner.steps.length !== 1) {
    badRequest("ใบสั่งผลิตต้องมีขั้น Final Pack เพียงหนึ่งขั้นก่อนส่งของ");
  }
  const finalPack = owner.steps[0]!;
  if (owner.completionOwnerStepId !== finalPack.id) {
    badRequest("ขั้น Final Pack ไม่ตรงกับเจ้าของการปิดงาน — ส่งของไม่ได้");
  }

  const linesComplete =
    finalPack.quantities.length > 0 &&
    finalPack.quantities.every(
      (line) =>
        line.qtyPlanned > 0 &&
        line.qtyGood === line.qtyPlanned &&
        line.qtyRework === 0,
    );
  return {
    workOrderId: owner.id,
    workOrderNumber: owner.workOrderNumber,
    operationJobId: finalPack.id,
    operationState: finalPack.operationState,
    isReadyToShip:
      finalPack.operationState === "COMPLETED" && linesComplete,
    lines: [...finalPack.quantities],
  };
}

export async function getV2FinalPackLedger(
  tx: PrismaTx,
  orderId: string,
): Promise<V2FinalPackLedger | null> {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      productionCompletionOwnerId: true,
      productions: {
        where: { workOrderNumber: { not: null } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, workOrderNumber: true },
      },
      productionCompletionOwner: {
        select: {
          id: true,
          workOrderNumber: true,
          completionOwnerStepId: true,
          steps: {
            where: {
              executionEnabled: true,
              operationCode: "FINAL_PACK",
            },
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            select: {
              id: true,
              operationState: true,
              quantities: {
                where: { scopeKind: "PACK_LINE" },
                orderBy: [{ scopeKey: "asc" }, { id: "asc" }],
                select: {
                  description: true,
                  size: true,
                  color: true,
                  qtyPlanned: true,
                  qtyGood: true,
                  qtyRework: true,
                },
              },
            },
          },
        },
      },
    },
  });
  return v2FinalPackLedgerFromOrder(order);
}

export async function assertV2FinalPackReadyToShip(
  tx: PrismaTx,
  orderId: string,
): Promise<V2FinalPackLedger | null> {
  const ledger = await getV2FinalPackLedger(tx, orderId);
  if (ledger && !ledger.isReadyToShip) {
    badRequest(
      `ยังส่งของไม่ได้ — ${ledger.workOrderNumber} ต้องปิด Final Pack และแพ็กครบทุกสินค้า สี และไซซ์ก่อน`,
    );
  }
  return ledger;
}

export function unallocatedDeliveryLinesFromFinalPack(
  ledger: V2FinalPackLedger,
  evidence: PackingEvidence,
): IncomingPackingLine[] {
  const packedByKey = new Map(
    evidence.lines.map((line) => [line.key, line.packed] as const),
  );
  const grouped = new Map<
    string,
    { description: string; size: string | null; color: string | null; qty: number }
  >();
  for (const line of ledger.lines) {
    const key = packingLineKey(line.description, line.size, line.color);
    const current = grouped.get(key);
    if (current) current.qty += line.qtyGood;
    else {
      grouped.set(key, {
        description: line.description,
        size: line.size,
        color: line.color,
        qty: line.qtyGood,
      });
    }
  }
  return [...grouped.entries()]
    .map(([key, line]) => ({
      ...line,
      qty: Math.max(0, line.qty - (packedByKey.get(key) ?? 0)),
    }))
    .filter((line) => line.qty > 0);
}

export async function getOrderPackingEvidence(
  tx: PrismaTx,
  orderId: string,
): Promise<PackingEvidence> {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      items: {
        select: {
          products: {
            select: {
              description: true,
              variants: {
                select: { size: true, color: true, quantity: true },
              },
            },
          },
        },
      },
      deliveries: {
        select: {
          status: true,
          lines: { select: { description: true, size: true, color: true, qty: true } },
        },
      },
    },
  });

  return packingEvidenceFromOrder(order);
}

export async function assertOrderPackingReadyToShip(
  tx: PrismaTx,
  orderId: string,
): Promise<PackingEvidence> {
  const evidence = await getOrderPackingEvidence(tx, orderId);

  if (!evidence.hasNonReturnedDelivery) {
    badRequest(
      'ยังไม่มีใบส่งของที่ใช้งานอยู่ — สร้างใบส่งในส่วน "จัดส่ง" ก่อนเปลี่ยนเป็นพร้อมส่ง',
    );
  }
  if (evidence.hasOrderedVariantQuantity && evidence.totalRemaining > 0) {
    const missing = evidence.lines
      .filter((line) => line.remaining > 0)
      .slice(0, 3)
      .map((line) => {
        const label = [line.size, line.color].filter(Boolean).join("/") || line.description;
        return `${label} ขาด ${line.remaining}`;
      })
      .join(", ");
    badRequest(
      `ยังแพ็คสินค้าไม่ครบ — เหลือ ${evidence.totalRemaining} ตัว${missing ? ` (${missing})` : ""}`,
    );
  }

  return evidence;
}
