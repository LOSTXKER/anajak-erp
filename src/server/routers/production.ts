import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireRole } from "../trpc";
import { createAuditLog, createNotification } from "@/server/helpers";
import { transitionOrder, finalizeProductionIfComplete } from "@/server/services/order-status";
import { isValidTransition } from "@/lib/order-status";
import { STEP_TYPE_LABELS } from "@/lib/production-steps";

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
              outsourceOrders: {
                orderBy: { createdAt: "desc" },
                include: { vendor: { select: { id: true, name: true } } },
              },
            },
          },
        },
      });
    }),

  // หน้าใบผลิต /production/[id] — ใบผลิต + บริบทออเดอร์ที่ช่างต้องเห็น (ไม่มี field เงินของออเดอร์)
  // steps ใช้ include shape เดียวกับ getByOrderId — dialog ฝั่ง UI ใช้ type ร่วมกันได้ตรงๆ
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.production.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              title: true,
              deadline: true,
              priority: true,
              internalStatus: true,
              customer: { select: { id: true, name: true } },
              items: { select: { totalQuantity: true } },
            },
          },
          steps: {
            orderBy: { sortOrder: "asc" },
            include: {
              assignedTo: { select: { id: true, name: true } },
              outsourceOrders: {
                orderBy: { createdAt: "desc" },
                include: { vendor: { select: { id: true, name: true } } },
              },
            },
          },
        },
      });
    }),

  // คิว "รอเปิดใบผลิต" บนหน้า /production — ออเดอร์ถึงเกณฑ์แต่ยังไม่มีใบผลิต
  // (ชุดสถานะเดียวกับปุ่มสร้างใบผลิตเดิมบนหน้าออเดอร์ — CONFIRMED รวมด้วยเพื่อรองรับ
  // งานซ้ำที่ไม่ต้องออกแบบ · UI แยกกลุ่ม CONFIRMED พับไว้ คงเจตนา audit ข้อ 28)
  // printTypes derive ฝั่ง server — ผู้สร้างใบผลิตไม่ได้เปิดหน้าออเดอร์อีกแล้ว
  queue: protectedProcedure.use(managerUp).query(async ({ ctx }) => {
    const orders = await ctx.prisma.order.findMany({
      where: {
        internalStatus: { in: ["PRODUCTION_QUEUE", "DESIGN_APPROVED", "CONFIRMED"] },
        productions: { none: {} },
      },
      select: {
        id: true,
        orderNumber: true,
        title: true,
        deadline: true,
        priority: true,
        internalStatus: true,
        customer: { select: { name: true } },
        items: {
          select: {
            totalQuantity: true,
            prints: { select: { printType: true } },
          },
        },
      },
      orderBy: { deadline: "asc" },
      take: 100,
    });
    return orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      title: o.title,
      deadline: o.deadline,
      priority: o.priority,
      internalStatus: o.internalStatus,
      customerName: o.customer?.name ?? null,
      totalQuantity: o.items.reduce((s, it) => s + it.totalQuantity, 0),
      printTypes: [...new Set(o.items.flatMap((it) => it.prints.map((p) => p.printType)))],
    }));
  }),

  create: protectedProcedure
    .use(managerUp)
    .input(
      z.object({
        orderId: z.string(),
        steps: z.array(
          z.object({
            stepType: z.enum([
              "DTF_PRINT", "HEAT_PRESS", "DTG_PRETREAT", "DTG_PRINT", "CURING",
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
      // รายการที่ยังเป็น "โครงจากใบเสนอ" ทั้งใบ (OTHER + ไซส์ FREE ล้วน) ห้ามเข้าผลิต —
      // ช่างไม่มีไซส์/สี/ลายให้ทำงาน ต้องแก้รายการเป็นของจริงก่อน (audit ข้อ 10)
      const orderProducts = await ctx.prisma.orderItemProduct.findMany({
        where: { orderItem: { orderId: input.orderId } },
        select: { productType: true, variants: { select: { size: true } } },
      });
      const allSkeleton =
        orderProducts.length > 0 &&
        orderProducts.every(
          (p) => p.productType === "OTHER" && p.variants.every((v) => v.size === "FREE")
        );
      if (allSkeleton) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            'รายการออเดอร์ยังเป็นโครงจากใบเสนอ (ไม่มีสินค้า/ไซส์จริง) — กด "แก้ไขรายการ" ใส่ของจริงก่อนเปิดใบผลิต',
        });
      }

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

      // อัปเดต step + ปิดใบผลิต + ดันสถานะออเดอร์ = ก้อนเดียวกัน (transitionOrder ต้องอยู่ใน tx)
      return ctx.prisma.$transaction(async (tx) => {
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
          const existing = await tx.productionStep.findUniqueOrThrow({
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

        const step = await tx.productionStep.update({
          where: { id: stepId },
          data: updateData,
          include: { production: true },
        });

        // ทุกขั้นเสร็จ → ปิดใบผลิต + ดันออเดอร์ "กำลังผลิต" → "ตรวจคุณภาพ" (rollup กลาง)
        await finalizeProductionIfComplete(tx, {
          productionId: step.productionId,
          changedBy: ctx.userId,
        });

        // ต้นทุนจริงต่อขั้นตอน → ต้นทุนออเดอร์อัตโนมัติ (upsert ด้วย sourceRef — แก้เลขซ้ำ
        // ได้ไม่เบิ้ลแถว) — เดิมกรอกแล้วเก็บเฉยๆ ไม่เข้ากำไรหน้าออเดอร์ (audit ข้อ 21)
        if (data.actualCost !== undefined) {
          const stepName =
            step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType;
          await tx.costEntry.upsert({
            where: { sourceRef: `step:${stepId}` },
            create: {
              orderId: step.production.orderId,
              category: "LABOR",
              name: `ต้นทุนขั้นตอน: ${stepName}`,
              amount: data.actualCost,
              sourceRef: `step:${stepId}`,
              createdById: ctx.userId,
            },
            update: { amount: data.actualCost },
          });
        }

        // step มีปัญหา = ต้องมีคนมาดูด่วน — กระดิ่งหาผู้จัดการทันที ห้ามจมเงียบ (audit ข้อ 20)
        if (data.status === "FAILED") {
          const order = await tx.order.findUniqueOrThrow({
            where: { id: step.production.orderId },
            select: { id: true, orderNumber: true, title: true },
          });
          const stepName =
            step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType;
          const managers = await tx.user.findMany({
            where: {
              role: { in: ["OWNER", "MANAGER"] },
              isActive: true,
              id: { not: ctx.userId },
            },
            select: { id: true },
          });
          for (const m of managers) {
            await createNotification(tx, {
              userId: m.id,
              type: "ORDER",
              title: `ขั้นตอนผลิตมีปัญหา — ${order.orderNumber}`,
              message: `${stepName}${data.notes ? `: ${data.notes}` : ""} (${order.title})`,
              // ชี้หน้าใบผลิตตรงๆ — ตัวจัดการขั้นตอนอยู่ที่นั่นแล้ว (แยกโมดูลผลิต 2026-06-12)
              link: `/production/${step.productionId}`,
              entityType: "ORDER",
              entityId: order.id,
            });
          }
        }

        await createAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entityType: "PRODUCTION_STEP",
          entityId: stepId,
          newValue: data,
        });

        return step;
      });
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
