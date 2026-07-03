import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../trpc";
import { getStockClientFromSettings } from "@/lib/stock-api";
import { byIdInput, fileUrlSchema, fileUrlArraySchema } from "@/server/schemas";

const managerUp = requireRole("OWNER", "MANAGER");
const ownerOnly = requireRole("OWNER");

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
      // B11: ซ่อนสินค้าที่ soft-delete แล้วจากทุกหน้า
      const where: Record<string, unknown> = { deletedAt: null };

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
      const where: Record<string, unknown> = { isActive: true, deletedAt: null };

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
    .input(byIdInput)
    .query(async ({ ctx, input }) => {
      // findFirst + deletedAt: null — สินค้าที่ลบแล้วเปิดหน้ารายละเอียดไม่ได้ (404)
      return ctx.prisma.product.findFirstOrThrow({
        where: { id: input.id, deletedAt: null },
        include: {
          variants: { orderBy: { sku: "asc" } },
        },
      });
    }),

  // Update limited to ERP-specific overrides only (synced fields come from Stock)
  update: protectedProcedure
    .use(managerUp)
    .input(
      z.object({
        id: z.string(),
        imageUrl: fileUrlSchema.optional(),
        images: fileUrlArraySchema.optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.product.update({ where: { id }, data });
    }),

  // Variant update limited to ERP-level price adjustment and active status
  updateVariant: protectedProcedure
    .use(managerUp)
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
    .use(ownerOnly)
    .input(byIdInput)
    .mutation(async ({ ctx, input }) => {
      const product = await ctx.prisma.product.findUniqueOrThrow({
        where: { id: input.id },
        select: { id: true, sku: true, name: true, stockProductId: true, deletedAt: true },
      });
      if (product.deletedAt) {
        return { deleted: true, sku: product.sku, name: product.name };
      }

      // B11: soft-delete — ตั้ง deletedAt แทนลบแถวจริง เก็บประวัติเบิกวัสดุ (MaterialUsage
      // FK Restrict — เดิม deleteMany ทิ้งประวัติถาวร) + order items เดิมที่อ้างถึง ·
      // สินค้าซ่อนจากทุก query ฝั่ง UI (กรอง deletedAt: null) — ไม่ต้องล้าง FK ใดๆ
      await ctx.prisma.product.update({
        where: { id: input.id },
        data: { deletedAt: new Date(), isActive: false },
      });

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
