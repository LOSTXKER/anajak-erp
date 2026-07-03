"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { roleAllows, SALES_DOC_ROLES } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { FilterChip } from "@/components/ui/filter-chip";
import { TablePagination } from "@/components/ui/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_VARIANTS } from "@/lib/status-config";
import { PageHeader } from "@/components/page-header";
import { Plus, ClipboardList } from "lucide-react";

const QUOTATION_STATUSES = [
  { value: "", label: "ทั้งหมด" },
  { value: "DRAFT", label: "ฉบับร่าง" },
  { value: "SENT", label: "ส่งแล้ว" },
  { value: "ACCEPTED", label: "อนุมัติ" },
  { value: "REJECTED", label: "ปฏิเสธ" },
  { value: "EXPIRED", label: "หมดอายุ" },
  { value: "CONVERTED", label: "แปลงแล้ว" },
];

export default function QuotationsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data: me } = trpc.user.me.useQuery();
  // สร้างใบเสนอ = สิทธิ์ขาย (quotation.create ใช้ salesUp) — ช่าง/กราฟิก/บัญชี ไม่โชว์ (B12)
  const canCreateQuotation = roleAllows(me?.role, SALES_DOC_ROLES);

  const { data, isLoading, isError, refetch } = trpc.quotation.list.useQuery({
    search: search || undefined,
    status: status || undefined,
    page,
    limit: 20,
  });

  if (isError) return <QueryError onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="ใบเสนอราคา"
        description="จัดการใบเสนอราคาทั้งหมด"
        action={
          canCreateQuotation ? (
            <Link href="/quotations/new">
              <Button size="sm">
                <Plus className="h-4 w-4" />
                สร้างใบเสนอราคา
              </Button>
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <SearchInput
          containerClassName="flex-1"
          placeholder="ค้นหาเลขใบเสนอราคา, ชื่อ, ลูกค้า..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <div className="flex flex-wrap gap-1">
          {QUOTATION_STATUSES.map((f) => (
            <FilterChip
              key={f.value}
              selected={status === f.value}
              onClick={() => {
                setStatus(f.value);
                setPage(1);
              }}
            >
              {f.label}
            </FilterChip>
          ))}
        </div>
      </div>

      <DataTable.Root>
        <DataTable.Head>
          <tr>
            <DataTable.Th>เลขที่</DataTable.Th>
            <DataTable.Th>ชื่อ</DataTable.Th>
            <DataTable.Th>ลูกค้า</DataTable.Th>
            <DataTable.Th align="right">ยอดรวม</DataTable.Th>
            <DataTable.Th>สถานะ</DataTable.Th>
            <DataTable.Th>วันที่สร้าง</DataTable.Th>
          </tr>
        </DataTable.Head>
        <DataTable.Body>
          {isLoading &&
            [...Array(5)].map((_, i) => (
              <tr key={i}>
                {[...Array(6)].map((_, j) => (
                  <DataTable.Td key={j}>
                    <Skeleton className="h-4 w-20" />
                  </DataTable.Td>
                ))}
              </tr>
            ))}
          {data?.quotations?.map((q) => (
            <DataTable.Row key={q.id}>
              <DataTable.Td>
                <Link
                  href={`/quotations/${q.id}`}
                  className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  {q.quotationNumber}
                </Link>
              </DataTable.Td>
              <DataTable.Td className="text-slate-900 dark:text-white">
                {q.title}
              </DataTable.Td>
              <DataTable.Td>
                <p className="text-sm text-slate-900 dark:text-white">
                  {q.customer.name}
                </p>
                {q.customer.company && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {q.customer.company}
                  </p>
                )}
              </DataTable.Td>
              <DataTable.Td
                align="right"
                className="font-medium tabular-nums text-slate-900 dark:text-white"
              >
                {formatCurrency(q.totalAmount)}
              </DataTable.Td>
              <DataTable.Td>
                <Badge
                  variant={
                    QUOTATION_STATUS_VARIANTS[
                      q.status as keyof typeof QUOTATION_STATUS_VARIANTS
                    ] ?? "default"
                  }
                >
                  {QUOTATION_STATUS_LABELS[
                    q.status as keyof typeof QUOTATION_STATUS_LABELS
                  ] ?? q.status}
                </Badge>
              </DataTable.Td>
              <DataTable.Td className="text-xs text-slate-500 dark:text-slate-400">
                {formatDate(q.createdAt)}
              </DataTable.Td>
            </DataTable.Row>
          ))}
          {!isLoading && data?.quotations?.length === 0 && (
            <tr>
              <td colSpan={6}>
                <EmptyState
                  icon={ClipboardList}
                  title="ไม่พบใบเสนอราคา"
                  description="สร้างใบเสนอราคาแรกของคุณได้เลย"
                  action={
                    canCreateQuotation ? (
                      <Link href="/quotations/new">
                        <Button size="sm">
                          <Plus className="h-4 w-4" />
                          สร้างใบเสนอราคา
                        </Button>
                      </Link>
                    ) : undefined
                  }
                />
              </td>
            </tr>
          )}
        </DataTable.Body>
      </DataTable.Root>

      {data && data.quotations.length > 0 && (
        <TablePagination
          page={page}
          totalPages={data.pages}
          total={data.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
