import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { byIdInput, fileUrlSchema } from "@/server/schemas";
import { notFound, badRequest } from "@/server/errors";
import { ATTACHMENT_CATEGORIES } from "@/lib/file-layers";
import { hasPermission } from "@/lib/permissions";
import { isOwnOutsourceFile } from "@/server/services/outsource-share";
import type { PrismaTx } from "@/lib/prisma";

// entityType ที่แนบไฟล์ได้ + วิธีเช็คว่าปลายทางมีจริง — กันไฟล์ลอย/ยัด entityId มั่ว
const ENTITY_LOOKUPS: Record<string, (prisma: PrismaTx, id: string) => Promise<unknown>> = {
  ORDER: (p, id) => p.order.findUnique({ where: { id }, select: { id: true } }),
  CUSTOMER: (p, id) => p.customer.findUnique({ where: { id }, select: { id: true } }),
  QUOTATION: (p, id) => p.quotation.findUnique({ where: { id }, select: { id: true } }),
  PRODUCTION: (p, id) => p.production.findUnique({ where: { id }, select: { id: true } }),
  INVOICE: (p, id) => p.invoice.findUnique({ where: { id }, select: { id: true } }),
  // ไฟล์ลายบนใบงานร้านนอก (B14) — โผล่บนหน้าแชร์ให้ร้านผ่าน shareToken
  OUTSOURCE_ORDER: (p, id) =>
    p.outsourceOrder.findUnique({ where: { id }, select: { id: true } }),
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
        fileUrl: fileUrlSchema,
        fileType: z.string(),
        fileSize: z.number(),
        category: z.enum(ATTACHMENT_CATEGORIES).optional(),
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

      // ไฟล์บนใบงานร้านนอก (B14) โผล่บนลิงก์ public /job/<token> — แนบได้เฉพาะทีมผลิต
      // (ตรง dialog ที่โชว์เฉพาะ canHandleGoods + generateLink=productionUp) · กัน role อื่น
      // ยัดไฟล์เข้าใบ outsource ทาง API · read side ก็กรอง path+category ซ้ำอีกชั้น
      if (input.entityType === "OUTSOURCE_ORDER") {
        if (!["OWNER", "MANAGER", "PRODUCTION_STAFF"].includes(ctx.userRole)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "แนบไฟล์บนใบงานร้านนอกได้เฉพาะทีมผลิต/ผู้จัดการ",
          });
        }
        // ไฟล์ต้องอยู่ในโฟลเดอร์ของใบนี้เอง (ที่ dialog อัปจริง) — กันยัด proxy URL ของ
        // ไฟล์เงิน/เอกสารอื่นในบัคเก็ต (แม้ encoded-traversal) แล้วรั่วสู่ลิงก์ public
        if (!isOwnOutsourceFile(input.entityId, input.fileUrl)) {
          badRequest("ไฟล์แนบใบงานร้านนอกต้องอัปโหลดผ่านช่องแนบไฟล์ของใบนั้น");
        }
      }

      // เอกสารการเงิน — แนบได้เฉพาะคนทำบิล/รับเงิน (สลิป/หลักฐานเงิน) · ปิด mutation
      // สุดท้ายที่ยังไม่มีด่าน role (P0.1 ข้อ requireRole ครบทุก mutation · audit 07-15)
      if (
        input.entityType === "INVOICE" &&
        !hasPermission(ctx.userRole, ctx.permissionOverrides, "manage_billing_docs") &&
        !hasPermission(ctx.userRole, ctx.permissionOverrides, "record_payments")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "แนบไฟล์บนเอกสารเงินได้เฉพาะทีมบิล/การเงิน",
        });
      }

      // ไฟล์พิมพ์จริง (ชั้น 3) = ของฝ่ายผลิต/กราฟิก — ขาย/บัญชีไม่มีเหตุต้องแนบ
      if (
        input.category === "PRINT_FILE" &&
        !["OWNER", "MANAGER", "DESIGNER", "PRODUCTION_STAFF"].includes(ctx.userRole)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "ไฟล์พิมพ์จริงแนบได้เฉพาะทีมผลิต/กราฟิก/ผู้จัดการ",
        });
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
