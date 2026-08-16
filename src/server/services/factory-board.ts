import type { Prisma } from "@prisma/client";
import type { ExtendedPrismaClient } from "@/lib/prisma";
import { getPrintQueue } from "@/server/services/print-run";
import { evaluateHeatPressGate, STEP_TYPE_LABELS } from "@/lib/production-steps";
import { BANGKOK_TZ } from "@/lib/utils";

// ============================================================
// factory-board — คิวการผลิตทั้งโรงงาน (จอเช้า myToday + ทีวี /factory ใช้ตัวเดียวกัน กัน drift)
// **ทุก field ที่ออกจากไฟล์นี้ไม่มีเงินโดยโครงสร้าง** — ทีวีโรงงานห้ามมีตัวเลขเงินเด็ดขาด (มติเบส)
// ============================================================

const ACTIVE_RUN_STATUSES = ["PRINTING", "PRINTED"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

type StepQueueOpts = { userId?: string | null; ownWorkOnly?: boolean; limit?: number };

const PREP_QUEUE_WHERE = {
  stepType: { in: ["GARMENT_PICK", "GARMENT_RECEIVE"] },
  status: { in: ["PENDING", "IN_PROGRESS"] },
  production: { order: { internalStatus: "PRODUCING" } },
} satisfies Prisma.ProductionStepWhereInput;

const PROBLEM_WHERE = {
  stepType: { not: "PACKAGING" },
  status: { in: ["FAILED", "ON_HOLD"] },
  production: {
    order: {
      internalStatus: { in: ["PRODUCTION_QUEUE", "PRODUCING", "QUALITY_CHECK", "PACKING"] },
    },
  },
} satisfies Prisma.ProductionStepWhereInput;

const ACTIVE_FACTORY_ORDER_STATUSES = [
  "PRODUCTION_QUEUE",
  "PRODUCING",
  "QUALITY_CHECK",
  "PACKING",
  "READY_TO_SHIP",
] as const;

// ไม่ใช่หัวหน้า = เห็นเฉพาะงานของตัวเอง/ยังไม่มีเจ้าของ · หัวหน้า/ทีวี = ทั้งโรงงาน (ownWorkOnly=false)
function ownFilter(ownWorkOnly: boolean, userId?: string | null) {
  return ownWorkOnly ? { OR: [{ assignedToId: userId ?? undefined }, { assignedToId: null }] } : {};
}

// คิวเตรียมเสื้อบน TV: รวมเบิกสต๊อคและตรวจรับเสื้อลูกค้า แต่ตัดงานเสีย/พักออกไป
// แสดงแยกใน rail ปัญหาอยู่แล้ว เพื่อให้ตัวเลขบนด่านสื่อว่า "งานที่เดินอยู่" จริง
export async function buildPrepQueue(prisma: ExtendedPrismaClient, limit = 8) {
  const steps = await prisma.productionStep.findMany({
    where: PREP_QUEUE_WHERE,
    select: {
      id: true,
      stepType: true,
      status: true,
      qtyDone: true,
      qtyTotal: true,
      assignedTo: { select: { name: true } },
      production: {
        select: {
          id: true,
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

  return steps.map((step) => ({
    stepId: step.id,
    productionId: step.production.id,
    orderNumber: step.production.order.orderNumber,
    title: step.production.order.title,
    customerName: step.production.order.customer.name,
    deadline: step.production.order.deadline,
    status: step.status,
    stepLabel: STEP_TYPE_LABELS[step.stepType] ?? step.stepType,
    qtyDone: step.qtyDone,
    qtyTotal: step.qtyTotal,
    assignedToName: step.assignedTo?.name ?? null,
  }));
}

// คิวรีดร้อน: ขั้น HEAT_PRESS ที่ผ่าน gate ฟิล์มเสร็จ∧เสื้อพร้อมเท่านั้น (งานติดเงื่อนไขไม่โผล่)
async function loadPressQueue(prisma: ExtendedPrismaClient, opts: StepQueueOpts = {}) {
  const { userId, ownWorkOnly = false } = opts;
  const steps = await prisma.productionStep.findMany({
    where: {
      stepType: "HEAT_PRESS",
      status: { in: ["PENDING", "IN_PROGRESS"] },
      production: { order: { internalStatus: { notIn: ["CANCELLED", "ON_HOLD"] } } },
      ...ownFilter(ownWorkOnly, userId),
    },
    select: {
      id: true,
      status: true,
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
  });
  return steps
    .filter((s) => evaluateHeatPressGate(s.production.steps).ready)
    .map((s) => ({
      stepId: s.id,
      productionId: s.production.id,
      orderNumber: s.production.order.orderNumber,
      title: s.production.order.title,
      customerName: s.production.order.customer.name,
      deadline: s.production.order.deadline,
      status: s.status,
      qtyDone: s.qtyDone,
      qtyTotal: s.qtyTotal,
      assignedToName: s.assignedTo?.name ?? null,
    }));
}

export async function buildPressQueue(prisma: ExtendedPrismaClient, opts: StepQueueOpts = {}) {
  const { limit = 8 } = opts;
  return (await loadPressQueue(prisma, opts)).slice(0, limit);
}

// คิวแพ็กสุดท้าย: ออเดอร์เข้า PACKING ได้หลัง QC ผ่านเท่านั้น · ไม่มี assignee ระดับ step
// เพราะแพ็กเป็นช่วงระดับออเดอร์/Delivery ไม่ใช่ ProductionStep แล้ว
export async function buildPackQueue(prisma: ExtendedPrismaClient, opts: StepQueueOpts = {}) {
  const { limit = 8 } = opts;
  const orders = await prisma.order.findMany({
    where: { internalStatus: "PACKING" },
    select: {
      id: true,
      orderNumber: true,
      title: true,
      deadline: true,
      priority: true,
      blindShip: true, // ธงแดงบนคิวแพ็ก — พลาดใส่เอกสาร Anajak ครั้งเดียวเสียลูกค้า reseller
      customer: { select: { name: true } },
      items: { select: { totalQuantity: true } },
    },
    orderBy: { deadline: "asc" },
    take: limit,
  });
  return orders.map((order) => ({
    stepId: `pack:${order.id}`,
    orderId: order.id,
    productionId: null,
    orderNumber: order.orderNumber,
    title: order.title,
    customerName: order.customer.name,
    deadline: order.deadline,
    priority: order.priority,
    totalQuantity: order.items.reduce((sum, item) => sum + item.totalQuantity, 0),
    blindShip: order.blindShip,
    assignedToName: null,
  }));
}

type PostProductionStatus = "QUALITY_CHECK" | "READY_TO_SHIP";

// ด่านหลังการผลิตไม่มี ProductionStep: QC และผลลัพธ์พร้อมส่งอ่านจากสถานะออเดอร์
// โดยตรง เพื่อไม่สร้าง PACKAGING ปลอมย้อนกลับไปก่อน QC
async function buildOrderStatusQueue(
  prisma: ExtendedPrismaClient,
  status: PostProductionStatus,
  limit = 8,
) {
  const orders = await prisma.order.findMany({
    where: { internalStatus: status },
    select: {
      id: true,
      orderNumber: true,
      title: true,
      deadline: true,
      priority: true,
      blindShip: true,
      customer: { select: { name: true } },
      items: { select: { totalQuantity: true } },
    },
    orderBy: { deadline: "asc" },
    take: limit,
  });

  const prefix = status === "QUALITY_CHECK" ? "qc" : "ready";
  return orders.map((order) => ({
    key: `${prefix}:${order.id}`,
    orderId: order.id,
    orderNumber: order.orderNumber,
    title: order.title,
    customerName: order.customer.name,
    deadline: order.deadline,
    priority: order.priority,
    totalQuantity: order.items.reduce((sum, item) => sum + item.totalQuantity, 0),
    blindShip: order.blindShip,
  }));
}

export function buildQcQueue(prisma: ExtendedPrismaClient, limit = 8) {
  return buildOrderStatusQueue(prisma, "QUALITY_CHECK", limit);
}

export function buildReadyToShipQueue(prisma: ExtendedPrismaClient, limit = 8) {
  return buildOrderStatusQueue(prisma, "READY_TO_SHIP", limit);
}

// ปัญหาบนไลน์: ขั้นที่ FAILED/ON_HOLD — เด่นสุดบนทีวี (บอกลูกค้า+ช่าง+ด่านที่ติด · ไม่มีเงิน)
export async function buildProblems(prisma: ExtendedPrismaClient, limit = 10) {
  const steps = await prisma.productionStep.findMany({
    where: PROBLEM_WHERE,
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
async function buildActiveRuns(prisma: ExtendedPrismaClient) {
  const runs = await prisma.printRun.findMany({
    where: { status: { in: [...ACTIVE_RUN_STATUSES] } },
    orderBy: { createdAt: "desc" },
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

export type FactoryStageTotal = { total: number; activeTotal: number };

export function buildFactoryStageTotals(input: {
  prepTotal: number;
  prepActiveTotal: number;
  activeRuns: ReadonlyArray<{ jobs: readonly unknown[] }>;
  printQueue: readonly unknown[];
  pressQueue: ReadonlyArray<{ status: string }>;
  qcTotal: number;
  packTotal: number;
}) {
  // DTF นับ "งาน/ขั้น" ทั้งฝั่งอยู่ในรอบและคิวถัดไป ไม่บวกรอบกับงานคนละหน่วย
  const activeDtfJobs = input.activeRuns.reduce((sum, run) => sum + run.jobs.length, 0);
  return {
    prep: { total: input.prepTotal, activeTotal: input.prepActiveTotal },
    dtf: {
      total: activeDtfJobs + input.printQueue.length,
      activeTotal: activeDtfJobs,
    },
    press: {
      total: input.pressQueue.length,
      // status คือแหล่งความจริง: กดเริ่มแล้วแต่นับได้ 0 ตัวก็ยังเป็นงานกำลังทำ
      activeTotal: input.pressQueue.filter((item) => item.status === "IN_PROGRESS").length,
    },
    qc: { total: input.qcTotal, activeTotal: 0 },
    pack: { total: input.packTotal, activeTotal: 0 },
  } satisfies Record<"prep" | "dtf" | "press" | "qc" | "pack", FactoryStageTotal>;
}

function bangkokDayStart(now: Date): Date {
  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: BANGKOK_TZ }).format(now);
  return new Date(`${dayKey}T00:00:00+07:00`);
}

// ครบกำหนดส่งวันนี้-พรุ่งนี้ตามวันทำงานไทย ไม่ผูก timezone ของ server
export function factoryBoardWindow(now = new Date()) {
  const startOfToday = bangkokDayStart(now);
  const endOfTomorrow = new Date(startOfToday.getTime() + DAY_MS * 2 - 1);
  return { startOfToday, endOfTomorrow };
}

function dueSoonWhere(window: ReturnType<typeof factoryBoardWindow>): Prisma.OrderWhereInput {
  return {
    internalStatus: { notIn: ["CANCELLED", "ON_HOLD", "SHIPPED", "COMPLETED"] },
    // URGENT มี rail ของตัวเองแล้ว จึงไม่แสดง/นับซ้ำในกลุ่มใกล้กำหนด
    priority: { not: "URGENT" },
    deadline: { gte: window.startOfToday, lte: window.endOfTomorrow },
  };
}

function urgentOrderWhere(window: ReturnType<typeof factoryBoardWindow>): Prisma.OrderWhereInput {
  return {
    internalStatus: { in: [...ACTIVE_FACTORY_ORDER_STATUSES] },
    OR: [{ priority: "URGENT" }, { deadline: { lt: window.startOfToday } }],
  };
}

export async function buildUrgentOrders(
  prisma: ExtendedPrismaClient,
  limit = 8,
  window = factoryBoardWindow(),
) {
  const select = {
    id: true,
    orderNumber: true,
    deadline: true,
    priority: true,
    customer: { select: { name: true } },
  } as const;

  // กันทั้งสองทาง: งานค้างจำนวนมากห้ามเบียด URGENT และ URGENT จำนวนมากก็ห้าม
  // กลบงานเลยกำหนดทั้งหมด จองครึ่ง rail ให้แต่ละกลุ่มแล้วค่อยเติมช่องที่เหลือ
  const [urgent, overdue] = await Promise.all([
    prisma.order.findMany({
      where: {
        internalStatus: { in: [...ACTIVE_FACTORY_ORDER_STATUSES] },
        priority: "URGENT",
      },
      select,
      orderBy: [{ deadline: "asc" }, { orderNumber: "asc" }],
      take: limit,
    }),
    prisma.order.findMany({
      where: {
        internalStatus: { in: [...ACTIVE_FACTORY_ORDER_STATUSES] },
        priority: { not: "URGENT" },
        deadline: { lt: window.startOfToday },
      },
      select,
      orderBy: [{ deadline: "asc" }, { orderNumber: "asc" }],
      take: limit,
    }),
  ]);
  const urgentQuota = Math.ceil(limit / 2);
  const overdueQuota = Math.floor(limit / 2);
  const reserved = Array.from(
    { length: Math.max(urgentQuota, overdueQuota) },
    (_, index) => [urgent[index], overdue[index]].filter((order) => order !== undefined),
  ).flat();
  const orders = [
    ...reserved,
    ...urgent.slice(urgentQuota),
    ...overdue.slice(overdueQuota),
  ].slice(0, limit);
  return orders.map((order) => ({
    orderId: order.id,
    orderNumber: order.orderNumber,
    deadline: order.deadline,
    priority: order.priority,
    customerName: order.customer.name,
  }));
}

async function buildDueSoon(
  prisma: ExtendedPrismaClient,
  limit = 8,
  window = factoryBoardWindow(),
) {
  const orders = await prisma.order.findMany({
    where: dueSoonWhere(window),
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

// ร้านนอกครบกำหนดรับ (lte สิ้นวันไทย = รวมเลยกำหนด) — ของที่ต้องตามกลับเข้าไลน์
export function endOfBangkokToday(now = new Date()) {
  return new Date(bangkokDayStart(now).getTime() + DAY_MS - 1);
}

function outsourceDueWhere(deadline: Date): Prisma.OutsourceOrderWhereInput {
  return {
    status: { in: ["SENT", "IN_PROGRESS"] },
    expectedBackAt: { lte: deadline },
  };
}

async function buildOutsourceDue(
  prisma: ExtendedPrismaClient,
  limit = 8,
  deadline = endOfBangkokToday(),
) {
  const rows = await prisma.outsourceOrder.findMany({
    where: outsourceDueWhere(deadline),
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
  const dueWindow = factoryBoardWindow();
  const outsourceDeadline = endOfBangkokToday();
  const [
    problems,
    prepQueue,
    activeRunsAll,
    printQueueAll,
    pressQueueAll,
    qcQueue,
    packQueue,
    readyToShip,
    urgentOrders,
    dueSoon,
    outsourceDue,
    prepTotal,
    prepActiveTotal,
    qcTotal,
    packTotal,
    readyToShipTotal,
    problemsTotal,
    urgentOrdersTotal,
    dueSoonTotal,
    outsourceDueTotal,
  ] =
    await Promise.all([
      buildProblems(prisma),
      buildPrepQueue(prisma),
      buildActiveRuns(prisma),
      getPrintQueue(prisma),
      loadPressQueue(prisma),
      buildQcQueue(prisma),
      buildPackQueue(prisma, { limit: 8 }),
      buildReadyToShipQueue(prisma),
      buildUrgentOrders(prisma, 8, dueWindow),
      buildDueSoon(prisma, 8, dueWindow),
      buildOutsourceDue(prisma, 8, outsourceDeadline),
      prisma.productionStep.count({ where: PREP_QUEUE_WHERE }),
      prisma.productionStep.count({
        where: { ...PREP_QUEUE_WHERE, status: "IN_PROGRESS" },
      }),
      prisma.order.count({ where: { internalStatus: "QUALITY_CHECK" } }),
      prisma.order.count({ where: { internalStatus: "PACKING" } }),
      prisma.order.count({ where: { internalStatus: "READY_TO_SHIP" } }),
      prisma.productionStep.count({ where: PROBLEM_WHERE }),
      prisma.order.count({ where: urgentOrderWhere(dueWindow) }),
      prisma.order.count({ where: dueSoonWhere(dueWindow) }),
      prisma.outsourceOrder.count({ where: outsourceDueWhere(outsourceDeadline) }),
    ]);

  const stageTotals = buildFactoryStageTotals({
    prepTotal,
    prepActiveTotal,
    activeRuns: activeRunsAll,
    printQueue: printQueueAll,
    pressQueue: pressQueueAll,
    qcTotal,
    packTotal,
  });

  return {
    generatedAt: new Date(),
    stageTotals,
    alertTotal: problemsTotal + urgentOrdersTotal + dueSoonTotal + outsourceDueTotal,
    readyToShipTotal,
    problems,
    prepQueue,
    activeRuns: activeRunsAll.slice(0, 6),
    printQueue: printQueueAll.slice(0, 8).map((entry) => ({
      stepId: entry.stepId, // ใช้เป็น React key — orderNumber ซ้ำได้ (ออเดอร์เดียวมีหลายขั้น DTF_PRINT)
      orderNumber: entry.orderNumber,
      customerName: entry.customerName,
      title: entry.orderName,
      qtyTotal: entry.qtyTotal,
      remaining: entry.remaining,
      deadline: entry.dueDate,
    })),
    pressQueue: pressQueueAll.slice(0, 8),
    qcQueue,
    packQueue,
    readyToShip,
    urgentOrders,
    dueSoon,
    outsourceDue,
  };
}
