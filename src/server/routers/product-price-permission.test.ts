import type { Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { productRouter } from "./product";
import { productSellingPrice } from "@/lib/product-price";

function fixture(role: Role, permissionOverrides: unknown = null, source = "STOCK") {
  const variant = { id: "v1", priceAdj: 2.25, sellingPrice: 150.5, costPrice: 98.75, stock: 12, totalStock: 12, isActive: true };
  const product = { id: "p1", source, basePrice: 99.75, costPrice: 99.75, totalStock: 12, variants: [variant] };
  const updateVariant = vi.fn().mockResolvedValue(variant);
  const ctx = {
    userId: "user", userRole: role, permissionOverrides,
    prisma: {
      product: { findMany: vi.fn().mockResolvedValue([product]), count: vi.fn().mockResolvedValue(1), findFirstOrThrow: vi.fn().mockResolvedValue(product), update: vi.fn().mockResolvedValue(product) },
      productVariant: { update: updateVariant },
    },
  } as unknown as Context;
  return { caller: productRouter.createCaller(ctx), updateVariant, product };
}

describe("catalog prices and cost permission", () => {
  it.each([
    ["SALES", null, false],
    ["PRODUCTION_STAFF", null, false],
    ["MANAGER", null, true],
    ["MANAGER", { see_finance: false }, false],
    ["PRODUCTION_STAFF", { see_finance: true }, true],
  ] as const)("%s / %j reads only permitted cost fields", async (role, overrides, canSeeCost) => {
    const { caller, product } = fixture(role, overrides);
    const [list, search, detail] = await Promise.all([caller.list({}), caller.searchForOrder({}), caller.getById({ id: "p1" })]);
    for (const response of [list.products[0], search[0], detail]) {
      expect(response).toMatchObject({ basePrice: 0, totalStock: 12, variants: [{ sellingPrice: 150.5, stock: 12 }] });
      expect(Object.hasOwn(response, "costPrice")).toBe(canSeeCost);
      expect(Object.hasOwn(response.variants[0], "costPrice")).toBe(canSeeCost);
      expect(productSellingPrice(response, response.variants[0])).toBe(152.75);
    }
    expect(product.costPrice).toBe(99.75);
    expect(product.basePrice).toBe(99.75);
  });

  it("local selling base remains a selling price, while absent Stock prices never fall back to cost", async () => {
    const local = await fixture("SALES", null, "LOCAL").caller.getById({ id: "p1" });
    expect(local.basePrice).toBe(99.75);
    expect(productSellingPrice(local, { sellingPrice: 0, priceAdj: 0.25 })).toBe(100);
    expect(productSellingPrice({ source: "STOCK", basePrice: 98.75 }, { sellingPrice: 0, priceAdj: 10 })).toBeNull();
  });

  it("write permissions stay enforced, and a settings override does not grant cost visibility", async () => {
    await expect(fixture("SALES").caller.updateVariant({ id: "v1", priceAdj: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const { caller, updateVariant } = fixture("SALES", { manage_settings: true, see_finance: false });
    const [product, variant] = await Promise.all([caller.update({ id: "p1", isActive: false }), caller.updateVariant({ id: "v1", priceAdj: 1.005 })]);
    expect(product).not.toHaveProperty("costPrice");
    expect(variant).not.toHaveProperty("costPrice");
    expect(variant).toMatchObject({ sellingPrice: 150.5, stock: 12 });
    expect(updateVariant.mock.calls[0][0].data.priceAdj.toString()).toBe("1.01");
  });
});
