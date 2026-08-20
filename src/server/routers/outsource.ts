import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requirePermission } from "../trpc";
import { hasPermission } from "@/lib/permissions";
import { firstPendingStepIdsByLane } from "@/lib/production-step-actions";
import { isOutsourceStep } from "@/lib/production-steps";
import type { PrismaTx } from "@/lib/prisma";
import { badRequest, conflict } from "@/server/errors";
import { createAuditLog } from "@/server/helpers";
import { moneyInput, round2 } from "@/server/services/money";
import { finalizeProductionIfComplete } from "@/server/services/order-status";
import { lockOrderRow, recalcOrderCost } from "@/server/services/order-cost";
import { lockProductionTopology } from "@/server/services/production-topology-lock";

// PERM3: ทะเบียนร้านนอก = ข้อมูลหลัก (default OWNER/MANAGER) · ใบงานนอก = งานผลิต
const managerUp = requirePermission("manage_settings");
const productionUp = requirePermission("manage_production");

type OutsourceProductionReference = {
  productionStepId: string;
  productionStep: {
    productionId: string;
    stepType: string;
    status: string;
    qtyDone: number;
    production: { orderId: string };
  };
};

const outsourceProductionReferenceSelect = {
  productionStepId: true,
  productionStep: {
    select: {
      productionId: true,
      stepType: true,
      status: true,
      qtyDone: true,
      production: { select: { orderId: true } },
    },
  },
} as const;

function sameOutsourceProductionReference(
  left: OutsourceProductionReference,
  right: OutsourceProductionReference,
) {
  return (
    left.productionStepId === right.productionStepId &&
    left.productionStep.productionId === right.productionStep.productionId &&
    left.productionStep.production.orderId === right.productionStep.production.orderId
  );
}

/**
 * QC แตะ step และ QC_PASSED เรียก finalizer ที่อาจปิด PACKAGING เก่า จึงต้อง
 * ถือ topology mutex → steps ทั้ง production ORDER BY id → production → order
 * ก่อนเขียนใบ outsource/step และอ่าน status สดซ้ำหลัง lock ครบเสมอ.
 */
