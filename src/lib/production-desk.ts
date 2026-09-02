/**
 * โต๊ะงานหัวหน้า (`/production` แบบ A — เบสเคาะ 2026-09-02 จากหน้าลอง /proto/production-module)
 *
 * รับ board จาก `buildProductionBoard` (สูตรเดิมของโรงงาน: จุดงาน/สาย/ราง/ข้อยกเว้น) แล้วตอบ
 * คำถามของหน้าใหม่: ตัวเลข 4 ช่อง · "กอง" ตามความรีบ · ข้อมูลต่อแถว (ขั้นปัจจุบัน ร้านนอก ผู้รับผิดชอบ)
 * pure function ทั้งหมด — ไม่แตะ DOM ไม่แตะ Date.now() (รับ now จากคนเรียก)
 */

import type { BoardJob, BoardOrderLike, BoardStepLike, ProductionBoard } from "@/lib/production-board";
import { OUTSOURCE_STATUS_LABELS } from "@/lib/production-steps";

export type DeskLens = "all" | "late" | "blocked" | "outsource" | "ready";

export const DESK_LENSES: readonly DeskLens[] = ["all", "late", "blocked", "outsource", "ready"];

export function isDeskLens(value: string | null | undefined): value is DeskLens {
  return DESK_LENSES.includes((value ?? "") as DeskLens);
}

/** ขั้นที่ kanban ส่งมา — เพิ่มร้านนอก/รอบพิมพ์ต่อจาก BoardStepLike (optional เพื่อให้ fixture เดิมใช้ได้) */
export type DeskStepLike = BoardStepLike & {
  outsourceOrders?: readonly {
    status: string;
    expectedBackAt: Date | string | null;
    description?: string | null;
    quantity?: number | null;
    vendor: { name: string };
  }[];
};

const OUTSOURCE_AWAITING = new Set(["PENDING", "SENT", "IN_PROGRESS"]);

