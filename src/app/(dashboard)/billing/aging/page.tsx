"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Users, DollarSign, AlertCircle, Hourglass } from "lucide-react";

const FINANCE_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT"];

// ลำดับ + ป้ายถังอายุหนี้ — ตรงกับ AGING_BUCKETS ใน services/receivables.ts
const BUCKETS = [
  { key: "current", label: "ยังไม่ครบกำหนด" },
  { key: "d1_30", label: "เลย 1-30 วัน" },
  { key: "d31_60", label: "เลย 31-60 วัน" },
  { key: "d61_90", label: "เลย 61-90 วัน" },
  { key: "d90plus", label: "เกิน 90 วัน" },
] as const;

export default function AgingPage() {
  const { data: me } = trpc.user.me.useQuery();
  const canView = me ? FINANCE_ROLES.includes(me.role) : true;
  const { data, isLoading, isError, refetch } = trpc.billingNote.aging.useQuery(undefined, {
    enabled: canView,
  });

  if (me && !canView) {
    return (
      <div className="space-y-5">
        <PageHeader title="ลูกหนี้ค้างชำระ" description="ยอดค้างแยกตามอายุหนี้" />
        <p className="text-sm text-slate-400">หน้านี้เปิดเฉพาะเจ้าของ ผู้จัดการ และบัญชี</p>
      </div>
    );
  }

  if (isError) return <QueryError onRetry={() => refetch()} />;

  const overdueTotal = data
    ? data.totals.d1_30 + data.totals.d31_60 + data.totals.d61_90 + data.totals.d90plus
    : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="ลูกหนี้ค้างชำระ (Aging)"
        description="ยอดค้างต่อลูกค้า แยกตามอายุหนี้นับจากวันครบกำหนด"
        breadcrumb={[{ label: "บิล/การเงิน", href: "/billing" }, { label: "ลูกหนี้" }]}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="ลูกหนี้รวม"
          value={formatCurrency(data?.grandTotal ?? 0)}
          icon={DollarSign}
        />
        <StatCard
          title="เลยกำหนดแล้ว"
          value={formatCurrency(overdueTotal)}
          icon={AlertCircle}
        />
        <StatCard
          title="ยังไม่ครบกำหนด"
          value={formatCurrency(data?.totals.current ?? 0)}
          icon={Hourglass}
        />
        <StatCard title="ลูกหนี้" value={data?.rows.length ?? 0} icon={Users} caption="ราย" />
      </div>

      <DataTable.Root>
        <DataTable.Head>
          <tr>
            <DataTable.Th>ลูกค้า</DataTable.Th>
            {BUCKETS.map((b) => (
              <DataTable.Th key={b.key} align="right">
                {b.label}
              </DataTable.Th>
            ))}
            <DataTable.Th align="right">รวม</DataTable.Th>
          </tr>
        </DataTable.Head>
        <DataTable.Body>
          {isLoading &&
            [...Array(4)].map((_, i) => (
              <tr key={i}>
                {[...Array(7)].map((_, j) => (
                  <DataTable.Td key={j}>
                    <Skeleton className="h-4 w-16" />
                  </DataTable.Td>
                ))}
              </tr>
            ))}
          {data?.rows.map((row) => (
            <DataTable.Row key={row.customerId}>
              <DataTable.Td>
                <Link
                  href={`/customers/${row.customerId}`}
                  className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  {row.company ? `${row.company} (${row.name})` : row.name}
                </Link>
              </DataTable.Td>
              {BUCKETS.map((b) => (
                <DataTable.Td
                  key={b.key}
                  align="right"
                  className={`tabular-nums ${
                    row.buckets[b.key] === 0
                      ? "text-slate-300 dark:text-slate-600"
                      : b.key === "current"
                        ? ""
                        : "font-medium text-red-600 dark:text-red-400"
                  }`}
                >
                  {row.buckets[b.key] === 0 ? "—" : formatCurrency(row.buckets[b.key])}
                </DataTable.Td>
              ))}
              <DataTable.Td
                align="right"
                className="font-semibold tabular-nums text-slate-900 dark:text-white"
              >
                {formatCurrency(row.total)}
              </DataTable.Td>
            </DataTable.Row>
          ))}
          {!isLoading && data && data.rows.length > 0 && (
            <DataTable.Row>
              <DataTable.Td className="font-semibold">รวมทั้งหมด</DataTable.Td>
              {BUCKETS.map((b) => (
                <DataTable.Td key={b.key} align="right" className="font-semibold tabular-nums">
                  {data.totals[b.key] === 0 ? "—" : formatCurrency(data.totals[b.key])}
                </DataTable.Td>
              ))}
              <DataTable.Td align="right" className="font-semibold tabular-nums">
                {formatCurrency(data.grandTotal)}
              </DataTable.Td>
            </DataTable.Row>
          )}
          {!isLoading && data?.rows.length === 0 && (
            <tr>
              <td colSpan={7}>
                <EmptyState
                  icon={Users}
                  title="ไม่มีลูกหนี้ค้างชำระ"
                  description="ใบแจ้งหนี้ทุกใบชำระครบแล้ว หรือยังไม่มีการวางบิล"
                />
              </td>
            </tr>
          )}
        </DataTable.Body>
      </DataTable.Root>
    </div>
  );
}
