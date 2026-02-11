"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";

// ============================================================
// STATUS CONFIG
// ============================================================

const QUOTATION_STATUSES = [
  { value: "", label: "ทั้งหมด" },
  { value: "DRAFT", label: "ฉบับร่าง" },
  { value: "SENT", label: "ส่งแล้ว" },
  { value: "ACCEPTED", label: "อนุมัติ" },
  { value: "REJECTED", label: "ปฏิเสธ" },
  { value: "EXPIRED", label: "หมดอายุ" },
  { value: "CONVERTED", label: "แปลงแล้ว" },
];

const STATUS_BADGE_VARIANT: Record<
  string,
  "secondary" | "default" | "success" | "destructive" | "warning" | "purple"
> = {
  DRAFT: "secondary",
  SENT: "default",
  ACCEPTED: "success",
  REJECTED: "destructive",
  EXPIRED: "warning",
  CONVERTED: "purple",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "ฉบับร่าง",
  SENT: "ส่งแล้ว",
  ACCEPTED: "อนุมัติ",
  REJECTED: "ปฏิเสธ",
  EXPIRED: "หมดอายุ",
  CONVERTED: "แปลงเป็นออเดอร์",
};

// ============================================================
// COMPONENT
// ============================================================

export default function QuotationsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.quotation.list.useQuery({
    search: search || undefined,
    status: status || undefined,
    page,
    limit: 20,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            ใบเสนอราคา
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            จัดการใบเสนอราคาทั้งหมด
          </p>
        </div>
        <Link href="/quotations/new">
          <Button>
            <Plus className="h-4 w-4" />
            สร้างใบเสนอราคา
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="ค้นหาเลขใบเสนอราคา, ชื่อ, ลูกค้า..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {QUOTATION_STATUSES.map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setStatus(f.value);
                setPage(1);
              }}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                status === f.value
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              {f.label}
            </button>
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
                    <Badge variant={STATUS_BADGE_VARIANT[q.status] ?? "secondary"}>
                      {STATUS_LABELS[q.status] ?? q.status}
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
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="text-xs text-slate-500">
              ทั้งหมด {data.total} รายการ
            </p>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="flex items-center px-2 text-xs text-slate-500">
                {page} / {data.pages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
