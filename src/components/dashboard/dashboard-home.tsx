"use client";

import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Factory,
  FileClock,
  Hourglass,
  Plus,
  ReceiptText,
  ShoppingCart,
  Truck,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { canCreateOrderWithPricing } from "@/lib/order-access";
import { permAllows } from "@/lib/permissions";
import { cn, formatBaht, formatDateShort } from "@/lib/utils";
import {
  buildDashboardAttentionItems,
  type DashboardAttentionItem,
  type DashboardAttentionKind,
} from "@/lib/dashboard";
import { PageShell } from "@/components/page-shell";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import {
  FOCUS_BUTTON,
  FOCUS_INSET,
  INTERACTIVE_HOVER,
  INTERACTIVE_PRESSED,
  RADIUS,
} from "@/components/ui/tokens";

const ATTENTION_ICONS: Record<DashboardAttentionKind, ComponentType<{ className?: string }>> = {
  "overdue-order": CalendarClock,
  "due-soon": Hourglass,
  outsource: Truck,
  stuck: AlertTriangle,
  "overdue-invoice": ReceiptText,
  quotation: ClipboardList,
};

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-lg lg:col-span-2" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
      <Skeleton className="h-32 rounded-lg" />
      <Skeleton className="h-80 rounded-lg" />
    </div>
  );
}

