"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  Users,
  TrendingUp,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { cn, formatCurrency } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/ui/section";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { permAllows } from "@/lib/permissions";

/**
 * การ์ดเล็กของแถบ "5 ตัวเลขเจ้าของ" — หน้าตาเดียวกับ StatCard แต่ย่อส่วน
 * ตัวเลขหลัก/รองแยกปลายทางได้ และไม่สร้างลิงก์เมื่อยังไม่มี filter ที่ตรงกับตัวเลข
 */
function PulseCard({
  href,
  subHref,
  title,
  value,
  tone,
  sub,
  subTone,
  className,
}: {
  href?: string;
  subHref?: string;
  title: string;
  value: string | number;
  /** สีเน้นตัวเลขหลัก — "muted" = ศูนย์จริง โชว์สีจาง (ไม่ซ่อน) */
  tone?: "danger" | "warning" | "muted";
  sub: string;
  subTone?: "danger" | "warning";
  className?: string;
}) {
  const titleAndValue = (
    <>
      <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <p
        className={cn(
          "mt-2 text-[28px] font-semibold leading-none tracking-tight tabular-nums",
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
    </>
  );
  const subClassName = cn(
    "text-[12px]",
    subTone === "danger"
      ? "text-red-600 dark:text-red-400"
      : subTone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-slate-500 dark:text-slate-400"
  );

  return (
    <div
      className={cn(
        "rounded-2xl card-surface p-4",
        (href || subHref) && "card-surface-hover",
        className
      )}
    >
      {href ? (
        <Link
          href={href}
          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
          aria-label={`ดูรายการ ${title}: ${value}`}
        >
          {titleAndValue}
        </Link>
      ) : (
        <div>{titleAndValue}</div>
      )}

      {subHref ? (
        <Link
          href={subHref}
          className={cn(
            "mt-1 inline-flex min-h-11 items-center gap-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 sm:min-h-8",
            subClassName
          )}
        >
          {sub}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ) : (
        <p className={cn("mt-1.5", subClassName)}>{sub}</p>
      )}
    </div>
  );
}

function KpiDrilldown({
  href,
  label,
  children,
}: {
  href?: string;
  label: string;
  children: ReactNode;
}) {
  if (!href) return children;

  return (
    <Link
      href={href}
      aria-label={label}
      className="block h-full rounded-2xl transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
    >
      {children}
    </Link>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = trpc.analytics.dashboard.useQuery();
  const { data: me } = trpc.user.me.useQuery();
  // 5 ตัวเลขเจ้าของ — gate ฝั่ง server (OWNER/MANAGER) · role อื่นโดน FORBIDDEN → ไม่โชว์ section นี้เลย
  const { data: pulse } = trpc.analytics.ownerPulse.useQuery(undefined, {
    retry: false,
  });
  // server ส่ง field การเงินเป็น null สำหรับ role ที่ไม่ใช่ฝั่งบริหาร-บัญชี
  const canSeeFinance = data ? data.revenueThisMonth !== null : true;
  // Owner Pulse เปิดแยกด้วย view_admin_reports ได้ จึงต้อง gate ปลายทางเงินตามสิทธิ์จริงอีกชั้น
  const canViewBilling = permAllows(me?.permissions, "manage_billing_docs");
  const canViewQuotations = permAllows(me?.permissions, "see_order_money");

  if (isLoading) {
    return (
      <div className="space-y-8">
        <PageHeader title="แดชบอร์ด" description="ภาพรวมระบบ Anajak Print" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="card-surface rounded-2xl p-5"
            >
              <Skeleton className="mb-3 h-3 w-24" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // query หลักพัง — ตัดจบทั้งหน้า กัน StatCard โชว์เลขศูนย์หลอกๆ
  if (isError) return <QueryError onRetry={() => refetch()} />;

  const today = new Date();

  return (
    <div className="space-y-8">
      <PageHeader
        title="แดชบอร์ด"
        description={`ภาพรวมระบบ Anajak Print · ${today.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}
      />

      {pulse && (
        <Section
          title="เช้านี้ใน 10 วินาที"
          bordered={false}
          compact
          action={
            <Badge variant="default" size="sm">
              อัปเดต{" "}
              {today.toLocaleTimeString("th-TH", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              น.
            </Badge>
          }
        >
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <PulseCard
              href="/orders?attention=overdue"
              subHref="/orders?attention=due-soon"
              title="งานเสี่ยงเลยกำหนด"
              value={pulse.atRiskOrders.overdue}
              tone={pulse.atRiskOrders.overdue > 0 ? "danger" : "muted"}
              sub={`ใกล้ถึงใน 48 ชม. ${pulse.atRiskOrders.dueSoon}`}
            />
            <PulseCard
              title="ค้างร้านนอก"
              value={pulse.outsource.pending}
              tone={pulse.outsource.pending === 0 ? "muted" : undefined}
              sub={`เลยกำหนดรับ ${pulse.outsource.overduePickup}`}
              subTone={pulse.outsource.overduePickup > 0 ? "danger" : undefined}
            />
            {/* open = ขั้นค้างทั้งระบบ ไม่ใช่ของวันนี้ — ห้ามเอามารวมเป็นตัวส่วน
                ของ done (สื่อผิดว่า "วันนี้ต้องทำอีกเท่านี้") · แยกเป็นบรรทัดรองแทน */}
            <PulseCard
              title="เสร็จวันนี้"
              value={pulse.todayQueue.done}
              tone={pulse.todayQueue.done === 0 ? "muted" : undefined}
              sub={`ค้างทั้งหมด ${pulse.todayQueue.open} ขั้น`}
            />
            <PulseCard
              href={canViewBilling ? "/billing?status=OVERDUE" : undefined}
              subHref={canViewQuotations ? "/quotations?status=SENT" : undefined}
              title="บิลเลยกำหนด"
              value={pulse.money.overdueInvoices}
              tone={pulse.money.overdueInvoices === 0 ? "muted" : undefined}
              sub={`ใบเสนอค้างตอบ ${pulse.money.quotationsAwaiting}`}
            />
            <PulseCard
              href="/orders?attention=stuck"
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
        <KpiDrilldown href="/customers" label="ดูรายชื่อลูกค้าทั้งหมด">
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
        </KpiDrilldown>
        {canSeeFinance && (
          <KpiDrilldown
            href={canViewBilling ? "/billing?status=OVERDUE" : undefined}
            label="ดูรายการบิลค้างชำระ"
          >
            <StatCard
              title="บิลค้างชำระ"
              value={data?.overdueInvoices ?? 0}
              icon={AlertCircle}
            />
          </KpiDrilldown>
        )}
      </div>

      {data?.recentOrders && data.recentOrders.length > 0 && (
        <Section
          title="ออเดอร์ล่าสุด"
          bordered
          flush
          action={
            <Link
              href="/orders"
              className="text-[13px] font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400"
            >
              ดูทั้งหมด
            </Link>
          }
        >
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {data.recentOrders.map((o) => (
              <Link
                key={o.id}
                href={`/orders/${o.id}`}
                className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13.5px] font-semibold tabular-nums text-slate-900 dark:text-white">
                      {o.orderNumber}
                    </p>
                    {o.printLabel && (
                      <Badge variant="accent" size="sm">
                        {o.printLabel}
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-[12px] text-slate-500 dark:text-slate-400">
                    {o.customerName} · {o.title}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {o.totalAmount != null && (
                    <p className="text-[13.5px] font-semibold tabular-nums text-slate-900 dark:text-white">
                      {formatCurrency(o.totalAmount)}
                    </p>
                  )}
                  {o.deadline && (
                    <p className="text-[11.5px] text-slate-400 dark:text-slate-500">
                      กำหนด{" "}
                      {new Date(o.deadline).toLocaleDateString("th-TH", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  )}
                </div>
                <div className="hidden w-28 shrink-0 sm:block">
                  <OrderStatusBadge
                    customerStatus={o.customerStatus}
                    internalStatus={o.internalStatus}
                    compact
                  />
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="สถานะออเดอร์" bordered>
          <div className="space-y-2.5">
            {data?.ordersByStatus?.map((item) => (
              <Link
                key={item.status}
                href={`/orders?status=${item.status}`}
                className="flex min-h-11 items-center justify-between rounded-lg px-2 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-slate-800/40"
              >
                <OrderStatusBadge internalStatus={item.status} compact />
                <span className="text-sm font-medium tabular-nums text-slate-900 dark:text-white">
                  {item.count}
                </span>
              </Link>
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
              <Link
                key={customer.id}
                href={`/customers/${customer.id}`}
                className="flex min-h-11 items-center justify-between rounded-lg px-2 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-slate-800/40"
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
              </Link>
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
