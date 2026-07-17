"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { FilterChip } from "@/components/ui/filter-chip";
import { TablePagination } from "@/components/ui/table-pagination";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
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
  ChevronRight,
  Clock3,
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
  { value: "deadline:asc", label: "กำหนดส่ง (ใกล้สุด)" },
  { value: "totalAmount:desc", label: "ยอดรวม (มาก→น้อย)" },
  { value: "totalAmount:asc", label: "ยอดรวม (น้อย→มาก)" },
  { value: "orderNumber:desc", label: "เลขออเดอร์ (ล่าสุด)" },
  { value: "orderNumber:asc", label: "เลขออเดอร์ (เก่าสุด)" },
];

const ATTENTION_FILTERS = [
  { value: "", label: "ทุกงาน" },
  { value: "overdue", label: "เลยกำหนด" },
  { value: "due-soon", label: "ใกล้กำหนด 48 ชม." },
  { value: "stuck", label: "ติดหล่มเกิน 3 วัน" },
] as const;

type OrderAttention = Exclude<(typeof ATTENTION_FILTERS)[number]["value"], "">;

function positivePage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function validDateParam(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  return Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()) ? "" : value;
}

// ────────────────────────────────────────────────────────────
// Payment status: dot + text (no pill)
// ────────────────────────────────────────────────────────────

const PAYMENT_DOT: Record<string, { label: string; dot: string; text: string }> = {
  paid: { label: "ชำระแล้ว", dot: "bg-green-500", text: "text-green-700 dark:text-green-300" },
  unpaid: { label: "ค้างชำระ", dot: "bg-red-500", text: "text-red-700 dark:text-red-300" },
  partial: { label: "บางส่วน", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" },
};

// ────────────────────────────────────────────────────────────
// Deadline urgency tone — เกณฑ์เดียวกับ attention ฝั่ง server
// (order-list-filter.ts: งานร่าง/ส่งแล้ว/จบ/ยกเลิก ไม่นับเร่งด่วน)
// ────────────────────────────────────────────────────────────

const ATTENTION_EXEMPT_STATUSES = new Set(["DRAFT", "SHIPPED", "COMPLETED", "CANCELLED"]);

function deadlineToneClass(
  deadline: string | Date | null | undefined,
  internalStatus: string
): string | null {
  if (!deadline || ATTENTION_EXEMPT_STATUSES.has(internalStatus)) return null;
  const due = new Date(deadline).getTime();
  const now = Date.now();
  if (due < now) return "font-medium text-red-600 dark:text-red-400";
  if (due <= now + 48 * 60 * 60 * 1000) return "text-amber-700 dark:text-amber-400";
  return null;
}

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
    totalAmount: number | null;
    paymentLabel: string;
    createdAt: string | Date;
  }>,
  canSeeMoney: boolean
) {
  // ⑦ ช่าง/กราฟิกไม่เห็นเงิน — ตัดคอลัมน์ยอดรวมออกทั้ง header + row
  const header = [
    "เลขออเดอร์",
    "ชื่องาน",
    "ลูกค้า",
    "บริษัท",
    "ช่องทาง",
    "ประเภท",
    "สถานะลูกค้า",
    "สถานะภายใน",
    ...(canSeeMoney ? ["ยอดรวม"] : []),
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
    ...(canSeeMoney ? [String(o.totalAmount ?? 0)] : []),
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
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <OrdersPageContent />
    </Suspense>
  );
}

function OrdersPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const rawChannel = searchParams.get("channel") ?? "";
  const channel = Object.hasOwn(CHANNEL_LABELS, rawChannel) ? rawChannel : "";
  const rawOrderType = searchParams.get("type") ?? "";
  const orderType = rawOrderType === "READY_MADE" || rawOrderType === "CUSTOM"
    ? rawOrderType
    : "";
  const rawCustomerStatus = searchParams.get("customerStatus") ?? "";
  const customerStatus = Object.hasOwn(CUSTOMER_STATUS_LABELS, rawCustomerStatus)
    ? rawCustomerStatus
    : "";
  const rawInternalStatus = searchParams.get("status") ?? "";
  const internalStatus = Object.hasOwn(INTERNAL_STATUS_LABELS, rawInternalStatus)
    ? rawInternalStatus
    : "";
  const createdAfter = validDateParam(searchParams.get("from"));
  const createdBefore = validDateParam(searchParams.get("to"));
  const rawAttention = searchParams.get("attention") ?? "";
  const attention = ATTENTION_FILTERS.some((option) => option.value === rawAttention)
    ? rawAttention
    : "";
  const rawSort = searchParams.get("sort") ?? "createdAt:desc";
  const page = positivePage(searchParams.get("page"));
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showFilters, setShowFilters] = useState(false);

  const replaceListState = useCallback(
    (updates: Record<string, string | null>) => {
      // อ่าน query ล่าสุดตอน action ทำงาน เพื่อให้ debounce ค้นหาไม่ทับ filter ที่เพิ่งกด
      const next = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(updates)) {
        if (
          !value ||
          (key === "page" && value === "1") ||
          (key === "sort" && value === "createdAt:desc")
        ) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    []
  );
  useEffect(() => {
    if (searchInputRef.current && searchInputRef.current.value !== search) {
      searchInputRef.current.value = search;
    }
  }, [search]);

  const { data: me } = trpc.user.me.useQuery();
  // เปิดออเดอร์ = สิทธิ์ขาย (order.create ใช้ salesUp) — ช่าง/กราฟิก/บัญชี ไม่โชว์ปุ่มสร้าง (B12)
  const canCreateOrder = permAllows(me?.permissions, "create_sales_docs");
  // ⑦ ช่าง/กราฟิกไม่เห็นเงินฝั่งขาย — ซ่อนคอลัมน์ยอดรวม + sort ยอดรวม (ระหว่างโหลด me = ซ่อนไว้ก่อน ปลอดภัยกว่า)
  const canSeeMoney = permAllows(me?.permissions, "see_order_money");
  const sortOptions = canSeeMoney
    ? SORT_OPTIONS
    : SORT_OPTIONS.filter((o) => !o.value.startsWith("totalAmount"));
  const sort = sortOptions.some((option) => option.value === rawSort)
    ? rawSort
    : "createdAt:desc";
  const [sortBy, sortOrder] = sort.split(":") as [
    "createdAt" | "totalAmount" | "orderNumber" | "deadline",
    "asc" | "desc",
  ];

  const { data, isLoading, isFetching, isError, refetch } = trpc.order.list.useQuery(
    {
      search: search.trim() || undefined,
      channel: channel || undefined,
      orderType: (orderType as OrderType) || undefined,
      customerStatus: (customerStatus as CustomerStatus) || undefined,
      internalStatus: (internalStatus as InternalStatus) || undefined,
      createdAfter: createdAfter || undefined,
      createdBefore: createdBefore || undefined,
      attention: (attention as OrderAttention) || undefined,
      sortBy,
      sortOrder,
      page,
      limit: 20,
    },
    { placeholderData: (previous) => previous }
  );

  useEffect(() => {
    if (data && page > data.pages && data.pages >= 1) {
      replaceListState({ page: String(data.pages) });
    }
  }, [data, page, replaceListState]);

  // attention ไม่นับในป้ายกล่องตัวกรอง — มันมีบ้านเป็นแถว chip บนผิวหน้าแล้ว
  const activeFilterCount = [
    channel,
    orderType,
    customerStatus,
    internalStatus,
    createdAfter,
    createdBefore,
  ].filter(Boolean).length;

  const clearFilters = () => {
    replaceListState({
      channel: null,
      type: null,
      customerStatus: null,
      status: null,
      attention: null,
      from: null,
      to: null,
      page: null,
    });
  };

  // empty state ตอนหาไม่เจอ: ล้างตัวกรอง + คำค้นในจังหวะเดียว (คนละปุ่มกับในกล่องตัวกรองที่ล้างเฉพาะ filter)
  const hasActiveFilters = activeFilterCount > 0 || Boolean(attention) || Boolean(search);
  const clearFiltersAndSearch = () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    replaceListState({
      q: null,
      channel: null,
      type: null,
      customerStatus: null,
      status: null,
      attention: null,
      from: null,
      to: null,
      page: null,
    });
  };

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
                onClick={() => exportOrdersCsv(data.orders, canSeeMoney)}
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            )}
            {canCreateOrder && (
              <Button asChild size="sm">
                <Link href="/orders/new">
                  <Plus className="h-4 w-4" />
                  สร้างออเดอร์
                </Link>
              </Button>
            )}
          </>
        }
      />

      {/* Toolbar + attention filter (คำถามหลักของหน้านี้ — โชว์ตลอด ไม่ต้องกางกล่องตัวกรอง) */}
      <div className="space-y-2.5">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <SearchInput
          ref={searchInputRef}
          containerClassName="flex-1"
          placeholder="ค้นหาเลขออเดอร์, ชื่อ, ลูกค้า..."
          defaultValue={search}
          onChange={(event) => {
            if (searchTimer.current) clearTimeout(searchTimer.current);
            const value = event.target.value;
            searchTimer.current = setTimeout(
              () => replaceListState({ q: value.trim() || null, page: null }),
              300
            );
          }}
        />

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
            <NativeSelect
              value={sort}
              onChange={(e) =>
                replaceListState({ sort: e.target.value, page: null })
              }
              className="h-9 px-2 text-xs"
            >
              {sortOptions.map((o) => (
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

      {/* ความเร่งด่วน — คำถามหลักที่เปิดหน้านี้มาถามทุกเช้า โชว์เป็นแถว chip ตลอด ไม่ฝังในกล่องพับ */}
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="กรองตามความเร่งด่วน"
      >
        {ATTENTION_FILTERS.map((filter) => (
          <FilterChip
            key={filter.value || "all"}
            selected={attention === filter.value}
            onClick={() =>
              replaceListState({ attention: filter.value || null, page: null })
            }
          >
            {filter.label}
          </FilterChip>
        ))}
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
                  onClick={() =>
                    replaceListState({ channel: f.value || null, page: null })
                  }
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
                  onClick={() =>
                    replaceListState({ type: f.value || null, page: null })
                  }
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
                  onClick={() =>
                    replaceListState({ customerStatus: f.value || null, page: null })
                  }
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
                  onClick={() =>
                    replaceListState({ status: f.value || null, page: null })
                  }
                >
                  {f.label}
                </FilterChip>
              ))}
            </FilterRow>
            <FilterRow label="วันที่สร้าง">
              <Input
                aria-label="วันที่สร้างตั้งแต่"
                type="date"
                value={createdAfter}
                onChange={(e) =>
                  replaceListState({ from: e.target.value || null, page: null })
                }
                className="w-36 text-xs"
              />
              <span className="text-xs text-slate-400">ถึง</span>
              <Input
                aria-label="วันที่สร้างถึง"
                type="date"
                value={createdBefore}
                onChange={(e) =>
                  replaceListState({ to: e.target.value || null, page: null })
                }
                className="w-36 text-xs"
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

      <ResponsiveList
        items={data?.orders}
        isLoading={isLoading || isFetching}
        isError={isError}
        errorMessage="โหลดรายการออเดอร์ไม่สำเร็จ"
        onRetry={() => refetch()}
        label="ออเดอร์"
        renderDesktop={(orders) => (
          <DataTable.Root>
            <DataTable.Head>
              <tr>
                <DataTable.Th>เลขออเดอร์</DataTable.Th>
                <DataTable.Th>ลูกค้า / งาน</DataTable.Th>
                <DataTable.Th>ช่องทาง</DataTable.Th>
                <DataTable.Th>สถานะ</DataTable.Th>
                {canSeeMoney && <DataTable.Th align="right">ยอดรวม</DataTable.Th>}
                <DataTable.Th>การชำระ</DataTable.Th>
                <DataTable.Th>กำหนดส่ง</DataTable.Th>
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {orders.map((order) => (
                <DataTable.Row key={order.id}>
                  <DataTable.Td>
                    <Link
                      href={`/orders/${order.id}`}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {order.orderNumber}
                    </Link>
                  </DataTable.Td>
                  <DataTable.Td>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900 dark:text-white">
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
                  <DataTable.Td className="text-xs text-slate-600 dark:text-slate-400">
                    {CHANNEL_LABELS[order.channel] ?? order.channel}
                  </DataTable.Td>
                  <DataTable.Td>
                    <OrderStatusBadge
                      customerStatus={order.customerStatus}
                      internalStatus={order.internalStatus}
                      compact
                    />
                  </DataTable.Td>
                  {canSeeMoney && (
                    <DataTable.Td
                      align="right"
                      className="font-medium tabular-nums text-slate-900 dark:text-white"
                    >
                      {formatCurrency(order.totalAmount ?? 0)}
                    </DataTable.Td>
                  )}
                  <DataTable.Td>
                    <PaymentIndicator status={order.paymentLabel} />
                  </DataTable.Td>
                  <DataTable.Td
                    className={cn(
                      "text-xs",
                      deadlineToneClass(order.deadline, order.internalStatus) ??
                        "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    {order.deadline ? formatDate(order.deadline) : "—"}
                  </DataTable.Td>
                </DataTable.Row>
              ))}
            </DataTable.Body>
          </DataTable.Root>
        )}
        renderMobile={(orders) => (
          <div role="list" aria-label="รายการออเดอร์" className="space-y-3">
            {orders.map((order) => (
              <article key={order.id} role="listitem" className="card-surface rounded-2xl">
                <Link
                  href={`/orders/${order.id}`}
                  className="block min-h-11 rounded-2xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label={`เปิดออเดอร์ ${order.orderNumber} ${order.customer?.name ?? ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-blue-700 dark:text-blue-300">
                        {order.orderNumber}
                      </p>
                      <p className="mt-1 truncate font-medium text-slate-900 dark:text-white">
                        {order.customer?.name ?? "—"}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {order.title}
                      </p>
                    </div>
                    <ChevronRight aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-slate-400" />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <OrderStatusBadge
                      customerStatus={order.customerStatus}
                      internalStatus={order.internalStatus}
                      compact
                    />
                    {order.orderType === "CUSTOM" && (
                      <Badge variant="accent" size="sm">Custom</Badge>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">ช่องทาง</p>
                      <p className="mt-0.5 text-slate-800 dark:text-slate-200">
                        {CHANNEL_LABELS[order.channel] ?? order.channel}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">การชำระ</p>
                      <div className="mt-0.5"><PaymentIndicator status={order.paymentLabel} /></div>
                    </div>
                    <div
                      className={cn(
                        "inline-flex items-center gap-1.5",
                        deadlineToneClass(order.deadline, order.internalStatus) ??
                          "text-slate-500 dark:text-slate-400"
                      )}
                    >
                      <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
                      {order.deadline ? `กำหนด ${formatDate(order.deadline)}` : `เปิด ${formatDate(order.createdAt)}`}
                    </div>
                    {canSeeMoney && (
                      <p className="text-right font-semibold tabular-nums text-slate-900 dark:text-white">
                        {formatCurrency(order.totalAmount ?? 0)}
                      </p>
                    )}
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
        emptyState={
          <EmptyState
            icon={ShoppingCart}
            title="ไม่พบออเดอร์"
            description={
              hasActiveFilters
                ? "ลองล้างตัวกรองหรือปรับคำค้นหา"
                : "เริ่มสร้างออเดอร์แรกของคุณได้เลย"
            }
            action={
              hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={clearFiltersAndSearch}>
                  ล้างตัวกรองและคำค้น
                </Button>
              ) : canCreateOrder ? (
                <Button asChild size="sm">
                  <Link href="/orders/new">
                    <Plus className="h-4 w-4" />
                    สร้างออเดอร์
                  </Link>
                </Button>
              ) : undefined
            }
          />
        }
        pagination={
          data && data.orders.length > 0 ? (
            <TablePagination
              page={page}
              totalPages={data.pages}
              total={data.total}
              onPageChange={(nextPage) =>
                replaceListState({ page: String(nextPage) })
              }
            />
          ) : undefined
        }
      />
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
