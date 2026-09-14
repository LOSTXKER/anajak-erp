import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { CustomerStatus, InternalStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { FOCUS_BUTTON, TINT } from "@/components/ui/tokens";
import { HomeChip } from "@/components/dashboard/home/home-card";
import { MockupThumbnail } from "@/components/mockup/mockup-thumbnail";
import { OrderProblemLabel } from "@/components/orders/order-problem";
import { PriorityBadge } from "@/components/orders/list/orders-table";
import type { HomeProblem } from "@/lib/home-orders";
import { orderStatusTone } from "@/lib/order-list-view";
import { CUSTOMER_STATUS_LABELS, INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import { cn } from "@/lib/utils";

/* ============================================================
   หัวใบออเดอร์ (ต้นแบบหน้าออเดอร์รอบ 2 · เบสเคาะ "โอเคทำจริงเลย" 2026-09-14)

   ยืนบนผืนหน้าตรง ๆ ไม่มีกรอบ (คำสั่งเดิม 08-30 "ส่วนบนขอแบบไม่ต้องมีพื้นกรอบ แบบ minimal"):
   ตำแหน่งหน้า → รูปม็อกอัพ + เลขที่ + สถานะภายใน/ความเร่งด่วน/สถานะที่ลูกค้าเห็น →
   ลูกค้า (กดไปหน้าลูกค้า) → ปุ่มเดิมทางขวา (ใบสั่งงาน, ลิงก์ลูกค้า, ขั้นต่อไป, ⋯)
   ตัวนี้รับ props ล้วน — ปุ่ม/สิทธิ์/การเดินสถานะอยู่ที่หน้าแม่ทั้งหมด
   ============================================================ */

/** รายละเอียดงานยาวไม่ขึ้นหัวใบ (อยู่การ์ดม็อกอัพแล้ว) — หัวใบรับได้แค่ชื่องานสั้น ๆ */
const HEAD_DESCRIPTION_MAX = 60;

export function OrderDetailHead({
  orderNumber,
  cover,
  internalStatus,
  customerStatus,
  priority,
  customer,
  description,
  actions,
}: {
  orderNumber: string;
  cover: string | null;
  internalStatus: InternalStatus;
  customerStatus: CustomerStatus;
  priority: string;
  customer: { id: string; name: string; company: string | null } | null;
  description: string | null;
  actions?: ReactNode;
}) {
  const shortDescription =
    description && description.trim().length <= HEAD_DESCRIPTION_MAX ? description.trim() : null;
  const company = customer?.company && customer.company !== customer.name ? customer.company : null;

  return (
    <div className="space-y-3">
      <nav aria-label="ตำแหน่งหน้า" className="flex items-center gap-1.5 text-sm text-muted">
        <Link href="/orders" className={cn(FOCUS_BUTTON, "rounded font-medium text-secondary")}>
          ออเดอร์
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span aria-current="page" className="tabular-nums">
          {orderNumber}
        </span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-start gap-4">
          <MockupThumbnail cover={cover} alt={`ม็อกอัพ ${orderNumber}`} size="md" className="hidden sm:flex" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tabular-nums text-strong">{orderNumber}</h1>
              <HomeChip tone={orderStatusTone(internalStatus)} dot>
                {INTERNAL_STATUS_LABELS[internalStatus]}
              </HomeChip>
              <PriorityBadge priority={priority} />
              <HomeChip tone="neutral">ลูกค้าเห็น · {CUSTOMER_STATUS_LABELS[customerStatus]}</HomeChip>
            </div>
            {customer || shortDescription ? (
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-secondary">
                {customer ? (
                  <Link
                    href={`/customers/${customer.id}`}
                    className={cn(
                      FOCUS_BUTTON,
                      "rounded font-medium text-blue-700 underline decoration-blue-200 underline-offset-4 dark:text-blue-300 dark:decoration-blue-800",
                    )}
                  >
                    {customer.name}
                  </Link>
                ) : null}
                {/* จุดคั่นเกาะกับข้อความถัดไป — ขึ้นบรรทัดใหม่บนจอแคบแล้วไม่เหลือจุดค้างท้ายบรรทัด */}
                {company ? (
                  <span className="inline-flex min-w-0 items-baseline gap-2">
                    <span aria-hidden="true" className="text-muted">
                      ·
                    </span>
                    <span className="[overflow-wrap:anywhere]">{company}</span>
                  </span>
                ) : null}
                {shortDescription ? (
                  <span className="inline-flex min-w-0 items-baseline gap-2">
                    <span aria-hidden="true" className="text-muted">
                      ·
                    </span>
                    <span className="[overflow-wrap:anywhere]">{shortDescription}</span>
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

const PROBLEM_TINT = {
  danger: TINT.error,
  warning: TINT.warning,
  success: TINT.success,
  neutral: TINT.neutral,
} as const;

/** ป้าย "ต้องจัดการ" บนสุดของหน้า — กฎเดียวกับหน้าแรก/ตาราง · ปุ่มพาไปแท็บที่แก้เรื่องนั้นได้ */
export function OrderAttentionCallout({
  problem,
  action,
}: {
  problem: HomeProblem;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className={cn(PROBLEM_TINT[problem.tone], "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-3")}>
      <OrderProblemLabel problem={problem} className="min-w-0 flex-1 text-sm" />
      {action ? (
        <Button type="button" variant="outline" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
