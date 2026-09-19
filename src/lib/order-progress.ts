import type { InternalStatus } from "@prisma/client";
import { differenceInBangkokDays } from "@/lib/date-utils";
import { claimHeadline } from "@/lib/claim";
import { isOutsourceStep, STEP_TYPE_LABELS } from "@/lib/production-steps";
import { currentProductionProblemReason } from "@/lib/production-problem";
import type { HomeOrderLike } from "@/lib/home-orders";

/* ============================================================
   ความคืบหน้าของออเดอร์หนึ่งใบ — สูตรเดียวของ "อยู่ขั้นไหน · รอใคร · นิ่งกี่วัน"

   แยกออกจาก home-overview (2026-09-14) ตอนลงหน้าออเดอร์ใหม่ ให้สามจอพูดตรงกัน:
   หน้าแรก (home-overview) · ตารางออเดอร์ (order.list) · หน้ารายละเอียด (order.getById)
   รับรูปทรงขั้นต่ำที่ทั้งสาม query ส่งได้ แล้วคืนข้อมูลให้ lib/home-orders ตีความเป็น
   "ต้องจัดการ" ต่อ — ไฟล์นี้ไม่ตัดสินว่าอะไรด่วนกว่าอะไร
   ============================================================ */

/** สถานะที่ไม่นับ "ต้องจัดการ" แล้ว — ร่าง/ยกเลิก/ปิดงาน/ส่งแล้ว (ชุดเดียวกับหน้าแรก) */
export const ATTENTION_EXCLUDED_STATUSES = [
  "DRAFT",
  "CANCELLED",
  "COMPLETED",
  "SHIPPED",
] as const satisfies readonly InternalStatus[];

/** ช่วงที่งานยังรอลูกค้าอนุมัติแบบได้ */
export const DESIGN_WAIT_STATUSES = ["CONFIRMED", "DESIGNING"] as const satisfies readonly InternalStatus[];

const OPEN_STEP_STATUSES = new Set(["PENDING", "IN_PROGRESS"]);
const OPEN_OUTSOURCE_STATUSES = new Set(["SENT", "IN_PROGRESS"]);

type DateLike = Date | string;

export interface OrderProgressStep {
  stepType: string;
  customStepName: string | null;
  status: string;
  assignedTo: { name: string | null } | null;
  /** หมายเหตุของขั้น — query ไหน select มาด้วย จอนั้นจะบอกได้ว่า "ติดอะไร" ไม่ใช่แค่ "ติด" */
  notes?: string | null;
  qcNotes?: string | null;
  /** ใบจ้างร้านนอกของขั้นนี้ · ไม่มี status = caller กรองเฉพาะใบที่ยังไม่รับกลับมาให้แล้ว */
  outsourceOrders: readonly {
    status?: string;
    expectedBackAt: DateLike | null;
    vendor: { name: string };
  }[];
}

export interface OrderProgressSource {
  orderNumber: string;
  internalStatus: InternalStatus;
  deadline: DateLike | null;
  updatedAt: DateLike;
  /** เวอร์ชันม็อกอัพ ใหม่สุดก่อน */
  designs: readonly { approvalStatus: string; createdAt: DateLike }[];
  revisions: readonly { createdAt: DateLike }[];
  /** ใบผลิต — มี createdAt จะเลือกใบล่าสุดเอง · ไม่มีถือว่าเรียงใหม่สุดก่อนมาแล้ว */
  productions: readonly { createdAt?: DateLike; steps: readonly OrderProgressStep[] }[];
  /** ใบเคลม/งานแก้ (ก้อน 1) — query ไหนที่ include มาด้วย จอนั้นจะเห็นงานแก้ทันทีโดยไม่ต้องแก้จอ */
  claims?: readonly {
    round: number;
    state: string;
    resolution: string | null;
    lines?: readonly { qtyClaimed: number }[];
  }[];
}

export type OrderProgress = HomeOrderLike;

