import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { calculateProfitMargin } from "@/lib/pricing";

export const costRouter = router({
  listByOrder: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [entries, order] = await Promise.all([
        ctx.prisma.costEntry.findMany({
          where: { orderId: input.orderId },
          include: { createdBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        }),
        ctx.prisma.order.findUniqueOrThrow({
          where: { id: input.orderId },
          select: { totalAmount: true, totalCost: true, profitMargin: true },
        }),
      ]);

      const totalCost = entries.reduce((sum, e) => sum + e.amount, 0);
      const byCategory = entries.reduce(
        (acc, e) => {
          acc[e.category] = (acc[e.category] || 0) + e.amount;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        entries,
        totalCost,
        byCategory,
        revenue: order.totalAmount,
        profitMargin: calculateProfitMargin(order.totalAmount, totalCost),
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        orderId: z.string(),
        category: z.string(),
        name: z.string().min(1),
        description: z.string().optional(),
        amount: z.number().min(0),
        quantity: z.number().optional(),
        unitCost: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.prisma.costEntry.create({
        data: {
          ...input,
          createdById: ctx.userId,
        },
      });

      // Recalculate order total cost
      const totalCostAgg = await ctx.prisma.costEntry.aggregate({
        _sum: { amount: true },
        where: { orderId: input.orderId },
      });

      const totalCost = totalCostAgg._sum.amount ?? 0;
      const order = await ctx.prisma.order.findUniqueOrThrow({
        where: { id: input.orderId },
        select: { totalAmount: true },
      });

      await ctx.prisma.order.update({
        where: { id: input.orderId },
        data: {
          totalCost,
          profitMargin: calculateProfitMargin(order.totalAmount, totalCost),
        },
      });

      return entry;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        category: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        amount: z.number().optional(),
        quantity: z.number().optional(),
        unitCost: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const entry = await ctx.prisma.costEntry.update({ where: { id }, data });

      // Recalculate
      const totalCostAgg = await ctx.prisma.costEntry.aggregate({
        _sum: { amount: true },
        where: { orderId: entry.orderId },
      });
      const totalCost = totalCostAgg._sum.amount ?? 0;
      const order = await ctx.prisma.order.findUniqueOrThrow({
        where: { id: entry.orderId },
        select: { totalAmount: true },
      });

      await ctx.prisma.order.update({
        where: { id: entry.orderId },
        data: {
          totalCost,
          profitMargin: calculateProfitMargin(order.totalAmount, totalCost),
        },
      });

      return entry;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.prisma.costEntry.delete({ where: { id: input.id } });

      // Recalculate
      const totalCostAgg = await ctx.prisma.costEntry.aggregate({
        _sum: { amount: true },
        where: { orderId: entry.orderId },
      });
      const totalCost = totalCostAgg._sum.amount ?? 0;
      const order = await ctx.prisma.order.findUniqueOrThrow({
        where: { id: entry.orderId },
        select: { totalAmount: true },
      });

      await ctx.prisma.order.update({
        where: { id: entry.orderId },
        data: {
          totalCost,
          profitMargin: calculateProfitMargin(order.totalAmount, totalCost),
        },
      });

      return entry;
    }),
});
