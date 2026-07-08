import type { ExtendedPrismaClient } from "@/lib/prisma";
import { getPrintQueue } from "@/server/services/print-run";
import { evaluateHeatPressGate, laneOf, STEP_TYPE_LABELS } from "@/lib/production-steps";

// ============================================================
// factory-board — คิวการผลิตทั้งโรงงาน (จอเช้า myToday + ทีวี /factory ใช้ตัวเดียวกัน กัน drift)
// **ทุก field ที่ออกจากไฟล์นี้ไม่มีเงินโดยโครงสร้าง** — ทีวีโรงงานห้ามมีตัวเลขเงินเด็ดขาด (มติเบส)
// ============================================================

const ACTIVE_RUN_STATUSES = ["PRINTING", "PRINTED"] as const;

// ด่านแพ็ค: แพ็คได้เมื่อทุกขั้นนอกเลน PACK ของใบผลิตจบครบ (ย้ายจาก task.ts มาใช้ร่วม กัน drift)
export function packGateReady(steps: { stepType: string; status: string }[]): boolean {
  return steps.every((s) => laneOf(s.stepType) === "PACK" || s.status === "COMPLETED");
}

type StepQueueOpts = { userId?: string | null; ownWorkOnly?: boolean; limit?: number };

// ไม่ใช่หัวหน้า = เห็นเฉพาะงานของตัวเอง/ยังไม่มีเจ้าของ · หัวหน้า/ทีวี = ทั้งโรงงาน (ownWorkOnly=false)
function ownFilter(ownWorkOnly: boolean, userId?: string | null) {
  return ownWorkOnly ? { OR: [{ assignedToId: userId ?? undefined }, { assignedToId: null }] } : {};
}

