import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { byIdInput } from "@/server/schemas";

export const patternRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        productType: z.string().optional(),
        isActive: z.boolean().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      if (input.productType) where.productType = input.productType;
      if (input.isActive !== undefined) where.isActive = input.isActive;
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { description: { contains: input.search, mode: "insensitive" } },
        ];
      }

      const [patterns, total] = await Promise.all([
        ctx.prisma.pattern.findMany({
          where,
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        }),
        ctx.prisma.pattern.count({ where }),
      ]);

      return { patterns, total };
    }),

  getById: protectedProcedure
    .input(byIdInput)
    .query(async ({ ctx, input }) => {
      return ctx.prisma.pattern.findUniqueOrThrow({
        where: { id: input.id },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        productType: z.string().optional(),
        collarType: z.string().optional(),
        sleeveType: z.string().optional(),
        bodyFit: z.string().optional(),
        fileUrl: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        description: z.string().optional(),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.pattern.create({ data: input });
    }),

  update: protectedProcedure
    .input(
      byIdInput.extend({
        name: z.string().optional(),
        productType: z.string().optional(),
        collarType: z.string().optional(),
        sleeveType: z.string().optional(),
        bodyFit: z.string().optional(),
        fileUrl: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.pattern.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(byIdInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.pattern.delete({ where: { id: input.id } });
    }),
});
