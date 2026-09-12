import { describe, expect, it, vi } from "vitest";
import type { StockApiClient } from "./stock-api";
import { syncProductPage } from "./stock-sync";

const db = vi.hoisted(() => ({
  setting: { findUnique: vi.fn().mockResolvedValue(null) },
  product: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: "p1" }) },
  productVariant: { findMany: vi.fn().mockResolvedValue([]), createMany: vi.fn().mockResolvedValue({ count: 1 }) },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

describe("stock sync price mapping", () => {
  it("stores actual costs separately and imports only the variant's selling price", async () => {
    const client = { getProducts: vi.fn().mockResolvedValue({ data: {
      pagination: { totalPages: 1, total: 1 },
      items: [{ id: "stock-p", sku: "P1", name: "เสื้อ", lastCost: 99.75, standardCost: 90, hasVariants: true, totalStock: 12,
        variants: [{ id: "stock-v", sku: "P1-M", name: "ขาว/M", lastCost: 98.75, costPrice: 89, sellingPrice: 150.5, totalStock: 12 }],
      }],
    } }) } as unknown as StockApiClient;
    const result = await syncProductPage(client, 1);
    expect(result.errors).toEqual([]);
    expect(db.product.create.mock.calls[0][0].data).toMatchObject({ basePrice: 0, costPrice: 99.75, totalStock: 12 });
    expect(db.productVariant.createMany.mock.calls[0][0].data[0]).toMatchObject({ sellingPrice: 150.5, costPrice: 98.75, stock: 12 });
  });
});
