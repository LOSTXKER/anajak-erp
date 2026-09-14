import type { CustomerStatus, InternalStatus, Prisma } from "@prisma/client";
import type { ExtendedPrismaClient } from "@/lib/prisma";
import { differenceInBangkokDays, startOfBangkokDay } from "@/lib/date-utils";
import { DESIGN_WAIT_STATUSES, describeOrderProgress } from "@/lib/order-progress";
import { evaluateHeatPressGate, type GateStepLite } from "@/lib/production-steps";
import { printLabelOf } from "@/lib/print-labels";
import { aggToNumber } from "@/server/services/money";
import { getOwnerPulse } from "@/server/services/owner-pulse";
import { PREP_QUEUE_WHERE } from "@/server/services/factory-board";

/* ============================================================
   home-overview — ตัวเลขทั้งหมดของหน้าแรก (รื้อ 2026-09-14 ตามต้นแบบที่เบสเคาะ)

   การ์ดโรงงาน: node จริงของสายผลิต + ด่านรีดร้อนรอฟิล์ม/รอเสื้อ (evaluateHeatPressGate)
   กำหนดส่ง 7 วัน: นับออเดอร์ที่ยังเดินอยู่ตามวันปฏิทินไทย
   ออเดอร์ที่กำลังเดิน: ใบเดียว = ขั้นที่ค้าง/คนที่รอ/วันที่นิ่ง (ตีความฝั่ง client ใน lib/home-orders)
   เงิน: ยอดบิลเลยกำหนดและใบเสนอที่รอตอบ — คืนเฉพาะเมื่อผู้เรียกมีสิทธิ์ see_finance
   นิยามที่ซ้ำกับ owner-pulse (คิววันนี้ · ร้านนอก) ยืมจาก getOwnerPulse ตรง ๆ กันเลขคนละชุด
   ============================================================ */

export const HOME_WEEK_DAYS = 7;
export const HOME_ORDER_LIMIT = 12;
export const ON_TIME_WINDOW_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

// ออเดอร์ที่ยังต้องดูแลบนหน้าแรก — ส่งแล้ว/จบ/ยกเลิก/ร่าง ไม่นับ
const ACTIVE_ORDER_EXCLUDED = ["DRAFT", "CANCELLED", "COMPLETED", "SHIPPED"] as const satisfies readonly InternalStatus[];
// ช่วงก่อนเปิดใบผลิต = ช่องแรกของผัง (ออกแบบ/รอลูกค้า)
const DESIGN_STAGE_STATUSES = DESIGN_WAIT_STATUSES;
const OUTSOURCE_OPEN_STATUSES = ["SENT", "IN_PROGRESS"] as const;

const FILM_QUEUE_WHERE = {
  stepType: "DTF_PRINT",
  status: { in: ["PENDING", "IN_PROGRESS"] },
  production: { order: { internalStatus: "PRODUCING" } },
} satisfies Prisma.ProductionStepWhereInput;

// ขั้นรีดร้อนที่ยังเปิดอยู่ทั้งหมด (ไม่กรอง gate) — ผังต้องเห็นทั้งที่พร้อมและที่ติดรอ
const PRESS_QUEUE_WHERE = {
  stepType: "HEAT_PRESS",
  status: { in: ["PENDING", "IN_PROGRESS"] },
  production: { order: { internalStatus: { notIn: ["CANCELLED", "ON_HOLD"] } } },
} satisfies Prisma.ProductionStepWhereInput;

const HOME_ORDER_SELECT = {
  id: true,
  orderNumber: true,
  description: true,
  deadline: true,
  totalAmount: true,
  customerStatus: true,
  internalStatus: true,
  updatedAt: true,
  customer: { select: { name: true, company: true } },
  items: {
    select: {
      description: true,
      totalQuantity: true,
      products: { orderBy: { sortOrder: "asc" }, take: 1, select: { description: true } },
      prints: { select: { printType: true } },
    },
  },
  designs: {
    orderBy: { versionNumber: "desc" },
    take: 1,
    select: { approvalStatus: true, createdAt: true },
  },
  revisions: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
  productions: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      steps: {
        orderBy: { sortOrder: "asc" },
        select: {
          stepType: true,
          customStepName: true,
          status: true,
          assignedTo: { select: { name: true } },
          outsourceOrders: {
            where: { status: { in: [...OUTSOURCE_OPEN_STATUSES] } },
            orderBy: { expectedBackAt: "asc" },
            take: 1,
            select: { expectedBackAt: true, vendor: { select: { name: true } } },
          },
        },
      },
    },
  },
} satisfies Prisma.OrderSelect;

