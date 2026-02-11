import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const productionRouter = router({
  getByOrderId: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.production.findMany({
        where: { orderId: input.orderId },
        include: {
          steps: {
            orderBy: { sortOrder: "asc" },
            include: {
              assignedTo: { select: { id: true, name: true } },
              outsourceOrder: { include: { vendor: true } },
            },
          },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        orderId: z.string(),
        steps: z.array(
          z.object({
            stepType: z.enum([
              "PATTERN_MAKING", "SCREEN_PRINTING", "TAGGING",
              "PACKAGING", "EMBROIDERY", "SPECIAL_PRINT", "SEWING", "CUSTOM",
            ]),
            customStepName: z.string().optional(),
            sortOrder: z.number(),
            estimatedCost: z.number().optional(),
            notes: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const production = await ctx.prisma.production.create({
        data: {
          orderId: input.orderId,
          steps: { create: input.steps },
        },
        include: { steps: true },
      });

      // Update order status to PRODUCTION
      await ctx.prisma.order.update({
        where: { id: input.orderId },
        data: { internalStatus: "PRODUCING", customerStatus: "IN_PRODUCTION" },
      });

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "CREATE",
          entityType: "PRODUCTION",
          entityId: production.id,
          newValue: { orderId: input.orderId, stepsCount: input.steps.length },
        },
      });

      return production;
    }),

  updateStep: protectedProcedure
    .input(
      z.object({
        stepId: z.string(),
        status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "ON_HOLD", "FAILED"]).optional(),
        assignedToId: z.string().optional(),
        actualCost: z.number().optional(),
        qcPassed: z.boolean().optional(),
        qcNotes: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { stepId, ...data } = input;

      const updateData: Record<string, unknown> = { ...data };
      if (data.status === "IN_PROGRESS" && !data.assignedToId) {
        updateData.startedAt = new Date();
      }
      if (data.status === "COMPLETED") {
        updateData.completedAt = new Date();
      }

      const step = await ctx.prisma.productionStep.update({
        where: { id: stepId },
        data: updateData,
        include: { production: true },
      });

      // Check if all steps are completed
      const allSteps = await ctx.prisma.productionStep.findMany({
        where: { productionId: step.productionId },
      });

      const allCompleted = allSteps.every((s) => s.status === "COMPLETED");
      if (allCompleted) {
        await ctx.prisma.production.update({
          where: { id: step.productionId },
          data: { status: "COMPLETED", endDate: new Date() },
        });
      }

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "UPDATE",
          entityType: "PRODUCTION_STEP",
          entityId: stepId,
          newValue: JSON.parse(JSON.stringify(data)),
        },
      });

      return step;
    }),

  board: protectedProcedure.query(async ({ ctx }) => {
    const productions = await ctx.prisma.production.findMany({
      where: { status: { not: "COMPLETED" } },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            title: true,
            deadline: true,
            customer: { select: { name: true } },
          },
        },
        steps: {
          orderBy: { sortOrder: "asc" },
          include: {
            assignedTo: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return productions;
  }),
});