async function lockOutsourceProductionChain(tx: PrismaTx, id: string) {
  const before = await tx.outsourceOrder.findUniqueOrThrow({
    where: { id },
    select: outsourceProductionReferenceSelect,
  });
  const orderId = before.productionStep.production.orderId;
  const productionId = before.productionStep.productionId;

  await lockProductionTopology(tx, orderId);
  const afterTopology = await tx.outsourceOrder.findUniqueOrThrow({
    where: { id },
    select: outsourceProductionReferenceSelect,
  });
  if (!sameOutsourceProductionReference(before, afterTopology)) {
    conflict("โครงใบงานนอกเปลี่ยนจากอีกหน้าจอแล้ว — กรุณาโหลดใหม่");
  }

  await tx.$queryRaw`SELECT id FROM production_steps WHERE production_id = ${productionId} ORDER BY id FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM productions WHERE id = ${productionId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;

  const current = await tx.outsourceOrder.findUniqueOrThrow({
    where: { id },
    select: {
      status: true,
      ...outsourceProductionReferenceSelect,
    },
  });
  if (!sameOutsourceProductionReference(afterTopology, current)) {
    conflict("โครงใบงานนอกเปลี่ยนจากอีกหน้าจอแล้ว — กรุณาโหลดใหม่");
  }

  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { internalStatus: true, orderNumber: true },
  });
  const siblings = await tx.productionStep.findMany({
    where: { productionId },
    select: { id: true, stepType: true, status: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  return { current, productionId, orderId, order, siblings };
}

async function lockOutsourceStepChain(tx: PrismaTx, stepId: string) {
  // สอง read แรกใช้หา lock scope เท่านั้น; การตัดสินทุกอย่างอ่านซ้ำหลัง lock ครบ
  const stepReference = await tx.productionStep.findUniqueOrThrow({
    where: { id: stepId },
    select: { productionId: true },
  });
  const productionReference = await tx.production.findUniqueOrThrow({
    where: { id: stepReference.productionId },
    select: { orderId: true },
  });

  await lockProductionTopology(tx, productionReference.orderId);
  await tx.$queryRaw`SELECT id FROM production_steps WHERE production_id = ${stepReference.productionId} ORDER BY id FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM productions WHERE id = ${stepReference.productionId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${productionReference.orderId} FOR UPDATE`;

  const step = await tx.productionStep.findUniqueOrThrow({
    where: { id: stepId },
    select: {
      id: true,
      productionId: true,
      stepType: true,
      status: true,
      sortOrder: true,
      qtyDone: true,
    },
  });
  const production = await tx.production.findUniqueOrThrow({
    where: { id: step.productionId },
    select: { orderId: true },
  });
  if (
    step.productionId !== stepReference.productionId ||
    production.orderId !== productionReference.orderId
  ) {
    conflict("โครงใบผลิตเปลี่ยนจากอีกหน้าจอแล้ว — กรุณาโหลดใหม่");
  }

  const [order, siblings] = await Promise.all([
    tx.order.findUniqueOrThrow({
      where: { id: production.orderId },
      select: { internalStatus: true, orderNumber: true },
    }),
    tx.productionStep.findMany({
      where: { productionId: step.productionId },
      select: { id: true, stepType: true, status: true, sortOrder: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
  ]);

  return { step, production, order, siblings };
}

function assertOutsourceStepActionable(input: Awaited<ReturnType<typeof lockOutsourceStepChain>>) {
  if (input.order.internalStatus !== "PRODUCING") {
    badRequest(
      `เปิดใบงานร้านนอกไม่ได้ — ออเดอร์ ${input.order.orderNumber} ไม่ได้อยู่สถานะกำลังผลิต`,
    );
  }
  if (!isOutsourceStep(input.step.stepType)) {
    badRequest("เปิดใบงานร้านนอกได้เฉพาะขั้นที่กำหนดให้ส่งร้านนอกเท่านั้น");
  }
  if (input.step.status !== "PENDING" && input.step.status !== "IN_PROGRESS") {
    badRequest(
      input.step.status === "FAILED"
        ? "ขั้นนี้มีปัญหาอยู่ — ให้หัวหน้าแก้ปัญหาขั้นงานก่อนเปิดใบร้านนอก"
        : `ขั้นนี้อยู่สถานะ ${input.step.status} จึงเปิดใบงานร้านนอกไม่ได้`,
    );
  }
  if (!firstPendingStepIdsByLane(input.siblings).has(input.step.id)) {
    badRequest("ยังเปิดใบงานร้านนอกของขั้นนี้ไม่ได้ — ทำขั้นก่อนหน้าในสายงานเดียวกันให้เสร็จก่อน");
  }
}

function assertOutsourceQcActionable(
  scope: Awaited<ReturnType<typeof lockOutsourceProductionChain>>,
) {
  const step = scope.current.productionStep;
  if (scope.order.internalStatus !== "PRODUCING") {
    badRequest(
      `ตัดสิน QC งานนอกไม่ได้ — ออเดอร์ ${scope.order.orderNumber} ไม่ได้อยู่สถานะกำลังผลิต`,
    );
  }
  if (!isOutsourceStep(step.stepType)) {
    badRequest("ใบนี้ไม่ได้ผูกกับขั้นงานร้านนอกที่ระบบรองรับ — ให้หัวหน้าตรวจใบผลิตก่อน");
  }
  if (step.status !== "PENDING" && step.status !== "IN_PROGRESS") {
    badRequest(
      step.status === "FAILED"
        ? "ขั้นนี้ถูกแจ้งปัญหาอยู่ — ให้หัวหน้าแก้ปัญหาขั้นงานก่อนตัดสิน QC ร้านนอก"
        : `ขั้นนี้อยู่สถานะ ${step.status} จึงตัดสิน QC งานนอกไม่ได้`,
    );
  }
  if (!firstPendingStepIdsByLane(scope.siblings).has(scope.current.productionStepId)) {
    badRequest("ยังตัดสิน QC ขั้นนี้ไม่ได้ — ขั้นก่อนหน้าในสายงานเดียวกันยังไม่เสร็จ");
  }
}

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
      // สร้างใบ + ดันสถานะ step + audit = ก้อนเดียวกัน · validate ใต้ transaction
      return ctx.prisma.$transaction(async (tx) => {
        const locked = await lockOutsourceStepChain(tx, input.productionStepId);
        assertOutsourceStepActionable(locked);
        // แบ่งส่งหลายรอบ (FLOW-REDESIGN ก้อน 1): ขั้นเดียวเปิดหลายใบพร้อมกันได้ —
        // ส่งของบางส่วนไปก่อนปลดล็อกงานค้าง (เดิมบังคับทีละใบ รอ QC จบถึงเปิดใหม่)
        // ขั้นจะปิดเองเมื่อทุกใบตัดสินแล้ว + จำนวนผ่าน QC ครบ (ดู updateOrderStatus)

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
        const lockedScope = await lockOutsourceProductionChain(tx, input.id);
        const order = await tx.outsourceOrder.findUniqueOrThrow({
          where: { id: input.id },
          select: { id: true, status: true, productionStepId: true, vendorId: true },
        });
        if (
          order.productionStepId !== lockedScope.current.productionStepId ||
          order.status !== lockedScope.current.status
        ) {
          conflict("ใบงานนอกเปลี่ยนจากอีกหน้าจอแล้ว — กรุณาโหลดใหม่");
        }
        if (order.status !== "DRAFT") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "ยกเลิกได้เฉพาะใบร่าง — ใบที่ส่งร้านแล้วให้เดินสถานะรับกลับ/QC ตามจริง",
          });
        }

        const deleted = await tx.outsourceOrder.deleteMany({
          where: { id: input.id, status: "DRAFT" },
        });
        if (deleted.count === 0) {
          conflict("มีคนส่งใบนี้ไปร้านก่อนหน้าจอนี้พอดี — รีเฟรชแล้วดูสถานะล่าสุดก่อน");
        }

        // ไม่มีใบอื่นค้างและยังไม่เคยผ่าน QC บางส่วน → คืนเป็น PENDING.
        // ถ้า qtyDone > 0 ต้องคง IN_PROGRESS ไม่งั้น split round ที่ผ่านแล้วจะดูเหมือนไม่เคยเริ่ม.
        const remaining = await tx.outsourceOrder.count({
          where: {
            productionStepId: order.productionStepId,
            status: { notIn: ["QC_PASSED", "QC_FAILED"] },
          },
        });
        if (remaining === 0 && lockedScope.current.productionStep.qtyDone === 0) {
          await tx.productionStep.updateMany({
            where: { id: order.productionStepId, status: "IN_PROGRESS", qtyDone: 0 },
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
        !hasPermission(ctx.userRole, ctx.permissionOverrides, "supervise_operations") &&
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
        // QC ทั้งสองผลแตะ production step; QC_PASSED ยังเรียก finalizer.
        // จึงต้องถือ chain lock ก่อน CAS ใบ outsource เพื่อไม่ให้เกิดวงจร
        // outsource row → step สวนทางกับ writer อื่นที่ถือ step → outsource row.
        const lockedScope =
          data.status === "QC_PASSED" || data.status === "QC_FAILED"
            ? await lockOutsourceProductionChain(tx, id)
            : null;
        const current = lockedScope
          ? lockedScope.current
          : await tx.outsourceOrder.findUniqueOrThrow({
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
        if (lockedScope) {
          assertOutsourceQcActionable(lockedScope);
        }

        // รับของกลับต้องผ่านใบตรวจนับก่อน (Gate B4) — UI ทั้งสองหน้า (/outsource + บอร์ดเลน)
        // เปิดใบตรวจรับให้นับแล้วค่อย flip สถานะ · ด่านนี้กันเส้น API ตรงที่ข้ามการนับ
        // (วางหลัง validate transition — ใบที่ตัดสินแล้ว/สถานะผิดยังได้ error เดิมก่อน)
        if (data.status === "RECEIVED_BACK") {
          const receiptCount = await tx.goodsReceipt.count({
            where: { outsourceOrderId: id, receiptType: "OUTSOURCE_RETURN" },
          });
          if (receiptCount === 0) {
            badRequest(
              "ยังไม่มีใบตรวจนับรับของกลับ — นับของจริงผ่านใบตรวจรับก่อน แล้วสถานะจะขยับให้เอง"
            );
          }
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

        // QC ผ่าน → นับยอดเข้า qtyDone ของขั้น · ปิดขั้นเมื่อ "ทุกใบตัดสินแล้ว + จำนวนครบ"
        // (แบ่งส่งหลายรอบ: ผ่านบางใบขั้นยังเปิด รอใบที่เหลือ/ส่วนที่ยังไม่ส่ง)
        // ใบผลิต/ออเดอร์ดันผ่าน rollup กลางตัวเดียวกับ production.updateStep
        if (data.status === "QC_PASSED") {
          if (!lockedScope) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "ไม่สามารถล็อกใบผลิตสำหรับ QC งานนอกได้",
            });
          }
          // chain lock ถือ target + sibling steps (รวม PACKAGING เก่า) ครบแล้ว
          const bumped = await tx.productionStep.update({
            where: { id: order.productionStepId },
            data: { qtyDone: { increment: order.quantity } },
            select: { qtyDone: true, qtyTotal: true },
          });
          const openOrders = await tx.outsourceOrder.count({
            where: {
              productionStepId: order.productionStepId,
              status: { notIn: ["QC_PASSED", "QC_FAILED"] },
            },
          });
          const qtyComplete = bumped.qtyTotal === null || bumped.qtyDone >= bumped.qtyTotal;
          const step = await (openOrders === 0 && qtyComplete
            ? tx.productionStep.update({
                where: { id: order.productionStepId },
                data: { status: "COMPLETED", qcPassed: true, completedAt: new Date() },
                select: { productionId: true },
              })
            : tx.productionStep.update({
                where: { id: order.productionStepId },
                data: { status: "IN_PROGRESS", qcPassed: true },
                select: { productionId: true },
              }));
          if (step.productionId !== lockedScope.productionId) {
            conflict("โครงใบงานนอกเปลี่ยนจากอีกหน้าจอแล้ว — กรุณาโหลดใหม่");
          }
          await finalizeProductionIfComplete(tx, {
            productionId: lockedScope.productionId,
            changedBy: ctx.userId,
          });

          // ค่าจ้างร้านนอก → ต้นทุนออเดอร์ เฉพาะเมื่อมีตัวเลขจริง — ใบที่ไม่กรอกค่าจ้าง
          // (ทางปกติ หลังเบสเคาะเลิกคิดต้นทุนต่องาน 2026-06-12) ไม่สร้างแถว 0 บาททิ้งไว้
          if (Number(order.totalCost) > 0) {
            const vendor = await tx.vendor.findUniqueOrThrow({
              where: { id: order.vendorId },
              select: { name: true },
            });
            // เขียน costEntry ต้อง lock+recalc ชุดเดียวกัน — ไม่งั้น order.totalCost drift
            // (invariant: services/order-cost.ts · Gate A4 audit 2026-07-02)
            await lockOrderRow(tx, lockedScope.orderId);
            await tx.costEntry.upsert({
              where: { sourceRef: `outsource:${order.id}` },
              create: {
                orderId: lockedScope.orderId,
                category: "OUTSOURCE",
                name: `ค่าจ้างร้านนอก: ${vendor.name}`,
                description: order.description,
                amount: order.totalCost,
                sourceRef: `outsource:${order.id}`,
                createdById: ctx.userId,
              },
              update: { amount: order.totalCost },
            });
            await recalcOrderCost(tx, lockedScope.orderId);
          }
        }
        // QC ไม่ผ่าน → เปิด step กลับมารอส่งแก้รอบใหม่ (แม้เคยถูก mark เสร็จมือไปแล้ว)
        if (data.status === "QC_FAILED") {
          if (!lockedScope) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "ไม่สามารถล็อกใบผลิตสำหรับ QC งานนอกได้",
            });
          }
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
