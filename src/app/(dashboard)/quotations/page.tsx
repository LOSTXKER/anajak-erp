"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { FilterChip } from "@/components/ui/filter-chip";
import { TablePagination } from "@/components/ui/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { formatCurrency, formatDate } from "@/lib/utils";
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_VARIANTS } from "@/lib/status-config";
import { PageHeader } from "@/components/page-header";
import {
  Plus,
  FileText,
} from "lucide-react";

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

  const { data, isLoading, isError, refetch } = trpc.quotation.list.useQuery({
    search: search || undefined,
    status: status || undefined,
    page,
    limit: 20,
  });

  if (isError) return <QueryError onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="ใบเสนอราคา"
        description="จัดการใบเสนอราคาทั้งหมด"
        action={
          <Link href="/quotations/new">
            <Button>
              <Plus className="h-4 w-4" />
              สร้างใบเสนอราคา
            </Button>
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput
          containerClassName="flex-1"
          placeholder="ค้นหาเลขใบเสนอราคา, ชื่อ, ลูกค้า..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <div className="flex gap-1 overflow-x-auto">
          {QUOTATION_STATUSES.map((f) => (
            <FilterChip key={f.value} selected={status === f.value} onClick={() => { setStatus(f.value); setPage(1); }}>
              {f.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  เลขที่
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  ชื่อ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  ลูกค้า
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">
                  ยอดรวม
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  สถานะ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  วันที่สร้าง
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  การดำเนินการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading &&
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-20" />
                      </td>
                    ))}
                  </tr>
                ))}
              {data?.quotations?.map((q) => (
                <tr
                  key={q.id}
                  className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/quotations/${q.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {q.quotationNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                    {q.title}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm text-slate-900 dark:text-white">
                        {q.customer.name}
                      </p>
                      {q.customer.company && (
                        <p className="text-xs text-slate-400">
                          {q.customer.company}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums font-medium text-slate-900 dark:text-white">
                    {formatCurrency(q.totalAmount)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={QUOTATION_STATUS_VARIANTS[q.status as keyof typeof QUOTATION_STATUS_VARIANTS] ?? "secondary"}>
                      {QUOTATION_STATUS_LABELS[q.status as keyof typeof QUOTATION_STATUS_LABELS] ?? q.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {formatDate(q.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/quotations/${q.id}`}>
                      <Button variant="ghost" size="sm">
                        <FileText className="h-4 w-4" />
                        ดูรายละเอียด
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {data?.quotations?.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm text-slate-400"
                  >
                    ไม่พบใบเสนอราคา
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && (
          <TablePagination page={page} totalPages={data.pages} total={data.total} onPageChange={setPage} />
        )}
      </Card>
    </div>
  );
}
