import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireRole } from "../trpc";
import { createAuditLog } from "@/server/helpers";
import { moneyInput, round2 } from "@/server/services/money";
import { finalizeProductionIfComplete } from "@/server/services/order-status";

const managerUp = requireRole("OWNER", "MANAGER");
const productionUp = requireRole("OWNER", "MANAGER", "PRODUCTION_STAFF");

export const outsourceRouter = router({
  // Vendors
  listVendors: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        capability: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { isActive: true };
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { contactName: { contains: input.search, mode: "insensitive" } },
        ];
      }
      if (input.capability) {
        where.capabilities = { has: input.capability };
      }

      return ctx.prisma.vendor.findMany({
        where,
        include: { _count: { select: { outsourceOrders: true } } },
        orderBy: { name: "asc" },
      });
    }),

  createVendor: protectedProcedure
    .use(managerUp)
    .input(
      z.object({
        name: z.string().min(1),
        contactName: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        lineId: z.string().optional(),
        address: z.string().optional(),
        capabilities: z.array(z.string()).default([]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const vendor = await ctx.prisma.vendor.create({ data: input });

      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "CREATE",
        entityType: "VENDOR",
        entityId: vendor.id,
        newValue: { name: vendor.name },
      });

      return vendor;
    }),

  updateVendor: protectedProcedure
    .use(managerUp)
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        contactName: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
        email: z.string().nullable().optional(),
        lineId: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
        capabilities: z.array(z.string()).optional(),
        notes: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const vendor = await ctx.prisma.vendor.update({ where: { id }, data });

      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "VENDOR",
        entityId: id,
        newValue: JSON.parse(JSON.stringify(data)),
      });

      return vendor;
    }),

  // Outsource Orders
  listOrders: protectedProcedure
    .input(
      z.object({
        status: z.string().optional(),
        vendorId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input.status) where.status = input.status;
      if (input.vendorId) where.vendorId = input.vendorId;

      return ctx.prisma.outsourceOrder.findMany({
        where,
        include: {
          vendor: { select: { name: true } },
          productionStep: {
            include: {
              production: {
                include: {
                  order: {
                    select: { orderNumber: true, title: true, customer: { select: { name: true } } },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  createOrder: protectedProcedure
    .use(managerUp)
    .input(
      z.object({
        productionStepId: z.string(),
        vendorId: z.string(),
        description: z.string(),
        quantity: z.number().min(1),
        // ค่าจ้างไม่บังคับ (เบสเคาะ 2026-06-12: ไม่คิดต้นทุนต่องานในระบบนี้ —
        // กำไรขาดทุนคิดรายเดือนในระบบบัญชี) — กรอกได้ถ้าอยากจดไว้ดูเอง
        unitCost: z.number().min(0).default(0),
        expectedBackAt: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // สร้างใบ + ดันสถานะ step + audit = ก้อนเดียวกัน · validate ใต้ transaction:
      // step ต้องมีจริง ยังไม่ปิด และไม่มีงานค้างที่ร้าน (รอบใหม่เปิดได้หลัง QC ตัดสินแล้วเท่านั้น)
      return ctx.prisma.$transaction(async (tx) => {
        // ล็อกแถว step ก่อนเช็ค — สอง request เปิดงานบน step เดียวพร้อมกันต้องต่อคิว
        // ไม่งั้นต่างคนต่างเช็คผ่านแล้วได้งานซ้อน 2 ใบ (ตั้งแต่ปลด unique เพื่อรองรับหลายรอบ)
        await tx.$queryRaw`SELECT id FROM production_steps WHERE id = ${input.productionStepId} FOR UPDATE`;
        const step = await tx.productionStep.findUnique({
          where: { id: input.productionStepId },
          include: {
            outsourceOrders: {
              where: { status: { notIn: ["QC_PASSED", "QC_FAILED"] } },
              include: { vendor: { select: { name: true } } },
            },
          },
        });
        if (!step) {
          throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบขั้นตอนผลิตนี้" });
        }
        if (step.status === "COMPLETED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "ขั้นตอนนี้เสร็จแล้ว ส่งร้านนอกซ้ำไม่ได้",
          });
        }
        if (step.outsourceOrders.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `ขั้นตอนนี้มีงานค้างอยู่กับร้าน ${step.outsourceOrders[0].vendor.name} — ตัดสิน QC งานเดิมก่อนเปิดรอบใหม่`,
          });
        }

        // เงินผ่าน Decimal — ปัด 2 ตำแหน่งก่อนเขียน DB
        const unitCost = moneyInput(input.unitCost);
        const order = await tx.outsourceOrder.create({
          data: {
            ...input,
            unitCost: unitCost.toNumber(),
            totalCost: round2(unitCost.times(input.quantity)).toNumber(),
            expectedBackAt: input.expectedBackAt ? new Date(input.expectedBackAt) : null,
          },
        });

        await tx.productionStep.update({
          where: { id: input.productionStepId },
          data: { status: "IN_PROGRESS" },
        });

        await createAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entityType: "OUTSOURCE_ORDER",
          entityId: order.id,
          newValue: { vendorId: input.vendorId, totalCost: order.totalCost },
        });

        return order;
      });
    }),

  // ยกเลิกได้เฉพาะใบร่างที่ยังไม่ส่งของจริง — ใบที่เปิดผิด/ร้านไม่รับงานก่อนส่ง
  // (ส่งแล้วให้เดิน รับกลับ → QC ไม่ผ่าน ตามจริง — ประวัติงานร้านห้ามหาย)
  cancelDraftOrder: protectedProcedure
    .use(managerUp)
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.$transaction(async (tx) => {
        const order = await tx.outsourceOrder.findUniqueOrThrow({
          where: { id: input.id },
          select: { id: true, status: true, productionStepId: true, vendorId: true },
        });
        if (order.status !== "DRAFT") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "ยกเลิกได้เฉพาะใบร่าง — ใบที่ส่งร้านแล้วให้เดินสถานะรับกลับ/QC ตามจริง",
          });
        }

        await tx.outsourceOrder.delete({ where: { id: input.id } });

        // ไม่มีใบอื่นค้างบน step → คืนสถานะ step ให้รอทำต่อ
        const remaining = await tx.outsourceOrder.count({
          where: {
            productionStepId: order.productionStepId,
            status: { notIn: ["QC_PASSED", "QC_FAILED"] },
          },
        });
        if (remaining === 0) {
          await tx.productionStep.updateMany({
            where: { id: order.productionStepId, status: "IN_PROGRESS" },
            data: { status: "PENDING" },
          });
        }

        await createAuditLog(tx, {
          userId: ctx.userId,
          action: "DELETE",
          entityType: "OUTSOURCE_ORDER",
          entityId: input.id,
          reason: "ยกเลิกใบร่าง (ยังไม่ส่งของ)",
          oldValue: { vendorId: order.vendorId, productionStepId: order.productionStepId },
        });

        return { ok: true };
      });
    }),

  updateOrderStatus: protectedProcedure
    .use(productionUp)
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["SENT", "IN_PROGRESS", "COMPLETED", "RECEIVED_BACK", "QC_PASSED", "QC_FAILED"]),
        qcNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // ตัดสิน QC (ซึ่งปิด production step อัตโนมัติ) = อำนาจหัวหน้า
      // staff อัปเดตได้แค่สถานะรับ-ส่งของ (SENT/RECEIVED_BACK ฯลฯ)
      if (
        ctx.userRole === "PRODUCTION_STAFF" &&
        (data.status === "QC_PASSED" || data.status === "QC_FAILED")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "การตัดสิน QC งานนอกต้องเป็นผู้จัดการขึ้นไป",
        });
      }

      const updateData: Record<string, unknown> = { status: data.status };

      if (data.status === "SENT") updateData.sentAt = new Date();
      if (data.status === "RECEIVED_BACK") updateData.receivedAt = new Date();
      // QC derive จาก status เท่านั้น — ห้ามมี input แยกให้ขัดกันเอง
      if (data.status === "QC_PASSED") updateData.qcPassed = true;
      if (data.status === "QC_FAILED") updateData.qcPassed = false;
      if (data.qcNotes) updateData.qcNotes = data.qcNotes;

      // อ่าน → validate transition → เขียนแบบมีเงื่อนไขสถานะเดิม = transaction เดียว
      // (กันสองจอกด QC ชนกัน: เขียนผ่าน updateMany where {id, status เดิม} — ถ้าใบถูก
      // คนอื่นตัดสินไประหว่างทาง count เป็น 0 คนช้าเจอ error ไม่ใช่เขียนทับ
      // — validate เฉยๆ ไม่พอ เพราะคนช้าอ่านสถานะก่อนคนเร็ว commit แล้วผ่าน validate ได้)
      return ctx.prisma.$transaction(async (tx) => {
        const current = await tx.outsourceOrder.findUniqueOrThrow({
          where: { id },
          select: { status: true, productionStepId: true },
        });
        const allowed = OUTSOURCE_TRANSITIONS[current.status] ?? [];
        if (!allowed.includes(data.status)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `ใบนี้สถานะ "${OUTSOURCE_STATUS_TH[current.status] ?? current.status}" แล้ว — เปลี่ยนเป็น "${OUTSOURCE_STATUS_TH[data.status] ?? data.status}" ไม่ได้ (อาจมีคนอัปเดตไปก่อน ลองรีเฟรช)`,
          });
        }

        const written = await tx.outsourceOrder.updateMany({
          where: { id, status: current.status },
          data: updateData,
        });
        if (written.count === 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "มีคนอัปเดตใบนี้ไปก่อนหน้านี้พอดี — รีเฟรชแล้วดูสถานะล่าสุดก่อน",
          });
        }
        const order = await tx.outsourceOrder.findUniqueOrThrow({ where: { id } });

        // QC ผ่าน → ปิด step + ถ้าทุก step เสร็จ ปิดใบผลิต + ดันออเดอร์เข้า "ตรวจคุณภาพ"
        // (rollup กลางตัวเดียวกับ production.updateStep — ตรรกะปิดงาน/ดันสถานะอยู่ที่เดียว)
        if (data.status === "QC_PASSED") {
          const step = await tx.productionStep.update({
            where: { id: order.productionStepId },
            data: { status: "COMPLETED", qcPassed: true, completedAt: new Date() },
            select: { productionId: true, production: { select: { orderId: true } } },
          });
          await finalizeProductionIfComplete(tx, {
            productionId: step.productionId,
            changedBy: ctx.userId,
          });

          // ค่าจ้างร้านนอก → ต้นทุนออเดอร์ เฉพาะเมื่อมีตัวเลขจริง — ใบที่ไม่กรอกค่าจ้าง
          // (ทางปกติ หลังเบสเคาะเลิกคิดต้นทุนต่องาน 2026-06-12) ไม่สร้างแถว 0 บาททิ้งไว้
          if (Number(order.totalCost) > 0) {
            const vendor = await tx.vendor.findUniqueOrThrow({
              where: { id: order.vendorId },
              select: { name: true },
            });
            await tx.costEntry.upsert({
              where: { sourceRef: `outsource:${order.id}` },
              create: {
                orderId: step.production.orderId,
                category: "OUTSOURCE",
                name: `ค่าจ้างร้านนอก: ${vendor.name}`,
                description: order.description,
                amount: order.totalCost,
                sourceRef: `outsource:${order.id}`,
                createdById: ctx.userId,
              },
              update: { amount: order.totalCost },
            });
          }
        }
        // QC ไม่ผ่าน → เปิด step กลับมารอส่งแก้รอบใหม่ (แม้เคยถูก mark เสร็จมือไปแล้ว)
        if (data.status === "QC_FAILED") {
          await tx.productionStep.update({
            where: { id: order.productionStepId },
            data: {
              status: "IN_PROGRESS",
              qcPassed: false,
              qcNotes: data.qcNotes,
              completedAt: null,
            },
          });
        }

        await createAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entityType: "OUTSOURCE_ORDER",
          entityId: id,
          oldValue: { status: current.status },
          newValue: { status: data.status, qcNotes: data.qcNotes },
        });

        return order;
      });
    }),
});

// เส้นทางสถานะใบ outsource — ใบที่ตัดสิน QC แล้วจบถาวร (รอบใหม่ = เปิดใบใหม่)
const OUTSOURCE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SENT"],
  SENT: ["IN_PROGRESS", "COMPLETED", "RECEIVED_BACK"],
  IN_PROGRESS: ["COMPLETED", "RECEIVED_BACK"],
  COMPLETED: ["RECEIVED_BACK"],
  RECEIVED_BACK: ["QC_PASSED", "QC_FAILED"],
  QC_PASSED: [],
  QC_FAILED: [],
};

const OUTSOURCE_STATUS_TH: Record<string, string> = {
  DRAFT: "ร่าง",
  SENT: "ส่งร้านแล้ว",
  IN_PROGRESS: "ร้านกำลังทำ",
  COMPLETED: "ร้านทำเสร็จ",
  RECEIVED_BACK: "รับกลับ รอ QC",
  QC_PASSED: "QC ผ่าน",
  QC_FAILED: "QC ไม่ผ่าน",
};
