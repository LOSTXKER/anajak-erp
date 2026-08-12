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
  Sparkles,
  Truck,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { resolveV2Href } from "@/lib/v2-navigation";
import { permAllows } from "@/lib/permissions";
import { cn, formatBaht, formatDateShort } from "@/lib/utils";
import {
  buildV2AttentionItems,
  type V2AttentionItem,
  type V2AttentionKind,
} from "@/lib/v2-dashboard";
import { PageShell } from "@/components/page-shell";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import { FOCUS_BUTTON, FOCUS_INSET, RADIUS, SUNK_PANEL, TINT } from "@/components/ui/tokens";

const ATTENTION_ICONS: Record<V2AttentionKind, ComponentType<{ className?: string }>> = {
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
        <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}

function AttentionRow({ item }: { item: V2AttentionItem }) {
  const Icon = ATTENTION_ICONS[item.kind];
  const danger = item.tone === "danger";

  return (
    <Link
      href={resolveV2Href(item.href)}
      className={cn(
        CONTROL_MIN_H,
        FOCUS_INSET,
        "group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-100 dark:hover:bg-white/[0.06]",
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
        <p className="truncate text-xs text-muted">{item.detail}</p>
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
  items: V2AttentionItem[];
}) {
  const visible = items.slice(0, 5);
  const hidden = Math.max(items.length - visible.length, 0);

  return (
    <Section
      title={allowed ? "ต้องเช็กก่อน" : "คิวงานของคุณ"}
      description={
        allowed
          ? "ซ่อนเลขศูนย์และเรียงเรื่องเสี่ยงที่สุดไว้ก่อน"
          : "งานส่วนตัวและคิวทีมเรียงตามความเร่งด่วนไว้แล้ว"
      }
      flush
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
          <div className={cn(RADIUS.inner, SUNK_PANEL, "flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center")}>
            <div className={cn(RADIUS.inner, "flex h-11 w-11 shrink-0 items-center justify-center bg-blue-600 text-white")}>
              <UserRoundCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-strong">เริ่มจากงานที่ต้องรับผิดชอบ</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                ระบบรวมงานผลิต งานออกแบบ และงานติดตามที่ตรงกับสิทธิ์ของคุณไว้หน้าเดียว
              </p>
            </div>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/my-tasks">
                เปิดคิวงาน
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      ) : loading ? (
        <div className="space-y-1 p-5">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-16 rounded-xl" />
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
          <p className="mt-1 text-xs text-muted">ไปต่อจากคิวงานประจำวันได้เลย</p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/my-tasks">ดูคิวงาน</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="divide-y divide-slate-200 dark:divide-white/10">
            {visible.map((item) => (
              <AttentionRow key={item.kind} item={item} />
            ))}
          </div>
          {hidden > 0 && (
            <div className="border-t border-slate-200 px-5 py-2 dark:border-white/10">
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
  description,
  primary,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  description: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        CONTROL_MIN_H,
        FOCUS_BUTTON,
        RADIUS.inner,
        "group flex min-h-20 items-center gap-3 p-3 transition-transform hover:-translate-y-0.5",
        primary
          ? "bg-blue-600 text-white"
          : cn(SUNK_PANEL, "text-secondary hover:text-strong"),
      )}
    >
      <div
        className={cn(
          RADIUS.item,
          "flex h-9 w-9 shrink-0 items-center justify-center",
          primary ? "bg-white/15" : "bg-surface text-blue-600 dark:bg-white/10 dark:text-blue-300",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{label}</p>
        <p className={cn("truncate text-2xs", primary ? "text-white/75" : "text-muted")}>
          {description}
        </p>
      </div>
      <ArrowRight className={cn("h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5", primary ? "text-white/80" : "text-muted")} />
    </Link>
  );
}

function Metric({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="min-w-0 bg-surface p-4 sm:p-5">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-strong">{value}</p>
      {note && <p className="mt-1 truncate text-2xs text-muted">{note}</p>}
    </div>
  );
}

export function V2Dashboard() {
  const dashboardQuery = trpc.analytics.dashboard.useQuery();
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const data = dashboardQuery.data;

  const canViewPulse = permAllows(me?.permissions, "view_admin_reports");
  const canCreateSalesDocs = permAllows(me?.permissions, "create_sales_docs");
  const canViewBilling = permAllows(me?.permissions, "manage_billing_docs");
  const canViewQuotations = permAllows(me?.permissions, "see_order_money");
  const pulseQuery = trpc.analytics.ownerPulse.useQuery(undefined, {
    enabled: canViewPulse,
    retry: false,
  });

  const attentionItems = pulseQuery.data
    ? buildV2AttentionItems(pulseQuery.data, {
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
      title="ภาพรวมวันนี้"
      description="เรื่องที่ควรลงมือก่อน ทางลัด และงานล่าสุด — อยู่ในจอเดียว"
      titleBadge={<Badge variant="accent" size="sm">V2</Badge>}
      action={
        canCreateSalesDocs ? (
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/v2/orders/new">
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

        <Section
          title="ทางลัด"
          description="งานที่เปิดบ่อย ไม่ต้องไล่หาเมนู"
          compact
        >
          <div className="grid grid-cols-2 gap-2">
            {canCreateSalesDocs && (
              <QuickLink
                href="/v2/orders/new"
                icon={Plus}
                label="เปิดงาน"
                description="ลูกค้าใหม่"
                primary
              />
            )}
            <QuickLink
              href="/my-tasks"
              icon={UserRoundCheck}
              label="งานของฉัน"
              description="เรียงให้แล้ว"
              primary={!canCreateSalesDocs}
            />
            <QuickLink
              href="/production"
              icon={Factory}
              label="การผลิต"
              description="ดูทุกเลน"
            />
            <QuickLink
              href={canViewBilling ? "/billing" : "/customers"}
              icon={canViewBilling ? FileClock : Users}
              label={canViewBilling ? "บิล" : "ลูกค้า"}
              description={canViewBilling ? "เอกสารเงิน" : "รายชื่อลูกค้า"}
            />
          </div>
        </Section>
      </div>

      <Section title="ภาพรวม" description="ตัวเลขสะสมไว้ดูทิศ ไม่แย่งเรื่องเร่งด่วน" compact flush>
        <div className="grid grid-cols-2 gap-px overflow-hidden bg-slate-200 dark:bg-white/10 lg:grid-cols-4">
          <Metric label="ออเดอร์กำลังเดิน" value={data?.activeOrders ?? 0} note="ไม่นับงานจบและยกเลิก" />
          <Metric label="ปิดงานเดือนนี้" value={data?.completedThisMonth ?? 0} />
          <Metric label="ลูกค้าทั้งหมด" value={data?.totalCustomers ?? 0} note={data?.newCustomersThisMonth ? `+${data.newCustomersThisMonth} เดือนนี้` : undefined} />
          {data?.revenueThisMonth != null ? (
            <Metric label="มูลค่าออเดอร์ที่เปิดเดือนนี้" value={formatBaht(data.revenueThisMonth)} />
          ) : (
            <Metric
              label="ขั้นผลิตค้างทั้งหมด"
              value={pulseQuery.data?.todayQueue.open ?? "—"}
              note={canViewPulse ? "จากทุกออเดอร์ที่ยังเดิน" : "ดูตามสิทธิ์ของคุณในคิวงาน"}
            />
          )}
        </div>
      </Section>

      <Section
        title="ออเดอร์ล่าสุด"
        description="เปิดต่อจากงานจริงได้ทันที"
        flush
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/v2/orders">
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
            description="เมื่อเปิดงาน รายการล่าสุดจะมาอยู่ตรงนี้"
            action={
              canCreateSalesDocs ? (
                <Button asChild>
                  <Link href="/v2/orders/new">เปิดงานแรก</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-white/10">
            {data.recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/v2/orders/${order.id}`}
                className={cn(
                  CONTROL_MIN_H,
                  FOCUS_INSET,
                  "group grid gap-3 px-5 py-4 transition-colors hover:bg-slate-100 dark:hover:bg-white/[0.06] sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center",
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold tabular-nums text-strong">{order.orderNumber}</p>
                    {order.printLabel && (
                      <Badge variant="accent" size="sm">{order.printLabel}</Badge>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted">
                    {order.customerName} · {order.title}
                  </p>
                  {order.deadline && (
                    <p className="mt-1 text-2xs text-muted">กำหนด {formatDateShort(order.deadline)}</p>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <OrderStatusBadge
                    customerStatus={order.customerStatus}
                    internalStatus={order.internalStatus}
                    compact
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

      <div className={cn(RADIUS.surface, TINT.info, "flex items-start gap-3 border p-4")}>
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold">V2 แยกจากหน้าปัจจุบันโดยสมบูรณ์</p>
          <p className="mt-1 text-2xs leading-relaxed opacity-80">
            ข้อมูลและสิทธิ์เป็นชุดเดียวกัน แต่โครงหน้าตานี้ทดลองได้โดยไม่กระทบงานเดิม
          </p>
        </div>
      </div>
    </PageShell>
  );
}
