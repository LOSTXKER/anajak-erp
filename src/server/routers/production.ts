import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { OutsourceStatus } from "@prisma/client";
import { router, protectedProcedure, requirePermission } from "../trpc";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog, createNotification } from "@/server/helpers";
import {
  transitionOrder,
  finalizeProductionIfComplete,
} from "@/server/services/order-status";
import { INTERNAL_STATUS_LABELS, isValidTransition } from "@/lib/order-status";
import {
  evaluateHeatPressGate,
  OUTSOURCE_ACTIVE_STATUSES,
  productionWorkflowSteps,
} from "@/lib/production-steps";
import { factoryStationKeyForStep } from "@/lib/factory-station";
import { firstPendingStepIdsByLane } from "@/lib/production-step-actions";
import {
  activeStationProblemReason,
  normalizedProblemReason,
  resolvedProblemMarker,
  resolvedProblemNotes,
  stationProblemNotes,
} from "@/lib/production-problem";
import {
  assertStaffFields,
  planAutoClaim,
  touchesRunGuardedFields,
  assertNotInActiveRun,
  assertStepClosable,
  buildStepUpdateData,
  qtyFollowUp,
  stepDisplayName,
  stepCostEntryPlan,
  failedStepNotification,
  normalizeStepUpdateForCurrentStatus,
} from "@/server/services/production-step-plan";
import {
  getGarmentPickState,
  issueGarments,
  returnGarments,
} from "@/server/services/garment-pick";
import {
  getOrdersReadiness,
  type OrderReadiness,
} from "@/server/services/production-readiness";
import { lockOrderRow, recalcOrderCost } from "@/server/services/order-cost";
import { lockProductionTopology } from "@/server/services/production-topology-lock";
import { assertProductionV2ApiEnabled } from "@/server/services/production-v2-gate";
import {
  netReceivedByVariant,
  receiptInspectionOfVariants,
} from "@/server/services/goods-receipt-plan";
import { getStockClientFromSettings } from "@/lib/stock-api";
import { notFound } from "@/server/errors";
import type { PrismaTx } from "@/lib/prisma";
import {
  getLocalDemoStockAvailability,
  isLocalDemoStockEnabled,
} from "@/server/services/local-demo-stock";

// วางแผนการผลิต = งานหัวหน้า (PERM3: default OWNER/MANAGER เดิมเป๊ะ + override รายคน)
const managerUp = requirePermission("supervise_operations");
const productionTeam = requirePermission("manage_production");

// Readiness ต้องคำนวณจากยอดเงินจริง แต่ role ที่ไม่มี see_order_money ต้องไม่รับยอดนั้นใน
// response ดิบ (UI ซ่อนอย่างเดียวไม่ใช่ permission boundary) · payment ที่ผ่านก็ต้องแทนข้อความ
// เพราะ detail เดิมอาจมีทั้งยอดรับ/ยอดที่ต้องรับ หรือเลขวันเครดิต
function sanitizeReadinessForViewer(
  readiness: OrderReadiness | null,
  canSeeOrderMoney: boolean,
): OrderReadiness | null {
  if (!readiness || canSeeOrderMoney) return readiness;

  return {
    ...readiness,
    checks: readiness.checks.map((check) =>
      check.key === "payment"
        ? {
            ...check,
            detail: check.ok
              ? "เงื่อนไขชำระไม่กั้นการผลิต"
              : (check.waitingOn ?? "รอฝ่ายขาย/การเงินตรวจเงื่อนไขชำระ"),
          }
        : check,
    ),
  };
}

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
      printRun: {
        status: { in: ["PRINTING", "PRINTED"] as ("PRINTING" | "PRINTED")[] },
      },
    },
    select: { printRun: { select: { runNumber: true, status: true } } },
  },
} as const;

