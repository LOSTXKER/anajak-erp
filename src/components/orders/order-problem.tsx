import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Activity, CalendarClock, CalendarDays, Flame, PackageCheck, PauseCircle, Truck, UserRound } from "lucide-react";
import { HomeChip, type HomeTone } from "@/components/dashboard/home/home-card";
import { DASHED, TINT } from "@/components/ui/tokens";
import type { HomeProblem, HomeProblemKind } from "@/lib/home-orders";
import { orderStatusTone, type OrderStatusTone } from "@/lib/order-list-view";
import { differenceInBangkokDays } from "@/lib/date-utils";
import { isAttentionStatus, type OrderProgress } from "@/lib/order-progress";
import { INTERNAL_STATUS_LABELS, PRIORITY_LABELS } from "@/lib/order-status";
import { cn, formatDateShort } from "@/lib/utils";

/* ============================================================
   ชิ้นเล็กของ "ต้องจัดการ" ที่ใช้ร่วมกัน — หน้าแรก, ตาราง/ดูย่อออเดอร์, หัวใบออเดอร์
   (รวมไว้ที่เดียว 2026-09-14 ตอนหน้าออเดอร์ใช้กฎเดียวกับหน้าแรก ไม่ให้หน้าตาเพี้ยนกันคนละจอ)

   2026-09-15 เบสเปิดของจริงแล้วบอก "ไม่เห็นเหมือนเลย" → ชิปวันส่ง ชิปวิธีพิมพ์ ชิปสถานะ
   และถ้อยคำ "ต้องจัดการ" ของหน้าออเดอร์ทำตามต้นแบบรอบ 2 ทีละชิ้น
   เหตุ/โทน/ลำดับความด่วนยังมาจากกฎกลาง (lib/home-orders) ชุดเดียวกับหน้าแรก — ต่างแค่ถ้อยคำที่แสดง
   ============================================================ */

export const ORDER_PROBLEM_ICON: Record<HomeProblemKind, LucideIcon> = {
  overdue: Flame,
  "vendor-late": Truck,
  ready: PackageCheck,
  "in-progress": Activity,
  customer: UserRound,
  vendor: Truck,
  stuck: PauseCircle,
};

export const ORDER_PROBLEM_TEXT: Record<HomeProblem["tone"], string> = {
  danger: "font-medium text-red-700 dark:text-red-300",
  warning: "font-medium text-amber-700 dark:text-amber-300",
  success: "font-medium text-green-700 dark:text-green-300",
  neutral: "text-secondary",
};

/** เหตุที่ต้องจัดการหนึ่งบรรทัด: ไอคอน + ค้างที่ไหน/รอใคร + คนทำขั้นนั้น */
export function OrderProblemLabel({ problem, className }: { problem: HomeProblem; className?: string }) {
  const Icon = ORDER_PROBLEM_ICON[problem.kind];
  return (
    <span className={cn("flex min-w-0 items-start gap-1.5 text-xs", ORDER_PROBLEM_TEXT[problem.tone], className)}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {problem.label}
        {problem.who ? <span className="font-normal text-muted"> · {problem.who}</span> : null}
      </span>
    </span>
  );
}

/** ถ้อยคำ "ต้องจัดการ" ของหน้าออเดอร์ (ต้นแบบรอบ 2) — บอกทั้งเหตุและตัวเลขที่ใช้ตัดสินในประโยคเดียว */
export function orderAttentionText(problem: HomeProblem, progress: OrderProgress): { text: string; who: string | null } {
  const step =
    progress.currentStep?.label ??
    (INTERNAL_STATUS_LABELS as Record<string, string>)[progress.internalStatus] ??
    progress.internalStatus;
  const lateDays = progress.dueInDays !== null && progress.dueInDays < 0 ? -progress.dueInDays : 0;
  const vendorName = progress.vendor?.name ?? "ร้านนอก";
  const vendorLate = progress.vendor?.overdueDays ?? 0;
  switch (problem.kind) {
    case "overdue":
      return { text: `เลยกำหนดส่ง ${lateDays} วัน · ค้างขั้น ${step}`, who: problem.who };
    case "vendor-late":
      return { text: `เลยกำหนดส่ง ${lateDays} วัน · ${vendorName} เลยรับ ${vendorLate} วัน`, who: null };
    case "ready":
      return { text: "ส่งวันนี้ · แพ็กแล้ว รอขนส่ง", who: problem.who };
    case "in-progress":
      return { text: `ส่งวันนี้ · อยู่ขั้น ${step}`, who: problem.who };
    case "customer":
      return { text: `รอลูกค้าอนุมัติแบบ · ${progress.waitingCustomerDays ?? 0} วัน`, who: problem.who };
    case "vendor":
      return vendorLate > 0
        ? { text: `${vendorName} · เลยกำหนดรับ ${vendorLate} วัน`, who: null }
        : { text: `${vendorName} · รอรับกลับ`, who: null };
    case "stuck":
      return { text: `ไม่มีความเคลื่อนไหว ${progress.stuckDays ?? 0} วัน`, who: null };
  }
}

