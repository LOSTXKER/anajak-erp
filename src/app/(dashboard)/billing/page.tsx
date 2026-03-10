"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { DollarSign, AlertCircle, TrendingUp, CreditCard } from "lucide-react";

const paymentStatusConfig: Record<string, { label: string; variant: "secondary" | "default" | "success" | "warning" | "destructive" }> = {
  UNPAID: { label: "ยังไม่จ่าย", variant: "warning" },
  PARTIALLY_PAID: { label: "จ่ายบางส่วน", variant: "default" },
  PAID: { label: "จ่ายแล้ว", variant: "success" },
  OVERDUE: { label: "เกินกำหนด", variant: "destructive" },
  VOIDED: { label: "ยกเลิก", variant: "secondary" },
};

const invoiceTypeLabels: Record<string, string> = {
  QUOTATION: "ใบเสนอราคา",
  DEPOSIT_INVOICE: "บิลมัดจำ",
  FINAL_INVOICE: "บิลส่วนที่เหลือ",
  RECEIPT: "ใบเสร็จ",
  CREDIT_NOTE: "ใบลดหนี้",
  DEBIT_NOTE: "ใบเพิ่มหนี้",
};

export default function BillingPage() {
  const [search, setSearch] = useState("");
  const { data: stats } = trpc.billing.stats.useQuery();
  const { data, isLoading, isError, refetch } = trpc.billing.list.useQuery({
    search: search || undefined,
    limit: 50,
  });

  const statCards = [
    { title: "ค้างชำระ", value: formatCurrency(stats?.totalUnpaid ?? 0), icon: DollarSign, color: "text-amber-600 bg-amber-50 dark:bg-amber-950" },
    { title: "เกินกำหนด", value: stats?.overdueCount ?? 0, icon: AlertCircle, color: "text-red-600 bg-red-50 dark:bg-red-950" },
    { title: "รายได้เดือนนี้", value: formatCurrency(stats?.revenueThisMonth ?? 0), icon: TrendingUp, color: "text-green-600 bg-green-50 dark:bg-green-950" },
    { title: "รับชำระเดือนนี้", value: formatCurrency(stats?.paidThisMonth ?? 0), icon: CreditCard, color: "text-blue-600 bg-blue-50 dark:bg-blue-950" },
  ];

  if (isError) return <QueryError onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="บิล/การเงิน"
        description="จัดการใบเสนอราคา, ใบแจ้งหนี้, ใบเสร็จ"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((stat) => (
          <StatCard key={stat.title} title={stat.title} value={stat.value} icon={stat.icon} color={stat.color} />
        ))}
      </div>

      {/* Search */}
      <SearchInput placeholder="ค้นหาเลขบิล, ชื่อลูกค้า..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {/* Invoice List */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">เลขบิล</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">ประเภท</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">ลูกค้า</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">ออเดอร์</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">จำนวนเงิน</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">สถานะ</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">ครบกำหนด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading && [...Array(5)].map((_, i) => (
                <tr key={i}>{[...Array(7)].map((_, j) => (
                  <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                ))}</tr>
              ))}
              {data?.invoices?.map((inv) => {
                const statusCfg = paymentStatusConfig[inv.paymentStatus] ?? paymentStatusConfig.UNPAID;
                return (
                  <tr key={inv.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{invoiceTypeLabels[inv.type] ?? inv.type}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">{inv.customer.name}</td>
                    <td className="px-4 py-3 text-sm text-blue-600 dark:text-blue-400">{inv.order.orderNumber}</td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums font-medium text-slate-900 dark:text-white">
                      {formatCurrency(inv.totalAmount)}
                    </td>
                    <td className="px-4 py-3"><Badge variant={statusCfg.variant}>{statusCfg.label}</Badge></td>
                    <td className="px-4 py-3 text-sm text-slate-500">{inv.dueDate ? formatDate(inv.dueDate) : "-"}</td>
                  </tr>
                );
              })}
              {data?.invoices?.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">ยังไม่มีบิล</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
