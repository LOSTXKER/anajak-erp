import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const serviceCatalogRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        category: z.string().optional(), // ADDON, PRINT, FEE
        isActive: z.boolean().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      if (input.category) where.category = input.category;
      if (input.isActive !== undefined) where.isActive = input.isActive;
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { type: { contains: input.search, mode: "insensitive" } },
        ];
      }

      return ctx.prisma.serviceCatalog.findMany({
        where,
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.serviceCatalog.findUniqueOrThrow({
        where: { id: input.id },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        category: z.string(),
        type: z.string(),
        name: z.string().min(1),
        description: z.string().optional(),
        defaultPrice: z.number().min(0),
        pricingType: z.enum(["PER_PIECE", "PER_ORDER"]),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.serviceCatalog.create({ data: input });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        defaultPrice: z.number().optional(),
        pricingType: z.enum(["PER_PIECE", "PER_ORDER"]).optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.serviceCatalog.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.serviceCatalog.delete({ where: { id: input.id } });
    }),
});
