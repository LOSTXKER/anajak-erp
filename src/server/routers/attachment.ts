import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { byIdInput } from "@/server/schemas";

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
        printPosition: z.string().optional(),
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
    .input(byIdInput)
    .mutation(async ({ ctx, input }) => {
      // ลบได้เฉพาะไฟล์ที่ตัวเองอัปโหลด — ยกเว้น OWNER/MANAGER ลบได้ทุกไฟล์
      const attachment = await ctx.prisma.attachment.findUniqueOrThrow({
        where: { id: input.id },
        select: { uploadedById: true },
      });
      const isManagerUp = ctx.userRole === "OWNER" || ctx.userRole === "MANAGER";
      if (!isManagerUp && attachment.uploadedById !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "ลบได้เฉพาะไฟล์ที่คุณอัปโหลดเอง",
        });
      }
      return ctx.prisma.attachment.delete({ where: { id: input.id } });
    }),
});
