"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { formatCurrency } from "@/lib/pricing";
import { formatDate } from "@/lib/utils";
import {
  CUSTOMER_STATUS_LABELS,
  CHANNEL_LABELS,
  CHANNEL_COLORS,
  ORDER_TYPE_LABELS,
} from "@/lib/order-status";
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import type { CustomerStatus, OrderType } from "@prisma/client";

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
// Page component
// ────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("");
  const [orderType, setOrderType] = useState("");
  const [customerStatus, setCustomerStatus] = useState("");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = trpc.order.list.useQuery({
    search: search || undefined,
    channel: channel || undefined,
    orderType: (orderType as OrderType) || undefined,
    customerStatus: (customerStatus as CustomerStatus) || undefined,
    page,
    limit: 20,
  });

  const activeFilterCount = [channel, orderType, customerStatus].filter(
    Boolean
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            ออเดอร์
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            จัดการออเดอร์ทั้งหมด
          </p>
        </div>
        <Link href="/orders/new">
          <Button>
            <Plus className="h-4 w-4" />
            สร้างออเดอร์
          </Button>
        </Link>
      </div>

      {/* Search + filter toggle */}
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
              สถานะ:
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
                  วันที่
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading &&
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((_, j) => (
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

                  {/* Date */}
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {order.createdAt ? formatDate(order.createdAt) : "-"}
                  </td>
                </tr>
              ))}

              {data?.orders?.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
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
