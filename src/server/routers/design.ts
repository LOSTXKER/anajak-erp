import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { randomBytes } from "crypto";
import { createAuditLog, processDesignApproval } from "@/server/helpers";

export const designRouter = router({
  listByOrder: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.designVersion.findMany({
        where: { orderId: input.orderId },
        orderBy: { versionNumber: "desc" },
      });
    }),

  upload: protectedProcedure
    .input(
      z.object({
        orderId: z.string(),
        fileUrl: z.string(),
        thumbnailUrl: z.string().optional(),
        designerNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const lastVersion = await ctx.prisma.designVersion.findFirst({
        where: { orderId: input.orderId },
        orderBy: { versionNumber: "desc" },
      });

      const design = await ctx.prisma.designVersion.create({
        data: {
          orderId: input.orderId,
          versionNumber: (lastVersion?.versionNumber ?? 0) + 1,
          fileUrl: input.fileUrl,
          thumbnailUrl: input.thumbnailUrl,
          designerNotes: input.designerNotes,
          approvalToken: randomBytes(32).toString("hex"),
        },
      });

      // Update order status
      await ctx.prisma.order.update({
        where: { id: input.orderId },
        data: { internalStatus: "DESIGNING", customerStatus: "PREPARING" },
      });

      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "CREATE",
        entityType: "DESIGN_VERSION",
        entityId: design.id,
        newValue: { orderId: input.orderId, version: design.versionNumber },
      });

      return design;
    }),

  // Public endpoint for customer approval via token
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.designVersion.findUniqueOrThrow({
        where: { approvalToken: input.token },
        include: {
          order: {
            select: {
              orderNumber: true,
              title: true,
              customer: { select: { name: true } },
            },
          },
        },
      });
    }),

  approve: protectedProcedure
    .input(
      z.object({
        designId: z.string(),
        approved: z.boolean(),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const design = await ctx.prisma.designVersion.update({
        where: { id: input.designId },
        data: {
          approvalStatus: input.approved ? "APPROVED" : "REVISION_REQUESTED",
          customerComment: input.comment,
          approvedAt: input.approved ? new Date() : null,
        },
        include: { order: true },
      });

      await processDesignApproval(ctx.prisma, {
        design: { orderId: design.orderId, versionNumber: design.versionNumber },
        approved: input.approved,
        comment: input.comment,
        changedBy: ctx.userId,
        descriptionPrefix: "",
      });

      return design;
    }),

  // Public mutation for customer approval via token (no login required)
  approveByToken: publicProcedure
    .input(
      z.object({
        token: z.string(),
        approved: z.boolean(),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const design = await ctx.prisma.designVersion.update({
        where: { approvalToken: input.token },
        data: {
          approvalStatus: input.approved ? "APPROVED" : "REVISION_REQUESTED",
          customerComment: input.comment,
          approvedAt: input.approved ? new Date() : null,
        },
        include: { order: { include: { customer: { select: { name: true } } } } },
      });

      await processDesignApproval(ctx.prisma, {
        design: { orderId: design.orderId, versionNumber: design.versionNumber },
        approved: input.approved,
        comment: input.comment,
        changedBy: "ลูกค้า",
        descriptionPrefix: "ลูกค้า",
      });

      return design;
    }),
});
