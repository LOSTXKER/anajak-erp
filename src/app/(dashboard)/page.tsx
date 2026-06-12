"use client";

import Link from "next/link";
import {
  ShoppingCart,
  Users,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/ui/section";
import { StatCard } from "@/components/ui/stat-card";

/**
 * การ์ดเล็กของแถบ "5 ตัวเลขเจ้าของ" — หน้าตาเดียวกับ StatCard แต่ย่อส่วน
 * กดได้ทั้งใบ + เน้นสีตัวเลขได้ (StatCard เดิมไม่รองรับทั้งสองอย่าง)
 */
function PulseCard({
  href,
  title,
  value,
  tone,
  sub,
  subTone,
  className,
}: {
  href: string;
  title: string;
  value: string | number;
  /** สีเน้นตัวเลขหลัก — "muted" = ศูนย์จริง โชว์สีจาง (ไม่ซ่อน) */
  tone?: "danger" | "warning" | "muted";
  sub: string;
  subTone?: "danger" | "warning";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-2xl border border-slate-200/70 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800/60 dark:bg-slate-900/80 dark:hover:border-slate-700 dark:hover:bg-slate-900",
        className
      )}
    >
      <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold leading-none tracking-tight tabular-nums",
          tone === "danger"
            ? "text-red-600 dark:text-red-400"
            : tone === "warning"
              ? "text-amber-600 dark:text-amber-400"
              : tone === "muted"
                ? "text-slate-300 dark:text-slate-600"
                : "text-slate-900 dark:text-white"
        )}
      >
        {value}
      </p>
      <p
        className={cn(
          "mt-1.5 text-[12px]",
          subTone === "danger"
            ? "text-red-600 dark:text-red-400"
            : subTone === "warning"
              ? "text-amber-600 dark:text-amber-400"
              : "text-slate-400 dark:text-slate-500"
        )}
      >
        {sub}
      </p>
    </Link>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = trpc.analytics.dashboard.useQuery();
  // 5 ตัวเลขเจ้าของ — gate ฝั่ง server (OWNER/MANAGER) · role อื่นโดน FORBIDDEN → ไม่โชว์ section นี้เลย
  const { data: pulse } = trpc.analytics.ownerPulse.useQuery(undefined, {
    retry: false,
  });
  // server ส่ง field การเงินเป็น null สำหรับ role ที่ไม่ใช่ฝั่งบริหาร-บัญชี
  const canSeeFinance = data ? data.revenueThisMonth !== null : true;

  if (isLoading) {
    return (
      <div className="space-y-8">
        <PageHeader title="Dashboard" description="ภาพรวมระบบ Anajak Print" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200/70 bg-white p-5 dark:border-slate-800/60 dark:bg-slate-900/80"
            >
              <Skeleton className="mb-3 h-3 w-24" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="ภาพรวมระบบ Anajak Print" />

      {pulse && (
        <Section title="เช้านี้ใน 10 วินาที" bordered={false} compact>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <PulseCard
              href="/orders"
              title="งานเสี่ยงเลยกำหนด"
              value={pulse.atRiskOrders.overdue}
              tone={pulse.atRiskOrders.overdue > 0 ? "danger" : "muted"}
              sub={`ใกล้ถึงใน 48 ชม. ${pulse.atRiskOrders.dueSoon}`}
            />
            <PulseCard
              href="/outsource"
              title="ค้างร้านนอก"
              value={pulse.outsource.pending}
              tone={pulse.outsource.pending === 0 ? "muted" : undefined}
              sub={`เลยกำหนดรับ ${pulse.outsource.overduePickup}`}
              subTone={pulse.outsource.overduePickup > 0 ? "danger" : undefined}
            />
            {/* open = ขั้นค้างทั้งระบบ ไม่ใช่ของวันนี้ — ห้ามเอามารวมเป็นตัวส่วน
                ของ done (สื่อผิดว่า "วันนี้ต้องทำอีกเท่านี้") · แยกเป็นบรรทัดรองแทน */}
            <PulseCard
              href="/production"
              title="เสร็จวันนี้"
              value={pulse.todayQueue.done}
              tone={pulse.todayQueue.done === 0 ? "muted" : undefined}
              sub={`ค้างทั้งหมด ${pulse.todayQueue.open} ขั้น`}
            />
            <PulseCard
              href="/billing"
              title="เงินรอเก็บ"
              value={pulse.money.overdueInvoices}
              tone={pulse.money.overdueInvoices === 0 ? "muted" : undefined}
              sub={`บิลเลยกำหนด · ใบเสนอค้างตอบ ${pulse.money.quotationsAwaiting}`}
            />
            <PulseCard
              href="/orders"
              title="งานติดหล่ม"
              value={pulse.stuckOrders}
              tone={pulse.stuckOrders > 0 ? "warning" : "muted"}
              sub="เงียบเกิน 3 วัน"
              className="col-span-2 lg:col-span-1"
            />
          </div>
        </Section>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="ออเดอร์กำลังดำเนินการ"
          value={data?.activeOrders ?? 0}
          icon={ShoppingCart}
        />
        {canSeeFinance && (
          <StatCard
            title="รายได้เดือนนี้"
            value={formatCurrency(data?.revenueThisMonth ?? 0)}
            icon={TrendingUp}
            change={data?.revenueChange ?? undefined}
          />
        )}
        <StatCard
          title="ลูกค้าทั้งหมด"
          value={data?.totalCustomers ?? 0}
          icon={Users}
          caption={
            data?.newCustomersThisMonth
              ? `+${data.newCustomersThisMonth} เดือนนี้`
              : undefined
          }
        />
        {canSeeFinance && (
          <StatCard
            title="บิลค้างชำระ"
            value={data?.overdueInvoices ?? 0}
            icon={AlertCircle}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="สถานะออเดอร์" bordered>
          <div className="space-y-2.5">
            {data?.ordersByStatus?.map((item) => (
              <div
                key={item.status}
                className="flex items-center justify-between"
              >
                <OrderStatusBadge internalStatus={item.status} compact />
                <span className="text-sm font-medium tabular-nums text-slate-900 dark:text-white">
                  {item.count}
                </span>
              </div>
            ))}
            {(!data?.ordersByStatus || data.ordersByStatus.length === 0) && (
              <p className="text-sm text-slate-400">ยังไม่มีออเดอร์</p>
            )}
          </div>
        </Section>

        {canSeeFinance && (
        <Section title="ลูกค้ายอดสั่งสูงสุด" bordered>
          <div className="space-y-3">
            {data?.topCustomers?.map((customer, index) => (
              <div
                key={customer.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                      {customer.name}
                    </p>
                    {customer.company && (
                      <p className="truncate text-xs text-slate-400">
                        {customer.company}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium tabular-nums text-slate-900 dark:text-white">
                    {formatCurrency(customer.totalSpent)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {customer.totalOrders} ออเดอร์
                  </p>
                </div>
              </div>
            ))}
            {(!data?.topCustomers || data.topCustomers.length === 0) && (
              <p className="text-sm text-slate-400">ยังไม่มีข้อมูลลูกค้า</p>
            )}
          </div>
        </Section>
        )}
      </div>
    </div>
  );
}
