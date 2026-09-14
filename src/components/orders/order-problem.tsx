import type { LucideIcon } from "lucide-react";
import { Activity, Flame, PackageCheck, PauseCircle, Truck, UserRound } from "lucide-react";
import type { HomeProblem, HomeProblemKind } from "@/lib/home-orders";
import { orderStatusTone, type OrderStatusTone } from "@/lib/order-list-view";
import { INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import { cn } from "@/lib/utils";

/* ============================================================
   ชิ้นเล็กของ "ต้องจัดการ" ที่ใช้ร่วมกัน — หน้าแรก, ตาราง/ดูย่อออเดอร์, หัวใบออเดอร์
   (รวมไว้ที่เดียว 2026-09-14 ตอนหน้าออเดอร์ใช้กฎเดียวกับหน้าแรก ไม่ให้หน้าตาเพี้ยนกันคนละจอ)
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
