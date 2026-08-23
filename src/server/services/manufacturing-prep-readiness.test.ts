import { describe, expect, it, vi } from "vitest";

import { getPrepGarmentSurplus } from "./manufacturing-prep-readiness";

function readinessTx(options?: { stockReturned?: number; customerReturned?: number }) {
  return {
    order: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "order-1",
        orderNumber: "ORD-001",
        items: [
          {
            products: [
              {
                itemSource: "FROM_STOCK",
                productId: "product-stock",
                description: "เสื้อจากสต๊อค",
                variants: [{ size: "M", color: "ดำ", quantity: 10 }],
              },
            ],
          },
        ],
      }),
    },
    product: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "product-stock",
          sku: "TSHIRT",
          name: "เสื้อจากสต๊อค",
          variants: [
            {
              id: "stock-variant-m",
              sku: "TS-M",
              size: "M",
              color: "ดำ",
            },
          ],
        },
      ]),
    },
    materialUsage: {
      findMany: vi.fn().mockResolvedValue([
        {
          productId: "product-stock",
          productVariantId: "stock-variant-m",
          quantity: 13,
          movementType: "ISSUE",
        },
        {
          productId: "product-stock",
          productVariantId: "stock-variant-m",
          quantity: options?.stockReturned ?? 2,
          movementType: "RETURN",
        },
      ]),
    },
    orderItemProduct: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "customer-product-1",
          variants: [{ size: "L", color: "ขาว", quantity: 5 }],
        },
      ]),
    },
    goodsReceiptLine: {
      findMany: vi.fn().mockResolvedValue([
        {
          orderItemProductId: "customer-product-1",
          size: "L",
          color: "ขาว",
          qtyCounted: 7,
          receipt: { receiptType: "CUSTOMER_GARMENT" },
        },
        {
          orderItemProductId: "customer-product-1",
          size: "L",
          color: "ขาว",
          qtyCounted: options?.customerReturned ?? 1,
          receipt: { receiptType: "CUSTOMER_RETURN" },
        },
      ]),
    },
  };
}

describe("PREP garment surplus readiness", () => {
  it("รวมส่วนเกินจากใบเบิก/คืนและใบรับ/คืนตามหลักฐานจริง", async () => {
    const tx = readinessTx();

    await expect(getPrepGarmentSurplus(tx as never, "order-1")).resolves.toEqual({
      stockSurplusQty: 1,
      customerSurplusQty: 1,
      totalSurplusQty: 2,
    });
  });

  it("ยอดส่วนเกินเป็นศูนย์เมื่อคืนครบทั้งสองแหล่ง", async () => {
    const tx = readinessTx({ stockReturned: 3, customerReturned: 2 });

    await expect(getPrepGarmentSurplus(tx as never, "order-1")).resolves.toEqual({
      stockSurplusQty: 0,
      customerSurplusQty: 0,
      totalSurplusQty: 0,
    });
  });
});