export type DeskOutsource = {
  vendor: string;
  work: string | null;
  status: string;
  statusLabel: string;
  expectedBackAt: Date | null;
  /** ระยะถึงวันนัดรับ (วัน) · ติดลบ = เลยนัดรับ · null = ไม่ได้นัด */
  backInDays: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(value: Date): Date {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** ระยะเป็นวันจากวันนี้ (ตัดเวลา) · null เมื่อไม่มีวันที่ */
export function daysFromNow(value: Date | string | null | undefined, now: Date): number | null {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((startOfDay(target).getTime() - startOfDay(now).getTime()) / DAY_MS);
}

/** งานร้านนอกที่ยังไม่กลับของใบนี้ (เอาใบที่นัดรับใกล้สุด) */
export function jobOutsource<S extends DeskStepLike, O extends BoardOrderLike<S>>(
  job: BoardJob<O, S>,
  now: Date,
): DeskOutsource | null {
  const candidates: DeskOutsource[] = [];
  for (const production of job.order.productions) {
    for (const step of production.steps) {
      const latest = step.outsourceOrders?.[0];
      if (!latest || !OUTSOURCE_AWAITING.has(latest.status)) continue;
      const expectedBackAt = latest.expectedBackAt ? new Date(latest.expectedBackAt) : null;
      candidates.push({
        vendor: latest.vendor.name,
        work: latest.description ?? null,
        status: latest.status,
        statusLabel: OUTSOURCE_STATUS_LABELS[latest.status as keyof typeof OUTSOURCE_STATUS_LABELS] ?? latest.status,
        expectedBackAt,
        backInDays: daysFromNow(expectedBackAt, now),
      });
    }
  }
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => (a.backInDays ?? 999) - (b.backInDays ?? 999))[0]!;
}

/** ผู้รับผิดชอบของจุดงานปัจจุบัน (ไม่ซ้ำ) — ว่าง = ยังไม่มีคนรับ */
export function jobResponsible<S extends BoardStepLike, O extends BoardOrderLike<S>>(
  job: BoardJob<O, S>,
): string[] {
  const names = job.spots
    .map((spot) => spot.step?.assignedTo?.name)
    .filter((name): name is string => Boolean(name));
  return [...new Set(names)];
}

export type DeskCurrent = {
  label: string;
  state: "failed" | "waiting" | "active" | "queue" | "post";
  /** เหตุที่รอ/ติด (waitingOn หรือ note ของขั้นที่พัง) */
  reason: string | null;
};

/** จุดงานปัจจุบันของแถว — ขั้นที่พังชนะ · รอของชนะ · ที่เหลือคือกำลังเดิน */
export function jobCurrent<S extends BoardStepLike, O extends BoardOrderLike<S>>(
  job: BoardJob<O, S>,
): DeskCurrent[] {
  return job.spots.map((spot) => {
    if (spot.step?.status === "FAILED") {
      return { label: spot.stationLabel, state: "failed", reason: spot.step.notes ?? spot.step.qcNotes ?? null };
    }
    if (spot.waitingOn.length > 0) {
      return { label: spot.stationLabel, state: "waiting", reason: spot.waitingOn.join(" / ") };
    }
    if (spot.kind === "queue") return { label: spot.stationLabel, state: "queue", reason: null };
    if (spot.kind === "post") return { label: spot.stationLabel, state: "post", reason: null };
    return { label: spot.stationLabel, state: "active", reason: null };
  });
}

export type DeskPileKey = "blocked" | "outsource-due" | "queue" | "doing" | "waiting" | "ready";

export const DESK_PILES: readonly { key: DeskPileKey; label: string }[] = [
  { key: "blocked", label: "ติดปัญหา — ต้องตัดสินก่อน" },
  { key: "outsource-due", label: "ของร้านนอกครบกำหนดรับ" },
  { key: "queue", label: "รอเปิดใบผลิต" },
  { key: "doing", label: "ลงมือได้ตอนนี้ในโรงงาน" },
  { key: "waiting", label: "รอของ / รอขั้นก่อนหน้า" },
  { key: "ready", label: "พร้อมส่ง" },
];

export type DeskRow<S extends DeskStepLike, O extends BoardOrderLike<S>> = {
  job: BoardJob<O, S>;
  current: DeskCurrent[];
  outsource: DeskOutsource | null;
  responsible: string[];
  dueInDays: number | null;
  blocked: boolean;
  outsourceDue: boolean;
  pile: DeskPileKey;
};

function isReadyToShip(status: string) {
  return status === "READY_TO_SHIP";
}

export function buildDeskRows<S extends DeskStepLike, O extends BoardOrderLike<S>>(
  board: ProductionBoard<O, S>,
  now: Date,
): DeskRow<S, O>[] {
  const exceptionIds = new Set(board.exceptions.map((item) => item.orderId));
  return board.jobs.map((job) => {
    const current = jobCurrent(job);
    const outsource = jobOutsource(job, now);
    const blocked = current.some((c) => c.state === "failed") || exceptionIds.has(job.order.id);
    const outsourceDue = outsource !== null && outsource.backInDays !== null && outsource.backInDays <= 0;
    const ready = isReadyToShip(job.order.internalStatus);
    const queue = current.some((c) => c.state === "queue");
    const doing = current.some((c) => c.state === "active" || c.state === "post");
    const pile: DeskPileKey = blocked
      ? "blocked"
      : outsourceDue
        ? "outsource-due"
        : ready
          ? "ready"
          : queue
            ? "queue"
            : doing
              ? "doing"
              : "waiting";
    return {
      job,
      current,
      outsource,
      responsible: jobResponsible(job),
      dueInDays: daysFromNow(job.order.deadline, now),
      blocked,
      outsourceDue,
      pile,
    };
  });
}

export type DeskSummary = Record<Exclude<DeskLens, "all">, number>;

export function deskSummary<S extends DeskStepLike, O extends BoardOrderLike<S>>(
  rows: readonly DeskRow<S, O>[],
): DeskSummary {
  return {
    late: rows.filter((row) => row.job.overdue).length,
    blocked: rows.filter((row) => row.blocked).length,
    outsource: rows.filter((row) => row.outsourceDue).length,
    ready: rows.filter((row) => isReadyToShip(row.job.order.internalStatus)).length,
  };
}

export function filterDeskRows<S extends DeskStepLike, O extends BoardOrderLike<S>>(
  rows: readonly DeskRow<S, O>[],
  lens: DeskLens,
): DeskRow<S, O>[] {
  switch (lens) {
    case "late":
      return rows.filter((row) => row.job.overdue);
    case "blocked":
      return rows.filter((row) => row.blocked);
    case "outsource":
      return rows.filter((row) => row.outsourceDue);
    case "ready":
      return rows.filter((row) => isReadyToShip(row.job.order.internalStatus));
    default:
      return [...rows];
  }
}

/** จัดกอง — ในกองเรียง เลยกำหนดก่อน แล้วตามกำหนดส่ง · กองว่างไม่แสดง */
export function groupDeskRows<S extends DeskStepLike, O extends BoardOrderLike<S>>(
  rows: readonly DeskRow<S, O>[],
): { key: DeskPileKey; label: string; rows: DeskRow<S, O>[] }[] {
  const byDue = (a: DeskRow<S, O>, b: DeskRow<S, O>) =>
    (a.dueInDays ?? 9999) - (b.dueInDays ?? 9999) ||
    a.job.order.orderNumber.localeCompare(b.job.order.orderNumber, "th", { numeric: true });
  return DESK_PILES.map((pile) => ({
    ...pile,
    rows: rows.filter((row) => row.pile === pile.key).sort(byDue),
  })).filter((pile) => pile.rows.length > 0);
}
