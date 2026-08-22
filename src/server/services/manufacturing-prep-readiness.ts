import type { PrismaTx } from "@/lib/prisma";
import { badRequest } from "@/server/errors";
import { getGarmentPickState } from "./garment-pick";
import { netReceivedByVariant, variantNetKey } from "./goods-receipt-plan";

export type PrepGarmentSurplus = {
  stockSurplusQty: number;
  customerSurplusQty: number;
  totalSurplusQty: number;
};

/**
 * อ่านยอดเสื้อส่วนเกินจากหลักฐานจริงของออเดอร์หลัง caller ถือ topology/order lock แล้ว:
 * Stock ใช้ ISSUE - RETURN; เสื้อของลูกค้าใช้ CUSTOMER_GARMENT - CUSTOMER_RETURN
 * เทียบทีละสินค้า/ไซซ์/สี จึงเอาส่วนเกินไซซ์หนึ่งไปกลบอีกไซซ์ไม่ได้.
 */
export async function getPrepGarmentSurplus(
  tx: PrismaTx,
  orderId: string,
): Promise<PrepGarmentSurplus> {
  const stockState = await getGarmentPickState(tx, orderId);
  const stockSurplusQty = stockState.lines.reduce(
    (sum, line) =>
      sum + Math.max(0, line.issued - line.returned - line.needed),
    0,
  );

  const customerProducts = await tx.orderItemProduct.findMany({
    where: {
      orderItem: { orderId },
      itemSource: "CUSTOMER_PROVIDED",
    },
    select: {
      id: true,
      variants: { select: { size: true, color: true, quantity: true } },
    },
  });
  if (customerProducts.length === 0) {
    return {
      stockSurplusQty,
      customerSurplusQty: 0,
      totalSurplusQty: stockSurplusQty,
    };
  }

  const receiptLines = await tx.goodsReceiptLine.findMany({
    where: {
      orderItemProductId: { in: customerProducts.map((product) => product.id) },
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
      receipt: { select: { receiptType: true } },
    },
  });
  const netByVariant = netReceivedByVariant(
    receiptLines.map((line) => ({
      orderItemProductId: line.orderItemProductId,
      size: line.size,
      color: line.color,
      qtyCounted: line.qtyCounted,
      receiptType: line.receipt.receiptType,
    })),
  );
  let customerSurplusQty = 0;
  for (const product of customerProducts) {
    const expectedByVariant = new Map<string, number>();
    for (const variant of product.variants) {
      const key = variantNetKey(product.id, variant.size, variant.color);
      expectedByVariant.set(
        key,
        (expectedByVariant.get(key) ?? 0) + variant.quantity,
      );
    }
    for (const [key, expected] of expectedByVariant) {
      customerSurplusQty += Math.max(0, (netByVariant.get(key) ?? 0) - expected);
    }
  }

  return {
    stockSurplusQty,
    customerSurplusQty,
    totalSurplusQty: stockSurplusQty + customerSurplusQty,
  };
}

export async function assertPrepGarmentSurplusCleared(
  tx: PrismaTx,
  orderId: string,
): Promise<void> {
  const surplus = await getPrepGarmentSurplus(tx, orderId);
  if (surplus.totalSurplusQty > 0) {
    badRequest(
      `ยังมีเสื้อส่วนเกินค้างอยู่ ${surplus.totalSurplusQty} ตัว กรุณาคืนส่วนเกินก่อนปิดงาน`,
    );
  }
}
