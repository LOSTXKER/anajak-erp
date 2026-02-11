import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const attachmentRouter = router({
  listByEntity: protectedProcedure
    .input(
      z.object({
        entityType: z.string(),
        entityId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.attachment.findMany({
        where: {
          entityType: input.entityType,
          entityId: input.entityId,
        },
        include: { uploadedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        entityType: z.string(),
        entityId: z.string(),
        fileName: z.string(),
        fileUrl: z.string(),
        fileType: z.string(),
        fileSize: z.number(),
        category: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.attachment.create({
        data: {
          ...input,
          uploadedById: ctx.userId,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.attachment.delete({ where: { id: input.id } });
    }),
});
