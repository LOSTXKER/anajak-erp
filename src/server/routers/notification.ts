import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const notificationRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        unreadOnly: z.boolean().default(false),
        type: z.string().optional(),
        page: z.number().default(1),
        limit: z.number().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        userId: ctx.userId,
      };

      if (input.unreadOnly) where.isRead = false;
      if (input.type) where.type = input.type;

      const [notifications, total] = await Promise.all([
        ctx.prisma.notification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        ctx.prisma.notification.count({ where }),
      ]);

      return { notifications, total, pages: Math.ceil(total / input.limit) };
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.notification.count({
      where: { userId: ctx.userId, isRead: false },
    });
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.notification.update({
        where: { id: input.id },
        data: { isRead: true, readAt: new Date() },
      });
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    return ctx.prisma.notification.updateMany({
      where: { userId: ctx.userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        userId: z.string().optional(),
        customerId: z.string().optional(),
        type: z.string(),
        channel: z.enum(["IN_APP", "LINE", "EMAIL"]).default("IN_APP"),
        title: z.string(),
        body: z.string(),
        data: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.notification.create({
        data: {
          type: input.type,
          channel: input.channel,
          title: input.title,
          body: input.body,
          data: input.data ? JSON.parse(JSON.stringify(input.data)) : undefined,
          sentAt: input.channel === "IN_APP" ? new Date() : undefined,
          ...(input.userId ? { user: { connect: { id: input.userId } } } : {}),
          ...(input.customerId ? { customer: { connect: { id: input.customerId } } } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.notification.delete({ where: { id: input.id } });
    }),
});
