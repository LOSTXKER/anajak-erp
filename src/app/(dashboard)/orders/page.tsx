"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  CUSTOMER_STATUS_LABELS,
  INTERNAL_STATUS_LABELS,
  CHANNEL_LABELS,
  CHANNEL_COLORS,
  ORDER_TYPE_LABELS,
} from "@/lib/order-status";
import { PageHeader } from "@/components/page-header";
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowUpDown,
  Download,
} from "lucide-react";
import type { CustomerStatus, InternalStatus, OrderType } from "@prisma/client";

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
// Payment status badge
// ────────────────────────────────────────────────────────────

const PAYMENT_BADGE: Record<string, { label: string; className: string }> = {
  paid: {
    label: "ชำระแล้ว",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  },
  unpaid: {
    label: "ค้างชำระ",
    className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  },
  partial: {
    label: "บางส่วน",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  },
};

function PaymentBadge({ status }: { status: string }) {
  const badge = PAYMENT_BADGE[status];
  if (!badge)
    return (
      <span className="text-xs text-slate-400">—</span>
    );
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

// ────────────────────────────────────────────────────────────
// Channel badge component
// ────────────────────────────────────────────────────────────

function ChannelBadge({ channel }: { channel: string }) {
  const label = CHANNEL_LABELS[channel] ?? channel;
  const colors = CHANNEL_COLORS[channel] ?? {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${colors.bg} ${colors.text}`}
    >
      {label}
    </span>
  );
}

// ────────────────────────────────────────────────────────────
// Type badge component
// ────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const label = ORDER_TYPE_LABELS[type as OrderType] ?? type;
  const isCustom = type === "CUSTOM";
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
        isCustom
          ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
      }`}
    >
      {label}
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

  const { data, isLoading } = trpc.order.list.useQuery({
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="ออเดอร์"
        description="จัดการออเดอร์ทั้งหมด"
        action={
          <div className="flex gap-2">
            {data && data.orders.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportOrdersCsv(data.orders)}
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            )}
            <Link href="/orders/new">
              <Button>
                <Plus className="h-4 w-4" />
                สร้างออเดอร์
              </Button>
            </Link>
          </div>
        }
      />

      {/* Search + filter toggle + sort */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="ค้นหาเลขออเดอร์, ชื่อ, ลูกค้า, เลขออเดอร์ภายนอก..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-4 w-4 text-slate-400" />
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
            className={`gap-1.5 ${
              activeFilterCount > 0
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            <Filter className="h-4 w-4" />
            ตัวกรอง
            {activeFilterCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-xs text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Filter rows */}
      {showFilters && (
        <div className="space-y-2">
          {/* Channel filter */}
          <div className="flex flex-wrap gap-1">
            <span className="mr-1 flex items-center text-xs font-medium text-slate-500 dark:text-slate-400">
              ช่องทาง:
            </span>
            {CHANNEL_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => {
                  setChannel(f.value);
                  setPage(1);
                }}
                className={`whitespace-nowrap rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                  channel === f.value
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <div className="flex flex-wrap gap-1">
            <span className="mr-1 flex items-center text-xs font-medium text-slate-500 dark:text-slate-400">
              ประเภท:
            </span>
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => {
                  setOrderType(f.value);
                  setPage(1);
                }}
                className={`whitespace-nowrap rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                  orderType === f.value
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Customer status filter */}
          <div className="flex flex-wrap gap-1">
            <span className="mr-1 flex items-center text-xs font-medium text-slate-500 dark:text-slate-400">
              สถานะลูกค้า:
            </span>
            {CUSTOMER_STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => {
                  setCustomerStatus(f.value);
                  setPage(1);
                }}
                className={`whitespace-nowrap rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                  customerStatus === f.value
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Internal status filter */}
          <div className="flex flex-wrap gap-1">
            <span className="mr-1 flex items-center text-xs font-medium text-slate-500 dark:text-slate-400">
              สถานะภายใน:
            </span>
            {INTERNAL_STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => {
                  setInternalStatus(f.value);
                  setPage(1);
                }}
                className={`whitespace-nowrap rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                  internalStatus === f.value
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Date range filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              วันที่สร้าง:
            </span>
            <Input
              type="date"
              value={createdAfter}
              onChange={(e) => {
                setCreatedAfter(e.target.value);
                setPage(1);
              }}
              className="h-8 w-36 text-xs"
              placeholder="จาก"
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
              placeholder="ถึง"
            />
            {(createdAfter || createdBefore) && (
              <button
                onClick={() => {
                  setCreatedAfter("");
                  setCreatedBefore("");
                  setPage(1);
                }}
                className="text-xs text-red-500 hover:underline"
              >
                ล้าง
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  เลขออเดอร์
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  ชื่องาน
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  ลูกค้า
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  ช่องทาง
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  ประเภท
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  สถานะ
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-500">
                  ยอดรวม
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  การชำระเงิน
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-500">
                  วันที่
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading &&
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(9)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-20" />
                      </td>
                    ))}
                  </tr>
                ))}

              {data?.orders?.map((order) => (
                <tr
                  key={order.id}
                  className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  {/* Order number */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/orders/${order.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {order.orderNumber}
                    </Link>
                  </td>

                  {/* Title */}
                  <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                    {order.title}
                  </td>

                  {/* Customer */}
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm text-slate-900 dark:text-white">
                        {order.customer?.name}
                      </p>
                      {order.customer?.company && (
                        <p className="text-xs text-slate-400">
                          {order.customer.company}
                        </p>
                      )}
                    </div>
                  </td>

                  {/* Channel */}
                  <td className="px-4 py-3">
                    <ChannelBadge channel={order.channel} />
                  </td>

                  {/* Type */}
                  <td className="px-4 py-3">
                    <TypeBadge type={order.orderType} />
                  </td>

                  {/* Status (dual) */}
                  <td className="px-4 py-3">
                    <OrderStatusBadge
                      customerStatus={order.customerStatus}
                      internalStatus={order.internalStatus}
                    />
                  </td>

                  {/* Total */}
                  <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-slate-900 dark:text-white">
                    {formatCurrency(order.totalAmount)}
                  </td>

                  {/* Payment */}
                  <td className="px-4 py-3">
                    <PaymentBadge status={order.paymentLabel} />
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {order.createdAt ? formatDate(order.createdAt) : "-"}
                  </td>
                </tr>
              ))}

              {data?.orders?.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-sm text-slate-400"
                  >
                    ไม่พบออเดอร์
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
