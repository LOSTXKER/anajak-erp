/**
 * รอบพิมพ์ฟิล์ม DTF (FLOW-REDESIGN ก้อน 2 — หน้าเครื่อง)
 *
 * ความจริงหน้าเครื่อง: คิวพิมพ์ฟิล์มกับคิวรีดเป็นคนละคิว — ช่างพิมพ์เลือกหลายงาน
 * จากคิว (เฉพาะงานไฟล์พร้อม) รวมลงม้วนเดียวเป็น "รอบพิมพ์" จัดวางในโปรแกรมเครื่อง
 * (RIP — ระบบจงใจไม่ทำ auto-nesting) แล้วกดเป็นจังหวะชุด:
 *
 *   PRINTING ──พิมพ์จบทั้งม้วน──▶ PRINTED ──ตัดแยก+ติดป้ายเสร็จ──▶ COMPLETED
 *
 * ขั้น DTF_PRINT ของงานสมาชิกถูกนับ/ปิด "ตอน COMPLETED เท่านั้น" — จุดตัดแยกฟิล์ม
 * เป็นด่านบังคับกันฟิล์มสลับออเดอร์ (ฟิล์มยังเป็นม้วนรวม = ยังรีดไม่ได้)
 * ฟิล์มพิมพ์เผื่อ (กรอกตอนปิดรอบ — batch เดียว ไม่เพิ่มงานหน้างาน) เข้าคลัง FilmStock
 *
 * กติกา:
 * - ปิดขั้นเป็นชุด = pattern เดียวกับ outsource QC_PASSED: lock แถวขั้น FOR UPDATE →
 *   increment qtyDone → ปิดเมื่อไม่มีรอบค้างอื่น + จำนวนครบ → finalizeProductionIfComplete
 * - งานหนึ่งแบ่งพิมพ์หลายรอบได้ แต่ห้ามอยู่สองรอบ active พร้อมกัน (กันนับซ้อน)
 * - ไม่มีเงินใน flow นี้ (มติเลิกคิดต้นทุนต่องาน 2026-06-12)
 */

import { badRequest, notFound } from "@/server/errors";
import { nextDocumentNumber } from "@/server/services/document-number";
import { finalizeProductionIfComplete } from "@/server/services/order-status";
import { resolveSoleOrderArtworkId } from "@/server/services/artwork";
// สูตรตัดสินล้วน (ช่องคิว/ไฟล์พร้อม/เพดานจำนวน/ปิดขั้น) — unit test ได้ไม่ต้องมี DB
import {
  isFileReadyForPrint,
  printQueueSlotOf,
  compareDueDate,
  planRunItemQty,
  shouldCloseStep,
} from "@/server/services/print-run-plan";
import type { ExtendedPrismaClient, PrismaTx } from "@/lib/prisma";

// สถานะรอบที่ยังกินงานอยู่ — งานในรอบเหล่านี้ห้ามโผล่ในคิว/ห้ามเข้ารอบใหม่
const ACTIVE_RUN_STATUSES = ["PRINTING", "PRINTED"] as const;

// ============================================================
// คิวพิมพ์ฟิล์ม — ขั้น DTF_PRINT ที่ "ไฟล์พร้อม + ยังพิมพ์ไม่ครบ + ไม่ติดรอบอื่น"
// ============================================================

export interface PrintQueueEntry {
  stepId: string;
  productionId: string;
  orderId: string;
  orderNumber: string;
  orderName: string;
  customerName: string;
  dueDate: Date | null;
  qtyDone: number;
  qtyTotal: number; // จำนวนที่ต้องพิมพ์ (qtyTotal ของขั้น หรือยอดรวมออเดอร์)
  remaining: number;
}

