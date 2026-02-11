import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const settingsRouter = router({
  get: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      const setting = await ctx.prisma.setting.findUnique({
        where: { key: input.key },
      });
      return setting ? setting.value : null;
    }),

  getMany: protectedProcedure
    .input(z.object({ keys: z.array(z.string()) }))
    .query(async ({ ctx, input }) => {
      const settings = await ctx.prisma.setting.findMany({
        where: { key: { in: input.keys } },
      });
      const map: Record<string, string> = {};
      for (const s of settings) {
        map[s.key] = s.value;
      }
      return map;
    }),

  set: protectedProcedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.setting.upsert({
        where: { key: input.key },
        update: { value: input.value },
        create: { key: input.key, value: input.value },
      });
      return { success: true };
    }),

  setMany: protectedProcedure
    .input(z.object({ settings: z.array(z.object({ key: z.string(), value: z.string() })) }))
    .mutation(async ({ ctx, input }) => {
      for (const s of input.settings) {
        await ctx.prisma.setting.upsert({
          where: { key: s.key },
          update: { value: s.value },
          create: { key: s.key, value: s.value },
        });
      }
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.setting.deleteMany({
        where: { key: input.key },
      });
      return { success: true };
    }),
});
