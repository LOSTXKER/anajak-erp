import { describe, expect, it, vi } from "vitest";
import type { ExtendedPrismaClient } from "@/lib/prisma";
import { createGoodsReceipt } from "./goods-receipt";

describe("goods receipt child concurrency", () => {
  it("ล็อกหัวใบก่อน refresh receivedInspected และขยับ updatedAt ใน tx เดียว", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      goodsReceipt: {
        create: vi.fn().mockResolvedValue({
          id: "receipt-1",
          lines: [{ orderItemProductId: "saved-product-1" }],
        }),
      },
      orderItemProduct: {
        findMany: vi.fn().mockResolvedValue([
          { id: "saved-product-1", totalQuantity: 1 },
        ]),
        update: vi.fn().mockResolvedValue({ id: "saved-product-1" }),
        count: vi.fn().mockResolvedValue(1),
      },
      goodsReceiptLine: {
        findMany: vi.fn().mockResolvedValue([
          {
            orderItemProductId: "saved-product-1",
            qtyCounted: 1,
            receipt: { receiptType: "CUSTOMER_GARMENT" },
          },
        ]),
      },
      orderRevision: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "revision-1" }),
      },
      order: { update: vi.fn().mockResolvedValue({ id: "order-1" }) },
    };
    const prisma = {
      order: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "order-1",
          orderNumber: "ORD-001",
          title: "งานทดสอบ",
        }),
      },
      $transaction: vi.fn(
        async (callback: (transaction: unknown) => unknown) => callback(tx),
      ),
    } as unknown as ExtendedPrismaClient;

    await createGoodsReceipt(prisma, {
      orderId: "order-1",
      receiptType: "CUSTOMER_GARMENT",
      photoUrls: [],
      lines: [
        {
          orderItemProductId: "saved-product-1",
          description: "เสื้อลูกค้า",
          qtyExpected: 1,
          qtyCounted: 1,
          defectQty: 0,
        },
      ],
      userId: "production-1",
    });

    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.goodsReceipt.create.mock.invocationCallOrder[0],
    );
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.orderItemProduct.update.mock.invocationCallOrder[0],
    );
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { updatedAt: expect.any(Date) },
      select: { id: true },
    });
  });
});
