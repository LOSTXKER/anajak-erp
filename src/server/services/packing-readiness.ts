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
