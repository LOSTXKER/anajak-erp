import type { InternalStatus } from "@prisma/client";
import { INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import { isAttentionStatus } from "@/lib/order-progress";

/* ============================================================
   ออเดอร์บนหน้าแรก — "ออเดอร์หนึ่งใบ = หนึ่งเหตุที่ต้องจัดการ" (เบสเคาะ 2026-09-14)

   แทนตัวเลขนับตามหมวดของเดิม ("ต้องเช็กก่อน") ที่นับออเดอร์เดียวซ้ำหลายแถวและ
   ต้องกดต่ออีกสองชั้นกว่าจะรู้ว่าใบไหน · ที่นี่เลือกเหตุด่วนที่สุดของแต่ละใบ
   แล้วเรียงเลยกำหนด → ส่งวันนี้ → รอลูกค้า/ร้านนอก → ไม่ขยับ → ปกติ
   ตัวเลขทุกตัวมาจาก service (home-overview) ไฟล์นี้ตีความอย่างเดียว
   ============================================================ */

/** งานเงียบเกินกี่วันถึงนับว่า "ไม่ขยับ" — ค่าเดียวกับ owner-pulse (STUCK_AFTER_DAYS) */
export const HOME_STUCK_AFTER_DAYS = 3;

export interface HomeOrderLike {
  orderNumber: string;
  internalStatus: InternalStatus;
  /** วันตามปฏิทินไทยถึงกำหนดส่ง: 0 = วันนี้ · ติดลบ = เลยกำหนด · null = ไม่มีกำหนด */
  dueInDays: number | null;
  currentStep: { label: string; assigneeName: string | null; outsource: boolean } | null;
  stepsDone: number;
  stepsTotal: number;
  /** รอลูกค้าอนุมัติแบบมากี่วัน · null = ไม่ได้รอ */
  waitingCustomerDays: number | null;
  /** งานที่อยู่ร้านนอก · overdueDays > 0 = เลยกำหนดรับกลับ */
  vendor: { name: string; overdueDays: number } | null;
  /** ไม่มีความเคลื่อนไหวมากี่วัน · null = ไม่ทราบ */
  stuckDays: number | null;
  /** พร้อมส่งแล้ว (แพ็กเสร็จ) */
  ready: boolean;
}

export type HomeProblemGroup = "late" | "today" | "wait" | "stuck";
export type HomeProblemTone = "danger" | "warning" | "success" | "neutral";
export type HomeProblemKind =
  | "overdue"
  | "vendor-late"
  | "ready"
  | "in-progress"
  | "customer"
  | "vendor"
  | "stuck";

export interface HomeProblem {
  group: HomeProblemGroup;
  kind: HomeProblemKind;
  tone: HomeProblemTone;
  /** ข้อความสั้นบอกว่าค้างที่ไหน/รอใคร — ไม่ใช่ประโยคอธิบาย */
  label: string;
  /** ผู้ทำขั้นนั้น (ถ้ามี) */
  who: string | null;
}

const GROUP_RANK: Record<HomeProblemGroup, number> = { late: 0, today: 1, wait: 2, stuck: 3 };

function stepOrStatus(order: HomeOrderLike): string {
  return order.currentStep?.label ?? INTERNAL_STATUS_LABELS[order.internalStatus] ?? order.internalStatus;
}

/** เหตุที่ต้องจัดการของออเดอร์ใบนี้ — null = เดินปกติ */
export function describeHomeOrder(order: HomeOrderLike): HomeProblem | null {
  const who = order.currentStep?.assigneeName ?? null;
  if (order.dueInDays !== null && order.dueInDays < 0) {
    if (order.vendor && order.vendor.overdueDays > 0) {
      return {
        group: "late",
        kind: "vendor-late",
        tone: "danger",
        label: `${order.vendor.name} · เลยรับ ${order.vendor.overdueDays} วัน`,
        who: null,
      };
    }
    return { group: "late", kind: "overdue", tone: "danger", label: `ค้างขั้น ${stepOrStatus(order)}`, who };
  }
  if (order.dueInDays === 0) {
    if (order.ready) {
      return { group: "today", kind: "ready", tone: "success", label: "แพ็กแล้ว · รอขนส่ง", who };
    }
    const progress = order.stepsTotal > 0 ? ` · ขั้น ${Math.min(order.stepsDone + 1, order.stepsTotal)}/${order.stepsTotal}` : "";
    return { group: "today", kind: "in-progress", tone: "warning", label: `${stepOrStatus(order)}${progress}`, who };
  }
  if (order.waitingCustomerDays !== null) {
    return {
      group: "wait",
      kind: "customer",
      tone: order.dueInDays !== null && order.dueInDays <= 1 ? "warning" : "neutral",
      label: `รอลูกค้าอนุมัติแบบ · ${order.waitingCustomerDays} วัน`,
      who,
    };
  }
  if (order.vendor) {
    const late = order.vendor.overdueDays > 0;
    return {
      group: "wait",
      kind: "vendor",
      tone: late ? "danger" : "neutral",
      label: late ? `${order.vendor.name} · เลยรับ ${order.vendor.overdueDays} วัน` : `${order.vendor.name} · รอรับกลับ`,
      who: null,
    };
  }
  if (order.stuckDays !== null && order.stuckDays >= HOME_STUCK_AFTER_DAYS) {
    return {
      group: "stuck",
      kind: "stuck",
      tone: "neutral",
      label: `${stepOrStatus(order)} · ไม่มีความเคลื่อนไหว ${order.stuckDays} วัน`,
      who: null,
    };
  }
  return null;
}

/** "ต้องจัดการ" ที่ใช้กับออเดอร์ได้ทุกสถานะ (ตาราง/หน้ารายละเอียด) — ใบร่าง/ส่งแล้ว/ปิด/ยกเลิก
 *  ไม่มีเรื่องต้องตาม แม้กำหนดส่งจะผ่านไปแล้ว · หน้าแรกส่งมาแต่ใบที่ยังเดินอยู่จึงเรียกตัวบนตรง ๆ */
export function describeOrderAttention(order: HomeOrderLike): HomeProblem | null {
  return isAttentionStatus(order.internalStatus) ? describeHomeOrder(order) : null;
}

export const HOME_ORDER_FILTERS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "late", label: "เลยกำหนด" },
  { key: "today", label: "ส่งวันนี้" },
  { key: "wait", label: "รอลูกค้า/ร้านนอก" },
  { key: "stuck", label: "ไม่ขยับ" },
] as const;
export type HomeOrderFilter = (typeof HOME_ORDER_FILTERS)[number]["key"];

export function matchesHomeFilter(
  order: HomeOrderLike,
  filter: HomeOrderFilter,
  problem: HomeProblem | null = describeHomeOrder(order),
): boolean {
  if (filter === "all") return true;
  if (filter === "today") return order.dueInDays === 0;
  return problem?.group === filter;
}

/** ลำดับความด่วน: เลยกำหนด → ส่งวันนี้ → รอคนอื่น → ไม่ขยับ → ปกติ · เท่ากันเรียงตามกำหนดส่ง */
export function urgencyOf(order: HomeOrderLike): number {
  const problem = describeHomeOrder(order);
  return problem ? GROUP_RANK[problem.group] : 9;
}

export function sortHomeOrders<T extends HomeOrderLike>(orders: readonly T[]): T[] {
  return [...orders].sort((a, b) => {
    const rank = urgencyOf(a) - urgencyOf(b);
    if (rank !== 0) return rank;
    const dueA = a.dueInDays ?? Number.POSITIVE_INFINITY;
    const dueB = b.dueInDays ?? Number.POSITIVE_INFINITY;
    if (dueA !== dueB) return dueA - dueB;
    return a.orderNumber.localeCompare(b.orderNumber);
  });
}