export type HomeOrderRow = Prisma.OrderGetPayload<{ select: typeof HOME_ORDER_SELECT }> & {
  /** ผ่าน result extension แล้ว (src/lib/prisma.ts) */
  totalAmount: number;
};

export interface HomeFacts {
  /** ขั้นผลิตที่ปิดวันนี้ / ยังค้าง (นิยามเดียวกับ Owner Pulse) */
  todayQueue: { done: number; open: number };
  /** ส่งตรงเวลาใน 7 วันล่าสุด — นับเฉพาะใบส่งที่ออเดอร์มีกำหนดส่ง */
  onTime: { shipped: number; onTime: number; rate: number | null };
  /** ออเดอร์ที่ยังเดินอยู่และเลยกำหนดส่ง (ตามวันปฏิทินไทย) */
  overdueOrders: number;
  /** รอบพิมพ์ DTF ที่เปิดวันนี้ */
  printRunsToday: number;
}

export interface HomeNodeCounts {
  design: { total: number; awaitingApproval: number };
  prep: { total: number; active: number };
  film: { total: number; active: number };
  vendor: { pending: number; overduePickup: number };
  press: { total: number; active: number; ready: number; waitingFilm: number; waitingGarment: number };
  qc: { total: number; checkedToday: number };
  pack: { total: number };
  ship: { readyToShip: number; dueToday: number };
}

export interface HomeWeek {
  overdue: number;
  /** offset 0 = วันนี้ … 6 = อีก 6 วัน */
  days: { offset: number; count: number }[];
}

export interface HomeMoney {
  overdueInvoices: { count: number; amount: number };
  quotationsAwaiting: { count: number; amount: number };
}

export interface HomeOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  title: string | null;
  printLabel: string | null;
  quantity: number;
  /** null เมื่อผู้เรียกไม่มีสิทธิ์เห็นเงิน */
  totalAmount: number | null;
  deadline: Date | null;
  dueInDays: number | null;
  customerStatus: CustomerStatus;
  internalStatus: InternalStatus;
  currentStep: { label: string; assigneeName: string | null; outsource: boolean } | null;
  stepsDone: number;
  stepsTotal: number;
  waitingCustomerDays: number | null;
  vendor: { name: string; overdueDays: number } | null;
  stuckDays: number | null;
  ready: boolean;
}

export interface HomeOverview {
  generatedAt: Date;
  facts: HomeFacts;
  nodes: HomeNodeCounts;
  week: HomeWeek;
  money: HomeMoney | null;
  orders: HomeOrder[];
}

/** เที่ยงคืนของวันนี้ตามเวลาไทย — เส้นแบ่ง "วันนี้" ของทุกตัวเลขในไฟล์นี้ */
export function startOfBangkokToday(now = new Date()): Date {
  return startOfBangkokDay(now);
}

/** สรุปด่านรีดร้อน: กี่ใบพร้อมรีด กี่ใบติดรอฟิล์ม/รอเสื้อ (ใบเดียวติดได้ทั้งสองอย่าง) */
export function summarizePressGate(
  rows: readonly { status: string; steps: readonly GateStepLite[] }[],
): HomeNodeCounts["press"] {
  let active = 0;
  let ready = 0;
  let waitingFilm = 0;
  let waitingGarment = 0;
  for (const row of rows) {
    if (row.status === "IN_PROGRESS") active++;
    const gate = evaluateHeatPressGate([...row.steps]);
    if (gate.ready) {
      ready++;
      continue;
    }
    if (!gate.filmReady) waitingFilm++;
    if (!gate.garmentReady) waitingGarment++;
  }
  return { total: rows.length, active, ready, waitingFilm, waitingGarment };
}

