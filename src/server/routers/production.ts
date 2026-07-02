import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireRole } from "../trpc";
import { createAuditLog, createNotification } from "@/server/helpers";
import { transitionOrder, finalizeProductionIfComplete } from "@/server/services/order-status";
import { isValidTransition } from "@/lib/order-status";
import { STEP_TYPE_LABELS } from "@/lib/production-steps";
import {
  getGarmentPickState,
  issueGarments,
  returnGarments,
} from "@/server/services/garment-pick";
import { getOrdersReadiness } from "@/server/services/production-readiness";
import { lockOrderRow, recalcOrderCost } from "@/server/services/order-cost";
import { getStockClientFromSettings } from "@/lib/stock-api";

// วางแผนการผลิต = งานระดับบริหารตามตาราง RBAC §7
const managerUp = requireRole("OWNER", "MANAGER");
const productionTeam = requireRole("OWNER", "MANAGER", "PRODUCTION_STAFF");

// select กลางของขั้นตอนผลิต — จงใจไม่มี field เงิน (estimatedCost/actualCost/unitCost/totalCost):
// endpoint พวกนี้เปิดทุก role — เงินต้องไม่ไหลถึง browser แม้ UI ไม่ render
// (เบสเคาะ 2026-06-12: ไม่คิดต้นทุนต่องานในระบบนี้)
const stepSelect = {
  id: true,
  productionId: true,
  stepType: true,
  customStepName: true,
  status: true,
  sortOrder: true,
  qtyDone: true,
  qtyTotal: true,
  startedAt: true,
  completedAt: true,
  qcPassed: true,
  qcNotes: true,
  notes: true,
  assignedTo: { select: { id: true, name: true } },
  outsourceOrders: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      status: true,
      description: true,
      quantity: true,
      sentAt: true,
      expectedBackAt: true,
      receivedAt: true,
      qcPassed: true,
      qcNotes: true,
      notes: true,
      createdAt: true,
      vendor: { select: { id: true, name: true } },
    },
  },
  // ขั้นที่อยู่ในรอบพิมพ์ค้าง (PRINTING/PRINTED) — UI สลับปุ่ม เริ่ม/เสร็จ เป็นลิงก์ไปหน้า
  // รอบพิมพ์ (updateStep ของขั้นพวกนี้ถูก server บล็อกแล้ว) · ไม่มี field เงิน — ปลอดภัยทุก role
  // (assert ชนิด array กัน as const ทำให้กลาย readonly ซึ่ง Prisma ไม่รับ)
  printRunItems: {
    where: {
      printRun: { status: { in: ["PRINTING", "PRINTED"] as ("PRINTING" | "PRINTED")[] } },
    },
    select: { printRun: { select: { runNumber: true, status: true } } },
  },
} as const;

