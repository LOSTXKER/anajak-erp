"use client";

import { Suspense, useState, type ReactNode } from "react";
import Link from "next/link";
import type { InternalStatus, OrderType } from "@prisma/client";
import {
  ArrowRight,
  CalendarDays,
  Filter,
  Plus,
  RotateCcw,
  SearchX,
  ShoppingCart,
} from "lucide-react";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { OrderStatusFlowBar } from "@/components/orders/order-status-flow-bar";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/ui/table-pagination";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import {
  FOCUS_BUTTON,
  INTERACTIVE_HOVER,
  INTERACTIVE_PRESSED,
  INTERACTIVE_SELECTED,
  TINT,
} from "@/components/ui/tokens";
import { useListPageState, usePageClamp } from "@/hooks/use-list-page-state";
import { canCreateOrderWithPricing } from "@/lib/order-access";
import { hasActiveOrderListFilters } from "@/lib/order-list-ui";
import {
  ATTENTION_FILTERS,
  CHANNEL_FILTERS,
  DEFAULT_SORT,
  SORT_DEFAULT_DIRECTION,
  TYPE_FILTERS,
  resolveOrderListSort,
  validDateParam,
  type OrderAttention,
  type SortDirection,
  type SortKey,
  type SortOption,
} from "@/lib/order-list-contract";
import {
  CHANNEL_LABELS,
  INTERNAL_STATUS_LABELS,
} from "@/lib/order-status";
import { permAllows } from "@/lib/permissions";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { cn, formatBaht, formatDate } from "@/lib/utils";

const PAGE_SIZE = 20;

type RegistryOrder = RouterOutput["order"]["list"]["orders"][number];
type ReplaceListState = (updates: Record<string, string | null>) => void;

type FilterFieldsProps = {
  channel: string;
  orderType: string;
  internalStatus: string;
  createdAfter: string;
  createdBefore: string;
  sort: string;
  sortOptions: readonly SortOption[];
  replaceListState: ReplaceListState;
};