/** จัดกำหนดส่งลงช่องรายวัน (ปฏิทินไทย) — เลยแล้วรวมเป็น overdue · เกินหน้าต่างไม่นับ */
export function bucketDeadlines(
  deadlines: readonly (Date | string)[],
  now: Date,
  days = HOME_WEEK_DAYS,
): HomeWeek {
  const counts = Array.from({ length: days }, () => 0);
  let overdue = 0;
  for (const deadline of deadlines) {
    const diff = differenceInBangkokDays(deadline, now);
    if (diff === null) continue;
    if (diff < 0) overdue++;
    else if (diff < days) counts[diff]++;
  }
  return { overdue, days: counts.map((count, offset) => ({ offset, count })) };
}

/** ส่งตรงเวลา = วันที่ส่ง (ปฏิทินไทย) ไม่เลยวันกำหนด · ใบที่ไม่มีกำหนดส่งไม่นับ (MFG1) */
export function computeOnTime(
  rows: readonly { shippedAt: Date | string | null; deadline: Date | string | null }[],
): HomeFacts["onTime"] {
  let shipped = 0;
  let onTime = 0;
  for (const row of rows) {
    if (!row.shippedAt || !row.deadline) continue;
    const diff = differenceInBangkokDays(row.shippedAt, row.deadline);
    if (diff === null) continue;
    shipped++;
    if (diff <= 0) onTime++;
  }
  return { shipped, onTime, rate: shipped > 0 ? Math.round((onTime / shipped) * 100) : null };
}

/** แปลงแถวออเดอร์เป็นข้อมูลหน้าแรก — เงินคืนเฉพาะเมื่อ canSeeFinance
 *  ขั้นที่ค้าง/ร้านนอก/รอลูกค้า/วันที่นิ่ง ใช้สูตรกลาง lib/order-progress (ตารางออเดอร์ใช้ตัวเดียวกัน) */
export function describeHomeOrderRow(
  row: HomeOrderRow,
  now: Date,
  canSeeFinance: boolean,
): HomeOrder {
  const firstItem = row.items[0];
  const title =
    row.description?.trim() || firstItem?.products[0]?.description?.trim() || firstItem?.description?.trim() || null;

  return {
    ...describeOrderProgress(row, now),
    id: row.id,
    customerName: row.customer.company || row.customer.name,
    title,
    printLabel: printLabelOf(row.items.flatMap((item) => item.prints.map((print) => print.printType))),
    quantity: row.items.reduce((sum, item) => sum + item.totalQuantity, 0),
    totalAmount: canSeeFinance ? row.totalAmount : null,
    deadline: row.deadline,
    customerStatus: row.customerStatus,
  };
}

async function loadMoney(prisma: ExtendedPrismaClient): Promise<HomeMoney> {
  const [overdue, quotations] = await Promise.all([
    prisma.invoice.aggregate({
      _count: { _all: true },
      _sum: { totalAmount: true },
      // นิยามเดียวกับ analytics.dashboard และ owner-pulse — บิลเลยกำหนดที่ยังไม่ถูกยกเลิก
      where: { paymentStatus: "OVERDUE", isVoided: false },
    }),
    prisma.quotation.aggregate({
      _count: { _all: true },
      _sum: { totalAmount: true },
      where: { status: "SENT" },
    }),
  ]);
  // ผล aggregate ไม่ผ่าน result extension — แปลง Decimal → number ที่นี่
  return {
    overdueInvoices: { count: overdue._count._all, amount: aggToNumber(overdue._sum.totalAmount) },
    quotationsAwaiting: {
      count: quotations._count._all,
      amount: aggToNumber(quotations._sum.totalAmount),
    },
  };
}

