"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { FINANCE_ROLES } from "@/lib/roles";
import {
  DollarSign,
  AlertCircle,
  TrendingUp,
  CreditCard,
  FileText,
} from "lucide-react";

const paymentStatusConfig: Record<
  string,
  { label: string; variant: "default" | "accent" | "success" | "warning" | "destructive" }
> = {
  UNPAID: { label: "ยังไม่จ่าย", variant: "warning" },
  PARTIALLY_PAID: { label: "จ่ายบางส่วน", variant: "accent" },
  PAID: { label: "จ่ายแล้ว", variant: "success" },
  OVERDUE: { label: "เกินกำหนด", variant: "destructive" },
  VOIDED: { label: "ยกเลิก", variant: "default" },
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
  const { data: me } = trpc.user.me.useQuery();
  // หน้าการเงินทั้งหน้าเป็นของฝั่งบริหาร-บัญชี (ตรงกับ requireRole ฝั่ง server)
  const canView = me ? FINANCE_ROLES.includes(me.role) : true;
  const { data: stats } = trpc.billing.stats.useQuery(undefined, {
    enabled: canView,
  });
  const { data, isLoading, isError, refetch } = trpc.billing.list.useQuery(
    {
      search: search || undefined,
      limit: 50,
    },
    { enabled: canView }
  );

  if (me && !canView) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="บิล/การเงิน"
          description="ใบเสนอราคา, ใบแจ้งหนี้, ใบเสร็จ"
        />
        <p className="text-sm text-slate-400">
          หน้านี้เปิดเฉพาะเจ้าของ ผู้จัดการ และบัญชี
        </p>
      </div>
    );
  }

  if (isError) return <QueryError onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="บิล/การเงิน"
        description="ใบเสนอราคา, ใบแจ้งหนี้, ใบเสร็จ"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="ค้างชำระ"
          value={formatCurrency(stats?.totalUnpaid ?? 0)}
          icon={DollarSign}
        />
        <StatCard
          title="เกินกำหนด"
          value={stats?.overdueCount ?? 0}
          icon={AlertCircle}
          caption="บิล"
        />
        <StatCard
          title="รายได้เดือนนี้"
          value={formatCurrency(stats?.revenueThisMonth ?? 0)}
          icon={TrendingUp}
        />
        <StatCard
          title="รับชำระเดือนนี้"
          value={formatCurrency(stats?.paidThisMonth ?? 0)}
          icon={CreditCard}
        />
      </div>

      <SearchInput
        placeholder="ค้นหาเลขบิล, ชื่อลูกค้า..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <DataTable.Root>
        <DataTable.Head>
          <tr>
            <DataTable.Th>เลขบิล</DataTable.Th>
            <DataTable.Th>ประเภท</DataTable.Th>
            <DataTable.Th>ลูกค้า</DataTable.Th>
            <DataTable.Th>ออเดอร์</DataTable.Th>
            <DataTable.Th align="right">จำนวนเงิน</DataTable.Th>
            <DataTable.Th>สถานะ</DataTable.Th>
            <DataTable.Th>ครบกำหนด</DataTable.Th>
          </tr>
        </DataTable.Head>
        <DataTable.Body>
          {isLoading &&
            [...Array(5)].map((_, i) => (
              <tr key={i}>
                {[...Array(7)].map((_, j) => (
                  <DataTable.Td key={j}>
                    <Skeleton className="h-4 w-20" />
                  </DataTable.Td>
                ))}
              </tr>
            ))}
          {data?.invoices?.map((inv) => {
            const statusCfg =
              paymentStatusConfig[inv.paymentStatus] ?? paymentStatusConfig.UNPAID;
            return (
              <DataTable.Row key={inv.id}>
                <DataTable.Td className="font-medium text-slate-900 dark:text-white">
                  {inv.invoiceNumber}
                </DataTable.Td>
                <DataTable.Td className="text-xs text-slate-500 dark:text-slate-400">
                  {invoiceTypeLabels[inv.type] ?? inv.type}
                </DataTable.Td>
                <DataTable.Td>{inv.customer.name}</DataTable.Td>
                <DataTable.Td className="text-blue-600 dark:text-blue-400">
                  {inv.order.orderNumber}
                </DataTable.Td>
                <DataTable.Td
                  align="right"
                  className="font-medium tabular-nums text-slate-900 dark:text-white"
                >
                  {formatCurrency(inv.totalAmount)}
                </DataTable.Td>
                <DataTable.Td>
                  <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                </DataTable.Td>
                <DataTable.Td className="text-xs text-slate-500 dark:text-slate-400">
                  {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                </DataTable.Td>
              </DataTable.Row>
            );
          })}
          {!isLoading && data?.invoices?.length === 0 && (
            <tr>
              <td colSpan={7}>
                <EmptyState
                  icon={FileText}
                  title="ยังไม่มีบิล"
                  description="สร้างบิลได้จากหน้าออเดอร์ — การ์ด บิล/การชำระเงิน"
                />
              </td>
            </tr>
          )}
        </DataTable.Body>
      </DataTable.Root>
    </div>
  );
}
