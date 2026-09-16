"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { cn, formatCurrency } from "@/lib/utils";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
import { CircleCheck, Shirt, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Section } from "@/components/ui/section";
import { StatCard } from "@/components/ui/stat-card";



export default function AnalyticsPage() {
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  // ปิด query ที่ role ไม่มีสิทธิ์ — กันยิงไปโดน FORBIDDEN + retry ฟรี 3 รอบ
  const canViewRevenue = me ? permAllows(me.permissions, "see_finance") : false;

  const {
    data: dashboard,
    isLoading,
    isError: dashboardError,
    refetch: refetchDashboard,
  } = trpc.analytics.dashboard.useQuery();
  const { data: printMix, isLoading: printMixLoading } = trpc.analytics.printTypeMix.useQuery({ months: 6 });
  const {
    data: revenueData,
    isLoading: revenueLoading,
    isError: revenueError,
    refetch: refetchRevenue,
  } = trpc.analytics.revenueByMonth.useQuery(
    { months: 6 },
    { enabled: canViewRevenue }
  );

  const maxRevenue = Math.max(
    ...((revenueData ?? []).map((r) => r.revenue) ?? [1]),
    1
  );

  return (
    <PageShell
      title="รายงาน"
      meta="ภาพรวมยอดขายและลูกค้า 6 เดือนล่าสุด"
      loading={isLoading || meQuery.isLoading}
      skeleton={
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      }
      // เฉพาะ query แกนหน้าพัง → error ทั้งหน้า · กราฟรายได้พังแยกเป็นราย section
      // ด้านล่าง (เหมือน audit log) — ไม่ดับสถิติส่วนที่ยังโหลดได้ (review จับ)
      error={
        meQuery.isError && !me
          ? { message: "โหลดสิทธิ์รายงานไม่สำเร็จ", onRetry: () => meQuery.refetch() }
          : dashboardError
          ? { message: "เกิดข้อผิดพลาดในการโหลดข้อมูล", onRetry: () => refetchDashboard() }
          : null
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          loading={isLoading}
          moduleTone="finance"
          title="ยอดขายเดือนนี้"
          value={canViewRevenue ? formatCurrency(dashboard?.revenueThisMonth ?? 0) : "—"}
          icon={TrendingUp}
          caption={
            canViewRevenue && typeof dashboard?.revenueChange === "number"
              ? `${dashboard.revenueChange >= 0 ? "+" : ""}${dashboard.revenueChange.toLocaleString("th-TH")}% จากเดือนก่อน`
              : undefined
          }
        />
        <StatCard
          loading={isLoading}
          moduleTone="brand"
          title="ออเดอร์ที่กำลังเดิน"
          value={dashboard?.activeOrders ?? 0}
          icon={ShoppingCart}
          caption="ออเดอร์"
        />
        <StatCard
          loading={isLoading}
          moduleTone="brand"
          title="ปิดงานเดือนนี้"
          value={dashboard?.completedThisMonth ?? 0}
          icon={CircleCheck}
          caption="ออเดอร์"
        />
        <StatCard
          loading={isLoading}
          moduleTone="brand"
          title="ลูกค้าทั้งหมด"
          value={dashboard?.totalCustomers ?? 0}
          icon={Users}
          caption={`ใหม่เดือนนี้ ${(dashboard?.newCustomersThisMonth ?? 0).toLocaleString("th-TH")}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section
          title="ยอดขาย 6 เดือนย้อนหลัง"
          icon={TrendingUp}
          tone="finance"
          bordered
        >
          {!canViewRevenue ? (
            <p className="text-sm text-muted">
              ต้องมีสิทธิ์ &quot;เห็นทุน/กำไร/รายงานการเงิน&quot; — เช็คสิทธิ์ที่ ตั้งค่า → ผู้ใช้
            </p>
          ) : revenueLoading ? (
            <div role="status" aria-label="กำลังโหลดรายได้รายเดือน" className="space-y-4">
              {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-8 w-full" />)}
            </div>
          ) : revenueError ? (
            <QueryError
              message="โหลดข้อมูลรายได้ไม่สำเร็จ"
              onRetry={() => refetchRevenue()}
            />
          ) : !revenueData || revenueData.length === 0 ? (
            <p className="text-sm text-muted">ยังไม่มีข้อมูล</p>
          ) : (
            <div className="flex items-end gap-2.5 pt-2" role="img" aria-label="ยอดขายรายเดือน 6 เดือนล่าสุด">
              {revenueData.map((item) => {
                const height = maxRevenue > 0 ? Math.max(8, (item.revenue / maxRevenue) * 130) : 8;
                return (
                  <div key={item.month} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                    <span className="text-2xs tabular-nums text-secondary">
                      {Math.round(item.revenue / 1000).toLocaleString("th-TH")}
                    </span>
                    <span
                      className="w-full max-w-11 rounded-t-lg rounded-b bg-blue-600 transition-[height] duration-[var(--duration-base)] ease-out"
                      style={{ height: `${height}px` }}
                    />
                    <span className="truncate text-xs text-muted">{item.month}</span>
                    <span className="text-2xs tabular-nums text-muted">{item.orders} ใบ</span>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section title="ลูกค้ายอดสูงสุด" icon={Users} tone="brand" bordered>
          <div className="space-y-3">
            {dashboard?.topCustomers?.map((c, i) => (
              <Link key={c.id} href={`/customers/${c.id}`} className={cn("flex min-h-11 items-center justify-between gap-4 rounded-lg", FOCUS_BUTTON)}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium dark:bg-slate-800">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    {c.company && (
                      <p className="truncate text-xs text-muted">
                        {c.company}
                      </p>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {formatCurrency(c.totalSpent)}
                </span>
              </Link>
            ))}
            {(!dashboard?.topCustomers ||
              dashboard.topCustomers.length === 0) && (
              <p className="text-sm text-muted">
                {canViewRevenue
                  ? "ยังไม่มีข้อมูล"
                  : "ต้องมีสิทธิ์ 'เห็นทุน/กำไร/รายงานการเงิน'"}
              </p>
            )}
          </div>
        </Section>

        <Section title="งานที่ขายดี" icon={Shirt} tone="production" bordered>
          {printMixLoading ? (
            <div role="status" aria-label="กำลังโหลดสัดส่วนงาน" className="space-y-3">
              {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-6 w-full" />)}
            </div>
          ) : !printMix || printMix.rows.length === 0 ? (
            <p className="text-sm text-muted">ยังไม่มีงานในช่วง 6 เดือนล่าสุด</p>
          ) : (
            <div className="space-y-3">
              {printMix.rows.map((row) => (
                <div key={row.type} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-sm text-strong">{row.label}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                    <span
                      className="block h-full rounded-full bg-blue-600"
                      style={{ width: `${row.share}%` }}
                    />
                  </span>
                  <span className="w-24 shrink-0 text-right text-sm tabular-nums text-secondary">
                    {row.quantity.toLocaleString("th-TH")} ตัว
                  </span>
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted">{row.share}%</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </PageShell>
  );
}