export async function getPrintQueue(prisma: ExtendedPrismaClient): Promise<PrintQueueEntry[]> {
  const steps = await prisma.productionStep.findMany({
    where: {
      stepType: "DTF_PRINT",
      status: { in: ["PENDING", "IN_PROGRESS"] },
      production: { order: { internalStatus: { notIn: ["CANCELLED", "ON_HOLD"] } } },
    },
    select: {
      id: true,
      productionId: true,
      qtyDone: true,
      qtyTotal: true,
      printRunItems: {
        where: { printRun: { status: { in: [...ACTIVE_RUN_STATUSES] } } },
        select: { id: true },
      },
      production: {
        select: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              title: true,
              internalStatus: true,
              deadline: true,
              customer: { select: { name: true } },
              items: { select: { totalQuantity: true } },
              designs: { where: { approvalStatus: "APPROVED" }, take: 1, select: { id: true } },
            },
          },
        },
      },
    },
  });

  const entries: PrintQueueEntry[] = [];
  for (const s of steps) {
    const order = s.production.order;
    const slot = printQueueSlotOf({
      inActiveRun: s.printRunItems.length > 0,
      hasApprovedDesign: order.designs.length > 0,
      orderInternalStatus: order.internalStatus,
      qtyDone: s.qtyDone,
      qtyTotal: s.qtyTotal,
      orderQty: order.items.reduce((sum, it) => sum + it.totalQuantity, 0),
    });
    if (!slot) continue; // ติดรอบ active / ไฟล์ไม่พร้อม / ไม่รู้จำนวน / พิมพ์ครบแล้ว
    entries.push({
      stepId: s.id,
      productionId: s.productionId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderName: order.title ?? "",
      customerName: order.customer.name,
      dueDate: order.deadline,
      qtyDone: s.qtyDone,
      qtyTotal: slot.qtyTotal,
      remaining: slot.remaining,
    });
  }

  // เรียงตามกำหนดส่ง — งานไม่มีกำหนดไปท้ายคิว
  entries.sort((a, b) => compareDueDate(a.dueDate, b.dueDate));
  return entries;
}

// ============================================================
// เปิดรอบพิมพ์ — เลือกหลายงานจากคิวรวมเป็นรอบเดียว
// ============================================================

export interface CreatePrintRunParams {
  items: Array<{ stepId: string; qty: number }>;
  note?: string;
  userId: string;
}

export async function createPrintRun(prisma: ExtendedPrismaClient, params: CreatePrintRunParams) {
  if (params.items.length === 0) badRequest("ยังไม่ได้เลือกงานเข้ารอบพิมพ์");
  const stepIds = params.items.map((i) => i.stepId);
  if (new Set(stepIds).size !== stepIds.length) badRequest("เลือกงานซ้ำกันในรอบเดียว");

  return prisma.$transaction(async (tx) => {
    // lock ทุกขั้นก่อนตรวจ — กันสองรอบเปิดทับงานเดียวกันพร้อมกัน
    // เรียง id เสมอ: ทุก path (เปิด/ปิด/ยกเลิกรอบ) ขอ lock ลำดับ global เดียวกัน กัน deadlock
    for (const stepId of [...stepIds].sort()) {
      await tx.$queryRaw`SELECT id FROM production_steps WHERE id = ${stepId} FOR UPDATE`;
    }

    const steps = await tx.productionStep.findMany({
      where: { id: { in: stepIds } },
      select: {
        id: true,
        stepType: true,
        status: true,
        qtyDone: true,
        qtyTotal: true,
        printRunItems: {
          where: { printRun: { status: { in: [...ACTIVE_RUN_STATUSES] } } },
          select: { id: true },
        },
        production: {
          select: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                internalStatus: true,
                items: { select: { totalQuantity: true } },
                designs: { where: { approvalStatus: "APPROVED" }, take: 1, select: { id: true } },
              },
            },
          },
        },
      },
    });
    const byId = new Map(steps.map((s) => [s.id, s]));

    const prepared: Array<{ stepId: string; orderId: string; qty: number; seedQtyTotal: number | null }> = [];
    for (const item of params.items) {
      const step = byId.get(item.stepId);
      if (!step) notFound("ขั้นตอนผลิต", item.stepId);
      const order = step.production.order;
      if (step.stepType !== "DTF_PRINT") {
        badRequest(`งาน ${order.orderNumber}: รอบพิมพ์รับเฉพาะขั้นพิมพ์ฟิล์ม DTF`);
      }
      // จอค้างเก่าพางานที่ถูกยกเลิก/พักเข้ารอบได้ — เช็คซ้ำฝั่ง server เสมอ (เปลืองม้วนจริง)
      if (order.internalStatus === "CANCELLED" || order.internalStatus === "ON_HOLD") {
        badRequest(`งาน ${order.orderNumber}: ออเดอร์ถูกยกเลิก/พักแล้ว — รีเฟรชคิวก่อน`);
      }
      if (step.status !== "PENDING" && step.status !== "IN_PROGRESS") {
        badRequest(
          `งาน ${order.orderNumber}: ขั้นพิมพ์ฟิล์มไม่อยู่สถานะที่เข้ารอบได้ (${step.status}) — งานมีปัญหา/ถูกพักให้แก้ที่หน้าใบผลิตก่อน`
        );
      }
      if (step.printRunItems.length > 0) {
        badRequest(`งาน ${order.orderNumber}: อยู่ในรอบพิมพ์อื่นที่ยังไม่จบ`);
      }
      if (!isFileReadyForPrint(order.designs.length > 0, order.internalStatus)) {
        badRequest(`งาน ${order.orderNumber}: แบบยังไม่อนุมัติ — ไฟล์ยังไม่พร้อมพิมพ์`);
      }

      const { seedQtyTotal } = planRunItemQty({
        orderNumber: order.orderNumber,
        stepQtyDone: step.qtyDone,
        stepQtyTotal: step.qtyTotal,
        orderQty: order.items.reduce((sum, it) => sum + it.totalQuantity, 0),
        qty: item.qty,
      });
      prepared.push({ stepId: step.id, orderId: order.id, qty: item.qty, seedQtyTotal });
    }

    const runNumber = await nextDocumentNumber(tx, "PRINT_RUN");
    const run = await tx.printRun.create({
      data: {
        runNumber,
        note: params.note,
        createdById: params.userId,
        items: {
          create: prepared.map((p) => ({
            productionStepId: p.stepId,
            orderId: p.orderId,
            qty: p.qty,
          })),
        },
      },
      include: { items: true },
    });

    // งานเข้ารอบ = เริ่มลงมือแล้ว — ขั้น PENDING ขยับเป็นกำลังทำ + seed qtyTotal
    for (const p of prepared) {
      await tx.productionStep.update({
        where: { id: p.stepId },
        data: {
          ...(p.seedQtyTotal !== null ? { qtyTotal: p.seedQtyTotal } : {}),
          status: "IN_PROGRESS",
          startedAt: byId.get(p.stepId)!.status === "PENDING" ? new Date() : undefined,
        },
      });
    }

    return run;
  });
}

