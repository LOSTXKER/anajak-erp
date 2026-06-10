import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { byIdInput } from "@/server/schemas";
import { notFound, badRequest } from "@/server/errors";
import type { PrismaTx } from "@/lib/prisma";

// entityType ที่แนบไฟล์ได้ + วิธีเช็คว่าปลายทางมีจริง — กันไฟล์ลอย/ยัด entityId มั่ว
const ENTITY_LOOKUPS: Record<string, (prisma: PrismaTx, id: string) => Promise<unknown>> = {
  ORDER: (p, id) => p.order.findUnique({ where: { id }, select: { id: true } }),
  CUSTOMER: (p, id) => p.customer.findUnique({ where: { id }, select: { id: true } }),
  QUOTATION: (p, id) => p.quotation.findUnique({ where: { id }, select: { id: true } }),
  PRODUCTION: (p, id) => p.production.findUnique({ where: { id }, select: { id: true } }),
  INVOICE: (p, id) => p.invoice.findUnique({ where: { id }, select: { id: true } }),
};

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
      // validate ปลายทางมีจริง (ค้างจาก review P0.1 — เก็บตอน P0.5)
      const lookup = ENTITY_LOOKUPS[input.entityType];
      if (!lookup) {
        badRequest(`แนบไฟล์กับ ${input.entityType} ไม่ได้`);
      }
      const entity = await lookup(ctx.prisma, input.entityId);
      if (!entity) {
        notFound("ปลายทางที่แนบไฟล์", input.entityId);
      }

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