function RegistrySkeleton() {
  return (
    <div
      className="redesign-orders-loading space-y-4"
      role="status"
      aria-label="กำลังโหลดทะเบียนออเดอร์"
    >
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

function RegistryListSkeleton() {
  return (
    <div
      className="redesign-orders-list-loading space-y-3"
      role="status"
      aria-label="กำลังโหลดรายการออเดอร์"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

function FilterField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("redesign-orders-filter-field min-w-0 space-y-1.5", className)}>
      <span className="block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function RegistryFilterFields({
  channel,
  orderType,
  internalStatus,
  createdAfter,
  createdBefore,
  sort,
  sortOptions,
  replaceListState,
}: FilterFieldsProps) {
  return (
    <div className="redesign-orders-filter-fields grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <FilterField label="สถานะ" className="xl:hidden">
        <Select
          surface="raised"
          aria-label="กรองตามสถานะออเดอร์"
          value={internalStatus}
          onChange={(event) =>
            replaceListState({ status: event.target.value || null, page: null })
          }
        >
          <option value="">ทุกสถานะ</option>
          {Object.entries(INTERNAL_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FilterField>

      <FilterField label="ช่องทาง">
        <Select
          surface="raised"
          aria-label="กรองตามช่องทาง"
          value={channel}
          onChange={(event) =>
            replaceListState({ channel: event.target.value || null, page: null })
          }
        >
          {CHANNEL_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </FilterField>

      <FilterField label="ประเภทงาน">
        <Select
          surface="raised"
          aria-label="กรองตามประเภทงาน"
          value={orderType}
          onChange={(event) =>
            replaceListState({ type: event.target.value || null, page: null })
          }
        >
          {TYPE_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </FilterField>

      <FilterField label="เรียงลำดับ">
        <Select
          surface="raised"
          aria-label="เรียงลำดับออเดอร์"
          value={sort}
          onChange={(event) =>
            replaceListState({
              sort: event.target.value === DEFAULT_SORT ? null : event.target.value,
              page: null,
            })
          }
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </FilterField>

      <div className="redesign-orders-date-filter space-y-1.5 sm:col-span-2 xl:col-span-1">
        <span className="block text-xs font-medium text-muted">วันที่เปิดงาน</span>
        <DateRangePicker
          from={createdAfter}
          to={createdBefore}
          placeholder="วันที่เปิดงาน"
          className="w-full"
          onChange={(from, to) =>
            replaceListState({ from: from || null, to: to || null, page: null })
          }
        />
      </div>
    </div>
  );
}

function MobileFilterDialog({
  total,
  activeCount,
  onClear,
  onClose,
  ...filterFields
}: FilterFieldsProps & {
  total: number;
  activeCount: number;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="redesign-orders-filter-sheet bottom-0 left-0 right-0 top-auto max-h-dvh w-full max-w-none translate-x-0 translate-y-0 gap-0 rounded-b-none rounded-t-xl p-0 pr-0 sm:p-0 sm:pr-0 lg:hidden">
        <DialogHeader className="border-b border-divider px-5 pb-4 pt-5 pr-14 text-left">
          <DialogTitle>ตัวกรองออเดอร์</DialogTitle>
          <DialogDescription>
            ตัวกรองทั้งหมดบันทึกใน URL และกลับมาได้ด้วยปุ่มย้อนกลับ
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-5 py-5">
          <RegistryFilterFields {...filterFields} />
        </div>

        <DialogFooter className="flex-row border-t border-divider px-5">
          {activeCount > 0 ? (
            <Button variant="outline" onClick={onClear} className="flex-1">
              ล้างตัวกรอง
            </Button>
          ) : null}
          <Button onClick={onClose} className="flex-1">
            ดู {total.toLocaleString("th-TH")} ออเดอร์
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AttentionFilters({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className="redesign-orders-attention grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
      role="group"
      aria-label="กรองงานที่ต้องสนใจ"
    >
      {ATTENTION_FILTERS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value || "all"}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              CONTROL_MIN_H,
              FOCUS_BUTTON,
              "redesign-orders-attention-button inline-flex items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors",
              active
                ? INTERACTIVE_SELECTED
                : cn("text-secondary", INTERACTIVE_HOVER, INTERACTIVE_PRESSED),
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function DeadlineIndicator({ deadline }: { deadline: Date | string | null }) {
  if (!deadline) {
    return <span className="text-xs text-muted">ยังไม่กำหนด</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs tabular-nums text-secondary">
      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
      กำหนด {formatDate(deadline)}
    </span>
  );
}

function DesktopRegistryTable({
  orders,
  canSeeMoney,
  sortBy,
  sortOrder,
  onSort,
}: {
  orders: readonly RegistryOrder[];
  canSeeMoney: boolean;
  sortBy: SortKey;
  sortOrder: SortDirection;
  onSort: (key: SortKey, direction: SortDirection) => void;
}) {
  const sortColumn = (key: SortKey) => ({
    direction: sortBy === key ? sortOrder : null,
    defaultDirection: SORT_DEFAULT_DIRECTION[key],
    onSort: (direction: SortDirection) => onSort(key, direction),
  });

  return (
    <DataTable.Root className="redesign-orders-table redesign-sheet rounded-xl">
      <DataTable.Head>
        <tr>
          <DataTable.SortableTh {...sortColumn("orderNumber")}>
            ออเดอร์
          </DataTable.SortableTh>
          <DataTable.SortableTh {...sortColumn("deadline")}>
            กำหนดส่ง
          </DataTable.SortableTh>
          <DataTable.Th>สถานะ</DataTable.Th>
          <DataTable.Th className="hidden xl:table-cell">ช่องทาง</DataTable.Th>
          {canSeeMoney ? (
            <DataTable.SortableTh align="right" {...sortColumn("totalAmount")}>
              ยอดรวม
            </DataTable.SortableTh>
          ) : null}
          <DataTable.SortableTh className="hidden xl:table-cell" {...sortColumn("createdAt")}>
            เปิดงาน
          </DataTable.SortableTh>
          <DataTable.Th align="right">เปิด</DataTable.Th>
        </tr>
      </DataTable.Head>
      <DataTable.Body>
        {orders.map((order) => {
          const href = `/redesign/orders/${order.id}`;
          return (
            <DataTable.Row
              key={order.id}
              href={href}
              className="redesign-orders-row"
            >
              <DataTable.Td>
                <Link
                  href={href}
                  className={cn(
                    FOCUS_BUTTON,
                    "inline-flex rounded px-1 font-semibold tabular-nums text-blue-700 dark:text-blue-300",
                  )}
                >
                  {order.orderNumber}
                </Link>
                <p className="mt-1 max-w-72 truncate font-medium text-strong">
                  {order.customer?.company || order.customer?.name || "ไม่ระบุลูกค้า"}
                </p>
                <p className="mt-0.5 max-w-72 truncate text-xs text-muted">
                  {order.title || "ยังไม่ตั้งชื่องาน"}
                </p>
              </DataTable.Td>
              <DataTable.Td>
                <DeadlineIndicator deadline={order.deadline} />
              </DataTable.Td>
              <DataTable.Td>
                <OrderStatusBadge
                  customerStatus={order.customerStatus}
                  internalStatus={order.internalStatus}
                  compact
                />
              </DataTable.Td>
              <DataTable.Td className="hidden text-xs text-secondary xl:table-cell">
                {CHANNEL_LABELS[order.channel] ?? order.channel}
              </DataTable.Td>
              {canSeeMoney ? (
                <DataTable.Td align="right" className="tabular-nums text-strong">
                  {order.totalAmount == null ? "—" : formatBaht(order.totalAmount)}
                </DataTable.Td>
              ) : null}
              <DataTable.Td className="hidden whitespace-nowrap text-xs tabular-nums text-muted xl:table-cell">
                {formatDate(order.createdAt)}
              </DataTable.Td>
              <DataTable.Td align="right">
                <Link
                  href={href}
                  aria-label={`เปิดภาพรวมงาน ${order.orderNumber}`}
                  className={cn(
                    CONTROL_MIN_H,
                    FOCUS_BUTTON,
                    INTERACTIVE_HOVER,
                    INTERACTIVE_PRESSED,
                    "inline-flex items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-blue-700 dark:text-blue-300",
                  )}
                >
                  <span className="hidden xl:inline">ภาพรวมงาน</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </DataTable.Td>
            </DataTable.Row>
          );
        })}
      </DataTable.Body>
    </DataTable.Root>
  );
}

function MobileRegistryCards({
  orders,
  canSeeMoney,
}: {
  orders: readonly RegistryOrder[];
  canSeeMoney: boolean;
}) {
  return (
    <ul
      className="redesign-orders-mobile-list space-y-3"
      aria-label="รายการออเดอร์"
    >
      {orders.map((order) => {
        const href = `/redesign/orders/${order.id}`;
        return (
          <li key={order.id}>
            <Link
              href={href}
              aria-label={`เปิดภาพรวมงาน ${order.orderNumber} ${order.customer?.name ?? ""}`}
              className={cn(
                FOCUS_BUTTON,
                INTERACTIVE_PRESSED,
                "redesign-orders-card redesign-sheet block rounded-xl px-4 py-4 transition-colors",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold tabular-nums text-blue-700 dark:text-blue-300">
                    {order.orderNumber}
                  </p>
                  <p className="mt-1 truncate font-semibold text-strong">
                    {order.customer?.company || order.customer?.name || "ไม่ระบุลูกค้า"}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {order.title || "ยังไม่ตั้งชื่องาน"}
                  </p>
                </div>
                <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <OrderStatusBadge
                  customerStatus={order.customerStatus}
                  internalStatus={order.internalStatus}
                  compact
                />
                <DeadlineIndicator deadline={order.deadline} />
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-divider pt-3 text-xs">
                <div>
                  <dt className="text-muted">ช่องทาง</dt>
                  <dd className="mt-0.5 font-medium text-secondary">
                    {CHANNEL_LABELS[order.channel] ?? order.channel}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">เปิดงาน</dt>
                  <dd className="mt-0.5 font-medium tabular-nums text-secondary">
                    {formatDate(order.createdAt)}
                  </dd>
                </div>
                {canSeeMoney ? (
                  <div className="col-span-2">
                    <dt className="text-muted">ยอดรวม</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-strong">
                      {order.totalAmount == null ? "—" : formatBaht(order.totalAmount)}
                    </dd>
                  </div>
                ) : null}
              </dl>

              <span className="mt-4 flex min-h-11 items-center justify-between border-t border-divider pt-3 text-sm font-semibold text-blue-700 dark:text-blue-300">
                เปิดภาพรวมงาน
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function RedesignOrdersRegistry() {
  return (
    <Suspense fallback={<RegistrySkeleton />}>
      <RedesignOrdersRegistryContent />
    </Suspense>
  );
}

function RedesignOrdersRegistryContent() {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const {
    search,
    page,
    searchParams,
    replaceListState,
    onSearchChange,
    searchInputRef,
    searchTimer,
  } = useListPageState();

  const rawChannel = searchParams.get("channel") ?? "";
  const channel = Object.hasOwn(CHANNEL_LABELS, rawChannel) ? rawChannel : "";
  const rawOrderType = searchParams.get("type") ?? "";
  const orderType =
    rawOrderType === "READY_MADE" || rawOrderType === "CUSTOM"
      ? rawOrderType
      : "";
  const rawInternalStatus = searchParams.get("status") ?? "";
  const internalStatus = Object.hasOwn(INTERNAL_STATUS_LABELS, rawInternalStatus)
    ? rawInternalStatus
    : "";
  const rawAttention = searchParams.get("attention") ?? "";
  const attention = ATTENTION_FILTERS.some(
    (option) => option.value === rawAttention,
  )
    ? rawAttention
    : "";
  const createdAfter = validDateParam(searchParams.get("from"));
  const createdBefore = validDateParam(searchParams.get("to"));

  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const canSeeMoney = permAllows(me?.permissions, "see_order_money");
  const canCreateOrder = canCreateOrderWithPricing(me?.permissions);
  const { sortOptions, sort, sortBy, sortOrder } = resolveOrderListSort(
    searchParams.get("sort"),
    canSeeMoney,
  );

  const orderQuery = trpc.order.list.useQuery(
    {
      search: search.trim() || undefined,
      channel: channel || undefined,
      orderType: (orderType as OrderType) || undefined,
      internalStatus: (internalStatus as InternalStatus) || undefined,
      createdAfter: createdAfter || undefined,
      createdBefore: createdBefore || undefined,
      attention: (attention as OrderAttention) || undefined,
      sortBy,
      sortOrder,
      page,
      limit: PAGE_SIZE,
    },
    {
      enabled: Boolean(me),
      placeholderData: (previous) => previous,
    },
  );

  usePageClamp(page, orderQuery.data?.pages, replaceListState);

  const hasActiveFilters = hasActiveOrderListFilters({
    search,
    channel,
    orderType,
    internalStatus,
    attention,
    createdAfter,
    createdBefore,
  });
  const advancedFilterCount = [
    channel,
    orderType,
    internalStatus,
    createdAfter || createdBefore,
    sort === DEFAULT_SORT ? "" : sort,
  ].filter(Boolean).length;

  const clearAdvancedFilters = () => {
    replaceListState({
      channel: null,
      type: null,
      status: null,
      from: null,
      to: null,
      sort: null,
      page: null,
    });
  };

  const clearAll = () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    replaceListState({
      q: null,
      channel: null,
      type: null,
      status: null,
      attention: null,
      from: null,
      to: null,
      sort: null,
      page: null,
    });
  };

  const filterFields: FilterFieldsProps = {
    channel,
    orderType,
    internalStatus,
    createdAfter,
    createdBefore,
    sort,
    sortOptions,
    replaceListState,
  };

  const handleSort = (key: SortKey, direction: SortDirection) => {
    const value = `${key}:${direction}`;
    replaceListState({
      sort: value === DEFAULT_SORT ? null : value,
      page: null,
    });
  };

  return (
    <div className="redesign-orders-registry space-y-5">
      <header className="redesign-orders-masthead flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-strong sm:text-3xl">
            ทะเบียนออเดอร์
          </h1>
          <p className="mt-1 text-sm text-muted">
            ค้นหา กรอง และเปิดงานที่ต้องขยับต่อ
          </p>
        </div>
        {canCreateOrder ? (
          <Button asChild size="sm" className="self-start sm:self-auto">
            <Link href="/orders/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              เปิดงานใหม่
            </Link>
          </Button>
        ) : null}
      </header>

      <section
        className="redesign-orders-command redesign-sheet space-y-4 rounded-xl px-4 py-4 sm:px-5"
        aria-labelledby="redesign-orders-command-title"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <h2 id="redesign-orders-command-title" className="sr-only">
            ค้นหาและกรองออเดอร์
          </h2>
          <SearchInput
            ref={searchInputRef}
            surface="raised"
            containerClassName="redesign-orders-search min-w-0 flex-1"
            placeholder="ค้นหาเลขงาน ลูกค้า ชื่องาน หรือเลขจากช่องทาง"
            defaultValue={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          <div className="flex items-center justify-between gap-3 lg:justify-end">
            <p
              className="whitespace-nowrap text-xs tabular-nums text-muted"
              aria-live="polite"
              aria-atomic="true"
            >
              {orderQuery.isFetching
                ? "กำลังอัปเดตผลลัพธ์…"
                : orderQuery.data
                  ? `${orderQuery.data.total.toLocaleString("th-TH")} ออเดอร์`
                  : "กำลังโหลด…"}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMobileFiltersOpen(true)}
              className="redesign-orders-filter-trigger gap-2 lg:hidden"
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
              ตัวกรอง
              {advancedFilterCount > 0 ? (
                <span className="rounded-full bg-blue-600 px-1.5 text-2xs font-semibold text-white">
                  {advancedFilterCount}
                </span>
              ) : null}
            </Button>
          </div>
        </div>

        <AttentionFilters
          value={attention}
          onChange={(value) =>
            replaceListState({ attention: value || null, page: null })
          }
        />

        <div className="hidden border-t border-divider pt-4 lg:block">
          <RegistryFilterFields {...filterFields} />
        </div>
      </section>

      <section
        className="redesign-orders-status hidden xl:block"
        aria-labelledby="redesign-orders-status-title"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id="redesign-orders-status-title" className="text-sm font-semibold text-strong">
            สถานะงาน
          </h2>
          {internalStatus ? (
            <button
              type="button"
              onClick={() => replaceListState({ status: null, page: null })}
              className={cn(
                CONTROL_MIN_H,
                FOCUS_BUTTON,
                INTERACTIVE_HOVER,
                INTERACTIVE_PRESSED,
                "rounded-lg px-2 text-xs font-semibold text-blue-700 dark:text-blue-300",
              )}
            >
              ดูทุกสถานะ
            </button>
          ) : null}
        </div>
        <OrderStatusFlowBar
          counts={orderQuery.data?.statusCounts}
          selected={internalStatus}
          onSelect={(status) =>
            replaceListState({ status: status || null, page: null })
          }
          isLoading={orderQuery.isLoading}
        />
      </section>

      {orderQuery.isError && orderQuery.data ? (
        <div
          className={cn(
            TINT.error,
            "redesign-orders-background-error flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
          )}
        >
          <span role="status">อัปเดตล่าสุดไม่สำเร็จ ข้อมูลเดิมยังแสดงอยู่</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void orderQuery.refetch()}
            className="gap-1.5 self-start sm:self-auto"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            ลองใหม่
          </Button>
        </div>
      ) : null}

      <section className="redesign-orders-results" aria-labelledby="redesign-orders-results-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="redesign-orders-results-title" className="text-lg font-semibold text-strong">
            ออเดอร์ที่ตรงเงื่อนไข
          </h2>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearAll}
              className={cn(
                CONTROL_MIN_H,
                FOCUS_BUTTON,
                INTERACTIVE_HOVER,
                INTERACTIVE_PRESSED,
                "rounded-lg px-2 text-xs font-semibold text-blue-700 dark:text-blue-300",
              )}
            >
              ล้างทั้งหมด
            </button>
          ) : null}
        </div>

        {meQuery.isError && !me ? (
          <div className="redesign-orders-permission-error redesign-sheet rounded-xl">
            <QueryError
              message="โหลดสิทธิ์ผู้ใช้ไม่สำเร็จ จึงยังเปิดทะเบียนออเดอร์ไม่ได้"
              onRetry={() => void meQuery.refetch()}
            />
          </div>
        ) : (
          <ResponsiveList
            items={orderQuery.data?.orders}
            isLoading={meQuery.isLoading || orderQuery.isLoading}
            isError={orderQuery.isError && !orderQuery.data}
            errorMessage="โหลดทะเบียนออเดอร์ไม่สำเร็จ"
            onRetry={() => void orderQuery.refetch()}
            loadingState={<RegistryListSkeleton />}
            label="ออเดอร์"
            renderDesktop={(orders) => (
              <DesktopRegistryTable
                orders={orders}
                canSeeMoney={canSeeMoney}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
            )}
            renderMobile={(orders) => (
              <MobileRegistryCards orders={orders} canSeeMoney={canSeeMoney} />
            )}
            emptyState={
              <EmptyState
                icon={hasActiveFilters ? SearchX : ShoppingCart}
                title={
                  hasActiveFilters
                    ? "ไม่พบออเดอร์ที่ตรงเงื่อนไข"
                    : "ยังไม่มีออเดอร์ในระบบ"
                }
                description={
                  hasActiveFilters
                    ? "ลองล้างคำค้นและตัวกรอง แล้วค้นหาอีกครั้ง"
                    : "ออเดอร์ใหม่จะปรากฏในทะเบียนนี้ทันทีที่เปิดงาน"
                }
                action={
                  hasActiveFilters ? (
                    <Button variant="outline" size="sm" onClick={clearAll}>
                      ล้างคำค้นและตัวกรอง
                    </Button>
                  ) : canCreateOrder ? (
                    <Button asChild size="sm">
                      <Link href="/orders/new">
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        เปิดงานใหม่
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            }
            pagination={
              orderQuery.data && orderQuery.data.orders.length > 0 ? (
                <TablePagination
                  page={page}
                  totalPages={orderQuery.data.pages}
                  total={orderQuery.data.total}
                  limit={PAGE_SIZE}
                  label="ออเดอร์"
                  onPageChange={(nextPage) =>
                    replaceListState({ page: String(nextPage) })
                  }
                />
              ) : undefined
            }
          />
        )}
      </section>

      {mobileFiltersOpen ? (
        <MobileFilterDialog
          {...filterFields}
          total={orderQuery.data?.total ?? 0}
          activeCount={advancedFilterCount}
          onClear={clearAdvancedFilters}
          onClose={() => setMobileFiltersOpen(false)}
        />
      ) : null}
    </div>
  );
}
