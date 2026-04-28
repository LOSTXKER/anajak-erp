"use client";

import {
  ShoppingCart,
  Users,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/ui/section";
import { StatCard } from "@/components/ui/stat-card";

export default function DashboardPage() {
  const { data, isLoading } = trpc.analytics.dashboard.useQuery();

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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="ออเดอร์กำลังดำเนินการ"
          value={data?.activeOrders ?? 0}
          icon={ShoppingCart}
        />
        <StatCard
          title="รายได้เดือนนี้"
          value={formatCurrency(data?.revenueThisMonth ?? 0)}
          icon={TrendingUp}
          change={data?.revenueChange}
        />
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
        <StatCard
          title="บิลค้างชำระ"
          value={data?.overdueInvoices ?? 0}
          icon={AlertCircle}
        />
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
      </div>
    </div>
  );
}
