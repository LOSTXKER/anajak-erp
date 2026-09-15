import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Activity, Flame, PackageCheck, Pause, Truck, User } from "lucide-react";
import { c, Callout, type Tone } from "@/components/kit/kit";
import { orderAttentionText } from "@/components/orders/order-problem";
import type { HomeProblem, HomeProblemKind } from "@/lib/home-orders";
import type { OrderProgress } from "@/lib/order-progress";
import { differenceInBangkokDays } from "@/lib/date-utils";

/* ============================================================
   ชิ้นเฉพาะหน้าออเดอร์บนชุดหน้าตากลาง (components/kit)
   ชิปวิธีพิมพ์/การชำระ · ช่องต้องจัดการ (กฎจาก lib/home-orders ชุดเดียวกับหน้าแรก) · สถานะม็อกอัพ
   ============================================================ */

/** ชิปวิธีพิมพ์ (techChip): DTF ฟ้า · ปัก เทา · ที่เหลือเส้นบาง */
export function TechChip({ label }: { label: string }) {
  return <span className={c("chip", label === "DTF" ? "blue" : label === "ปัก" ? "gray" : "line")}>{label}</span>;
}

/** การชำระ (payTag) */
export function PayTag({ label, status }: { label: string; status: string }) {
  if (status === "INQUIRY" || status === "CANCELLED" || !["paid", "partial", "unpaid"].includes(label)) {
    return <span className={c("pay none")}>—</span>;
  }
  const [tone, text] =
    label === "paid" ? ["good", "ชำระแล้ว"] : label === "partial" ? ["warn", "บางส่วน"] : ["bad", "ค้างชำระ"];
  return (
    <span className={c("pay", tone)}>
      <span className={c("d")} aria-hidden="true" />
      {text}
    </span>
  );
}


export const PROBLEM_ICON: Record<HomeProblemKind, LucideIcon> = {
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
}: {
  problem: HomeProblem | null;
  progress: OrderProgress;
  showWho?: boolean;
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
        {text}
      </span>
      {showWho && who ? <span className={c("wholine")}>{who}</span> : null}
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
  switch (design.approvalStatus) {
    case "APPROVED":
      return <span className={c("chip good")}>ลูกค้าอนุมัติแล้ว</span>;
    case "PENDING":
      return (
        <span className={c("chip warn")}>
          รอลูกค้าตรวจ · {Math.max(0, differenceInBangkokDays(now, design.createdAt) ?? 0)} วัน
        </span>
      );
    case "REVISION_REQUESTED":
      return <span className={c("chip warn")}>ลูกค้าขอแก้</span>;
    case "REJECTED":
      return <span className={c("chip bad")}>ลูกค้าไม่ผ่านแบบ</span>;
    default:
      return <span className={c("chip gray")}>{design.approvalStatus}</span>;
  }
}