// mutation จอสถานีต้องคืน DTO ที่ไม่มีเงินด้วยโครงสร้าง ห้ามคืน Production/ต้นทุนที่ Prisma
// include มาใช้ภายใน transaction แม้ UI จะไม่ render ก็ตาม
const updateStepResultSelect = {
  id: true,
  productionId: true,
  stepType: true,
  customStepName: true,
  status: true,
  sortOrder: true,
  qtyDone: true,
  qtyTotal: true,
  assignedToId: true,
  startedAt: true,
  completedAt: true,
  qcPassed: true,
  qcNotes: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ลิงก์ในแจ้งเตือนชี้ใบผลิตเสมอ — จอสถานี (/factory/station) ถูกถอดออก 2026-09-02 รอออกแบบใหม่
function productionStepWorkLink(productionId: string): string {
  return `/production/${encodeURIComponent(productionId)}`;
}

/**
 * Production writers ทุกตัวใช้ลำดับเดียวกัน: topology mutex → steps ทั้งใบตาม id →
 * production → order. การอ่านสองครั้งแรกมีไว้หา lock scope เท่านั้น ห้ามใช้ตัดสินงาน
 * จนกว่าจะถือ lock ครบและอ่าน step สดอีกครั้ง
 */
async function lockProductionStepScope(tx: PrismaTx, stepId: string) {
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
  await lockOrderRow(tx, productionReference.orderId);

  const lockedStep = await tx.productionStep.findUniqueOrThrow({
    where: { id: stepId },
    select: { ...updateStepResultSelect, executionEnabled: true },
  });
  const { executionEnabled, ...existing } = lockedStep;
  if (executionEnabled) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "ขั้นงาน Production V2 ต้องอัปเดตจากโหมดสถานีหรือคำสั่ง Manufacturing เท่านั้น",
    });
  }
  const production = await tx.production.findUniqueOrThrow({
    where: { id: existing.productionId },
    select: { orderId: true },
  });
  if (
    existing.productionId !== stepReference.productionId ||
    production.orderId !== productionReference.orderId
  ) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "โครงใบผลิตเปลี่ยนจากอีกหน้าจอแล้ว — กรุณาโหลดใหม่",
    });
  }

  return { existing, production };
}

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
  // UX1: เพิ่มแบบอนุมัติ + ลายพิมพ์ + ตารางไซส์ ให้ช่างเห็นบนจอโดยไม่ต้องพึ่งใบกระดาษ —
  // select ระบุ field รายตัวเสมอ (OrderItemPrint/OrderItemProduct มี unitPrice — ห้าม include ทั้งก้อน)
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const production = await ctx.prisma.production.findUnique({
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
              deadline: true,
              priority: true,
              internalStatus: true,
              customer: { select: { id: true, name: true } },
              // ม็อกอัพที่ลูกค้าอนุมัติ — อ้างเวอร์ชันชัด กันพิมพ์ผิดเวอร์ชัน (pattern job ticket)
              // เก็บหลายรุ่นล่าสุดให้แท็บม็อกอัพเทียบย้อนได้ · designs[0] ยังเป็นรุ่นอนุมัติ
              // ล่าสุดตาม orderBy desc เสมอ จอที่อ่านตัวเดียวจึงไม่เปลี่ยนพฤติกรรม
              designs: {
                where: { approvalStatus: "APPROVED" as const },
                orderBy: { versionNumber: "desc" as const },
                take: 5,
                select: {
                  id: true,
                  versionNumber: true,
                  fileUrl: true,
                  thumbnailUrl: true,
                  approvedAt: true,
                  customerComment: true,
                  designerNotes: true,
                  files: {
                    orderBy: { sortOrder: "asc" as const },
                    select: {
                      fileUrl: true,
                      thumbnailUrl: true,
                      position: true,
                      caption: true,
                    },
                  },
                },
              },
              items: {
                orderBy: { sortOrder: "asc" as const },
                select: {
                  id: true,
                  // จงใจไม่ส่ง description/notes ของ item — ยังไม่มีจอไหน render
                  // (notes เป็น free text ฝั่งแอดมิน เสี่ยงพ่วงเรื่องราคา/ดีลถึงจอช่าง)
                  totalQuantity: true,
                  products: {
                    orderBy: { sortOrder: "asc" as const },
                    select: {
                      id: true,
                      productType: true,
                      description: true,
                      itemSource: true,
                      fabricColor: true,
                      totalQuantity: true,
                      variants: {
                        orderBy: { size: "asc" as const },
                        select: {
                          id: true,
                          size: true,
                          color: true,
                          quantity: true,
                        },
                      },
                    },
                  },
                  prints: {
                    orderBy: { position: "asc" as const },
                    select: {
                      id: true,
                      position: true,
                      printType: true,
                      printSize: true,
                      width: true,
                      height: true,
                      colorCount: true,
                      designNote: true,
                      designImageUrl: true,
                      // สเปกรีดกรอกครั้งเดียวที่คลังลาย — จอสถานี/แท็บม็อกอัพอ่านจากที่นี่
                      // แทนให้ช่างเปิดไปหน้าคลังลายเอง · imageUrl เผื่อ designImageUrl ว่าง
                      artwork: {
                        select: {
                          imageUrl: true,
                          heatTempC: true,
                          heatPressSec: true,
                          heatPressure: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          steps: { orderBy: { sortOrder: "asc" }, select: stepSelect },
        },
      });
      if (!production) notFound("งานผลิต", input.id);
      return production;
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
      const readiness = sanitizeReadinessForViewer(
        (await getOrdersReadiness(ctx.prisma, [input.orderId])).get(
          input.orderId,
        ) ?? null,
        hasPermission(ctx.userRole, ctx.permissionOverrides, "see_order_money"),
      );
      return {
        orderNumber: order.orderNumber,
        printTypes: [
          ...new Set(
            order.items.flatMap((it) => it.prints.map((p) => p.printType)),
          ),
        ],
        itemSources: [
          ...new Set(
            order.items.flatMap((it) =>
              it.products
                .map((p) => p.itemSource)
                .filter((s): s is string => s !== null),
            ),
          ),
        ],
        addonTypes: [
          ...new Set(
            order.items.flatMap((it) => it.addons.map((a) => a.addonType)),
          ),
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
        deadline: true,
        priority: true,
        internalStatus: true,
        orderType: true,
        blindShip: true, // ธงแดงบนการ์ดเลนแพ็ค (ก้อน 3)
        customer: { select: { name: true } },
        productions: {
          orderBy: { createdAt: "desc" },
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
                    // ใบตรวจนับรับของกลับบนบอร์ดเลนต้องรู้ของ/จำนวนที่คาด (Gate B4)
                    description: true,
                    quantity: true,
                    vendor: { select: { name: true } },
                  },
                },
                // ขั้นที่อยู่ในรอบพิมพ์ค้าง — การ์ดเลนสลับปุ่ม เริ่ม/เสร็จ เป็นลิงก์ไป
                // หน้ารอบพิมพ์ (updateStep ถูก server บล็อกแล้ว ปุ่มเดิมกดได้แต่ error)
                printRunItems: {
                  where: {
                    printRun: { status: { in: ["PRINTING", "PRINTED"] } },
                  },
                  select: {
                    printRun: { select: { runNumber: true, status: true } },
                  },
                },
              },
            },
          },
        },
        // รูปปกม็อกอัพหนึ่งรูปต่อออเดอร์ — หัวหน้าจำงานจากภาพได้เร็วกว่าเลขออเดอร์
        // เอาเฉพาะ URL ที่ต้องใช้วาดรูปย่อ ไม่มีเงินและไม่มี token อนุมัติติดมา
        designs: {
          where: { approvalStatus: "APPROVED" as const },
          orderBy: { versionNumber: "desc" as const },
          take: 1,
          select: {
            versionNumber: true,
            fileUrl: true,
            thumbnailUrl: true,
            files: {
              orderBy: { sortOrder: "asc" as const },
              select: { fileUrl: true, thumbnailUrl: true, position: true },
            },
          },
        },
        items: {
          select: {
            totalQuantity: true,
            // ออเดอร์ที่ยังไม่มีม็อกอัพอนุมัติ (งานสต๊อค/งานลายเดิม) ยังพอมีรูปลายให้จำงาน
            prints: {
              select: {
                designImageUrl: true,
                artwork: { select: { imageUrl: true } },
              },
            },
          },
        },
      },
      orderBy: { deadline: "asc" },
      take: 200,
    });
    // ด่านพร้อมผลิต — คิดเฉพาะออเดอร์ที่อยู่ในคิว "รอเปิดใบผลิต" (เกณฑ์เดียวกับหน้า
    // /production): เงินตามเทอม + แบบอนุมัติ + ของครบ · งานติดด่านแยกกองไม่ปนคิวช่าง
    const queueIds = orders
      .filter(
        (o) =>
          ["CONFIRMED", "DESIGN_APPROVED", "PRODUCTION_QUEUE"].includes(
            o.internalStatus,
          ) ||
          (o.internalStatus === "PRODUCING" && o.productions.length === 0),
      )
      .map((o) => o.id);
    const readinessById = await getOrdersReadiness(ctx.prisma, queueIds);

    const canSeeOrderMoney = hasPermission(
      ctx.userRole,
      ctx.permissionOverrides,
      "see_order_money",
    );
    return orders.map((o) => {
      const steps = productionWorkflowSteps(
        o.productions.flatMap((p) => p.steps),
      );
      const stepsDone = steps.filter((s) => s.status === "COMPLETED").length;
      return {
        id: o.id,
        orderNumber: o.orderNumber,
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
        // รูปปกม็อกอัพบนแถวคิว — query ด้านบนดึง designs/items มาแล้ว ต้องส่งต่อด้วย
        // ไม่งั้น orderMockupCover(job.order) ได้ null ทุกแถวแม้ฐานมีรูป
        designs: o.designs,
        items: o.items,
        readiness: sanitizeReadinessForViewer(
          readinessById.get(o.id) ?? null,
          canSeeOrderMoney,
        ),
      };
    });
  }),

  create: protectedProcedure
    .use(managerUp)
    .input(
      z.object({
        orderId: z.string(),
        steps: z
          .array(
            z
              .object({
            stepType: z.enum([
                  "DTF_PRINT",
                  "HEAT_PRESS",
                  "DTG_PRETREAT",
                  "DTG_PRINT",
                  "CURING",
                  "PATTERN_MAKING",
                  "SCREEN_PRINTING",
                  "TAGGING",
                  "PACKAGING",
                  "EMBROIDERY",
                  "SPECIAL_PRINT",
                  "SEWING",
                  "CUSTOM",
                  "GARMENT_PICK",
                  "GARMENT_RECEIVE",
                  "SUBLIMATION",
            ]),
            customStepName: z.string().optional(),
            sortOrder: z.number(),
            estimatedCost: z.number().optional(),
            notes: z.string().optional(),
              })
              .refine((step) => step.stepType !== "PACKAGING", {
            message: "แพ็กเป็นขั้นหลัง QC และเพิ่มในใบผลิตไม่ได้",
            path: ["stepType"],
              }),
          )
          .min(1, "ใบผลิตต้องมีอย่างน้อย 1 ขั้นตอน"),
        // ใบผลิตศูนย์ขั้นทำให้ออเดอร์ PRODUCING หายจากทุก section ของหน้าการผลิต
        // (ไม่มีขั้นค้าง = ไม่มีการ์ดสักเลน) และ finalize ไม่มีวันปิดให้
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // ใบผลิต + เปลี่ยนสถานะ = ก้อนเดียวกัน — สถานะต้องเดินตาม machine เท่านั้น
      // (no-op ถ้าออเดอร์ PRODUCING อยู่แล้ว เช่นเปิดใบผลิตใบที่สอง)
      return ctx.prisma.$transaction(async (tx) => {
        await lockProductionTopology(tx, input.orderId);
        // topology mutex กันสมาชิกใบผลิตเปลี่ยน ส่วน parent row lock กัน order item writer
        // แทนรายการระหว่างอ่าน receipt evidence กับ insert ใบผลิต
        await lockOrderRow(tx, input.orderId);
        const v2WorkOrder = await tx.production.findFirst({
          where: {
            orderId: input.orderId,
            workOrderNumber: { not: null },
          },
          select: { workOrderNumber: true },
        });
        if (v2WorkOrder) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `ออเดอร์นี้ใช้ Production V2 (${v2WorkOrder.workOrderNumber}) แล้ว — เปิดใบผลิตแบบเดิมไม่ได้`,
          });
        }
        // receipt อาจเกิดก่อนเปิดใบผลิต: ต้องอ่าน evidence สดหลังถือ topology mutex
        // และ order row lock เดียวกับ Goods Receipt/หน้าแก้ ห้ามใช้ snapshot ก่อน transaction
        // มิฉะนั้นสร้าง step ค้างหลอกหรือผูกกับรายการคนละชุด
        const orderProducts = await tx.orderItemProduct.findMany({
          where: { orderItem: { orderId: input.orderId } },
          select: {
            id: true,
            productType: true,
            productId: true,
            itemSource: true,
            variants: { select: { size: true, color: true, quantity: true } },
          },
        });

        // รายการที่ยังเป็น "โครงจากใบเสนอ" ทั้งใบ (OTHER + ไซส์ FREE ล้วน) ห้ามเข้าผลิต —
        // ช่างไม่มีไซส์/สี/ลายให้ทำงาน ต้องแก้รายการเป็นของจริงก่อน (audit ข้อ 10)
        // สินค้าฟรีไซส์จากสต็อก/เสื้อลูกค้าส่งมา ก็เป็น OTHER+FREE ได้ ห้ามเหมาว่าโครง
        const allSkeleton =
          orderProducts.length > 0 &&
          orderProducts.every(
            (p) =>
              p.productType === "OTHER" &&
              p.productId === null &&
              p.itemSource === null &&
              p.variants.every((v) => v.size === "FREE"),
          );
        if (allSkeleton) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              'รายการออเดอร์ยังเป็นโครงจากใบเสนอ (ไม่มีสินค้า/ไซส์จริง) — กด "แก้ไขรายการ" ใส่ของจริงก่อนเปิดใบผลิต',
          });
        }

        // จำนวนทั้งหมดต่อขั้นตั้งต้น = จำนวนเสื้อทั้งออเดอร์ · ออเดอร์ไม่มีจำนวน = ขั้นติ๊ก
        const orderTotalQty = orderProducts.reduce(
          (sum, product) =>
            sum +
            product.variants.reduce(
              (variantSum, variant) => variantSum + variant.quantity,
              0,
            ),
          0,
        );
        const customerProducts = orderProducts.filter(
          (product) => product.itemSource === "CUSTOMER_PROVIDED",
        );
        const receiptLines =
          customerProducts.length > 0
            ? await tx.goodsReceiptLine.findMany({
                where: {
                  orderItemProductId: {
                    in: customerProducts.map((product) => product.id),
                  },
                  receipt: {
                    orderId: input.orderId,
                    receiptType: {
                      in: ["CUSTOMER_GARMENT", "CUSTOMER_RETURN"],
                    },
                  },
                },
                select: {
                  orderItemProductId: true,
                  size: true,
                  color: true,
                  qtyCounted: true,
                  receipt: { select: { receiptType: true } },
                },
              })
            : [];
        const receivedNetByVariant = netReceivedByVariant(
          receiptLines.map((line) => ({
            orderItemProductId: line.orderItemProductId,
            size: line.size,
            color: line.color,
            qtyCounted: line.qtyCounted,
            receiptType: line.receipt.receiptType,
          })),
        );
        const customerGarmentsAlreadyInspected =
          customerProducts.length > 0 &&
          customerProducts.every(
            (product) =>
              receiptInspectionOfVariants(
                product.id,
                product.variants,
                receivedNetByVariant,
              ).receivedInspected,
          );
        const completedAt = customerGarmentsAlreadyInspected
          ? new Date()
          : null;
        const autoCompletedGarmentReceiveSteps = input.steps.filter(
          (step) =>
            step.stepType === "GARMENT_RECEIVE" &&
            customerGarmentsAlreadyInspected,
        ).length;

        const production = await tx.production.create({
          data: {
            orderId: input.orderId,
            steps: {
              create: input.steps.map((s) => ({
                ...s,
                qtyTotal: orderTotalQty > 0 ? orderTotalQty : null,
                ...(s.stepType === "GARMENT_RECEIVE" &&
                customerGarmentsAlreadyInspected
                  ? {
                      status: "COMPLETED" as const,
                      completedAt,
                      qtyDone: orderTotalQty,
                    }
                  : {}),
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

        const createdWorkflowSteps = productionWorkflowSteps(production.steps);
        if (
          createdWorkflowSteps.length > 0 &&
          createdWorkflowSteps.every((step) => step.status === "COMPLETED")
        ) {
          await finalizeProductionIfComplete(tx, {
            productionId: production.id,
            changedBy: ctx.userId,
          });
        }

        await createAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entityType: "PRODUCTION",
          entityId: production.id,
          newValue: {
            orderId: input.orderId,
            stepsCount: input.steps.length,
            autoCompletedGarmentReceiveSteps,
          },
        });

        return tx.production.findUniqueOrThrow({
          where: { id: production.id },
          include: { steps: true },
        });
      });
    }),

  reportStationProblem: protectedProcedure
    .use(productionTeam)
    .input(
      z.object({
        stepId: z.string(),
        reason: z.string().trim().min(3, "กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const canSupervise = hasPermission(
        ctx.userRole,
        ctx.permissionOverrides,
        "supervise_operations",
      );

      return ctx.prisma.$transaction(async (tx) => {
        // semantic Station command รับแค่ stepId+reason: work center/source ต้อง derive
        // จาก DB เท่านั้น เพื่อกัน client ปลอมสถานีหรือยิง request เก่าข้ามงาน
        const { existing, production } = await lockProductionStepScope(
          tx,
          input.stepId,
        );
        const workCenter = factoryStationKeyForStep(existing.stepType);
        if (!workCenter) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "ขั้นนี้ไม่ได้อยู่ในสถานีโรงงานที่รองรับการแจ้งปัญหา",
          });
        }
        if (existing.status === "COMPLETED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "ขั้นนี้เสร็จแล้ว — เปิดงานแก้ผ่านหัวหน้าฝ่ายผลิตแทน",
          });
        }
        if (existing.status === "ON_HOLD") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "ขั้นนี้ถูกพักอยู่ — ให้หัวหน้าตัดสินใจสถานะงานก่อนแจ้งปัญหาจากสถานี",
          });
        }

        const order = await tx.order.findUniqueOrThrow({
          where: { id: production.orderId },
          select: {
            id: true,
            internalStatus: true,
            orderNumber: true,
          },
        });
        if (order.internalStatus !== "PRODUCING") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `แจ้งปัญหาขั้นผลิตไม่ได้ — ออเดอร์อยู่สถานะ ${INTERNAL_STATUS_LABELS[order.internalStatus] ?? order.internalStatus}`,
          });
        }

        const siblings = await tx.productionStep.findMany({
          where: { productionId: existing.productionId },
          select: {
            id: true,
            stepType: true,
            status: true,
            sortOrder: true,
          },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        });
        if (!firstPendingStepIdsByLane(siblings).has(input.stepId)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "ยังแจ้งปัญหาขั้นนี้ไม่ได้ — ขั้นก่อนหน้าในสายงานเดียวกันยังไม่เสร็จ",
          });
        }
        if (existing.stepType === "HEAT_PRESS") {
          const pressGate = evaluateHeatPressGate(siblings);
          if (!pressGate.ready) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `ยังแจ้งปัญหาขั้นรีดร้อนไม่ได้ — ${pressGate.waitingOn.join(" และ ")}`,
            });
          }
        }

        // ใบ legacy อาจมีงานร้านนอกบน step ที่ map กลับ Station ได้ แม้ createOrder
        // รุ่นใหม่จะกันแล้ว: writer ของร้านนอกต้องเป็นเจ้าของสถานะจน QC จบ ห้าม Station
        // แทรก FAILED กลางรอบแล้วปล่อยให้สอง command แข่งกันเขียนทับ.
        const activeOutsource = await tx.outsourceOrder.findFirst({
          where: {
            productionStepId: input.stepId,
            status: { in: OUTSOURCE_ACTIVE_STATUSES as OutsourceStatus[] },
          },
          select: { id: true },
        });
        if (activeOutsource) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "ขั้นนี้อยู่ระหว่างงานร้านนอก — จัดการรับกลับและตัดสิน QC ที่ใบงานร้านก่อนแจ้งปัญหาจากสถานี",
          });
        }

        let autoClaim = false;
        if (!canSupervise) {
          autoClaim = planAutoClaim({
            existingAssignedToId: existing.assignedToId,
            userId: ctx.userId,
          }).autoClaim;
        }

        // DTF ที่อยู่ในรอบ active มี writer เฉพาะทางซึ่งจะเดินจำนวน/สถานะต่อเมื่อปิดรอบ
        // จึงห้ามตั้ง FAILED แทรกกลางรอบใน Phase 1 มิฉะนั้น completePrintRun จะเขียนทับ
        if (existing.stepType === "DTF_PRINT") {
          const activeRun = await tx.printRunItem.findFirst({
            where: {
              productionStepId: input.stepId,
              printRun: { status: { in: ["PRINTING", "PRINTED"] } },
            },
            select: {
              printRun: { select: { runNumber: true, status: true } },
            },
          });
          if (activeRun) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `งานอยู่ในรอบพิมพ์ ${activeRun.printRun.runNumber} — จัดการรอบตามสถานะปัจจุบันให้เรียบร้อยก่อนแจ้งปัญหาขั้นงาน`,
            });
          }
        }

        const alreadyReported =
          existing.status === "FAILED" &&
          activeStationProblemReason(existing.notes) ===
            normalizedProblemReason(input.reason);
        if (existing.status === "FAILED" && !alreadyReported) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "ขั้นนี้แจ้งปัญหาไว้แล้ว — รอหัวหน้าแก้ปัญหาเดิมก่อนแจ้งเหตุใหม่",
          });
        }
        if (alreadyReported && !autoClaim) {
          return {
            ...existing,
            workCenter,
            operation: "REPORT_PROBLEM" as const,
          };
        }

        const nextNotes = alreadyReported
          ? existing.notes
          : stationProblemNotes(existing.notes, input.reason);

        const step = await tx.productionStep.update({
          where: { id: input.stepId },
          data: {
            ...(!alreadyReported
              ? { status: "FAILED" as const, notes: nextNotes }
              : {}),
            ...(autoClaim ? { assignedToId: ctx.userId } : {}),
          },
          select: updateStepResultSelect,
        });

        // retry ที่ state FAILED+notes เดิมไม่ควรส่งกระดิ่งซ้ำ; กรณี step เดิมไม่มี owner
        // ยัง claim ให้ผู้รายงานใน transaction เดียวและเก็บ audit ของ write นั้นไว้
        if (!alreadyReported) {
          const activeUsers = await tx.user.findMany({
            where: {
              isActive: true,
              id: { not: ctx.userId },
            },
            select: { id: true, role: true, permissionOverrides: true },
          });
          const supervisors = activeUsers.filter((user) =>
            hasPermission(
              user.role,
              user.permissionOverrides,
              "supervise_operations",
            ),
          );
          const notification = failedStepNotification({
            orderNumber: order.orderNumber,
            stepName: stepDisplayName(existing),
            notes: input.reason,
            productionId: existing.productionId,
            orderId: order.id,
          });
          for (const supervisor of supervisors) {
            await createNotification(tx, {
              userId: supervisor.id,
              ...notification,
            });
          }
        }

        await createAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entityType: "PRODUCTION_STEP",
          entityId: input.stepId,
          oldValue: {
            status: existing.status,
            notes: existing.notes,
            assignedToId: existing.assignedToId,
          },
          newValue: {
            source: "STATION",
            workCenter,
            operation: "REPORT_PROBLEM",
            status: "FAILED",
            notes: nextNotes,
            assignedToId: step.assignedToId,
          },
          reason: input.reason,
        });

        return { ...step, workCenter, operation: "REPORT_PROBLEM" as const };
      });
    }),

  resolveStationProblem: protectedProcedure
    .use(managerUp)
    .input(
      z.object({
        stepId: z.string(),
        resolutionReason: z
          .string()
          .trim()
          .min(3, "กรุณาระบุวิธีแก้อย่างน้อย 3 ตัวอักษร"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.$transaction(async (tx) => {
        const { existing, production } = await lockProductionStepScope(
          tx,
          input.stepId,
        );
        const order = await tx.order.findUniqueOrThrow({
          where: { id: production.orderId },
          select: {
            id: true,
            internalStatus: true,
            orderNumber: true,
          },
        });
        if (order.internalStatus !== "PRODUCING") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `แก้ปัญหาขั้นผลิตไม่ได้ — ออเดอร์อยู่สถานะ ${INTERNAL_STATUS_LABELS[order.internalStatus] ?? order.internalStatus}`,
          });
        }

        const resolutionMarker = resolvedProblemMarker(input.resolutionReason);
        // retry หลัง response หลุด: PENDING + trail เดิมต้องไม่เขียน/audit/แจ้งซ้ำ
        if (
          existing.status === "PENDING" &&
          existing.notes?.endsWith(resolutionMarker)
        ) {
          return { ...existing, operation: "RESOLVE_PROBLEM" as const };
        }
        if (existing.status !== "FAILED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "แก้ปัญหาได้เฉพาะขั้นที่มีสถานะมีปัญหา และห้ามถอยขั้นที่เดินต่อแล้ว",
          });
        }
        const nextNotes = resolvedProblemNotes(
          existing.notes,
          input.resolutionReason,
        );

        const step = await tx.productionStep.update({
          where: { id: input.stepId },
          data: {
            status: "PENDING",
            startedAt: null,
            completedAt: null,
            notes: nextNotes,
          },
          select: updateStepResultSelect,
        });

        if (existing.assignedToId && existing.assignedToId !== ctx.userId) {
          const assignee = await tx.user.findUnique({
            where: { id: existing.assignedToId },
            select: { id: true, isActive: true },
          });
          if (assignee?.isActive) {
            await createNotification(tx, {
              userId: assignee.id,
              type: "PRODUCTION",
              title: `แก้ปัญหาแล้ว — ${order.orderNumber}`,
              message: `${stepDisplayName(existing)} · ${input.resolutionReason}`,
              link: productionStepWorkLink(existing.productionId),
              entityType: "PRODUCTION_STEP",
              entityId: input.stepId,
            });
          }
        }

        await createAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entityType: "PRODUCTION_STEP",
          entityId: input.stepId,
          oldValue: { status: existing.status, notes: existing.notes },
          newValue: {
            operation: "RESOLVE_PROBLEM",
            status: "PENDING",
            notes: nextNotes,
          },
          reason: input.resolutionReason,
        });

        return { ...step, operation: "RESOLVE_PROBLEM" as const };
      });
    }),

  assignProductionStep: protectedProcedure
    .use(managerUp)
    .input(
      z.object({
        stepId: z.string(),
        assignedToId: z.string().trim().min(1).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.$transaction(async (tx) => {
        const { existing, production } = await lockProductionStepScope(
          tx,
          input.stepId,
        );
        const order = await tx.order.findUniqueOrThrow({
          where: { id: production.orderId },
          select: { internalStatus: true, orderNumber: true },
        });
        if (
          order.internalStatus !== "PRODUCING" ||
          existing.status === "COMPLETED"
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "มอบหมายได้เฉพาะขั้นที่ยังทำงานอยู่ในออเดอร์กำลังผลิต",
          });
        }

        let assignee: { id: string; isActive: boolean } | null = null;
        if (input.assignedToId) {
          const candidate = await tx.user.findUnique({
            where: { id: input.assignedToId },
            select: {
              id: true,
              role: true,
              permissionOverrides: true,
              isActive: true,
            },
          });
          if (
            !candidate?.isActive ||
            !hasPermission(
              candidate.role,
              candidate.permissionOverrides,
              "manage_production",
            )
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "ผู้รับงานต้องเป็นผู้ใช้งานที่ยัง active และมีสิทธิ์งานผลิต",
            });
          }
          assignee = candidate;
        }

        if (existing.assignedToId === input.assignedToId) {
          return { ...existing, operation: "ASSIGN_STEP" as const };
        }

        const step = await tx.productionStep.update({
          where: { id: input.stepId },
          data: { assignedToId: input.assignedToId },
          select: updateStepResultSelect,
        });
        if (assignee && assignee.id !== ctx.userId) {
          await createNotification(tx, {
            userId: assignee.id,
            type: "PRODUCTION",
            title: `ได้รับมอบหมายงาน — ${order.orderNumber}`,
            message: stepDisplayName(existing),
            link: productionStepWorkLink(existing.productionId),
            entityType: "PRODUCTION_STEP",
            entityId: input.stepId,
          });
        }
        await createAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entityType: "PRODUCTION_STEP",
          entityId: input.stepId,
          oldValue: { assignedToId: existing.assignedToId },
          newValue: {
            operation: "ASSIGN_STEP",
            assignedToId: input.assignedToId,
          },
        });

        return { ...step, operation: "ASSIGN_STEP" as const };
      });
    }),

  updateStep: protectedProcedure
    .use(productionTeam)
    .input(
      z.object({
        stepId: z.string(),
        // FAILED เป็น exception command ที่ต้องมีเหตุผล/source/audit/notification ครบ
        // จึงเข้าได้ทาง reportStationProblem และออกได้ทาง resolveStationProblem เท่านั้น
        status: z
          .enum(["PENDING", "IN_PROGRESS", "COMPLETED", "ON_HOLD"])
          .optional(),
        actualCost: z.number().min(0).optional(),
        // บอก "บางส่วน" ได้ — ทำแล้ว/ทั้งหมด (qtyTotal null = ขั้นแบบติ๊กเฉยๆ)
        qtyDone: z.number().int().min(0).optional(),
        qtyTotal: z.number().int().min(0).nullable().optional(),
        qcPassed: z.boolean().optional(),
        qcNotes: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { stepId, ...data } = input;

      // PERM3: เช็คสิทธิ์งานหัวหน้าครั้งเดียวบนหัว mutation — service pure รับ flag
      // (ห้าม import hasPermission ใน service · pattern เดียวกับ issueGarments)
      const canSupervise = hasPermission(
        ctx.userRole,
        ctx.permissionOverrides,
        "supervise_operations",
      );

      // อัปเดต step + ปิดใบผลิต + ดันสถานะออเดอร์ = ก้อนเดียวกัน (transitionOrder ต้องอยู่ใน tx)
      return ctx.prisma.$transaction(async (tx) => {
        // คนไม่มีสิทธิ์งานหัวหน้า (default = PRODUCTION_STAFF): ห้ามแตะ assignedToId/actualCost
        // (มอบงาน + ต้นทุน = อำนาจหัวหน้า) · step ที่ยังไม่มีเจ้าของ → claim อัตโนมัติ
        // (ระบบยังไม่มี UI มอบหมายงาน ถ้าบังคับ assign ก่อน staff จะอัปเดตอะไรไม่ได้เลย) ·
        // step ของคนอื่น → ห้าม (ด่าน field ต้องมาก่อนโหลด step — FORBIDDEN ก่อน NOT_FOUND)
        assertStaffFields({ canSupervise, data });

        // ล็อก topology + ทุก step ของใบก่อนอ่าน assignee/สถานะจริง เพื่อให้ finalizer
        // ที่อาจแตะ PACKAGING และสองจอที่ claim พร้อมกันใช้ global lock order เดียวกัน
        const { existing, production } = await lockProductionStepScope(
          tx,
          stepId,
        );
        const liveOrder = await tx.order.findUniqueOrThrow({
          where: { id: production.orderId },
          select: { internalStatus: true },
        });
        if (liveOrder.internalStatus !== "PRODUCING") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `อัปเดตขั้นผลิตไม่ได้ — ออเดอร์อยู่สถานะ ${INTERNAL_STATUS_LABELS[liveOrder.internalStatus] ?? liveOrder.internalStatus}`,
          });
        }

        if (existing.stepType === "PACKAGING") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "ขั้นแพ็กเดิมแก้จากใบผลิตไม่ได้ — งานต้องผ่าน QC แล้วจึงแพ็กสุดท้าย",
          });
        }

        if (existing.status === "FAILED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "ขั้นที่มีปัญหาต้องแก้ผ่านคำสั่งแก้ปัญหาของหัวหน้าฝ่ายผลิต",
          });
        }

        const effectiveData = {
          ...normalizeStepUpdateForCurrentStatus({
          currentStatus: existing.status,
          data,
          }),
        };
        // Absolute-value commands ต้อง retry ได้จริง: field ที่เท่ากับแถวหลัง lock คือ no-op
        // ไม่ claim, ไม่เดิน lane, ไม่ประทับเวลา และไม่สร้าง audit ซ้ำ.
        if (effectiveData.qtyDone === existing.qtyDone)
          delete effectiveData.qtyDone;
        if (effectiveData.qtyTotal === existing.qtyTotal)
          delete effectiveData.qtyTotal;
        if (effectiveData.qcPassed === existing.qcPassed)
          delete effectiveData.qcPassed;
        if (effectiveData.qcNotes === existing.qcNotes)
          delete effectiveData.qcNotes;
        if (effectiveData.notes === existing.notes) delete effectiveData.notes;
        const nextQtyDone = effectiveData.qtyDone ?? existing.qtyDone;
        const nextQtyTotal =
          effectiveData.qtyTotal !== undefined
            ? effectiveData.qtyTotal
            : existing.qtyTotal;
        if (nextQtyTotal !== null && nextQtyDone > nextQtyTotal) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `จำนวนทำแล้วเกินยอดขั้นผลิต — บันทึกได้ไม่เกิน ${nextQtyTotal} ตัว`,
          });
        }

        const hasEffectiveChanges = Object.values(effectiveData).some(
          (value) => value !== undefined,
        );
        // request ว่าง/สถานะเดิมคือ retry no-op จริง — ห้ามใช้ claim ขั้นที่ยังไม่มี owner
        // และขั้นที่ปิดแล้วต้อง immutable นอก semantic recovery.
        if (!hasEffectiveChanges) return existing;
        if (existing.status === "COMPLETED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "ขั้นนี้ปิดเสร็จแล้ว — แก้ผลย้อนหลังผ่านกระบวนการงานแก้แทน",
          });
        }

        // service เฉพาะทางเป็นเจ้าของทุก mutation ของขั้นเหล่านี้ ไม่ใช่แค่ status/qty:
        // notes/QC-only ผ่าน generic endpoint ก็ forge หลักฐานและ auto-claim งานได้เหมือนกัน.
        if (existing.stepType === "GARMENT_PICK") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "ขั้นเบิกเสื้อต้องอัปเดตผ่านเมนูเบิก/คืนเสื้อ เพื่อให้สต๊อคตรงกัน",
          });
        }
        if (existing.stepType === "GARMENT_RECEIVE") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "ขั้นรับเสื้อลูกค้าต้องอัปเดตผ่านใบตรวจรับ เพื่อให้หลักฐานและจำนวนตรงกัน",
          });
        }
        if (existing.stepType === "DTF_PRINT") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "ขั้นพิมพ์ DTF ต้องเดินผ่านหน้ารอบพิมพ์ฟิล์ม",
          });
        }

        // ทุก field ของ generic command (รวม notes/QC-only) ต้องอยู่บน current step
        // ใน lane จริง ไม่เช่นนั้น staff ยิง field ที่ไม่ใช่ status เพื่อ claim ขั้นอนาคตได้.
        const siblings = await tx.productionStep.findMany({
          where: { productionId: existing.productionId },
          select: {
            id: true,
            stepType: true,
            status: true,
            sortOrder: true,
          },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        });
        if (!firstPendingStepIdsByLane(siblings).has(stepId)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "ยังอัปเดตขั้นนี้ไม่ได้ — ทำขั้นก่อนหน้าในสายงานเดียวกันให้เสร็จก่อน",
          });
        }

        let autoClaim = false;
        if (!canSupervise) {
          autoClaim = planAutoClaim({
            existingAssignedToId: existing.assignedToId,
            userId: ctx.userId,
          }).autoClaim;
        }

        if (touchesRunGuardedFields(effectiveData)) {
          // current-lane ถูกตรวจสำหรับทุก field ด้านบนแล้ว; ที่นี่เหลือ gate เฉพาะ HEAT_PRESS.
          if (
            existing.stepType === "HEAT_PRESS" &&
            !evaluateHeatPressGate(siblings).ready
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `ยังรีดร้อนไม่ได้ — ${evaluateHeatPressGate(siblings).waitingOn.join(" และ ")}`,
            });
          }
        }

        // ขั้นที่อยู่ในรอบพิมพ์ค้าง (PRINTING/PRINTED): สถานะ/จำนวนเดินผ่านรอบเท่านั้น —
        // จุดตัดแยกฟิล์มเป็นด่านบังคับ ปิดมือ = ข้ามด่าน + จำนวนถูกนับซ้อนตอนรอบปิด
        // lock กลางด้านบนกัน race กับการเปิด/ปิดรอบก่อนเช็คแล้ว
        if (touchesRunGuardedFields(effectiveData)) {
          const activeRun = await tx.printRunItem.findFirst({
            where: {
              productionStepId: stepId,
              printRun: { status: { in: ["PRINTING", "PRINTED"] } },
            },
            select: { printRun: { select: { runNumber: true } } },
          });
          assertNotInActiveRun(activeRun?.printRun ?? null);
        }

        // ปิดขั้น (รวมปุ่ม "ผ่านรวด" งานร้านนอก) ห้ามทับงานที่ยังค้างอยู่กับร้าน —
        // ใบ outsource ที่ยังไม่ตัดสิน QC ต้องเดินจบทางใบ outsource เท่านั้น
        if (effectiveData.status === "COMPLETED") {
          // ใช้ lock กลางด้านบนร่วมกับ outsource.createOrder — ไม่งั้น
          // "ผ่านรวด" กับ "เปิดใบส่งร้าน" ที่ยิงพร้อมกันต่างคนต่างเช็คผ่าน:
          // step ปิดทั้งที่ใบส่งร้านเพิ่งเกิด แล้วใบนั้นเดินต่อบน step ที่ตายแล้ว
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
          assertStepClosable({
            openOutsourceCount: openOutsource,
            latestOutsourceStatus: latestOutsource?.status ?? null,
            canSupervise,
          });
        }

        const updateData = buildStepUpdateData({
          data: effectiveData,
          autoClaim,
          userId: ctx.userId,
          now: new Date(),
        });

        let step = await tx.productionStep.update({
          where: { id: stepId },
          data: updateData,
          include: { production: true },
        });

        // กติกา qty: ปิดขั้น → จำนวนทำแล้ว snap เท่าทั้งหมด (ติ๊กเสร็จ = ครบ ไม่ต้องกรอกเลขซ้ำ)
        // · กรอกจำนวนบนขั้นที่ยังรอ → ขั้นเริ่มเอง (กันสถานะค้าง PENDING ทั้งที่ทำไปแล้วครึ่งกอง)
        const followUp = qtyFollowUp(step, new Date());
        if (followUp) {
          step = await tx.productionStep.update({
            where: { id: stepId },
            data: followUp,
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
        const cost = stepCostEntryPlan({
          actualCost: effectiveData.actualCost,
          stepId,
          customStepName: step.customStepName,
          stepType: step.stepType,
        });
        if (cost) {
          // เขียน costEntry ต้อง lock+recalc ชุดเดียวกัน — ไม่งั้น order.totalCost drift
          // (invariant: services/order-cost.ts · Gate A4 audit 2026-07-02)
          await lockOrderRow(tx, step.production.orderId);
          await tx.costEntry.upsert({
            where: { sourceRef: cost.sourceRef },
            create: {
              orderId: step.production.orderId,
              category: "LABOR",
              name: cost.name,
              amount: cost.amount,
              sourceRef: cost.sourceRef,
              createdById: ctx.userId,
            },
            update: { amount: cost.amount },
          });
          await recalcOrderCost(tx, step.production.orderId);
        }

        // step มีปัญหา = ต้องมีคนมาดูด่วน — กระดิ่งหาผู้จัดการทันที ห้ามจมเงียบ (audit ข้อ 20)
        if (effectiveData.status === "FAILED") {
          const order = await tx.order.findUniqueOrThrow({
            where: { id: step.production.orderId },
            select: { id: true, orderNumber: true },
          });
          const managers = await tx.user.findMany({
            where: {
              role: { in: ["OWNER", "MANAGER"] },
              isActive: true,
              id: { not: ctx.userId },
            },
            select: { id: true },
          });
          const notification = failedStepNotification({
            orderNumber: order.orderNumber,
            stepName: stepDisplayName(step),
            notes: effectiveData.notes,
            productionId: step.productionId,
            orderId: order.id,
          });
          for (const m of managers) {
            await createNotification(tx, { userId: m.id, ...notification });
          }
        }

        await createAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entityType: "PRODUCTION_STEP",
          entityId: stepId,
          newValue: effectiveData,
        });

        return tx.productionStep.findUniqueOrThrow({
          where: { id: stepId },
          select: updateStepResultSelect,
        });
      });
    }),

  // ใบผลิตเก่าบางใบมี PACKAGING ค้างเป็นด่านก่อน QC ตาม flow เดิม — ห้ามให้คนกด
  // PACKAGING ตรง ๆ เพราะจะทำให้เข้าใจว่าแพ็กจริงแล้ว ทางนี้ตรวจว่าขั้นผลิตจริงครบทุกขั้น
  // แล้วปิดแถว compatibility + ส่งเข้า QC ใน transaction เดียวกัน
  finalizeLegacyPackaging: protectedProcedure
    .use(productionTeam)
    .input(z.object({ productionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.$transaction(async (tx) => {
        // อ่านครั้งแรกเพื่อหา scope เท่านั้น จากนั้นใช้ global order เดียวกับทุก writer:
        // topology mutex → steps ทั้งใบตาม id → production → order
        const reference = await tx.production.findUniqueOrThrow({
          where: { id: input.productionId },
          select: { orderId: true },
        });
        await lockProductionTopology(tx, reference.orderId);
        await tx.$queryRaw`SELECT id FROM production_steps WHERE production_id = ${input.productionId} ORDER BY id FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM productions WHERE id = ${input.productionId} FOR UPDATE`;
        await lockOrderRow(tx, reference.orderId);
        const current = await tx.production.findUniqueOrThrow({
          where: { id: input.productionId },
          select: {
            status: true,
            orderId: true,
            steps: { select: { stepType: true, status: true } },
          },
        });
        if (current.orderId !== reference.orderId) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "โครงใบผลิตเปลี่ยนจากอีกหน้าจอแล้ว — กรุณาโหลดใหม่",
          });
        }
        const liveOrder = await tx.order.findUniqueOrThrow({
          where: { id: current.orderId },
          select: { internalStatus: true },
        });
        const legacySteps = current.steps.filter(
          (step) => step.stepType === "PACKAGING",
        );
        const hasPendingLegacy = legacySteps.some(
          (step) => step.status !== "COMPLETED",
        );

        // ปุ่มอาจถูกกดซ้ำจาก timeout/refetch: ถ้าก้อนเดิมปิดแล้ว ให้ตอบผลปัจจุบันโดยไม่เขียนซ้ำ
        if (
          current.status === "COMPLETED" &&
          legacySteps.length > 0 &&
          !hasPendingLegacy
        ) {
          return {
            finalized: true,
            alreadyFinalized: true,
            movedToQc: liveOrder.internalStatus === "QUALITY_CHECK",
            orderStatus: liveOrder.internalStatus,
          };
        }
        if (liveOrder.internalStatus !== "PRODUCING") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `ส่งเข้า QC ไม่ได้ — ออเดอร์อยู่สถานะ ${INTERNAL_STATUS_LABELS[liveOrder.internalStatus] ?? liveOrder.internalStatus}`,
          });
        }

        const finalized = await finalizeProductionIfComplete(tx, {
          productionId: input.productionId,
          changedBy: ctx.userId,
          requireLegacyPackaging: true,
        });
        if (!finalized) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "ยังส่งเข้า QC ไม่ได้ — ขั้นผลิตจริงต้องเสร็จครบและมีขั้นแพ็กเดิมค้างอยู่",
          });
        }

        await createAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entityType: "PRODUCTION",
          entityId: input.productionId,
          newValue: { finalizedLegacyPackaging: true },
        });
        const after = await tx.order.findUniqueOrThrow({
          where: { id: current.orderId },
          select: { internalStatus: true },
        });
        return {
          finalized: true,
          alreadyFinalized: false,
          movedToQc: after.internalStatus === "QUALITY_CHECK",
          orderStatus: after.internalStatus,
        };
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
      const demoLocal = isLocalDemoStockEnabled();
      const apiConfigured = demoLocal
        ? false
        : (await getStockClientFromSettings()) !== null;
      const availability = demoLocal
        ? await getLocalDemoStockAvailability(
            ctx.prisma,
            production.orderId,
            state.lines,
          )
        : [];
      const availableBySku = new Map(
        availability.map((line) => [line.sku, line.availableToThisOrder]),
      );
      const stockMode = demoLocal
        ? ("demo-local" as const)
        : apiConfigured
          ? ("api" as const)
          : ("unconfigured" as const);
      return {
        ...state,
        lines: state.lines.map((line) => ({
          ...line,
          available: demoLocal ? (availableBySku.get(line.sku) ?? 0) : null,
        })),
        configured: demoLocal || apiConfigured,
        stockMode,
      };
    }),

  // เบิกเสื้อ: ISSUE + orderRef → Stock ตัดยอดจองออเดอร์นี้อัตโนมัติ + กันเบิกทับจองงานอื่น
  issueGarments: protectedProcedure
    .use(productionTeam)
    .input(
      z.object({
        productionId: z.string(),
        stepId: z.string().optional(),
        operationJobId: z.string().optional(),
        expectedRevision: z.number().int().nonnegative().optional(),
        // กันยิงซ้ำ (กดเบิ้ล/เน็ตสะดุดแล้วลองใหม่) — UI สร้างครั้งเดียวต่อการเปิด dialog
        idempotencyKey: z.string().min(8),
        lines: z
          .array(z.object({ sku: z.string(), qty: z.number().int().min(0) }))
          .min(1),
      }).superRefine((value, refinement) => {
        if (!!value.stepId === !!value.operationJobId) {
          refinement.addIssue({
            code: "custom",
            path: ["operationJobId"],
            message: "ต้องระบุ stepId หรือ operationJobId อย่างใดอย่างหนึ่ง",
          });
        }
        if (value.operationJobId && value.expectedRevision === undefined) {
          refinement.addIssue({
            code: "custom",
            path: ["expectedRevision"],
            message: "Production V2 ต้องระบุ expectedRevision",
          });
        }
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.operationJobId) assertProductionV2ApiEnabled();
      return issueGarments(ctx.prisma, {
        ...input,
        userId: ctx.userId,
        // PERM: กติกา own-work/auto-claim ตรง updateStep — ไม่ใช่หัวหน้า = แตะเฉพาะงานตัวเอง
        canSupervise: hasPermission(
          ctx.userRole,
          ctx.permissionOverrides,
          "supervise_operations",
        ),
      });
    }),

  // คืนเศษเข้าสต๊อค (เผื่อเสีย 3% ที่เหลือ) — คืนได้ไม่เกินยอดเบิกค้าง
  returnGarments: protectedProcedure
    .input(
      z.object({
        productionId: z.string(),
        operationJobId: z.string().optional(),
        expectedRevision: z.number().int().nonnegative().optional(),
        idempotencyKey: z.string().min(8),
        note: z.string().optional(),
        lines: z
          .array(z.object({ sku: z.string(), qty: z.number().int().min(0) }))
          .min(1),
      }).superRefine((value, refinement) => {
        if (value.operationJobId && value.expectedRevision === undefined) {
          refinement.addIssue({
            code: "custom",
            path: ["expectedRevision"],
            message: "Production V2 ต้องระบุ expectedRevision",
          });
        }
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.operationJobId) assertProductionV2ApiEnabled();
      const requiredPermission = input.operationJobId
        ? "manage_production"
        : "supervise_operations";
      if (!hasPermission(ctx.userRole, ctx.permissionOverrides, requiredPermission)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "บัญชีนี้ไม่มีสิทธิ์คืนเสื้อเข้าสต๊อค",
        });
      }
      return returnGarments(ctx.prisma, {
        ...input,
        userId: ctx.userId,
        canSupervise: hasPermission(
          ctx.userRole,
          ctx.permissionOverrides,
          "supervise_operations",
        ),
      });
    }),
});