/** ช่อง "ต้องจัดการ" ในตาราง/การ์ด — ไอคอนอยู่ในบรรทัดเดียวกับข้อความ คนทำอยู่บรรทัดล่าง */
export function OrderAttentionLine({
  problem,
  progress,
  showWho = true,
  className,
}: {
  problem: HomeProblem;
  progress: OrderProgress;
  showWho?: boolean;
  className?: string;
}) {
  const Icon = ORDER_PROBLEM_ICON[problem.kind];
  const { text, who } = orderAttentionText(problem, progress);
  return (
    <span className={cn("block min-w-0 text-xs [overflow-wrap:anywhere]", ORDER_PROBLEM_TEXT[problem.tone], className)}>
      <Icon className="-mt-0.5 mr-1 inline h-3.5 w-3.5 align-middle" strokeWidth={1.75} aria-hidden="true" />
      {text}
      {showWho && who ? <span className="mt-0.5 block font-normal text-muted">{who}</span> : null}
    </span>
  );
}

/* ป้ายต้องจัดการแบบกล่อง (ต้นแบบ .callout): งานเลยกำหนด = แดง · ส่งวันนี้แพ็กแล้ว = ฟ้า · ที่เหลือ = ส้ม */
const CALLOUT_TONE: Record<HomeProblem["tone"], string> = {
  danger: TINT.error,
  success: TINT.info,
  warning: TINT.warning,
  neutral: TINT.warning,
};

export function OrderProblemCallout({
  problem,
  progress,
  action,
  className,
}: {
  problem: HomeProblem;
  progress: OrderProgress;
  action?: ReactNode;
  className?: string;
}) {
  const Icon = ORDER_PROBLEM_ICON[problem.kind];
  const { text, who } = orderAttentionText(problem, progress);
  return (
    <div className={cn(CALLOUT_TONE[problem.tone], "flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-xl border px-3.5 py-2.5 text-sm", className)}>
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span className="min-w-0 flex-1 basis-48 text-strong [overflow-wrap:anywhere]">
        <span className="font-semibold">{text}</span>
        {who ? <span className="text-xs font-normal text-muted"> · {who}</span> : null}
      </span>
      {action}
    </div>
  );
}

/** ป้ายวันส่ง (ต้นแบบ .due) — งานที่ยังเดินหนักตามความรีบ · งานจบแล้วเหลือแค่วันที่ */
export function OrderDueChip({
  status,
  deadline,
  dueInDays,
  withDate = false,
  className,
}: {
  status: string;
  deadline: Date | string | null;
  dueInDays: number | null;
  /** ต่อวันที่ท้าย "อีก N วัน" (ใช้ในที่ที่มีพื้นที่) */
  withDate?: boolean;
  className?: string;
}) {
  if (!deadline || dueInDays === null) {
    return (
      <HomeChip className={cn("font-normal", className)}>
        <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ยังไม่กำหนด
      </HomeChip>
    );
  }
  if (!isAttentionStatus(status)) {
    return (
      <HomeChip className={cn("font-normal", className)}>
        <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {formatDateShort(deadline)}
      </HomeChip>
    );
  }
  const tone: HomeTone = dueInDays < 0 ? "danger" : dueInDays <= 1 ? "warning" : "neutral";
  const text =
    dueInDays < 0
      ? `เลยกำหนด ${-dueInDays} วัน`
      : dueInDays === 0
        ? "ส่งวันนี้"
        : dueInDays === 1
          ? "ส่งพรุ่งนี้"
          : `อีก ${dueInDays} วัน${withDate ? ` · ${formatDateShort(deadline)}` : ""}`;
  return (
    <HomeChip tone={tone} className={cn(tone === "neutral" && "font-normal", className)}>
      <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {text}
    </HomeChip>
  );
}

