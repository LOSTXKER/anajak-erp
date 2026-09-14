import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { CustomerStatus, InternalStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { FOCUS_BUTTON, TINT } from "@/components/ui/tokens";
import { HomeChip } from "@/components/dashboard/home/home-card";
import { MockupThumbnail } from "@/components/mockup/mockup-thumbnail";
import { OrderPriorityChip, OrderProblemCallout, OrderStatusPill } from "@/components/orders/order-problem";
import type { HomeProblem } from "@/lib/home-orders";
import type { OrderProgress } from "@/lib/order-progress";
import { CUSTOMER_STATUS_LABELS } from "@/lib/order-status";
import { cn } from "@/lib/utils";

/* ============================================================
   หัวใบออเดอร์ (ต้นแบบหน้าออเดอร์รอบ 2 · เบสเคาะ "โอเคทำจริงเลย" 2026-09-14
   · ไล่ให้ตรงต้นแบบทีละส่วน 2026-09-15 หลังเบสเปิดของจริงแล้วบอก "ไม่เห็นเหมือนเลย")

   ยืนบนผืนหน้าตรง ๆ ไม่มีกรอบ (คำสั่งเดิม 08-30 "ส่วนบนขอแบบไม่ต้องมีพื้นกรอบ แบบ minimal"):
   ตำแหน่งหน้า → รูปม็อกอัพ + เลขที่ + ชิปสถานะ/ความเร่งด่วน/สถานะที่ลูกค้าเห็น →
   ลูกค้า (กดไปหน้าลูกค้า) · บริษัท · ชื่องาน → ปุ่มเดิมทางขวา (ใบสั่งงาน, ลิงก์ลูกค้า, ขั้นต่อไป, ⋯)
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
      <nav aria-label="ตำแหน่งหน้า" className="flex items-center gap-1.5 text-xs text-muted">
        <Link href="/orders" className={cn(FOCUS_BUTTON, "rounded text-secondary")}>
          ออเดอร์
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span aria-current="page" className="tabular-nums">
          {orderNumber}
        </span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-start gap-3.5">
          <MockupThumbnail cover={cover} alt={`ม็อกอัพ ${orderNumber}`} size="md" className="mt-0.5 hidden rounded-xl sm:flex" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-2xl font-semibold tabular-nums text-strong">{orderNumber}</h1>
              <OrderStatusPill status={internalStatus} className="min-h-7 px-3 text-sm" />
              <OrderPriorityChip priority={priority} className="min-h-7 px-3 text-sm" />
              <HomeChip className="bg-transparent font-normal ring-1 ring-inset ring-border">
                ลูกค้าเห็น · {CUSTOMER_STATUS_LABELS[customerStatus]}
              </HomeChip>
            </div>
            {customer || shortDescription ? (
              <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-secondary">
                {customer ? (
                  <Link
                    href={`/customers/${customer.id}`}
                    className={cn(
                      FOCUS_BUTTON,
                      "rounded-sm border-b border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-300",
                    )}
                  >
                    {customer.name}
                  </Link>
                ) : null}
                {/* จุดคั่นเกาะกับข้อความถัดไป — ขึ้นบรรทัดใหม่บนจอแคบแล้วไม่เหลือจุดค้างท้ายบรรทัด */}
                {company ? (
                  <span className="inline-flex min-w-0 items-baseline gap-2.5">
                    <span aria-hidden="true" className="text-muted">
                      ·
                    </span>
                    <span className="[overflow-wrap:anywhere]">{company}</span>
                  </span>
                ) : null}
                {shortDescription ? (
                  <span className="inline-flex min-w-0 items-baseline gap-2.5">
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

/** ป้าย "ต้องจัดการ" บนสุดของหน้า — กฎเดียวกับหน้าแรก/ตาราง · ปุ่มพาไปแท็บที่แก้เรื่องนั้นได้ */
export function OrderAttentionCallout({
  problem,
  progress,
  action,
}: {
  problem: HomeProblem;
  progress: OrderProgress;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <OrderProblemCallout
      problem={problem}
      progress={progress}
      action={
        action ? (
          <Button type="button" variant="outline" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        ) : undefined
      }
    />
  );
}

const CALLOUT_TONE = {
  warning: TINT.warning,
  danger: TINT.error,
  info: TINT.info,
} as const;

/** ป้ายแจ้งเตือนบนสุดแบบเดียวกันทั้งชุด (ต้นแบบ .callout): ไอคอน · หัวเรื่องตัวหนา · รายละเอียด · ปุ่มแก้ */
export function DetailCallout({
  tone = "warning",
  icon: Icon,
  title,
  children,
  action,
  role,
}: {
  tone?: keyof typeof CALLOUT_TONE;
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  role?: "alert" | "note";
}) {
  return (
    <div
      role={role}
      className={cn(CALLOUT_TONE[tone], "flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-xl border px-3.5 py-2.5 text-sm")}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span className="min-w-0 flex-1 basis-48 text-strong [overflow-wrap:anywhere]">
        <span className="font-semibold">{title}</span>
        {children ? <span> · {children}</span> : null}
      </span>
      {action}
    </div>
  );
}
