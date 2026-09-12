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
  LayoutGrid,
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
} from "@/components/ui/tokens";
import { VISUAL_TONE_CLASSES, type VisualTone } from "@/lib/visual-tone";

const ATTENTION_ICONS: Record<DashboardAttentionKind, ComponentType<{ className?: string }>> = {
  "overdue-order": CalendarClock,
  "due-soon": Hourglass,
  outsource: Truck,
  stuck: AlertTriangle,
  "overdue-invoice": ReceiptText,
  quotation: ClipboardList,
};

const PANEL =
  "rounded-2xl border border-slate-200 bg-surface shadow-[0_3px_14px_-8px_rgba(15,23,42,0.18)] dark:border-slate-700/70";

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}

function AttentionRow({ item, emphasized = false }: { item: DashboardAttentionItem; emphasized?: boolean }) {
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
        "group flex items-center gap-3 rounded-xl border transition-colors",
        emphasized ? "col-span-full p-4 sm:gap-4 sm:p-5" : "bg-surface p-3",
        emphasized && (danger ? "bg-red-50/70 dark:bg-red-950/30" : "bg-amber-50/70 dark:bg-amber-950/30"),
        danger
          ? emphasized
            ? "border-red-300 hover:border-red-400 dark:border-red-800 dark:hover:border-red-700"
            : "border-red-200/80 hover:border-red-300 dark:border-red-900/70 dark:hover:border-red-700"
          : "border-amber-200/80 hover:border-amber-300 dark:border-amber-900/60 dark:hover:border-amber-700",
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl border",
          emphasized ? "h-12 w-12" : "h-9 w-9",
          danger
            ? "border-red-100 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
            : "border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
        )}
      >
        <Icon className={emphasized ? "h-6 w-6" : "h-[18px] w-[18px]"} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("break-words font-semibold text-strong", emphasized ? "text-base" : "text-sm")}>{item.title}</p>
        {item.kind === "outsource" && danger && item.detail && (
          <p className="mt-1 text-xs leading-relaxed text-muted group-hover:text-secondary group-active:text-secondary">{item.detail}</p>
        )}
      </div>
      <span
        className={cn(
          "min-w-8 text-right font-semibold tabular-nums",
          emphasized ? "text-4xl" : "text-2xl",
          danger ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400",
        )}
      >
        {item.count}
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted transition-transform motion-safe:group-hover:translate-x-0.5" />
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
  return (
    <section className={cn(PANEL, "@container overflow-hidden lg:col-span-2")} aria-labelledby="dashboard-attention-title">
      <header className="flex items-center justify-between gap-4 bg-blue-950 px-5 py-5 text-white sm:px-6 sm:py-6 dark:bg-blue-950/70">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 sm:h-12 sm:w-12" aria-hidden="true">
            {allowed ? <CalendarClock className="h-6 w-6" /> : <UserRoundCheck className="h-6 w-6" />}
          </span>
          <h2 id="dashboard-attention-title" className="text-xl font-semibold sm:text-2xl">
            {allowed ? "ต้องเช็กก่อน" : "คิวงานของคุณ"}
          </h2>
        </div>
      </header>
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
      ) : items.length === 0 ? (
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
        <div className="grid gap-2.5 bg-slate-50/70 p-3 @[35rem]:grid-cols-2 sm:p-4 dark:bg-slate-950/20">
          {items.map((item, index) => (
            <AttentionRow key={item.kind} item={item} emphasized={index === 0} />
          ))}
        </div>
      )}
    </section>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  primary,
  tone,
  wide,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  primary?: boolean;
  wide?: boolean;
  /** สีของหมวดที่ทางลัดนี้พาไป — ตรงกับสีในเมนูซ้ายและหัวหน้าปลายทาง */
  tone?: VisualTone;
}) {
  return (
    <Link
      href={href}
      className={cn(
        CONTROL_MIN_H,
        FOCUS_BUTTON,
        "group flex min-h-28 flex-col items-start justify-between gap-4 rounded-xl border p-4 transition-colors",
        wide && "col-span-2",
        primary
          ? "border-blue-600 bg-blue-600 text-white shadow-sm hover:border-blue-700 hover:bg-blue-700 active:bg-blue-800"
          : cn("border-slate-200 bg-surface hover:border-blue-300 dark:border-slate-700 dark:hover:border-blue-700", INTERACTIVE_HOVER, INTERACTIVE_PRESSED, "text-secondary"),
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          primary
            ? "bg-white/15 text-white"
            : tone
              ? VISUAL_TONE_CLASSES[tone].soft
              : "bg-surface-muted text-secondary",
        )}
        aria-hidden="true"
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 text-pretty text-sm font-semibold">
        {label}
      </span>
    </Link>
  );
}

