"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { cn, formatCurrency } from "@/lib/utils";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
import {
  TrendingUp,
  Users,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Section } from "@/components/ui/section";



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
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section
          title="รายได้ 6 เดือนย้อนหลัง"
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
            <div className="space-y-3">
              {revenueData.map((item) => {
                const width =
                  maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;
                return (
                  <div key={item.month} className="space-y-1">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-xs text-muted">
                        {item.month}
                      </span>
                      <span className="font-medium tabular-nums text-strong">
                        {formatCurrency(item.revenue)}
                        <span className="ml-1 text-xs font-normal text-muted">
                          ({item.orders} ออเดอร์)
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-[width] duration-[var(--duration-base)] ease-out"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section title="ลูกค้ายอดสูงสุด" icon={Users} tone="brand" bordered>
          <div className="space-y-3">
            {dashboard?.topCustomers?.map((c, i) => (
              <Link key={c.id} href={`/customers/${c.id}`} className={cn("flex min-h-11 items-center justify-between gap-4 rounded-lg hover:bg-interactive-hover", FOCUS_BUTTON)}>
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
      </div>
    </PageShell>
  );
}
