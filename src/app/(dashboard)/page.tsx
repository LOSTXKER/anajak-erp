"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  Users,
  TrendingUp,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/order-status-badge";

export default function DashboardPage() {
  const { data, isLoading } = trpc.analytics.dashboard.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-500">ภาพรวมระบบ Anajak Print</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="mb-2 h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    {
      title: "ออเดอร์กำลังดำเนินการ",
      value: data?.activeOrders ?? 0,
      icon: ShoppingCart,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    {
      title: "รายได้เดือนนี้",
      value: formatCurrency(data?.revenueThisMonth ?? 0),
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
      change: data?.revenueChange,
    },
    {
      title: "ลูกค้าทั้งหมด",
      value: data?.totalCustomers ?? 0,
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950",
      sub: `+${data?.newCustomersThisMonth ?? 0} เดือนนี้`,
    },
    {
      title: "บิลค้างชำระ",
      value: data?.overdueInvoices ?? 0,
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          ภาพรวมระบบ Anajak Print
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  {stat.title}
                </p>
                <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {stat.value}
                </p>
                {stat.change !== undefined && (
                  <span
                    className={`flex items-center text-xs font-medium ${
                      stat.change >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {stat.change >= 0 ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {Math.abs(stat.change).toFixed(1)}%
                  </span>
                )}
                {stat.sub && (
                  <span className="text-xs text-slate-400">{stat.sub}</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Orders by Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">สถานะออเดอร์</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data?.ordersByStatus?.map((item) => (
                <div
                  key={item.status}
                  className="flex items-center justify-between"
                >
                  <OrderStatusBadge internalStatus={item.status} />
                  <span className="text-sm font-medium tabular-nums text-slate-900 dark:text-white">
                    {item.count}
                  </span>
                </div>
              ))}
              {(!data?.ordersByStatus || data.ordersByStatus.length === 0) && (
                <p className="text-sm text-slate-400">ยังไม่มีออเดอร์</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ลูกค้ายอดสั่งสูงสุด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data?.topCustomers?.map((customer, index) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {customer.name}
                      </p>
                      {customer.company && (
                        <p className="text-xs text-slate-400">{customer.company}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
