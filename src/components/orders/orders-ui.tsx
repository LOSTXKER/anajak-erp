import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Activity, AlertTriangle, Flame, OctagonAlert, PackageCheck, Pause, Truck, User } from "lucide-react";
import { c, Callout, type Tone } from "@/components/kit/kit";
import type { HomeProblem, HomeProblemKind } from "@/lib/home-orders";
import type { OrderProgress } from "@/lib/order-progress";
import { differenceInBangkokDays } from "@/lib/date-utils";
import { INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import {
  APPROVAL_STATUS_LABELS_BY_CUSTOMER,
  PAYMENT_LABEL_TO_STATUS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_VARIANTS,
} from "@/lib/status-config";

/* ============================================================
   ชิ้นเฉพาะหน้าออเดอร์บนชุดหน้าตากลาง (components/kit)
   ชิปวิธีพิมพ์/การชำระ · ช่องต้องจัดการ (กฎจาก lib/home-orders ชุดเดียวกับหน้าแรก) · สถานะม็อกอัพ
   ============================================================ */

/** ชิปวิธีพิมพ์ (techChip): DTF ฟ้า · ปัก เทา · ที่เหลือเส้นบาง */
export function TechChip({ label }: { label: string }) {
  return <span className={c("chip", label === "DTF" ? "blue" : label === "ปัก" ? "gray" : "line")}>{label}</span>;
}

/** โทนของ Badge (status-config) → คลาสโทนของ .pay — ป้ายจุดกับชิปเรียกชื่อโทนคนละชุด */
const PAY_TONE: Record<string, string> = {
  success: "good",
  accent: "blue",
  warning: "warn",
  destructive: "bad",
};

/**
 * การชำระ (payTag) — คำและโทนชุดเดียวกับหน้าการเงินและลิงก์ที่ส่งให้ลูกค้า (PAYMENT_STATUS_*)
 * เดิมที่นี่สะกดเอง ("ชำระแล้ว/บางส่วน/ค้างชำระ" · บางส่วน = ส้ม) แอดมินจึงตอบลูกค้าคนละคำ
 * กับที่ลูกค้าเห็น (เบสเคาะ 2026-09-18 ให้ยึดชุดของ status-config)
 * คงรูปทรง .pay ไว้ (ข้อความ + จุด ไม่มีพื้น) — ป้ายนี้อยู่ทั้งคอลัมน์ ถ้ามีพื้นทุกแถวจะกลายเป็นพรมสี
 */
export function PayTag({ label, status }: { label: string; status: string }) {
  const key = PAYMENT_LABEL_TO_STATUS[label as keyof typeof PAYMENT_LABEL_TO_STATUS];
  // งานที่ยังไม่รับ/ยกเลิก และใบที่ยังไม่มีบิล (label = "none") ไม่มีอะไรให้ตาม จึงไม่ขึ้นป้าย
  if (status === "INQUIRY" || status === "CANCELLED" || !key) {
    return <span className={c("pay none")}>—</span>;
  }
  return (
    <span className={c("pay", PAY_TONE[PAYMENT_STATUS_VARIANTS[key]])}>
      <span className={c("d")} aria-hidden="true" />
      {PAYMENT_STATUS_LABELS[key]}
    </span>
  );
}


/** ถ้อยคำ "ต้องจัดการ" ของหน้าออเดอร์ — เหตุ/โทน/ลำดับมาจาก lib/home-orders ชุดเดียวกับหน้าแรก ต่างแค่ถ้อยคำ */
export function orderAttentionText(problem: HomeProblem, progress: OrderProgress): { text: string; who: string | null } {
  const step =
    progress.currentStep?.label ??
    (INTERNAL_STATUS_LABELS as Record<string, string>)[progress.internalStatus] ??
    progress.internalStatus;
  const lateDays = progress.dueInDays !== null && progress.dueInDays < 0 ? -progress.dueInDays : 0;
  const vendorName = progress.vendor?.name ?? "ร้านนอก";
  const vendorLate = progress.vendor?.overdueDays ?? 0;
  switch (problem.kind) {
    // งานแก้/เคลม — ข้อความปั้นมาจาก lib/home-orders แล้ว (มีเลขรอบและจำนวน) ใช้ตามนั้นเลย
    case "claim":
      return { text: problem.label, who: problem.who };
    // งานหยุดเดิน — ข้อความปั้นมาจาก lib/home-orders แล้ว (หัวเรื่อง + เหตุจริง) ใช้ตามนั้น
    case "blocked":
      return { text: problem.label, who: problem.who };
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

/** ถ้อยคำสั้นของตาราง (ต้นแบบ mockup-orders-list-lite-2026-09-16) — วันเลยกำหนดอยู่ช่องกำหนดส่งแล้ว ไม่พูดซ้ำ */
export function orderAttentionShort(problem: HomeProblem, progress: OrderProgress): string {
  const step =
    progress.currentStep?.label ??
    (INTERNAL_STATUS_LABELS as Record<string, string>)[progress.internalStatus] ??
    progress.internalStatus;
  const vendorName = progress.vendor?.name ?? "ร้านนอก";
  const vendorLate = progress.vendor?.overdueDays ?? 0;
  switch (problem.kind) {
    case "claim":
      return problem.label;
    case "blocked":
      return problem.label;
    case "overdue":
      return `ค้างขั้น${step}`;
    case "vendor-late":
      return `${vendorName} เลยรับ ${vendorLate} วัน`;
    case "ready":
      return "แพ็กแล้ว รอขนส่ง";
    case "in-progress":
      return `อยู่ขั้น${step}`;
    case "customer":
      return `รอลูกค้าอนุมัติ ${progress.waitingCustomerDays ?? 0} วัน`;
    case "vendor":
      return vendorLate > 0 ? `${vendorName} เลยรับ ${vendorLate} วัน` : `${vendorName} รอรับกลับ`;
    case "stuck":
      return `ไม่ขยับ ${progress.stuckDays ?? 0} วัน`;
  }
}

export const PROBLEM_ICON: Record<HomeProblemKind, LucideIcon> = {
  claim: AlertTriangle,
  blocked: OctagonAlert,
  overdue: Flame,
  "vendor-late": Truck,
  ready: PackageCheck,
  "in-progress": Activity,
  customer: User,
  vendor: Truck,
  stuck: Pause,
};

export const PROBLEM_TONE: Record<HomeProblem["tone"], Tone> = {
  danger: "bad",
  warning: "warn",
  success: "good",
  neutral: "",
};

/** ช่องต้องจัดการในตาราง/การ์ด (why-cell) */
export function WhyCell({
  problem,
  progress,
  showWho = true,
  short = false,
}: {
  problem: HomeProblem | null;
  progress: OrderProgress;
  showWho?: boolean;
  /** ถ้อยคำสั้นแบบตารางออเดอร์ · ไม่มีบรรทัดชื่อคนทำ (มีคอลัมน์คนทำแยก) */
  short?: boolean;
}) {
  if (!problem) {
    return (
      <div className={c("why-cell")}>
        <span className={c("none")}>—</span>
      </div>
    );
  }
  const Icon = PROBLEM_ICON[problem.kind];
  const { text, who } = orderAttentionText(problem, progress);
  return (
    <div className={c("why-cell")}>
      <span className={c("why", PROBLEM_TONE[problem.tone])}>
        <Icon aria-hidden="true" />
        {short ? orderAttentionShort(problem, progress) : text}
      </span>
      {showWho && !short && who ? <span className={c("wholine")}>{who}</span> : null}
    </div>
  );
}

/** ป้ายต้องจัดการแบบกล่อง (problemCallout): เลยกำหนด = แดง · ส่งวันนี้แพ็กแล้ว = ฟ้า · ที่เหลือ = ส้ม */
export function ProblemCallout({
  problem,
  progress,
  action,
}: {
  problem: HomeProblem;
  progress: OrderProgress;
  action?: ReactNode;
}) {
  const Icon = PROBLEM_ICON[problem.kind];
  const { text, who } = orderAttentionText(problem, progress);
  return (
    <Callout
      tone={problem.tone === "danger" ? "danger" : problem.tone === "success" ? "info" : undefined}
      icon={Icon}
      action={action}
    >
      <b>{text}</b>
      {who ? <span className={c("whoinline")}>· {who}</span> : null}
    </Callout>
  );
}

/** สถานะม็อกอัพ (mockPill) · ส่งให้ลูกค้าดูมากี่วันนับจาก now ที่หน้าแม่ส่งมา */
export function MockupPill({
  design,
  now,
}: {
  design: { approvalStatus: string; createdAt: Date | string } | null | undefined;
  now: Date;
}) {
  if (!design) return <span className={c("chip gray")}>ยังไม่มีม็อกอัพ</span>;
  // คำมาจากแผนที่กลาง (ชุดเดียวกับแถวม็อกอัพในแท็บงานผลิต) — ที่นี่เหลือแค่เลือกโทนกับต่อจำนวนวัน
  switch (design.approvalStatus) {
    case "APPROVED":
      return <span className={c("chip good")}>{APPROVAL_STATUS_LABELS_BY_CUSTOMER.APPROVED}</span>;
    case "PENDING":
      return (
        <span className={c("chip warn")}>
          {APPROVAL_STATUS_LABELS_BY_CUSTOMER.PENDING} · {Math.max(0, differenceInBangkokDays(now, design.createdAt) ?? 0)} วัน
        </span>
      );
    case "REVISION_REQUESTED":
      return <span className={c("chip warn")}>{APPROVAL_STATUS_LABELS_BY_CUSTOMER.REVISION_REQUESTED}</span>;
    case "REJECTED":
      return <span className={c("chip bad")}>{APPROVAL_STATUS_LABELS_BY_CUSTOMER.REJECTED}</span>;
    default:
      return <span className={c("chip gray")}>{design.approvalStatus}</span>;
  }
}