// ============================================================
// จังหวะของรอบ: พิมพ์จบทั้งม้วน → ตัดแยก+ติดป้ายเสร็จ (ปิดขั้นเป็นชุด)
// ============================================================

export async function markPrintRunPrinted(prisma: ExtendedPrismaClient, runId: string) {
  const res = await prisma.printRun.updateMany({
    where: { id: runId, status: "PRINTING" },
    data: { status: "PRINTED", printedAt: new Date() },
  });
  if (res.count === 0) {
    badRequest("รอบนี้ไม่ได้อยู่สถานะกำลังพิมพ์ — รีเฟรชดูสถานะล่าสุดก่อน");
  }
}

export interface CompletePrintRunParams {
  runId: string;
  /** ฟิล์มพิมพ์เผื่อต่องาน (optional) — เข้าคลังฟิล์มพร้อมรีด */
  extras?: Array<{ itemId: string; extraQty: number; label?: string }>;
  userId: string;
}

export async function completePrintRun(
  prisma: ExtendedPrismaClient,
  params: CompletePrintRunParams
) {
  return prisma.$transaction(async (tx) => {
    // optimistic: ผ่านจุดตัดแยกได้เฉพาะรอบที่พิมพ์จบแล้ว — สองจอกดพร้อมกันเหลือคนเดียว
    const res = await tx.printRun.updateMany({
      where: { id: params.runId, status: "PRINTED" },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    if (res.count === 0) {
      badRequest("รอบนี้ยังไม่ได้กดพิมพ์จบ หรือถูกปิดไปแล้ว — รีเฟรชดูสถานะล่าสุดก่อน");
    }

    const run = await tx.printRun.findUniqueOrThrow({
      where: { id: params.runId },
      include: {
        items: {
          include: {
            order: {
              select: { id: true, orderNumber: true, title: true, customerId: true },
            },
          },
        },
      },
    });
    const extraByItem = new Map(
      (params.extras ?? []).map((e) => [e.itemId, e] as const)
    );

    const touchedProductions = new Set<string>();
    // เรียงตาม stepId — ลำดับ lock global เดียวกับเปิด/ยกเลิกรอบ (กัน deadlock)
    const sortedItems = [...run.items].sort((a, b) =>
      a.productionStepId.localeCompare(b.productionStepId)
    );
    for (const item of sortedItems) {
      // pattern เดียวกับ outsource QC_PASSED — lock แถวขั้นก่อนอ่าน-เขียน qty
      await tx.$queryRaw`SELECT id FROM production_steps WHERE id = ${item.productionStepId} FOR UPDATE`;
      const bumped = await tx.productionStep.update({
        where: { id: item.productionStepId },
        data: { qtyDone: { increment: item.qty } },
        select: { qtyDone: true, qtyTotal: true, productionId: true },
      });
      // รอบ active อื่นที่ยังกินขั้นนี้อยู่ — ยังปิดขั้นไม่ได้ (แบ่งพิมพ์หลายรอบ)
      const openRuns = await tx.printRunItem.count({
        where: {
          productionStepId: item.productionStepId,
          printRunId: { not: run.id },
          printRun: { status: { in: [...ACTIVE_RUN_STATUSES] } },
        },
      });
      await tx.productionStep.update({
        where: { id: item.productionStepId },
        data: shouldCloseStep({ qtyDone: bumped.qtyDone, qtyTotal: bumped.qtyTotal, openRuns })
          ? { status: "COMPLETED", completedAt: new Date() }
          : { status: "IN_PROGRESS" },
      });
      touchedProductions.add(bumped.productionId);

      // ฟิล์มพิมพ์เผื่อ → คลังฟิล์มพร้อมรีด (ป้าย: ลายไหน ของลูกค้าไหน กี่ชิ้น)
      const extra = extraByItem.get(item.id);
      if (extra && extra.extraQty > 0) {
        if (!Number.isInteger(extra.extraQty)) {
          badRequest(`ฟิล์มเผื่อของงาน ${item.order.orderNumber} ต้องเป็นจำนวนเต็ม`);
        }
        await tx.printRunItem.update({
          where: { id: item.id },
          data: { extraQty: extra.extraQty },
        });
        // ผูกฟิล์มกับคลังลายเมื่อระบุได้ไม่กำกวม (งานสั่งซ้ำลายผูกคลังมาแล้ว) —
        // ออเดอร์หลายลาย/ลายยังไม่เข้าคลัง = null (QC ผ่านจะย้อนผูกให้ถ้าไม่กำกวม)
        // ไม่เพิ่มช่องกรอกหน้างาน (มติ batch เดียว)
        const artworkId = await resolveSoleOrderArtworkId(tx as PrismaTx, item.order.id);
        await tx.filmStock.create({
          data: {
            customerId: item.order.customerId,
            orderId: item.order.id,
            printRunId: run.id,
            artworkId,
            label:
              extra.label?.trim() ||
              `ลายงาน ${item.order.orderNumber}${item.order.title ? ` — ${item.order.title}` : ""}`,
            qty: extra.extraQty,
            initialQty: extra.extraQty,
          },
        });
      }
    }

    // rollup กลางตัวเดียวกับ updateStep/outsource — ปิดใบผลิต + ดันออเดอร์เมื่อครบ
    for (const productionId of touchedProductions) {
      await finalizeProductionIfComplete(tx as PrismaTx, {
        productionId,
        changedBy: params.userId,
      });
    }

    return run;
  });
}

export async function cancelPrintRun(prisma: ExtendedPrismaClient, runId: string) {
  return prisma.$transaction(async (tx) => {
    // ยกเลิกได้เฉพาะก่อนพิมพ์จบ — พิมพ์ไปแล้วฟิล์มเกิดขึ้นจริง ต้องเดินต่อให้จบรอบ
    const res = await tx.printRun.updateMany({
      where: { id: runId, status: "PRINTING" },
      // completedAt = เวลาจบรอบ (รวมยกเลิก) — list ประวัติ 7 วันกรองจาก field นี้
      data: { status: "CANCELLED", completedAt: new Date() },
    });
    if (res.count === 0) {
      badRequest("ยกเลิกได้เฉพาะรอบที่ยังไม่กดพิมพ์จบ");
    }
    // คืนขั้นที่ยังไม่มีความคืบหน้าจริงกลับเข้าคิว
    const items = await tx.printRunItem.findMany({
      where: { printRunId: runId },
      select: { productionStepId: true },
      orderBy: { productionStepId: "asc" }, // ลำดับ lock global เดียวกันทุก path
    });
    for (const item of items) {
      await tx.$queryRaw`SELECT id FROM production_steps WHERE id = ${item.productionStepId} FOR UPDATE`;
      const otherRuns = await tx.printRunItem.count({
        where: {
          productionStepId: item.productionStepId,
          printRunId: { not: runId },
          printRun: { status: { in: [...ACTIVE_RUN_STATUSES] } },
        },
      });
      if (otherRuns === 0) {
        await tx.productionStep.updateMany({
          where: { id: item.productionStepId, status: "IN_PROGRESS", qtyDone: 0 },
          data: { status: "PENDING", startedAt: null },
        });
      }
    }
  });
}

// ============================================================
// รายการรอบ — จอช่างพิมพ์ (รอบค้าง) + ประวัติล่าสุด
// ============================================================

export async function listPrintRuns(prisma: ExtendedPrismaClient) {
  return prisma.printRun.findMany({
    where: {
      OR: [
        { status: { in: [...ACTIVE_RUN_STATUSES] } },
        // ประวัติรอบที่จบ/ยกเลิกล่าสุดพอให้ย้อนดู — ไม่ลาก list ยาว
        { completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      createdBy: { select: { name: true } },
      items: {
        include: {
          order: { select: { orderNumber: true, title: true, deadline: true } },
          productionStep: { select: { status: true, qtyDone: true, qtyTotal: true } },
        },
      },
    },
  });
}
