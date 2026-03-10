import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { byIdInput } from "@/server/schemas";

export const packagingRouter = router({
  list: protectedProcedure
    .input(z.object({ includeInactive: z.boolean().default(false) }).optional())
    .query(async ({ ctx, input }) => {
      const where = input?.includeInactive ? {} : { isActive: true };
      return ctx.prisma.packagingOption.findMany({
        where,
        orderBy: { sortOrder: "asc" },
      });
    }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const maxSort = await ctx.prisma.packagingOption.aggregate({ _max: { sortOrder: true } });
      return ctx.prisma.packagingOption.create({
        data: { name: input.name, sortOrder: (maxSort._max.sortOrder ?? -1) + 1 },
      });
    }),

  update: protectedProcedure
    .input(byIdInput.extend({
      name: z.string().min(1).optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.packagingOption.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(byIdInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.packagingOption.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),
});
