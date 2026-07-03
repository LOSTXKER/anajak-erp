"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { roleAllows, SALES_DOC_ROLES } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { FilterChip } from "@/components/ui/filter-chip";
import { TablePagination } from "@/components/ui/table-pagination";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { DataTable } from "@/components/ui/data-table";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  CUSTOMER_STATUS_LABELS,
  INTERNAL_STATUS_LABELS,
  CHANNEL_LABELS,
  ORDER_TYPE_LABELS,
} from "@/lib/order-status";
import { PageHeader } from "@/components/page-header";
import {
  Plus,
  Filter,
  ArrowUpDown,
  Download,
  ShoppingCart,
} from "lucide-react";
import type { CustomerStatus, InternalStatus, OrderType } from "@prisma/client";
import { EmptyState } from "@/components/ui/empty-state";

// ────────────────────────────────────────────────────────────
// Filter options
// ────────────────────────────────────────────────────────────

const CHANNEL_FILTERS = [
  { value: "", label: "ทุกช่องทาง" },
  ...Object.entries(CHANNEL_LABELS).map(([value, label]) => ({ value, label })),
];

const TYPE_FILTERS = [
  { value: "", label: "ทุกประเภท" },
  ...Object.entries(ORDER_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

const CUSTOMER_STATUS_FILTERS = [
  { value: "", label: "ทุกสถานะ" },
  ...Object.entries(CUSTOMER_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

const INTERNAL_STATUS_FILTERS = [
  { value: "", label: "ทุกสถานะ" },
  ...Object.entries(INTERNAL_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "วันที่ (ล่าสุด)" },
  { value: "createdAt:asc", label: "วันที่ (เก่าสุด)" },
  { value: "totalAmount:desc", label: "ยอดรวม (มาก→น้อย)" },
  { value: "totalAmount:asc", label: "ยอดรวม (น้อย→มาก)" },
  { value: "orderNumber:desc", label: "เลขออเดอร์ (ล่าสุด)" },
  { value: "orderNumber:asc", label: "เลขออเดอร์ (เก่าสุด)" },
];

// ────────────────────────────────────────────────────────────
// Payment status: dot + text (no pill)
// ────────────────────────────────────────────────────────────

const PAYMENT_DOT: Record<string, { label: string; dot: string; text: string }> = {
  paid: { label: "ชำระแล้ว", dot: "bg-green-500", text: "text-green-700 dark:text-green-300" },
  unpaid: { label: "ค้างชำระ", dot: "bg-red-500", text: "text-red-700 dark:text-red-300" },
  partial: { label: "บางส่วน", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" },
};

function PaymentIndicator({ status }: { status: string }) {
  const v = PAYMENT_DOT[status];
  if (!v) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${v.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${v.dot}`} />
      {v.label}
    </span>
  );
}

// ────────────────────────────────────────────────────────────
// CSV Export helper
// ────────────────────────────────────────────────────────────

function exportOrdersCsv(
  orders: Array<{
    orderNumber: string;
    title: string;
    customer: { name: string; company?: string | null } | null;
    channel: string;
    orderType: string;
    customerStatus: string;
    internalStatus: string;
    totalAmount: number;
    paymentLabel: string;
    createdAt: string | Date;
  }>
) {
  const header = [
    "เลขออเดอร์",
    "ชื่องาน",
    "ลูกค้า",
    "บริษัท",
    "ช่องทาง",
    "ประเภท",
    "สถานะลูกค้า",
    "สถานะภายใน",
    "ยอดรวม",
    "สถานะชำระเงิน",
    "วันที่สร้าง",
  ];

  const paymentLabelMap: Record<string, string> = {
    paid: "ชำระแล้ว",
    unpaid: "ค้างชำระ",
    partial: "บางส่วน",
    none: "—",
  };

  const rows = orders.map((o) => [
    o.orderNumber,
    o.title,
    o.customer?.name ?? "",
    o.customer?.company ?? "",
    CHANNEL_LABELS[o.channel] ?? o.channel,
    ORDER_TYPE_LABELS[o.orderType as OrderType] ?? o.orderType,
    CUSTOMER_STATUS_LABELS[o.customerStatus as CustomerStatus] ?? o.customerStatus,
    INTERNAL_STATUS_LABELS[o.internalStatus as InternalStatus] ?? o.internalStatus,
    String(o.totalAmount),
    paymentLabelMap[o.paymentLabel] ?? "—",
    new Date(o.createdAt).toLocaleDateString("th-TH"),
  ]);

  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n"))
      return `"${v.replace(/"/g, '""')}"`;
    return v;
  };

  const csv =
    "\uFEFF" +
    [header, ...rows].map((r) => r.map(escape).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ────────────────────────────────────────────────────────────
// Page component
// ────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("");
  const [orderType, setOrderType] = useState("");
  const [customerStatus, setCustomerStatus] = useState("");
  const [internalStatus, setInternalStatus] = useState("");
  const [createdAfter, setCreatedAfter] = useState("");
  const [createdBefore, setCreatedBefore] = useState("");
  const [sort, setSort] = useState("createdAt:desc");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const [sortBy, sortOrder] = sort.split(":") as [
    "createdAt" | "totalAmount" | "orderNumber",
    "asc" | "desc",
  ];

  const { data: me } = trpc.user.me.useQuery();
  // เปิดออเดอร์ = สิทธิ์ขาย (order.create ใช้ salesUp) — ช่าง/กราฟิก/บัญชี ไม่โชว์ปุ่มสร้าง (B12)
  const canCreateOrder = roleAllows(me?.role, SALES_DOC_ROLES);

  const { data, isLoading, isError, refetch } = trpc.order.list.useQuery({
    search: search || undefined,
    channel: channel || undefined,
    orderType: (orderType as OrderType) || undefined,
    customerStatus: (customerStatus as CustomerStatus) || undefined,
    internalStatus: (internalStatus as InternalStatus) || undefined,
    createdAfter: createdAfter || undefined,
    createdBefore: createdBefore || undefined,
    sortBy,
    sortOrder,
    page,
    limit: 20,
  });

  const activeFilterCount = [
    channel,
    orderType,
    customerStatus,
    internalStatus,
    createdAfter,
    createdBefore,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setChannel("");
    setOrderType("");
    setCustomerStatus("");
    setInternalStatus("");
    setCreatedAfter("");
    setCreatedBefore("");
    setPage(1);
  };

  if (isError) return <QueryError onRetry={() => refetch()} />;

  return (
    <div className="space-y-7">
      <PageHeader
        title="ออเดอร์"
        description="จัดการออเดอร์ทั้งหมด"
        action={
          <>
            {data && data.orders.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportOrdersCsv(data.orders)}
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            )}
            {canCreateOrder && (
              <Link href="/orders/new">
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  สร้างออเดอร์
                </Button>
              </Link>
            )}
          </>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <SearchInput
          containerClassName="flex-1"
          placeholder="ค้นหาเลขออเดอร์, ชื่อ, ลูกค้า..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
            <NativeSelect
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="h-9 px-2 text-xs"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </div>

          <Button
            variant={showFilters || activeFilterCount > 0 ? "subtle" : "outline"}
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="h-4 w-4" />
            ตัวกรอง
            {activeFilterCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-medium text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="card-surface rounded-2xl p-3.5">
          <div className="space-y-3">
            <FilterRow label="ช่องทาง">
              {CHANNEL_FILTERS.map((f) => (
                <FilterChip
                  key={f.value}
                  selected={channel === f.value}
                  onClick={() => {
                    setChannel(f.value);
                    setPage(1);
                  }}
                >
                  {f.label}
                </FilterChip>
              ))}
            </FilterRow>
            <FilterRow label="ประเภท">
              {TYPE_FILTERS.map((f) => (
                <FilterChip
                  key={f.value}
                  selected={orderType === f.value}
                  onClick={() => {
                    setOrderType(f.value);
                    setPage(1);
                  }}
                >
                  {f.label}
                </FilterChip>
              ))}
            </FilterRow>
            <FilterRow label="สถานะลูกค้า">
              {CUSTOMER_STATUS_FILTERS.map((f) => (
                <FilterChip
                  key={f.value}
                  selected={customerStatus === f.value}
                  onClick={() => {
                    setCustomerStatus(f.value);
                    setPage(1);
                  }}
                >
                  {f.label}
                </FilterChip>
              ))}
            </FilterRow>
            <FilterRow label="สถานะภายใน">
              {INTERNAL_STATUS_FILTERS.map((f) => (
                <FilterChip
                  key={f.value}
                  selected={internalStatus === f.value}
                  onClick={() => {
                    setInternalStatus(f.value);
                    setPage(1);
                  }}
                >
                  {f.label}
                </FilterChip>
              ))}
            </FilterRow>
            <FilterRow label="วันที่สร้าง">
              <Input
                type="date"
                value={createdAfter}
                onChange={(e) => {
                  setCreatedAfter(e.target.value);
                  setPage(1);
                }}
                className="h-8 w-36 text-xs"
              />
              <span className="text-xs text-slate-400">ถึง</span>
              <Input
                type="date"
                value={createdBefore}
                onChange={(e) => {
                  setCreatedBefore(e.target.value);
                  setPage(1);
                }}
                className="h-8 w-36 text-xs"
              />
            </FilterRow>

            {activeFilterCount > 0 && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  ล้างตัวกรองทั้งหมด
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <DataTable.Root>
        <DataTable.Head>
          <tr>
            <DataTable.Th>เลขออเดอร์</DataTable.Th>
            <DataTable.Th>ลูกค้า / งาน</DataTable.Th>
            <DataTable.Th>ช่องทาง</DataTable.Th>
            <DataTable.Th>สถานะ</DataTable.Th>
            <DataTable.Th align="right">ยอดรวม</DataTable.Th>
            <DataTable.Th>การชำระ</DataTable.Th>
            <DataTable.Th>วันที่</DataTable.Th>
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

          {data?.orders?.map((order) => (
            <DataTable.Row key={order.id}>
              <DataTable.Td>
                <Link
                  href={`/orders/${order.id}`}
                  className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  {order.orderNumber}
                </Link>
              </DataTable.Td>

              <DataTable.Td>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                    {order.customer?.name ?? "—"}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {order.title}
                    {order.orderType === "CUSTOM" && (
                      <Badge variant="accent" size="sm" className="ml-1.5">
                        Custom
                      </Badge>
                    )}
                  </p>
                </div>
              </DataTable.Td>

              <DataTable.Td>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {CHANNEL_LABELS[order.channel] ?? order.channel}
                </span>
              </DataTable.Td>

              <DataTable.Td>
                <OrderStatusBadge
                  customerStatus={order.customerStatus}
                  internalStatus={order.internalStatus}
                  compact
                />
              </DataTable.Td>

              <DataTable.Td align="right" className="font-medium tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(order.totalAmount)}
              </DataTable.Td>

              <DataTable.Td>
                <PaymentIndicator status={order.paymentLabel} />
              </DataTable.Td>

              <DataTable.Td className="text-xs text-slate-500 dark:text-slate-400">
                {order.createdAt ? formatDate(order.createdAt) : "—"}
              </DataTable.Td>
            </DataTable.Row>
          ))}

          {!isLoading && data?.orders?.length === 0 && (
            <tr>
              <td colSpan={7}>
                <EmptyState
                  icon={ShoppingCart}
                  title="ไม่พบออเดอร์"
                  description={
                    activeFilterCount > 0
                      ? "ลองล้างตัวกรองหรือปรับคำค้นหา"
                      : "เริ่มสร้างออเดอร์แรกของคุณได้เลย"
                  }
                  action={
                    canCreateOrder ? (
                      <Link href="/orders/new">
                        <Button size="sm">
                          <Plus className="h-4 w-4" />
                          สร้างออเดอร์
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

      {data && data.orders.length > 0 && (
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

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-20 shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </span>
      {children}
    </div>
  );
}