function Metric({
  label,
  value,
  note,
  icon: Icon,
  tone,
  amount = false,
}: {
  label: string;
  value: ReactNode;
  note?: string;
  icon?: ComponentType<{ className?: string }>;
  tone?: VisualTone;
  amount?: boolean;
}) {
  return (
    <div className={cn(PANEL, "@container relative min-w-0 p-4 sm:p-5")}>
      <div className="flex items-start justify-between gap-3">
        <p className="pt-1 text-xs font-medium leading-relaxed text-secondary">{label}</p>
        {Icon && tone && (
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", VISUAL_TONE_CLASSES[tone].soft)} aria-hidden="true">
            <Icon className="h-4.5 w-4.5" />
          </span>
        )}
      </div>
      <p
        className={cn(
          "mt-3 font-semibold tabular-nums",
          amount
            ? "whitespace-nowrap text-[clamp(0.9375rem,13cqi,1.5rem)]"
            : "break-words text-2xl sm:text-3xl",
          tone ? VISUAL_TONE_CLASSES[tone].text : "text-strong",
        )}
      >
        {value}
      </p>
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
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
    <div className="-mx-4 -mt-5 bg-slate-100/70 px-4 pb-6 pt-5 dark:bg-slate-950/40 sm:-mx-6 sm:-mt-7 sm:px-6 sm:pt-7 lg:-mx-8 lg:px-8">
      <PageShell
        className="mx-auto max-w-6xl"
        title="ภาพรวมวันนี้"
        icon={LayoutGrid}
        tone="brand"
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
        <div className="grid items-start gap-5 lg:grid-cols-3">
          <AttentionPanel
            allowed={canViewPulse}
            loading={!pulseQuery.data && (pulseQuery.isLoading || pulseQuery.isFetching)}
            error={pulseQuery.isError}
            onRetry={() => void pulseQuery.refetch()}
            items={attentionItems}
          />

          <Section title="ทางลัด" surface="card" flush className={PANEL}>
            <div className="grid grid-cols-2 gap-3 p-4">
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
                tone="brand"
                wide={!canCreateOrder}
              />
              <QuickLink
                href="/production"
                icon={Factory}
                label="การผลิต"
                tone="production"
              />
              <QuickLink
                href={canViewBilling ? "/billing" : "/customers"}
                icon={canViewBilling ? FileClock : Users}
                label={canViewBilling ? "บิล" : "ลูกค้า"}
                tone={canViewBilling ? "finance" : "brand"}
              />
            </div>
          </Section>
        </div>

        <Section aria-label="ตัวเลขภาพรวม" bordered={false} surface="plain" flush>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Metric label="ออเดอร์กำลังเดิน" value={data?.activeOrders ?? 0} icon={ShoppingCart} tone="brand" />
            <Metric label="ปิดงานเดือนนี้" value={data?.completedThisMonth ?? 0} icon={CheckCircle2} tone="production" />
            <Metric label="ลูกค้าทั้งหมด" value={data?.totalCustomers ?? 0} icon={Users} tone="brand" note={data?.newCustomersThisMonth ? `+${data.newCustomersThisMonth} เดือนนี้` : undefined} />
            {data?.revenueThisMonth != null ? (
              <Metric label="มูลค่าออเดอร์ที่เปิดเดือนนี้" value={formatBaht(data.revenueThisMonth)} icon={ReceiptText} tone="finance" amount />
            ) : canViewPulse ? (
              <Metric
                label="ขั้นผลิตค้างทั้งหมด"
                value={pulseQuery.data?.todayQueue.open ?? "—"}
                icon={Factory}
                tone="production"
              />
            ) : (
              <QuickLink href="/my-tasks" icon={UserRoundCheck} label="เปิดงานที่ต้องทำและติดตาม" tone="brand" />
            )}
          </div>
        </Section>

        <Section
          title="ออเดอร์ล่าสุด"
          flush
          className={PANEL}
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
                    "group grid gap-3 px-4 py-4 transition-colors sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-5",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold tabular-nums text-strong">{order.orderNumber}</p>
                      {order.printLabel && (
                        <Badge variant="default" size="sm">{order.printLabel}</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-secondary group-hover:text-strong group-active:text-strong">
                      {order.customerName}
                    </p>
                    {order.deadline && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted group-hover:text-secondary group-active:text-secondary">
                        <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        กำหนด {formatDateShort(order.deadline)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-divider pt-3 sm:justify-end sm:border-0 sm:pt-0">
                    <OrderStatusBadge
                      customerStatus={order.customerStatus}
                      internalStatus={order.internalStatus}
                      compact
                      subClassName="group-hover:text-secondary group-active:text-secondary dark:group-hover:text-secondary dark:group-active:text-secondary"
                    />
                    {order.totalAmount != null && (
                      <p className="text-base font-semibold tabular-nums text-strong sm:min-w-28 sm:text-right">{formatBaht(order.totalAmount)}</p>
                    )}
                  </div>
                  <ArrowRight className="hidden h-4 w-4 text-muted transition-transform motion-safe:group-hover:translate-x-0.5 sm:block" />
                </Link>
              ))}
            </div>
          )}
        </Section>

      </PageShell>
    </div>
  );
}
