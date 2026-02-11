import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

const variantSchema = z.object({
  size: z.string(),
  color: z.string(),
  sku: z.string(),
  priceAdj: z.number().default(0),
  stock: z.number().default(0),
  isActive: z.boolean().default(true),
});

export const productRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        productType: z.string().optional(),
        productGroup: z.string().optional(),
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
      if (input.productGroup) where.productGroup = input.productGroup;
      if (input.source) where.source = input.source;
      if (input.category) where.category = input.category;
      if (input.isActive !== undefined) where.isActive = input.isActive;

      const [products, total] = await Promise.all([
        ctx.prisma.product.findMany({
          where,
          include: {
            _count: { select: { variants: true } },
            variants: { where: { isActive: true }, select: { stock: true } },
          },
          orderBy: { createdAt: "desc" },
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
        productGroup: z.string().optional(),
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
      if (input.productGroup) where.productGroup = input.productGroup;

      return ctx.prisma.product.findMany({
        where,
        include: {
          variants: {
            where: { isActive: true },
            orderBy: [{ size: "asc" }, { color: "asc" }],
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
          variants: { orderBy: [{ size: "asc" }, { color: "asc" }] },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        sku: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        productType: z.string(),
        category: z.string().optional(),
        basePrice: z.number().min(0),
        costPrice: z.number().optional(),
        imageUrl: z.string().optional(),
        images: z.array(z.string()).default([]),
        variants: z.array(variantSchema).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { variants, ...data } = input;

      return ctx.prisma.product.create({
        data: {
          ...data,
          variants: {
            create: variants,
          },
        },
        include: { variants: true },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        productType: z.string().optional(),
        category: z.string().optional(),
        basePrice: z.number().optional(),
        costPrice: z.number().optional(),
        imageUrl: z.string().optional(),
        images: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.product.update({ where: { id }, data });
    }),

  addVariant: protectedProcedure
    .input(
      z.object({
        productId: z.string(),
        size: z.string(),
        color: z.string(),
        sku: z.string(),
        priceAdj: z.number().default(0),
        stock: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { productId, ...data } = input;
      return ctx.prisma.productVariant.create({
        data: { productId, ...data },
      });
    }),

  updateVariant: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        priceAdj: z.number().optional(),
        stock: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.productVariant.update({ where: { id }, data });
    }),

  deleteVariant: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.productVariant.delete({ where: { id: input.id } });
    }),
});
