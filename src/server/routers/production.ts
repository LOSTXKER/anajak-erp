import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireRole } from "../trpc";
import { createAuditLog } from "@/server/helpers";
import { transitionOrder } from "@/server/services/order-status";
import { isValidTransition } from "@/lib/order-status";

// วางแผนการผลิต = งานระดับบริหารตามตาราง RBAC §7
const managerUp = requireRole("OWNER", "MANAGER");
const productionTeam = requireRole("OWNER", "MANAGER", "PRODUCTION_STAFF");

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
    .use(managerUp)
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
      // ใบผลิต + เปลี่ยนสถานะ = ก้อนเดียวกัน — สถานะต้องเดินตาม machine เท่านั้น
      // (no-op ถ้าออเดอร์ PRODUCING อยู่แล้ว เช่นเปิดใบผลิตใบที่สอง)
      return ctx.prisma.$transaction(async (tx) => {
        const production = await tx.production.create({
          data: {
            orderId: input.orderId,
            steps: { create: input.steps },
          },
          include: { steps: true },
        });

        // UI เปิดปุ่มสร้างใบผลิตตั้งแต่ CONFIRMED/DESIGN_APPROVED — ถ้ายังไป PRODUCING
        // ตรงๆ ไม่ได้ ให้เดินผ่านคิวผลิตก่อน (ยังผ่าน validate ทุกก้าว ไม่ใช่ set ตรง)
        const order = await tx.order.findUniqueOrThrow({
          where: { id: input.orderId },
          select: { orderType: true, internalStatus: true },
        });
        if (
          order.internalStatus !== "PRODUCING" &&
          !isValidTransition(order.orderType, order.internalStatus, "PRODUCING")
        ) {
          await transitionOrder(tx, {
            orderId: input.orderId,
            to: "PRODUCTION_QUEUE",
            changedBy: ctx.userId,
          });
        }

        await transitionOrder(tx, {
          orderId: input.orderId,
          to: "PRODUCING",
          changedBy: ctx.userId,
        });

        await createAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entityType: "PRODUCTION",
          entityId: production.id,
          newValue: { orderId: input.orderId, stepsCount: input.steps.length },
        });

        return production;
      });
    }),

  updateStep: protectedProcedure
    .use(productionTeam)
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

      // PRODUCTION_STAFF: ห้ามแตะ assignedToId/actualCost (มอบงาน + ต้นทุน = อำนาจหัวหน้า)
      // step ที่ยังไม่มีเจ้าของ → claim อัตโนมัติ (ระบบยังไม่มี UI มอบหมายงาน
      // ถ้าบังคับ assign ก่อน staff จะอัปเดตอะไรไม่ได้เลย) · step ของคนอื่น → ห้าม
      let autoClaim = false;
      if (ctx.userRole === "PRODUCTION_STAFF") {
        if (data.assignedToId !== undefined || data.actualCost !== undefined) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "ฝ่ายผลิตแก้ผู้รับผิดชอบ/ต้นทุนจริงไม่ได้",
          });
        }
        const existing = await ctx.prisma.productionStep.findUniqueOrThrow({
          where: { id: stepId },
          select: { assignedToId: true },
        });
        if (existing.assignedToId === null) {
          autoClaim = true;
        } else if (existing.assignedToId !== ctx.userId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "งานนี้ถูกมอบหมายให้คนอื่นแล้ว",
          });
        }
      }

      const updateData: Record<string, unknown> = { ...data };
      if (autoClaim) {
        updateData.assignedToId = ctx.userId;
      }
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

      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "PRODUCTION_STEP",
        entityId: stepId,
        newValue: data,
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