function timeOf(value: DateLike | null | undefined): number | null {
  if (value == null) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/** ยังเป็นงานที่ต้องตามอยู่ไหม — ใช้กันไม่ให้ใบที่จบแล้วขึ้น "เลยกำหนด" */
export function isAttentionStatus(status: string): boolean {
  return !(ATTENTION_EXCLUDED_STATUSES as readonly string[]).includes(status);
}

/** ชื่อขั้นผลิตบนจอ — ชื่อที่ตั้งเองมาก่อน · ตัด "(ร้านนอก)" เพราะป้ายร้านบอกอยู่แล้ว */
export function productionStepLabel(step: { stepType: string; customStepName: string | null }): string {
  return (step.customStepName || STEP_TYPE_LABELS[step.stepType] || step.stepType).replace(" (ร้านนอก)", "");
}

function latestProduction(productions: OrderProgressSource["productions"]) {
  let latest: OrderProgressSource["productions"][number] | undefined;
  for (const production of productions) {
    if (!latest) {
      latest = production;
      continue;
    }
    const candidate = timeOf(production.createdAt);
    const current = timeOf(latest.createdAt);
    if (candidate !== null && current !== null && candidate > current) latest = production;
  }
  return latest;
}

export function describeOrderProgress(source: OrderProgressSource, now: Date): OrderProgress {
  const steps = latestProduction(source.productions)?.steps ?? [];
  const current = steps.find((step) => OPEN_STEP_STATUSES.has(step.status)) ?? null;

  // ขั้นที่หยุดเดิน — งานติดปัญหา (ช่างแจ้ง) หรือหัวหน้าสั่งพัก · ขั้นแบบนี้ไม่เข้า OPEN_STEP_STATUSES
  // จึงเคยหายจากทุกตัวเลข หน้าแรกเลยขึ้น "—" ทั้งที่งานหยุดอยู่ (เบสเจอ 2026-09-19 "ดูยากงง")
  const halted = steps.find((step) => step.status === "FAILED" || step.status === "ON_HOLD") ?? null;

  // งานที่อยู่ร้านนอก: ใบจ้างที่ยังไม่รับกลับ ขั้นไหนก็ได้ในใบผลิต · เลือกใบที่เลยรับนานสุด
  let vendor: OrderProgress["vendor"] = null;
  for (const step of steps) {
    for (const outsource of step.outsourceOrders) {
      if (outsource.status !== undefined && !OPEN_OUTSOURCE_STATUSES.has(outsource.status)) continue;
      const diff = outsource.expectedBackAt ? differenceInBangkokDays(outsource.expectedBackAt, now) : null;
      const overdueDays = diff !== null && diff < 0 ? -diff : 0;
      if (!vendor || overdueDays > vendor.overdueDays) vendor = { name: outsource.vendor.name, overdueDays };
    }
  }

  const latestDesign = source.designs[0];
  const waitingCustomerDays =
    latestDesign?.approvalStatus === "PENDING" &&
    (DESIGN_WAIT_STATUSES as readonly InternalStatus[]).includes(source.internalStatus)
      ? Math.max(0, differenceInBangkokDays(now, latestDesign.createdAt) ?? 0)
      : null;

  // ความเคลื่อนไหวล่าสุด = updatedAt หรือประวัติล่าสุด — นิยามเดียวกับ owner-pulse
  let lastActivity = timeOf(source.updatedAt);
  for (const revision of source.revisions) {
    const at = timeOf(revision.createdAt);
    if (at !== null && (lastActivity === null || at > lastActivity)) lastActivity = at;
  }

  // ใบเคลมที่ยังไม่จบของออเดอร์นี้ — รอบล่าสุดก่อน (query ที่ไม่ include มาก็ไม่มีผลใดๆ)
  const openClaim = (source.claims ?? [])
    .filter((claim) => claim.state === "OPEN" || claim.state === "DECIDED")
    .sort((a, b) => b.round - a.round)[0];

  return {
    orderNumber: source.orderNumber,
    internalStatus: source.internalStatus,
    dueInDays: differenceInBangkokDays(source.deadline, now),
    currentStep: current
      ? {
          label: productionStepLabel(current),
          assigneeName: current.assignedTo?.name ?? null,
          outsource: isOutsourceStep(current.stepType),
        }
      : null,
    blocked: halted
      ? {
          stepLabel: productionStepLabel(halted),
          reason: currentProductionProblemReason(halted),
          held: halted.status === "ON_HOLD",
          assigneeName: halted.assignedTo?.name ?? null,
        }
      : null,
    stepsDone: steps.filter((step) => step.status === "COMPLETED").length,
    stepsTotal: steps.length,
    waitingCustomerDays,
    vendor,
    stuckDays: lastActivity !== null ? Math.max(0, differenceInBangkokDays(now, lastActivity) ?? 0) : null,
    ready: source.internalStatus === "READY_TO_SHIP",
    claim: openClaim
      ? {
          round: openClaim.round,
          label: claimHeadline({
            round: openClaim.round,
            state: openClaim.state,
            resolution: openClaim.resolution,
            qtyClaimed: (openClaim.lines ?? []).reduce((sum, line) => sum + line.qtyClaimed, 0),
          }),
        }
      : null,
  };
}