// คิวรีดร้อน: ขั้น HEAT_PRESS ที่ผ่าน gate ฟิล์มเสร็จ∧เสื้อพร้อมเท่านั้น (งานติดเงื่อนไขไม่โผล่)
export async function buildPressQueue(prisma: ExtendedPrismaClient, opts: StepQueueOpts = {}) {
  const { userId, ownWorkOnly = false, limit = 8 } = opts;
  const steps = await prisma.productionStep.findMany({
    where: {
      stepType: "HEAT_PRESS",
      status: { in: ["PENDING", "IN_PROGRESS"] },
      production: { order: { internalStatus: { notIn: ["CANCELLED", "ON_HOLD"] } } },
      ...ownFilter(ownWorkOnly, userId),
    },
    select: {
      id: true,
      qtyDone: true,
      qtyTotal: true,
      assignedTo: { select: { name: true } },
      production: {
        select: {
          id: true,
          steps: { select: { stepType: true, status: true } },
          order: {
            select: {
              orderNumber: true,
              title: true,
              deadline: true,
              customer: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { production: { order: { deadline: "asc" } } },
    take: 100,
  });
  return steps
    .filter((s) => evaluateHeatPressGate(s.production.steps).ready)
    .slice(0, limit)
    .map((s) => ({
      stepId: s.id,
      productionId: s.production.id,
      orderNumber: s.production.order.orderNumber,
      title: s.production.order.title,
      customerName: s.production.order.customer.name,
      deadline: s.production.order.deadline,
      qtyDone: s.qtyDone,
      qtyTotal: s.qtyTotal,
      assignedToName: s.assignedTo?.name ?? null,
    }));
}

// คิวแพ็ค: ขั้น PACKAGING ที่ของพร้อมแพ็คจริง (สายอื่นจบครบ) · ใบผลิตเดียวเอาขั้นแรกที่ค้าง
export async function buildPackQueue(prisma: ExtendedPrismaClient, opts: StepQueueOpts = {}) {
  const { userId, ownWorkOnly = false, limit = 8 } = opts;
  const steps = await prisma.productionStep.findMany({
    where: {
      stepType: "PACKAGING",
      status: { in: ["PENDING", "IN_PROGRESS"] },
      production: { order: { internalStatus: { notIn: ["CANCELLED", "ON_HOLD"] } } },
      ...ownFilter(ownWorkOnly, userId),
    },
    select: {
      id: true,
      assignedTo: { select: { name: true } },
      production: {
        select: {
          id: true,
          steps: { select: { stepType: true, status: true } },
          order: {
            select: {
              orderNumber: true,
              title: true,
              deadline: true,
              blindShip: true, // ธงแดงบนคิวแพ็ค — พลาดใส่เอกสาร Anajak ครั้งเดียวเสียลูกค้า reseller
              customer: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: [{ production: { order: { deadline: "asc" } } }, { sortOrder: "asc" }],
    take: 100,
  });
  const seen = new Set<string>();
  return steps
    .filter((s) => packGateReady(s.production.steps))
    .filter((s) => {
      if (seen.has(s.production.id)) return false;
      seen.add(s.production.id);
      return true;
    })
    .slice(0, limit)
    .map((s) => ({
      stepId: s.id,
      productionId: s.production.id,
      orderNumber: s.production.order.orderNumber,
      title: s.production.order.title,
      customerName: s.production.order.customer.name,
      deadline: s.production.order.deadline,
      blindShip: s.production.order.blindShip,
      assignedToName: s.assignedTo?.name ?? null,
    }));
}

// ปัญหาบนไลน์: ขั้นที่ FAILED/ON_HOLD — เด่นสุดบนทีวี (บอกลูกค้า+ช่าง+ด่านที่ติด · ไม่มีเงิน)
async function buildProblems(prisma: ExtendedPrismaClient, limit = 10) {
  const steps = await prisma.productionStep.findMany({
    where: {
      status: { in: ["FAILED", "ON_HOLD"] },
      production: {
        order: {
          internalStatus: { in: ["PRODUCTION_QUEUE", "PRODUCING", "QUALITY_CHECK", "PACKING"] },
        },
      },
    },
    select: {
      id: true,
      stepType: true,
      customStepName: true,
      status: true,
      assignedTo: { select: { name: true } },
      production: {
        select: {
          order: {
            select: {
              orderNumber: true,
              title: true,
              deadline: true,
              customer: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { production: { order: { deadline: "asc" } } },
    take: limit,
  });
  return steps.map((s) => ({
    stepId: s.id,
    orderNumber: s.production.order.orderNumber,
    title: s.production.order.title,
    customerName: s.production.order.customer.name,
    deadline: s.production.order.deadline,
    status: s.status, // FAILED | ON_HOLD — client แปลงเป็นไทย
    stepLabel: s.customStepName ?? STEP_TYPE_LABELS[s.stepType] ?? s.stepType,
    assignedToName: s.assignedTo?.name ?? null,
  }));
}

// รอบพิมพ์ DTF ที่เดินอยู่ (PRINTING/PRINTED) — งานบนเครื่องพิมพ์ตอนนี้ + ช่างที่เปิดรอบ
async function buildActiveRuns(prisma: ExtendedPrismaClient, limit = 6) {
  const runs = await prisma.printRun.findMany({
    where: { status: { in: [...ACTIVE_RUN_STATUSES] } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      runNumber: true,
      status: true,
      createdBy: { select: { name: true } },
      items: {
        select: {
          qty: true,
          order: { select: { orderNumber: true, customer: { select: { name: true } } } },
        },
      },
    },
  });
  return runs.map((r) => ({
    runNumber: r.runNumber,
    status: r.status,
    openedByName: r.createdBy.name,
    jobs: r.items.map((it) => ({
      orderNumber: it.order.orderNumber,
      customerName: it.order.customer.name,
      qty: it.qty,
    })),
  }));
}

// ครบกำหนดส่งวันนี้-พรุ่งนี้ ที่ยังเดินอยู่ (ส่งแล้วไม่ต้องลุ้น) — แถบ "กำลังจะมา"
async function buildDueSoon(prisma: ExtendedPrismaClient, limit = 8) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfTomorrow = new Date();
  endOfTomorrow.setHours(23, 59, 59, 999);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
  const orders = await prisma.order.findMany({
    where: {
      internalStatus: { notIn: ["CANCELLED", "ON_HOLD", "SHIPPED", "COMPLETED"] },
      deadline: { gte: startOfToday, lte: endOfTomorrow },
    },
    select: {
      orderNumber: true,
      deadline: true,
      customer: { select: { name: true } },
    },
    orderBy: { deadline: "asc" },
    take: limit,
  });
  return orders.map((o) => ({
    orderNumber: o.orderNumber,
    customerName: o.customer.name,
    deadline: o.deadline,
  }));
}

// ร้านนอกครบกำหนดรับ (lte สิ้นวันนี้ = รวมเลยกำหนด) — ของที่ต้องตามกลับเข้าไลน์
async function buildOutsourceDue(prisma: ExtendedPrismaClient, limit = 8) {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const rows = await prisma.outsourceOrder.findMany({
    where: {
      status: { in: ["SENT", "IN_PROGRESS"] },
      expectedBackAt: { lte: endOfToday },
    },
    orderBy: { expectedBackAt: "asc" },
    take: limit,
    select: {
      expectedBackAt: true,
      vendor: { select: { name: true } },
      productionStep: {
        select: {
          production: {
            select: {
              order: {
                select: { orderNumber: true, customer: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  });
  return rows.map((o) => ({
    orderNumber: o.productionStep.production.order.orderNumber,
    customerName: o.productionStep.production.order.customer.name,
    vendorName: o.vendor.name,
    expectedBackAt: o.expectedBackAt,
  }));
}

// ภาพรวมทั้งโรงงานสำหรับทีวี — ยิงทุกก้อนขนาน · ไม่มีเงินสัก field เดียว
export async function getFactoryBoard(prisma: ExtendedPrismaClient) {
  const [problems, activeRuns, printQueue, pressQueue, packQueue, dueSoon, outsourceDue] =
    await Promise.all([
      buildProblems(prisma),
      buildActiveRuns(prisma),
      getPrintQueue(prisma).then((q) =>
        q.slice(0, 8).map((e) => ({
          stepId: e.stepId, // ใช้เป็น React key — orderNumber ซ้ำได้ (ออเดอร์เดียวมีหลายขั้น DTF_PRINT)
          orderNumber: e.orderNumber,
          customerName: e.customerName,
          title: e.orderName,
          qtyTotal: e.qtyTotal,
          remaining: e.remaining,
          deadline: e.dueDate,
        }))
      ),
      buildPressQueue(prisma, { limit: 8 }),
      buildPackQueue(prisma, { limit: 8 }),
      buildDueSoon(prisma),
      buildOutsourceDue(prisma),
    ]);
  return {
    generatedAt: new Date(),
    problems,
    activeRuns,
    printQueue,
    pressQueue,
    packQueue,
    dueSoon,
    outsourceDue,
  };
}