export const productionRouter = router({
  getByOrderId: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.production.findMany({
        where: { orderId: input.orderId },
        select: {
          id: true,
          orderId: true,
          status: true,
          notes: true,
          steps: { orderBy: { sortOrder: "asc" }, select: stepSelect },
        },
      });
    }),

  // หน้าใบผลิต /production/[id] — ใบผลิต + บริบทออเดอร์ที่ช่างต้องเห็น (ไม่มี field เงินใดๆ)
  // steps ใช้ select shape เดียวกับ getByOrderId — dialog ฝั่ง UI ใช้ type ร่วมกันได้ตรงๆ
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.production.findUniqueOrThrow({
        where: { id: input.id },
        select: {
          id: true,
          orderId: true,
          status: true,
          notes: true,
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
          steps: { orderBy: { sortOrder: "asc" }, select: stepSelect },
        },
      });
    }),

  // บริบทออเดอร์สำหรับเปิดใบผลิต — dialog ดึงเอง (รับแค่ orderId)
  // รองรับทุกทางเข้า: kanban · การ์ดสรุปหน้าออเดอร์ · deep-link ?create=
  // derive ฝั่ง server ครบ 3 อย่างที่ตัวแนะนำสายงานใช้: วิธีพิมพ์ + แหล่งเสื้อ + add-on
  // (เดิมส่งแค่ printTypes — ใบผลิตเลยไม่เคยมีขั้นเตรียมเสื้อ/เย็บป้ายคอ)
  orderContext: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const order = await ctx.prisma.order.findUniqueOrThrow({
        where: { id: input.orderId },
        select: {
          orderNumber: true,
          title: true,
          items: {
            select: {
              prints: { select: { printType: true } },
              products: { select: { itemSource: true } },
              addons: { select: { addonType: true } },
            },
          },
        },
      });
      // ด่านพร้อมผลิตในจุดเปิดใบผลิต = soft-gate: หัวหน้าเปิดได้แต่ต้องเห็นว่าติดอะไร
      const readiness =
        (await getOrdersReadiness(ctx.prisma, [input.orderId])).get(input.orderId) ?? null;
      return {
        orderNumber: order.orderNumber,
        title: order.title,
        printTypes: [
          ...new Set(order.items.flatMap((it) => it.prints.map((p) => p.printType))),
        ],
        itemSources: [
          ...new Set(
            order.items.flatMap((it) =>
              it.products.map((p) => p.itemSource).filter((s): s is string => s !== null)
            )
          ),
        ],
        addonTypes: [
          ...new Set(order.items.flatMap((it) => it.addons.map((a) => a.addonType))),
        ],
        readiness,
      };
    }),

  // กระดานการผลิต — ออเดอร์ทุกใบที่อยู่ในเฟสผลิต-จัดส่ง · ทุก role ดูได้
  // ส่งขั้นตอนแบบละเอียด (ชนิด/สถานะ/outsource ล่าสุด) — UI จัดเลนต่อเทคนิคเอง
  // จากเนื้อขั้นตอนจริง (เบสเคาะ 2026-06-12: มุมมองแยกเทคนิค ไม่ใช่กองเดียวตามสถานะ)
  // ปุ่มเลื่อนสถานะฝั่ง UI gate ด้วย canRoleSetStatus — server ยัง validate ซ้ำเสมอ
  kanban: protectedProcedure.query(async ({ ctx }) => {
    const orders = await ctx.prisma.order.findMany({
      where: {
        OR: [
          {
            internalStatus: {
              in: [
                "DESIGN_APPROVED",
                "PRODUCTION_QUEUE",
                "PRODUCING",
                "QUALITY_CHECK",
                "PACKING",
                "READY_TO_SHIP",
              ],
            },
          },
          // เสื้อเปล่าจากสต๊อค (READY_MADE) ไม่มีขั้นออกแบบ — จุดพร้อมผลิตคือ CONFIRMED
          // ถ้าไม่รวม คิว "รอเปิดใบผลิต" จะมองไม่เห็นงานสต๊อคเลย (CUSTOM ที่ CONFIRMED
          // ยังต้องผ่านออกแบบก่อน จึงห้ามลากเข้ามาทั้งหมด)
          { internalStatus: "CONFIRMED", orderType: "READY_MADE" },
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        title: true,
        deadline: true,
        priority: true,
        internalStatus: true,
        orderType: true,
        blindShip: true, // ธงแดงบนการ์ดเลนแพ็ค (ก้อน 3)
        customer: { select: { name: true } },
        productions: {
          select: {
            id: true,
            status: true,
            steps: {
              orderBy: { sortOrder: "asc" },
              select: {
                id: true,
                stepType: true,
                customStepName: true,
                status: true,
                sortOrder: true,
                qtyDone: true,
                qtyTotal: true,
                // id ด้วย — UI ต้องเทียบกับ me.id กันโชว์ปุ่มบนงานที่เป็นของคนอื่น
                assignedTo: { select: { id: true, name: true } },
                outsourceOrders: {
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: {
                    id: true,
                    status: true,
                    expectedBackAt: true,
                    vendor: { select: { name: true } },
                  },
                },
                // ขั้นที่อยู่ในรอบพิมพ์ค้าง — การ์ดเลนสลับปุ่ม เริ่ม/เสร็จ เป็นลิงก์ไป
                // หน้ารอบพิมพ์ (updateStep ถูก server บล็อกแล้ว ปุ่มเดิมกดได้แต่ error)
                printRunItems: {
                  where: { printRun: { status: { in: ["PRINTING", "PRINTED"] } } },
                  select: { printRun: { select: { runNumber: true, status: true } } },
                },
              },
            },
          },
        },
        items: { select: { totalQuantity: true } },
      },
      orderBy: { deadline: "asc" },
      take: 200,
    });
    // ด่านพร้อมผลิต — คิดเฉพาะออเดอร์ที่อยู่ในคิว "รอเปิดใบผลิต" (เกณฑ์เดียวกับหน้า
    // /production): เงินตามเทอม + แบบอนุมัติ + ของครบ · งานติดด่านแยกกองไม่ปนคิวช่าง
    const queueIds = orders
      .filter(
        (o) =>
          ["CONFIRMED", "DESIGN_APPROVED", "PRODUCTION_QUEUE"].includes(o.internalStatus) ||
          (o.internalStatus === "PRODUCING" && o.productions.length === 0)
      )
      .map((o) => o.id);
    const readinessById = await getOrdersReadiness(ctx.prisma, queueIds);

    return orders.map((o) => {
      const steps = o.productions.flatMap((p) => p.steps);
      const stepsDone = steps.filter((s) => s.status === "COMPLETED").length;
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        title: o.title,
        deadline: o.deadline,
        priority: o.priority,
        internalStatus: o.internalStatus,
        orderType: o.orderType,
        blindShip: o.blindShip,
        customerName: o.customer?.name ?? null,
        productionId: o.productions[0]?.id ?? null,
        productions: o.productions,
        stepsDone,
        stepsTotal: steps.length,
        totalQuantity: o.items.reduce((s, it) => s + it.totalQuantity, 0),
        readiness: readinessById.get(o.id) ?? null,
      };
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
              "DTF_PRINT", "HEAT_PRESS", "DTG_PRETREAT", "DTG_PRINT", "CURING",
              "PATTERN_MAKING", "SCREEN_PRINTING", "TAGGING",
              "PACKAGING", "EMBROIDERY", "SPECIAL_PRINT", "SEWING", "CUSTOM",
              "GARMENT_PICK", "GARMENT_RECEIVE", "SUBLIMATION",
            ]),
            customStepName: z.string().optional(),
            sortOrder: z.number(),
            estimatedCost: z.number().optional(),
            notes: z.string().optional(),
          })
        ).min(1, "ใบผลิตต้องมีอย่างน้อย 1 ขั้นตอน"),
        // ใบผลิตศูนย์ขั้นทำให้ออเดอร์ PRODUCING หายจากทุก section ของหน้าการผลิต
        // (ไม่มีขั้นค้าง = ไม่มีการ์ดสักเลน) และ finalize ไม่มีวันปิดให้
      })
    )
    .mutation(async ({ ctx, input }) => {
      // รายการที่ยังเป็น "โครงจากใบเสนอ" ทั้งใบ (OTHER + ไซส์ FREE ล้วน) ห้ามเข้าผลิต —
      // ช่างไม่มีไซส์/สี/ลายให้ทำงาน ต้องแก้รายการเป็นของจริงก่อน (audit ข้อ 10)
      // โครง = ไม่ผูกสินค้าจริง (productId null) และไม่มีแหล่งที่มา (itemSource null) เท่านั้น —
      // สินค้าฟรีไซส์จากสต็อก/เสื้อลูกค้าส่งมา ก็เป็น OTHER+FREE ได้ ห้ามเหมาว่าโครง
      // (เบสเจอจริง 2026-06-12: เสื้อ oversize ฟรีไซส์จากสต็อกโดนด่านนี้บล็อก)
      const orderProducts = await ctx.prisma.orderItemProduct.findMany({
        where: { orderItem: { orderId: input.orderId } },
        select: {
          productType: true,
          productId: true,
          itemSource: true,
          variants: { select: { size: true, quantity: true } },
        },
      });
      const allSkeleton =
        orderProducts.length > 0 &&
        orderProducts.every(
          (p) =>
            p.productType === "OTHER" &&
            p.productId === null &&
            p.itemSource === null &&
            p.variants.every((v) => v.size === "FREE")
        );
      if (allSkeleton) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            'รายการออเดอร์ยังเป็นโครงจากใบเสนอ (ไม่มีสินค้า/ไซส์จริง) — กด "แก้ไขรายการ" ใส่ของจริงก่อนเปิดใบผลิต',
        });
      }

      // จำนวนทั้งหมดต่อขั้นตั้งต้น = จำนวนเสื้อทั้งออเดอร์ (บอก "บางส่วน" ได้ — แก้ราย
      // ขั้นทีหลังได้ใน dialog อัปเดต) · ออเดอร์ไม่มีจำนวน = ขั้นแบบติ๊กเฉยๆ (qtyTotal null)
      const orderTotalQty = orderProducts.reduce(
        (s, p) => s + p.variants.reduce((vs, v) => vs + v.quantity, 0),
        0
      );

      // ใบผลิต + เปลี่ยนสถานะ = ก้อนเดียวกัน — สถานะต้องเดินตาม machine เท่านั้น
      // (no-op ถ้าออเดอร์ PRODUCING อยู่แล้ว เช่นเปิดใบผลิตใบที่สอง)
      return ctx.prisma.$transaction(async (tx) => {
        const production = await tx.production.create({
          data: {
            orderId: input.orderId,
            steps: {
              create: input.steps.map((s) => ({
                ...s,
                qtyTotal: orderTotalQty > 0 ? orderTotalQty : null,
              })),
            },
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
        actualCost: z.number().min(0).optional(),
        // บอก "บางส่วน" ได้ — ทำแล้ว/ทั้งหมด (qtyTotal null = ขั้นแบบติ๊กเฉยๆ)
        qtyDone: z.number().int().min(0).optional(),
        qtyTotal: z.number().int().min(0).nullable().optional(),
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

        // ขั้นที่อยู่ในรอบพิมพ์ค้าง (PRINTING/PRINTED): สถานะ/จำนวนเดินผ่านรอบเท่านั้น —
        // จุดตัดแยกฟิล์มเป็นด่านบังคับ ปิดมือ = ข้ามด่าน + จำนวนถูกนับซ้อนตอนรอบปิด
        // (guard pattern เดียวกับใบ outsource ค้างด้านล่าง — lock แถวก่อนเช็คกัน race กับเปิดรอบ)
        if (
          data.status !== undefined ||
          data.qtyDone !== undefined ||
          data.qtyTotal !== undefined
        ) {
          await tx.$queryRaw`SELECT id FROM production_steps WHERE id = ${stepId} FOR UPDATE`;
          const activeRun = await tx.printRunItem.findFirst({
            where: {
              productionStepId: stepId,
              printRun: { status: { in: ["PRINTING", "PRINTED"] } },
            },
            select: { printRun: { select: { runNumber: true } } },
          });
          if (activeRun) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `งานอยู่ในรอบพิมพ์ ${activeRun.printRun.runNumber} — จัดการที่หน้ารอบพิมพ์ฟิล์ม (พิมพ์จบ/ตัดแยกเสร็จ หรือยกเลิกรอบ)`,
            });
          }
        }

        // ปิดขั้น (รวมปุ่ม "ผ่านรวด" งานร้านนอก) ห้ามทับงานที่ยังค้างอยู่กับร้าน —
        // ใบ outsource ที่ยังไม่ตัดสิน QC ต้องเดินจบทางใบ outsource เท่านั้น
        if (data.status === "COMPLETED") {
          // ล็อกแถว step ก่อนเช็ค (lock เดียวกับ outsource.createOrder) — ไม่งั้น
          // "ผ่านรวด" กับ "เปิดใบส่งร้าน" ที่ยิงพร้อมกันต่างคนต่างเช็คผ่าน:
          // step ปิดทั้งที่ใบส่งร้านเพิ่งเกิด แล้วใบนั้นเดินต่อบน step ที่ตายแล้ว
          await tx.$queryRaw`SELECT id FROM production_steps WHERE id = ${stepId} FOR UPDATE`;
          const latestOutsource = await tx.outsourceOrder.findFirst({
            where: { productionStepId: stepId },
            orderBy: { createdAt: "desc" },
            select: { status: true },
          });
          // แบ่งส่งหลายรอบ = ขั้นเดียวมีหลายใบค้างพร้อมกันได้ — เช็ค "ทุกใบ" ไม่ใช่แค่ใบล่าสุด
          const openOutsource = await tx.outsourceOrder.count({
            where: {
              productionStepId: stepId,
              status: { notIn: ["QC_PASSED", "QC_FAILED"] },
            },
          });
          if (openOutsource > 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `ขั้นนี้มีงานค้างอยู่กับร้านนอก ${openOutsource} ใบ — กดรับกลับ/ตัดสิน QC ที่ใบ outsource ก่อน`,
            });
          }
          // งานที่หัวหน้าตัดสิน QC ไม่ผ่านไปแล้ว ช่างห้ามกดผ่านรวดทับ — ต้องส่งแก้
          // รอบใหม่หรือให้หัวหน้าเป็นคนปิด
          if (
            latestOutsource?.status === "QC_FAILED" &&
            ctx.userRole === "PRODUCTION_STAFF"
          ) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message:
                "งานนี้ QC ไม่ผ่านจากร้าน — ส่งแก้รอบใหม่ หรือให้หัวหน้าเป็นคนปิดขั้น",
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

        let step = await tx.productionStep.update({
          where: { id: stepId },
          data: updateData,
          include: { production: true },
        });

        // กติกา qty: ปิดขั้น → จำนวนทำแล้ว snap เท่าทั้งหมด (ติ๊กเสร็จ = ครบ ไม่ต้องกรอกเลขซ้ำ)
        // · กรอกจำนวนบนขั้นที่ยังรอ → ขั้นเริ่มเอง (กันสถานะค้าง PENDING ทั้งที่ทำไปแล้วครึ่งกอง)
        if (step.status === "COMPLETED" && step.qtyTotal && step.qtyDone < step.qtyTotal) {
          step = await tx.productionStep.update({
            where: { id: stepId },
            data: { qtyDone: step.qtyTotal },
            include: { production: true },
          });
        } else if (step.status === "PENDING" && step.qtyDone > 0) {
          step = await tx.productionStep.update({
            where: { id: stepId },
            data: { status: "IN_PROGRESS", startedAt: step.startedAt ?? new Date() },
            include: { production: true },
          });
        }

        // ทุกขั้นเสร็จ → ปิดใบผลิต + ดันออเดอร์ "กำลังผลิต" → "ตรวจคุณภาพ" (rollup กลาง)
        await finalizeProductionIfComplete(tx, {
          productionId: step.productionId,
          changedBy: ctx.userId,
        });

        // ต้นทุนจริงต่อขั้นตอน → ต้นทุนออเดอร์อัตโนมัติ (upsert ด้วย sourceRef — แก้เลขซ้ำ
        // ได้ไม่เบิ้ลแถว) — เฉพาะตัวเลขจริง ไม่สร้างแถว 0 บาท (UI ถอดช่องนี้แล้ว
        // ตามมติเลิกคิดต้นทุนต่องาน 2026-06-12 — เก็บ path ไว้รับ caller ตรงเท่านั้น)
        if (data.actualCost !== undefined && data.actualCost > 0) {
          const stepName =
            step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType;
          // เขียน costEntry ต้อง lock+recalc ชุดเดียวกัน — ไม่งั้น order.totalCost drift
          // (invariant: services/order-cost.ts · Gate A4 audit 2026-07-02)
          await lockOrderRow(tx, step.production.orderId);
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
          await recalcOrderCost(tx, step.production.orderId);
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

  // ============================================================
  // ใบเบิกเสื้อ + ใบคืนเศษ (FLOW-REDESIGN ก้อน 1 — logic ใน services/garment-pick)
  // ============================================================

  // สถานะเบิก/คืนของออเดอร์นี้ — ใช้ทั้งการ์ดบนหน้าใบผลิตและ dialog เบิก/คืน
  garmentPick: protectedProcedure
    .input(z.object({ productionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const production = await ctx.prisma.production.findUniqueOrThrow({
        where: { id: input.productionId },
        select: { orderId: true },
      });
      const state = await getGarmentPickState(ctx.prisma, production.orderId);
      const configured = (await getStockClientFromSettings()) !== null;
      return { ...state, configured };
    }),

  // เบิกเสื้อ: ISSUE + orderRef → Stock ตัดยอดจองออเดอร์นี้อัตโนมัติ + กันเบิกทับจองงานอื่น
  issueGarments: protectedProcedure
    .use(productionTeam)
    .input(
      z.object({
        productionId: z.string(),
        stepId: z.string(),
        // กันยิงซ้ำ (กดเบิ้ล/เน็ตสะดุดแล้วลองใหม่) — UI สร้างครั้งเดียวต่อการเปิด dialog
        idempotencyKey: z.string().min(8),
        lines: z.array(z.object({ sku: z.string(), qty: z.number().int().min(0) })).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await issueGarments(ctx.prisma, {
        ...input,
        userId: ctx.userId,
        userRole: ctx.userRole,
      });
      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "CREATE",
        entityType: "STOCK_ISSUE",
        entityId: result.docNumber,
        newValue: { productionId: input.productionId, lines: input.lines },
      });
      return result;
    }),

  // คืนเศษเข้าสต๊อค (เผื่อเสีย 3% ที่เหลือ) — คืนได้ไม่เกินยอดเบิกค้าง
  returnGarments: protectedProcedure
    .use(productionTeam)
    .input(
      z.object({
        productionId: z.string(),
        idempotencyKey: z.string().min(8),
        note: z.string().optional(),
        lines: z.array(z.object({ sku: z.string(), qty: z.number().int().min(0) })).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await returnGarments(ctx.prisma, { ...input, userId: ctx.userId });
      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "CREATE",
        entityType: "STOCK_RETURN",
        entityId: result.docNumber,
        newValue: { productionId: input.productionId, lines: input.lines, note: input.note },
      });
      return result;
    }),

});
