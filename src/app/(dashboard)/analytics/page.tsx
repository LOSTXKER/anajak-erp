"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { BarChart3, TrendingUp, Users, ShoppingCart, AlertCircle, FileText } from "lucide-react";

export default function AnalyticsPage() {
  const { data: dashboard, isLoading } = trpc.analytics.dashboard.useQuery();
  const { data: revenueData } = trpc.analytics.revenueByMonth.useQuery({ months: 6 });
  const { data: auditData } = trpc.analytics.auditLog.useQuery({ limit: 20 });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">สถิติ</h1></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">สถิติและรายงาน</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">ภาพรวมธุรกิจและ audit log</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950">
              <ShoppingCart className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-slate-500">ออเดอร์กำลังทำ</p>
              <p className="text-lg font-bold tabular-nums">{dashboard?.activeOrders}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-green-50 p-2 text-green-600 dark:bg-green-950">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-slate-500">รายได้เดือนนี้</p>
              <p className="text-lg font-bold tabular-nums">{formatCurrency(dashboard?.revenueThisMonth ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600 dark:bg-purple-950">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-slate-500">ลูกค้าทั้งหมด</p>
              <p className="text-lg font-bold tabular-nums">{dashboard?.totalCustomers}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-red-50 p-2 text-red-600 dark:bg-red-950">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-slate-500">บิลเกินกำหนด</p>
              <p className="text-lg font-bold tabular-nums">{dashboard?.overdueInvoices}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue by Month */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              รายได้ 6 เดือนย้อนหลัง
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revenueData?.length === 0 ? (
              <p className="text-sm text-slate-400">ยังไม่มีข้อมูล</p>
            ) : (
              <div className="space-y-3">
                {revenueData?.map((item) => {
                  const maxRevenue = Math.max(...(revenueData?.map((r) => r.revenue) ?? [1]));
                  const width = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;
                  return (
                    <div key={item.month} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{item.month}</span>
                        <span className="font-medium tabular-nums">{formatCurrency(item.revenue)} ({item.orders} ออเดอร์)</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              ลูกค้ายอดสูงสุด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboard?.topCustomers?.map((c, i) => (
                <div key={c.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-medium dark:bg-slate-800">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      {c.company && <p className="text-xs text-slate-400">{c.company}</p>}
                    </div>
                  </div>
                  <span className="text-sm font-medium tabular-nums">{formatCurrency(c.totalSpent)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Audit Log (ล่าสุด)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auditData?.logs?.length === 0 ? (
            <p className="text-sm text-slate-400">ยังไม่มี log</p>
          ) : (
            <div className="space-y-2">
              {auditData?.logs?.map((log) => (
                <div key={log.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{log.action}</Badge>
                    <span className="text-sm text-slate-900 dark:text-white">{log.entityType}</span>
                    <span className="text-xs text-slate-400">โดย {log.user.name}</span>
                  </div>
                  <span className="text-xs text-slate-400">{formatDateTime(log.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