export async function getHomeOverview(
  prisma: ExtendedPrismaClient,
  opts: { canSeeFinance: boolean; now?: Date },
): Promise<HomeOverview> {
  const now = opts.now ?? new Date();
  const startToday = startOfBangkokToday(now);
  const shippedSince = new Date(now.getTime() - ON_TIME_WINDOW_DAYS * DAY_MS);
  const activeWhere = {
    internalStatus: { notIn: [...ACTIVE_ORDER_EXCLUDED] },
  } satisfies Prisma.OrderWhereInput;
  const designWhere = {
    internalStatus: { in: [...DESIGN_STAGE_STATUSES] },
  } satisfies Prisma.OrderWhereInput;

  const [
    pulse,
    shippedRows,
    printRunsToday,
    designTotal,
    designAwaiting,
    prepTotal,
    prepActive,
    filmTotal,
    filmActive,
    pressRows,
    qcTotal,
    qcCheckedToday,
    packTotal,
    readyToShip,
    deadlineRows,
    orderRows,
    money,
  ] = await Promise.all([
    getOwnerPulse(prisma),
    prisma.delivery.findMany({
      where: { shippedAt: { gte: shippedSince } },
      select: { shippedAt: true, order: { select: { deadline: true } } },
    }),
    prisma.printRun.count({ where: { createdAt: { gte: startToday } } }),
    prisma.order.count({ where: designWhere }),
    prisma.order.count({
      where: {
        ...designWhere,
        designs: { some: { approvalStatus: "PENDING" }, none: { approvalStatus: "APPROVED" } },
      },
    }),
    prisma.productionStep.count({ where: PREP_QUEUE_WHERE }),
    prisma.productionStep.count({ where: { ...PREP_QUEUE_WHERE, status: "IN_PROGRESS" } }),
    prisma.productionStep.count({ where: FILM_QUEUE_WHERE }),
    prisma.productionStep.count({ where: { ...FILM_QUEUE_WHERE, status: "IN_PROGRESS" } }),
    prisma.productionStep.findMany({
      where: PRESS_QUEUE_WHERE,
      select: {
        status: true,
        production: { select: { steps: { select: { stepType: true, status: true } } } },
      },
    }),
    prisma.order.count({ where: { internalStatus: "QUALITY_CHECK" } }),
    prisma.qcRecord.count({ where: { checkedAt: { gte: startToday } } }),
    prisma.order.count({ where: { internalStatus: "PACKING" } }),
    prisma.order.count({ where: { internalStatus: "READY_TO_SHIP" } }),
    prisma.order.findMany({
      where: { ...activeWhere, deadline: { not: null } },
      select: { deadline: true },
    }),
    prisma.order.findMany({
      where: activeWhere,
      orderBy: [{ deadline: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      take: HOME_ORDER_LIMIT,
      select: HOME_ORDER_SELECT,
    }),
    opts.canSeeFinance ? loadMoney(prisma) : Promise.resolve(null),
  ]);

  const week = bucketDeadlines(
    deadlineRows.flatMap((row) => (row.deadline ? [row.deadline] : [])),
    now,
  );

  return {
    generatedAt: now,
    facts: {
      todayQueue: pulse.todayQueue,
      onTime: computeOnTime(
        shippedRows.map((row) => ({ shippedAt: row.shippedAt, deadline: row.order.deadline })),
      ),
      overdueOrders: week.overdue,
      printRunsToday,
    },
    nodes: {
      design: { total: designTotal, awaitingApproval: designAwaiting },
      prep: { total: prepTotal, active: prepActive },
      film: { total: filmTotal, active: filmActive },
      vendor: { pending: pulse.outsource.pending, overduePickup: pulse.outsource.overduePickup },
      press: summarizePressGate(
        pressRows.map((row) => ({ status: row.status, steps: row.production.steps })),
      ),
      qc: { total: qcTotal, checkedToday: qcCheckedToday },
      pack: { total: packTotal },
      ship: { readyToShip, dueToday: week.days[0]?.count ?? 0 },
    },
    week,
    money,
    orders: (orderRows as HomeOrderRow[]).map((row) =>
      describeHomeOrderRow(row, now, opts.canSeeFinance),
    ),
  };
}
