import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { getStockClientFromSettings } from "@/lib/stock-api";

export const productRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        productType: z.string().optional(),
        itemType: z.string().optional(),
        source: z.string().optional(),
        category: z.string().optional(),
        isActive: z.boolean().optional(),
        page: z.number().default(1),
        limit: z.number().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { sku: { contains: input.search, mode: "insensitive" } },
          { description: { contains: input.search, mode: "insensitive" } },
          { barcode: { contains: input.search, mode: "insensitive" } },
        ];
      }
      if (input.productType) where.productType = input.productType;
      if (input.itemType) where.itemType = input.itemType;
      if (input.source) where.source = input.source;
      if (input.category) where.category = input.category;
      if (input.isActive !== undefined) where.isActive = input.isActive;

      const [products, total] = await Promise.all([
        ctx.prisma.product.findMany({
          where,
          include: {
            _count: { select: { variants: true } },
            variants: { where: { isActive: true }, select: { stock: true, sellingPrice: true } },
          },
          orderBy: { sku: "asc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        ctx.prisma.product.count({ where }),
      ]);

      // Add total stock calculation
      const productsWithStock = products.map((p) => ({
        ...p,
        totalStock: p.totalStock || p.variants.reduce((sum, v) => sum + v.stock, 0),
      }));

      return { products: productsWithStock, total, pages: Math.ceil(total / input.limit) };
    }),

  searchForOrder: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        itemType: z.string().optional(),
        limit: z.number().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { isActive: true };

      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { sku: { contains: input.search, mode: "insensitive" } },
          { barcode: { contains: input.search, mode: "insensitive" } },
        ];
      }
      if (input.itemType) where.itemType = input.itemType;

      return ctx.prisma.product.findMany({
        where,
        include: {
          variants: {
            where: { isActive: true },
            orderBy: { sku: "asc" },
            select: {
              id: true,
              size: true,
              color: true,
              sku: true,
              priceAdj: true,
              stock: true,
              totalStock: true,
              sellingPrice: true,
              costPrice: true,
            },
          },
        },
        orderBy: { name: "asc" },
        take: input.limit,
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.product.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          variants: { orderBy: { sku: "asc" } },
        },
      });
    }),

  // Update limited to ERP-specific overrides only (synced fields come from Stock)
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        imageUrl: z.string().optional(),
        images: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.product.update({ where: { id }, data });
    }),

  // Variant update limited to ERP-level price adjustment and active status
  updateVariant: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        priceAdj: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.productVariant.update({ where: { id }, data });
    }),

  // Delete product from ERP + soft-delete from Stock
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const product = await ctx.prisma.product.findUniqueOrThrow({
        where: { id: input.id },
        select: {
          id: true,
          sku: true,
          name: true,
          stockProductId: true,
          _count: { select: { orderItems: true } },
        },
      });

      // Atomically clean up relations and delete product
      await ctx.prisma.$transaction([
        // Nullify product link on order items (orders themselves are kept)
        ctx.prisma.orderItem.updateMany({
          where: { productId: input.id },
          data: { productId: null, productVariantId: null },
        }),
        // Remove material usage records for this product
        ctx.prisma.materialUsage.deleteMany({
          where: { productId: input.id },
        }),
        // Delete the product (variants cascade automatically)
        ctx.prisma.product.delete({ where: { id: input.id } }),
      ]);

      // Soft-delete from Stock (non-blocking — don't fail if Stock API errors)
      if (product.stockProductId) {
        try {
          const client = await getStockClientFromSettings();
          if (client) {
            await client.deleteProduct(product.stockProductId);
          }
        } catch {
          // Stock deletion is best-effort
        }
      }

      return { deleted: true, sku: product.sku, name: product.name };
    }),
});
