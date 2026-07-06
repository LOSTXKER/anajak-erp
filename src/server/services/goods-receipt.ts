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

import { badRequest } from "@/server/errors";
import { createNotification } from "@/server/helpers";
import { addOrderRevision, finalizeProductionIfComplete } from "@/server/services/order-status";
import { RECEIPT_TYPE_LABELS, type ReceiptType } from "@/lib/goods-receipt";
// สูตรรับสุทธิ/ด่านกรอก/สรุปขาดเกิน แยกไป goods-receipt-plan.ts — unit test ได้ไม่ต้องมี DB
import {
  netReceivedByVariant,
  netReceivedByProduct,
  variantNetKey,
  receiptInspectionOf,
  assertValidReceiptLines,
  summarizeReceiptLines,
} from "@/server/services/goods-receipt-plan";
import type { ExtendedPrismaClient, PrismaTx } from "@/lib/prisma";

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
  const prior = await prisma.goodsReceiptLine.findMany({
    where: {
      receipt: { orderId, receiptType: { in: ["CUSTOMER_GARMENT", "SEWING_GARMENT", "CUSTOMER_RETURN"] } },
      orderItemProductId: { in: products.map((p) => p.id) },
    },
    select: {
      orderItemProductId: true,
      size: true,
      color: true,
      qtyCounted: true,
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

  const lines: ReceiptContextLine[] = products.flatMap((p) =>
    p.variants.map((v) => ({
      orderItemProductId: p.id,
      description: p.description,
      size: v.size,
      color: v.color,
      qtyExpected: v.quantity,
      qtyReceivedNet: netByKey.get(variantNetKey(p.id, v.size, v.color)) ?? 0,
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
  receiptType: ReceiptType;
  outsourceOrderId?: string;
  notes?: string;
  photoUrls: string[];
  lines: CreateReceiptLineInput[];
  userId: string;
}

// อัปเดต receivedInspected ของรายการสินค้าตามยอดรับสุทธิล่าสุด — เรียกใน tx เดียวกับใบ
async function refreshReceivedInspected(tx: PrismaTx, orderId: string, productIds: string[]) {
  if (productIds.length === 0) return;
  const products = await tx.orderItemProduct.findMany({
    where: { id: { in: productIds } },
    select: { id: true, totalQuantity: true },
  });
  const lines = await tx.goodsReceiptLine.findMany({
    where: {
      orderItemProductId: { in: productIds },
      receipt: { orderId, receiptType: { in: ["CUSTOMER_GARMENT", "SEWING_GARMENT", "CUSTOMER_RETURN"] } },
    },
    select: {
      orderItemProductId: true,
      qtyCounted: true,
      receipt: { select: { receiptType: true } },
    },
  });
  const netByProduct = netReceivedByProduct(
    lines.map((l) => ({
      orderItemProductId: l.orderItemProductId,
      qtyCounted: l.qtyCounted,
      receiptType: l.receipt.receiptType,
    }))
  );
  for (const p of products) {
    const net = netByProduct.get(p.id) ?? 0;
    await tx.orderItemProduct.update({
      where: { id: p.id },
      data: receiptInspectionOf(net, p.totalQuantity),
    });
  }
}

export async function createGoodsReceipt(
  prisma: ExtendedPrismaClient,
  params: CreateReceiptParams
) {
  const lines = assertValidReceiptLines(params.lines);

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: params.orderId },
    select: { id: true, orderNumber: true, title: true },
  });

  // ใบผูก outsource ต้องเป็นของจริงและอยู่ใต้ออเดอร์เดียวกัน — ค่านี้เป็นด่านปล่อยสถานะ
  // "รับของกลับ" (Gate B4) ปล่อยผ่านค่ามั่ว/ข้ามออเดอร์ไม่ได้ (หลักฐานการนับจะไปโผล่ผิดใบ
  // แล้วด่านฝั่ง outsource เปิดให้ใบที่ไม่เคยนับ · review 2026-07-02) + ผูกได้เฉพาะใบชนิด
  // รับกลับร้านนอกเท่านั้น — schema ไม่มี FK (String? เปล่า) ด่านนี้จึงเป็นด่านเดียว
  if (params.outsourceOrderId) {
    if (params.receiptType !== "OUTSOURCE_RETURN") {
      badRequest("ผูกใบ outsource ได้เฉพาะใบตรวจนับชนิดรับกลับร้านนอก");
    }
    const outsource = await prisma.outsourceOrder.findUnique({
      where: { id: params.outsourceOrderId },
      select: { productionStep: { select: { production: { select: { orderId: true } } } } },
    });
    if (!outsource) badRequest("ไม่พบใบ outsource ที่อ้างถึง");
    if (outsource.productionStep.production.orderId !== params.orderId) {
      badRequest("ใบ outsource ที่อ้างถึงไม่ใช่ของออเดอร์นี้");
    }
  }

  const typeLabel = RECEIPT_TYPE_LABELS[params.receiptType];
  const { totalCounted, totalDefect, discrepancies } = summarizeReceiptLines(
    params.receiptType,
    lines
  );

  const receipt = await prisma.$transaction(async (tx) => {
    const created = await tx.goodsReceipt.create({
      data: {
        orderId: params.orderId,
        receiptType: params.receiptType,
        outsourceOrderId: params.outsourceOrderId,
        notes: params.notes,
        photoUrls: params.photoUrls,
        receivedById: params.userId,
        lines: {
          create: lines.map((l) => ({
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
    const productIds = [
      ...new Set(lines.map((l) => l.orderItemProductId).filter((id): id is string => !!id)),
    ];
    if (params.receiptType !== "OUTSOURCE_RETURN") {
      await refreshReceivedInspected(tx, params.orderId, productIds);
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
      if (remaining === 0) {
        const steps = await tx.productionStep.findMany({
          where: {
            production: { orderId: params.orderId },
            stepType: "GARMENT_RECEIVE",
            status: { in: ["PENDING", "IN_PROGRESS"] },
          },
          select: { id: true, productionId: true },
        });
        for (const s of steps) {
          await tx.productionStep.update({
            where: { id: s.id },
            data: { status: "COMPLETED", completedAt: new Date() },
          });
          await finalizeProductionIfComplete(tx, {
            productionId: s.productionId,
            changedBy: params.userId,
          });
        }
      }
    }

    const summaryParts = [
      `${typeLabel} ${totalCounted} ตัว`,
      ...(totalDefect > 0 ? [`ตำหนิ ${totalDefect}`] : []),
      ...(discrepancies.length > 0 ? [`ขาด/เกิน: ${discrepancies.join(" · ")}`] : []),
    ];
    await addOrderRevision(tx, {
      orderId: params.orderId,
      changedBy: params.userId,
      changeType: "STOCK",
      description: summaryParts.join(" — "),
    });

    return created;
  });

  // ขาด/เกิน/ตำหนิ → แจ้งแอดมิน (OWNER/MANAGER) ทันที — นอก tx (กระดิ่งพังต้องไม่ล้มใบ)
  if (discrepancies.length > 0 || totalDefect > 0) {
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
  }

  return receipt;
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