/** ชิปวิธีพิมพ์ (ต้นแบบ techChip): DTF ฟ้า · ปัก เทา · ที่เหลือเส้นบาง */
export function OrderPrintChip({ label, className }: { label: string; className?: string }) {
  if (label === "DTF") return <HomeChip tone="brand" className={className}>{label}</HomeChip>;
  if (label === "ปัก") return <HomeChip className={className}>{label}</HomeChip>;
  return (
    <HomeChip className={cn("bg-transparent ring-1 ring-inset ring-border", className)}>{label}</HomeChip>
  );
}

/** ชิปความเร่งด่วน — โผล่เฉพาะงานสูง/เร่งด่วน */
export function OrderPriorityChip({ priority, className }: { priority: string; className?: string }) {
  if (priority !== "URGENT" && priority !== "HIGH") return null;
  return (
    <HomeChip tone={priority === "URGENT" ? "danger" : "warning"} className={className}>
      {PRIORITY_LABELS[priority] ?? priority}
    </HomeChip>
  );
}

/** สถานะม็อกอัพ (ต้นแบบ mockPill): ลูกค้าอนุมัติแล้ว · รอลูกค้าตรวจกี่วัน · ขอแก้ · ไม่ผ่าน */
export function MockupApprovalChip({ status, sentAt, now }: { status: string; sentAt: Date | string; now?: Date }) {
  if (status === "APPROVED") return <HomeChip tone="success">ลูกค้าอนุมัติแล้ว</HomeChip>;
  if (status === "PENDING") {
    const days = now ? Math.max(0, differenceInBangkokDays(now, sentAt) ?? 0) : null;
    return <HomeChip tone="warning">{days === null ? "รอลูกค้าตรวจ" : `รอลูกค้าตรวจ · ${days} วัน`}</HomeChip>;
  }
  if (status === "REVISION_REQUESTED") return <HomeChip tone="warning">ลูกค้าขอแก้</HomeChip>;
  if (status === "REJECTED") return <HomeChip tone="danger">ลูกค้าไม่ผ่านแบบ</HomeChip>;
  return <HomeChip>{status}</HomeChip>;
}

const PILL_TONE: Record<OrderStatusTone, HomeTone> = {
  neutral: "neutral",
  brand: "brand",
  warning: "warning",
  success: "success",
  danger: "danger",
};

/** สถานะภายในแบบชิปมีจุด (ต้นแบบ statusPill) · พักงาน = กรอบประ */
export function OrderStatusPill({ status, className }: { status: string; className?: string }) {
  const label = (INTERNAL_STATUS_LABELS as Record<string, string>)[status] ?? status;
  if (status === "ON_HOLD") {
    return (
      <HomeChip dot className={cn(DASHED, className)}>
        {label}
      </HomeChip>
    );
  }
  return (
    <HomeChip tone={PILL_TONE[orderStatusTone(status)]} dot className={className}>
      {label}
    </HomeChip>
  );
}

/** ขั้นของใบผลิตเป็นขีด — ขีดทึบ = เสร็จ · ขีดจาง = กำลังทำ */
export function StepProgress({ done, total, className }: { done: number; total: number; className?: string }) {
  if (total === 0) return null;
  return (
    <span className={cn("inline-flex shrink-0 gap-0.5", className)} role="img" aria-label={`ขั้น ${done} จาก ${total}`}>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn(
            "block h-1.5 w-3 rounded-full",
            index < done
              ? "bg-blue-600 dark:bg-blue-400"
              : index === done
                ? "bg-blue-600/40 dark:bg-blue-400/40"
                : "bg-border",
          )}
        />
      ))}
    </span>
  );
}

const STATUS_DOT: Record<OrderStatusTone, string> = {
  neutral: "bg-slate-400 dark:bg-slate-500",
  brand: "bg-blue-500",
  warning: "bg-amber-500",
  success: "bg-green-600 dark:bg-green-400",
  danger: "bg-red-500",
};

/** สถานะภายใน = จุดสี + ชื่อ · ขนาด/น้ำหนักตัวอักษรให้ผู้เรียกกำหนดตามที่วาง */
export function OrderStatusDot({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[orderStatusTone(status)])} />
      {(INTERNAL_STATUS_LABELS as Record<string, string>)[status] ?? status}
    </span>
  );
}
