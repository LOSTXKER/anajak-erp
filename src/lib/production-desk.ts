/**
 * โต๊ะงานหัวหน้า (`/production` แบบ A — เบสเคาะ 2026-09-02 จากหน้าลอง /proto/production-module)
 *
 * รับ board จาก `buildProductionBoard` (สูตรเดิมของโรงงาน: จุดงาน/สาย/ราง/ข้อยกเว้น) แล้วตอบ
 * คำถามของหน้าใหม่: ตัวเลข 4 ช่อง · ข้อมูลต่อแถว (ขั้นปัจจุบัน ร้านนอก ผู้รับผิดชอบ)
 * pile ใช้จำแนกงานสำหรับตัวกรอง/เปิดใบผลิต ไม่แบ่งหัวกลุ่มในตาราง
 * pure function ทั้งหมด — ไม่แตะ DOM ไม่แตะ Date.now() (รับ now จากคนเรียก)
 */

import type { BoardJob, BoardOrderLike, BoardStepLike, ProductionBoard } from "@/lib/production-board";
import { OUTSOURCE_ACTIVE_STATUSES, OUTSOURCE_STATUS_LABELS, STEP_TYPE_LABELS, isOutsourceStep } from "@/lib/production-steps";
import { differenceInBangkokDays } from "@/lib/date-utils";
import { currentProductionProblemReason } from "@/lib/production-problem";
import { outsourceQueueForStatus } from "@/lib/outsource-ui";

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

export type DeskOutsource = {
  vendor: string;
  work: string | null;
  status: string;
  statusLabel: string;
  expectedBackAt: Date | null;
  /** ระยะถึงวันนัดรับ (วัน) · ติดลบ = เลยนัดรับ · null = ไม่ได้นัด */
  backInDays: number | null;
};

/** ระยะเป็นวันตามปฏิทินไทย · null เมื่อไม่มีวันที่ */
export function daysFromNow(value: Date | string | null | undefined, now: Date): number | null {
  return differenceInBangkokDays(value, now);
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
      if (!latest || outsourceQueueForStatus(latest.status) !== "receive") continue;
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
  state: "failed" | "held" | "waiting" | "external" | "active" | "queue" | "post";
  /** เหตุที่รอ/ติด (waitingOn หรือ note ของขั้นที่พัง) */
  reason: string | null;
};

/** วาดทุกสายเหมือนเดิม แต่ขึ้นสิ่งที่ทำต่อได้ก่อนขั้นที่รอบรรจบ — ใช้เส้นทางเดียวกับใบผลิต */
export function jobCurrent<S extends DeskStepLike, O extends BoardOrderLike<S>>(
  job: BoardJob<O, S>,
): DeskCurrent[] {
  const current = job.spots.map((spot): DeskCurrent => {
    const step = spot.step;
    if (!step) {
      return { label: spot.stationLabel, state: spot.kind === "queue" ? "queue" : "post", reason: spot.waitingOn.join(" / ") || null };
    }
    const label = step.customStepName || (STEP_TYPE_LABELS[step.stepType] || spot.stationLabel).replace(" (ร้านนอก)", "");
    if (step.status === "FAILED" || step.status === "ON_HOLD") {
      return { label: `${label} · ${step.status === "FAILED" ? "มีปัญหา" : "พักไว้"}`, state: step.status === "FAILED" ? "failed" : "held", reason: currentProductionProblemReason(step) || null };
    }
    const outsource = step.outsourceOrders?.[0];
    if (outsource?.status === "QC_FAILED") {
      return { label: `${label} · ตรวจรับไม่ผ่าน`, state: "failed", reason: "รอหัวหน้าตัดสินใจ" };
    }
    if (outsource && OUTSOURCE_ACTIVE_STATUSES.includes(outsource.status)) {
      const queue = outsourceQueueForStatus(outsource.status);
      if (queue === "send") return { label: `รอส่งร้าน${label}`, state: "active", reason: null };
      if (queue === "qc") return { label: `รอตรวจรับงาน${label}`, state: "active", reason: null };
      return { label: `รอรับงาน${label}`, state: "external", reason: null };
    }
    if (spot.waitingOn.length > 0) {
      return { label, state: "waiting", reason: spot.waitingOn.join(" / ") };
    }
    if (isOutsourceStep(step.stepType)) return { label: `รอส่งร้าน${label}`, state: "active", reason: null };
    return { label: `${step.status === "IN_PROGRESS" ? "กำลัง" : "รอ"}${label}`, state: "active", reason: null };
  });
  const rank: Record<DeskCurrent["state"], number> = { failed: 0, held: 1, active: 2, queue: 2, post: 2, external: 3, waiting: 4 };
  return current.sort((a, b) => rank[a.state] - rank[b.state]);
}

export type DeskPileKey = "blocked" | "outsource-due" | "queue" | "doing" | "waiting" | "ready";

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
  return board.jobs.map((job) => {
    const current = jobCurrent(job);
    const outsource = jobOutsource(job, now);
    // Board exceptions รวมเลยกำหนด/รอเสื้อ/รอ QC ด้วย — สิ่งเหล่านั้นไม่ใช่งานเสียหรือหยุดเสมอไป
    const blocked = job.order.productions.some((p) => p.steps.some((s) =>
      s.status === "FAILED" || s.status === "ON_HOLD" || s.outsourceOrders?.[0]?.status === "QC_FAILED",
    )) || (job.spots.some((s) => s.kind === "queue") && job.order.readiness?.ready === false);
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
