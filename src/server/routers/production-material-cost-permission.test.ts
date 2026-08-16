import type { Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { productRouter } from "./product";
import { stockSyncRouter } from "./stock-sync";

function contextFor(
  role: Role,
  permissionOverrides: unknown = null,
): {
  ctx: Context;
  findMaterials: ReturnType<typeof vi.fn>;
  findProducts: ReturnType<typeof vi.fn>;
} {
  const findMaterials = vi.fn().mockResolvedValue([
    {
      id: "usage-1",
      productId: "product-1",
      productVariantId: "variant-1",
      quantity: 2,
      unit: "PCS",
      unitCost: 12,
      totalCost: 24,
      movementType: "ISSUE",
      stockMovementRef: "SM-001",
      deductedAt: new Date("2026-08-16T00:00:00.000Z"),
      product: { name: "ฟิล์ม DTF", sku: "DTF-001" },
    },
  ]);
  const findProducts = vi.fn().mockResolvedValue([
    {
      id: "product-1",
      sku: "DTF-001",
      name: "ฟิล์ม DTF",
      costPrice: 12,
      totalStock: 50,
      variants: [
        {
          id: "variant-1",
          sku: "DTF-001-A",
          costPrice: 11,
          stock: 20,
          totalStock: 20,
        },
      ],
    },
  ]);

  return {
    ctx: {
      prisma: {
        materialUsage: { findMany: findMaterials },
        product: { findMany: findProducts },
      } as unknown as Context["prisma"],
      userId: "production-user",
      userRole: role,
      permissionOverrides,
    },
    findMaterials,
    findProducts,
  };
}

describe("production material cost permission boundary", () => {
  it("ช่างผลิตไม่ได้รับ unitCost/totalCost จาก stockSync.listMaterials", async () => {
    const { ctx } = contextFor("PRODUCTION_STAFF");

    const result = await stockSyncRouter
      .createCaller(ctx)
      .listMaterials({ productionId: "production-1" });

    expect(result[0]).not.toHaveProperty("unitCost");
    expect(result[0]).not.toHaveProperty("totalCost");
  });

  it("ช่างผลิตไม่ได้รับ costPrice จาก product.searchForOrder ทุกระดับ", async () => {
    const { ctx } = contextFor("PRODUCTION_STAFF");

    const result = await productRouter
      .createCaller(ctx)
      .searchForOrder({ itemType: "RAW_MATERIAL" });

    expect(result[0]).not.toHaveProperty("costPrice");
    expect(result[0]?.variants[0]).not.toHaveProperty("costPrice");
  });

  it("ผู้จัดการที่มี see_finance ยังได้รับต้นทุนวัตถุดิบเดิมครบ", async () => {
    const { ctx } = contextFor("MANAGER");

    const [materials, products] = await Promise.all([
      stockSyncRouter
        .createCaller(ctx)
        .listMaterials({ productionId: "production-1" }),
      productRouter
        .createCaller(ctx)
        .searchForOrder({ itemType: "RAW_MATERIAL" }),
    ]);

    expect(materials[0]).toMatchObject({ unitCost: 12, totalCost: 24 });
    expect(products[0]).toMatchObject({
      costPrice: 12,
      variants: [{ costPrice: 11 }],
    });
  });

  it("ยึด see_finance override ไม่ยึดชื่อตำแหน่ง", async () => {
    const manager = contextFor("MANAGER", { see_finance: false });
    const staff = contextFor("PRODUCTION_STAFF", { see_finance: true });

    const [managerMaterials, managerProducts, staffMaterials, staffProducts] =
      await Promise.all([
        stockSyncRouter
          .createCaller(manager.ctx)
          .listMaterials({ productionId: "production-1" }),
        productRouter
          .createCaller(manager.ctx)
          .searchForOrder({ itemType: "RAW_MATERIAL" }),
        stockSyncRouter
          .createCaller(staff.ctx)
          .listMaterials({ productionId: "production-1" }),
        productRouter
          .createCaller(staff.ctx)
          .searchForOrder({ itemType: "RAW_MATERIAL" }),
      ]);

    expect(managerMaterials[0]).not.toHaveProperty("unitCost");
    expect(managerMaterials[0]).not.toHaveProperty("totalCost");
    expect(managerProducts[0]).not.toHaveProperty("costPrice");
    expect(managerProducts[0]?.variants[0]).not.toHaveProperty("costPrice");
    expect(staffMaterials[0]).toMatchObject({ unitCost: 12, totalCost: 24 });
    expect(staffProducts[0]).toMatchObject({
      costPrice: 12,
      variants: [{ costPrice: 11 }],
    });
  });
});