function AttentionRow({ item }: { item: DashboardAttentionItem }) {
  const Icon = ATTENTION_ICONS[item.kind];
  const danger = item.tone === "danger";

  return (
    <Link
      href={item.href}
      className={cn(
        CONTROL_MIN_H,
        FOCUS_INSET,
        INTERACTIVE_HOVER,
        INTERACTIVE_PRESSED,
        "group flex items-center gap-3 px-5 py-3 transition-colors",
      )}
    >
      <div
        className={cn(
          RADIUS.inner,
          "flex h-10 w-10 shrink-0 items-center justify-center",
          danger
            ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
            : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-strong">{item.title}</p>
        {item.kind === "outsource" && item.detail.startsWith("เลยกำหนด") && (
          <p className="truncate text-xs text-muted group-hover:text-secondary group-active:text-secondary">{item.detail}</p>
        )}
      </div>
      <span
        className={cn(
          "text-xl font-semibold tabular-nums",
          danger ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400",
        )}
      >
        {item.count}
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function AttentionPanel({
  allowed,
  loading,
  error,
  onRetry,
  items,
}: {
  allowed: boolean;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  items: DashboardAttentionItem[];
}) {
  const visible = items.slice(0, 5);
  const hidden = Math.max(items.length - visible.length, 0);

  return (
    <Section
      title={allowed ? "ต้องเช็กก่อน" : "คิวงานของคุณ"}
      flush
      surface="card"
      className="overflow-hidden lg:col-span-2"
      action={
        allowed && !loading && !error ? (
          <Badge variant={items.length > 0 ? "warning" : "success"} size="sm">
            {items.length > 0 ? `${items.length} เรื่อง` : "เรียบร้อย"}
          </Badge>
        ) : undefined
      }
    >
      {!allowed ? (
        <div className="p-5">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/my-tasks">
              เปิดคิวงาน
              <ArrowRight />
            </Link>
          </Button>
        </div>
      ) : loading ? (
        <div className="space-y-1 p-5">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <QueryError message="โหลดรายการที่ต้องเช็กไม่สำเร็จ" onRetry={onRetry} />
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <p className="mt-4 text-sm font-semibold text-strong">ยังไม่มีเรื่องเสี่ยงที่ต้องรีบแก้</p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/my-tasks">ดูคิวงาน</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="divide-y divide-divider">
            {visible.map((item) => (
              <AttentionRow key={item.kind} item={item} />
            ))}
          </div>
          {hidden > 0 && (
            <div className="border-t border-divider px-5 py-2">
              <Button asChild variant="ghost" size="sm" className="w-full">
                <Link href="/my-tasks">ดูงานอื่นอีก {hidden} เรื่อง</Link>
              </Button>
            </div>
          )}
        </>
      )}
    </Section>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  primary,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        CONTROL_MIN_H,
        FOCUS_BUTTON,
        "group flex min-h-16 items-center gap-3 p-3 transition-colors",
        primary
          ? "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
          : cn("bg-surface", INTERACTIVE_HOVER, INTERACTIVE_PRESSED, "text-secondary"),
      )}
    >
      <div
        className={cn(
          RADIUS.item,
          "flex h-9 w-9 shrink-0 items-center justify-center",
          primary ? "bg-white/15" : "bg-surface-muted text-secondary",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <p className="min-w-0 flex-1 text-pretty text-sm font-semibold">
        {label}
      </p>
    </Link>
  );
}

function Metric({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="min-w-0 bg-surface p-4 sm:p-5">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-strong">{value}</p>
      {note && <p className="mt-1 truncate text-xs text-muted">{note}</p>}
    </div>
  );
}

export function DashboardHome() {
  const dashboardQuery = trpc.analytics.dashboard.useQuery();
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const data = dashboardQuery.data;

  const canViewPulse = permAllows(me?.permissions, "view_admin_reports");
  const canCreateOrder = canCreateOrderWithPricing(me?.permissions);
  const canViewBilling = permAllows(me?.permissions, "manage_billing_docs");
  const canViewQuotations = permAllows(me?.permissions, "see_order_money");
  const pulseQuery = trpc.analytics.ownerPulse.useQuery(undefined, {
    enabled: canViewPulse,
    retry: false,
  });

  const attentionItems = pulseQuery.data
    ? buildDashboardAttentionItems(pulseQuery.data, {
        canViewBilling,
        canViewQuotations,
      })
    : [];

  const loading = dashboardQuery.isLoading || meQuery.isLoading;
  const primaryError = dashboardQuery.isError || meQuery.isError || (!loading && (!data || !me));

  const retryPrimary = () => {
    void dashboardQuery.refetch();
    void meQuery.refetch();
  };

  return (
    <PageShell
      className="mx-auto max-w-6xl"
      title="ภาพรวมวันนี้"
      action={
        canCreateOrder ? (
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/orders/new">
              <Plus />
              เปิดงานใหม่
            </Link>
          </Button>
        ) : undefined
      }
      loading={loading}
      skeleton={<DashboardSkeleton />}
      error={
        primaryError
          ? { message: "โหลดพื้นที่ทำงานไม่สำเร็จ", onRetry: retryPrimary }
          : null
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <AttentionPanel
          allowed={canViewPulse}
          loading={!pulseQuery.data && (pulseQuery.isLoading || pulseQuery.isFetching)}
          error={pulseQuery.isError}
          onRetry={() => void pulseQuery.refetch()}
          items={attentionItems}
        />

        <Section title="ทางลัด" compact surface="card" flush>
          <div className="grid grid-cols-2 gap-px bg-divider">
            {canCreateOrder && (
              <QuickLink
                href="/orders/new"
                icon={Plus}
                label="เปิดงาน"
                primary
              />
            )}
            <QuickLink
              href="/my-tasks"
              icon={UserRoundCheck}
              label="งานของฉัน"
              primary={!canCreateOrder}
            />
            <QuickLink
              href="/production"
              icon={Factory}
              label="การผลิต"
            />
            <QuickLink
              href={canViewBilling ? "/billing" : "/customers"}
              icon={canViewBilling ? FileClock : Users}
              label={canViewBilling ? "บิล" : "ลูกค้า"}
            />
          </div>
        </Section>
      </div>

      <Section title="ภาพรวม" compact flush>
        <div className="grid grid-cols-2 gap-px overflow-hidden bg-divider lg:grid-cols-4">
          <Metric label="ออเดอร์กำลังเดิน" value={data?.activeOrders ?? 0} />
          <Metric label="ปิดงานเดือนนี้" value={data?.completedThisMonth ?? 0} />
          <Metric label="ลูกค้าทั้งหมด" value={data?.totalCustomers ?? 0} note={data?.newCustomersThisMonth ? `+${data.newCustomersThisMonth} เดือนนี้` : undefined} />
          {data?.revenueThisMonth != null ? (
            <Metric label="มูลค่าออเดอร์ที่เปิดเดือนนี้" value={formatBaht(data.revenueThisMonth)} />
          ) : (
            <Metric
              label="ขั้นผลิตค้างทั้งหมด"
              value={pulseQuery.data?.todayQueue.open ?? "—"}
            />
          )}
        </div>
      </Section>

      <Section
        title="ออเดอร์ล่าสุด"
        flush
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/orders">
              ดูทั้งหมด
              <ArrowRight />
            </Link>
          </Button>
        }
      >
        {!data?.recentOrders || data.recentOrders.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="ยังไม่มีออเดอร์"
            action={
              canCreateOrder ? (
                <Button asChild>
                  <Link href="/orders/new">เปิดงานแรก</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="divide-y divide-divider">
            {data.recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className={cn(
                  CONTROL_MIN_H,
                  FOCUS_INSET,
                  INTERACTIVE_HOVER,
                  INTERACTIVE_PRESSED,
                  "group grid gap-3 px-5 py-4 transition-colors sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center",
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold tabular-nums text-strong">{order.orderNumber}</p>
                    {order.printLabel && (
                      <Badge variant="default" size="sm">{order.printLabel}</Badge>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted group-hover:text-secondary group-active:text-secondary">
                    {order.customerName} · {order.title}
                  </p>
                  {order.deadline && (
                    <p className="mt-1 text-xs text-muted group-hover:text-secondary group-active:text-secondary">กำหนด {formatDateShort(order.deadline)}</p>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <OrderStatusBadge
                    customerStatus={order.customerStatus}
                    internalStatus={order.internalStatus}
                    compact
                    subClassName="group-hover:text-secondary group-active:text-secondary dark:group-hover:text-secondary dark:group-active:text-secondary"
                  />
                  {order.totalAmount != null && (
                    <p className="text-sm font-medium tabular-nums text-strong">{formatBaht(order.totalAmount)}</p>
                  )}
                </div>
                <ArrowRight className="hidden h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 sm:block" />
              </Link>
            ))}
          </div>
        )}
      </Section>

    </PageShell>
  );
}
