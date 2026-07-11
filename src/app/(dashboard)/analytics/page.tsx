"use client";

import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/ui/section";



export default function AnalyticsPage() {
  const { data: me } = trpc.user.me.useQuery();
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
    isError: revenueError,
    refetch: refetchRevenue,
  } = trpc.analytics.revenueByMonth.useQuery(
    { months: 6 },
    { enabled: canViewRevenue }
  );

  if (isLoading) {
    return (
      <div className="space-y-5">
        <PageHeader title="รายงาน" description="แนวโน้มรายได้และลูกค้า" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // เฉพาะ query แกนหน้าพัง → error ทั้งหน้า · กราฟรายได้พังแยกเป็นราย section
  // ด้านล่าง (เหมือน audit log) — ไม่ดับสถิติส่วนที่ยังโหลดได้ (review จับ)
  if (dashboardError) {
    return <QueryError onRetry={() => refetchDashboard()} />;
  }

  const maxRevenue = Math.max(
    ...((revenueData ?? []).map((r) => r.revenue) ?? [1]),
    1
  );

  return (
    <div className="space-y-5">
      <PageHeader title="รายงาน" description="ดูแนวโน้มระยะยาว ส่วนงานเร่งด่วนอยู่ที่ Dashboard" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section
          title={<span className="inline-flex items-center gap-2"><TrendingUp className="h-4 w-4" aria-hidden="true" />รายได้ 6 เดือนย้อนหลัง</span>}
          description="เปรียบเทียบแนวโน้ม ไม่ใช่คิวงานประจำวัน"
          bordered
        >
          {!canViewRevenue ? (
            <p className="text-sm text-slate-400">
              ต้องมีสิทธิ์ &quot;เห็นทุน/กำไร/รายงานการเงิน&quot; — เช็คสิทธิ์ที่ ตั้งค่า → ผู้ใช้
            </p>
          ) : revenueError ? (
            <QueryError
              message="โหลดข้อมูลรายได้ไม่สำเร็จ"
              onRetry={() => refetchRevenue()}
            />
          ) : !revenueData || revenueData.length === 0 ? (
            <p className="text-sm text-slate-400">ยังไม่มีข้อมูล</p>
          ) : (
            <div className="space-y-3">
              {revenueData.map((item) => {
                const width =
                  maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;
                return (
                  <div key={item.month} className="space-y-1">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-xs text-slate-500">
                        {item.month}
                      </span>
                      <span className="font-medium tabular-nums text-slate-900 dark:text-white">
                        {formatCurrency(item.revenue)}
                        <span className="ml-1 text-xs font-normal text-slate-400">
                          ({item.orders} ออเดอร์)
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all dark:bg-blue-500"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section title={<span className="inline-flex items-center gap-2"><Users className="h-4 w-4" aria-hidden="true" />ลูกค้ายอดสูงสุด</span>} bordered>
          <div className="space-y-3">
            {dashboard?.topCustomers?.map((c, i) => (
              <div key={c.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium dark:bg-slate-800">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    {c.company && (
                      <p className="truncate text-xs text-slate-400">
                        {c.company}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-sm font-medium tabular-nums">
                  {formatCurrency(c.totalSpent)}
                </span>
              </div>
            ))}
            {(!dashboard?.topCustomers ||
              dashboard.topCustomers.length === 0) && (
              <p className="text-sm text-slate-400">
                {canViewRevenue
                  ? "ยังไม่มีข้อมูล"
                  : "ต้องมีสิทธิ์ 'เห็นทุน/กำไร/รายงานการเงิน'"}
              </p>
            )}
          </div>
        </Section>
      </div>

    </div>
  );
}
