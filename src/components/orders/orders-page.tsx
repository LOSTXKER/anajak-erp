"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Download, MoreHorizontal, Plus, ShoppingCart, Workflow, X } from "lucide-react";
import type { CustomerStatus, InternalStatus, OrderType } from "@prisma/client";
import { useListPageState, usePageClamp } from "@/hooks/use-list-page-state";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { canCreateOrderWithPricing } from "@/lib/order-access";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { ListPageSkeleton } from "@/components/ui/page-skeleton";
import { QueryError } from "@/components/ui/query-error";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/ui/table-pagination";
import { Toolbar } from "@/components/ui/toolbar";
import { MENU_ITEM, OVERLAY_PANEL } from "@/components/ui/tokens";
import { HomeCard } from "@/components/dashboard/home/home-card";
import { OrderPipeline } from "@/components/orders/list/order-pipeline";
import { OrderPeekPanel } from "@/components/orders/list/order-peek-panel";
import { OrdersTable } from "@/components/orders/list/orders-table";
import { cn } from "@/lib/utils";
import {
  CHANNEL_LABELS,
  CUSTOMER_STATUS_LABELS,
  INTERNAL_STATUS_LABELS,
  ORDER_TYPE_UI_LABELS,
} from "@/lib/order-status";
import { hasActiveOrderListFilters } from "@/lib/order-list-ui";
import { ordersHeadline } from "@/lib/order-list-view";
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
} from "@/lib/order-list-contract";

/* ============================================================
   หน้ารายการออเดอร์ (รื้อ 2026-09-14 ตามต้นแบบรอบ 2 · เบส "โอเคทำจริงเลย")
   ต้นแบบ: สมอง records/projects/anajak-erp/mockup-orders-minimal-2026-09-14.html

   หัวหน้า (ตัวเลขทั้งหมด/กำลังเดิน/เลยกำหนด) → ราง pipeline กรองสถานะ → ตารางในการ์ด
   (ค้นหา/วันที่/ช่องทาง/ประเภทอยู่หัวการ์ด) → กดแถวดูย่อทางขวา, ↑↓ ไล่ใบ, Esc ปิด
   สถานะ/ตัวกรอง/หน้า/การเรียงอยู่ใน URL ชุดเดิม ลิงก์จากหน้าแรก (?status= ?attention=) ใช้ได้เหมือนเดิม
   ============================================================ */

function exportOrdersCsv(
  orders: Array<{
    orderNumber: string;
    customer: { name: string; company?: string | null } | null;
    channel: string;
    orderType: string;
    customerStatus: string;
    internalStatus: string;
    totalAmount: number | null;
    paymentLabel: string;
    createdAt: string | Date;
  }>,
  canSeeMoney: boolean,
) {
  // ช่าง/กราฟิกไม่เห็นเงิน — ตัดคอลัมน์ยอดรวมออกทั้ง header + row
  const header = [
    "เลขออเดอร์",
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
    o.customer?.name ?? "",
    o.customer?.company ?? "",
    CHANNEL_LABELS[o.channel] ?? o.channel,
    ORDER_TYPE_UI_LABELS[o.orderType as OrderType] ?? o.orderType,
    CUSTOMER_STATUS_LABELS[o.customerStatus as CustomerStatus] ?? o.customerStatus,
    INTERNAL_STATUS_LABELS[o.internalStatus as InternalStatus] ?? o.internalStatus,
    ...(canSeeMoney ? [String(o.totalAmount ?? 0)] : []),
    paymentLabelMap[o.paymentLabel] ?? "—",
    new Date(o.createdAt).toLocaleDateString("th-TH"),
  ]);
  const escape = (v: string) =>
    v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v;
  const csv = "﻿" + [header, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** คืนโฟกัสให้ปุ่มของแถวที่เพิ่งดูย่อ — ปิดแผงแล้วคีย์บอร์ดไม่หลุดไปต้นหน้า */
/** คืนโฟกัสให้ปุ่มเลขออเดอร์ของแถวที่ดูย่อ: ทำทันที (rAF หยุดในแท็บที่ถูกซ่อน) รอเฟรมถัดไปเฉพาะตอนแถวยังไม่ขึ้น */
function focusPeekTrigger(id: string) {
  const find = () => document.querySelector<HTMLElement>(`[data-peek-trigger="${id}"]`);
  const trigger = find();
  if (trigger) trigger.focus();
  else requestAnimationFrame(() => find()?.focus());
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <OrdersPageContent />
    </Suspense>
  );
}

function OrdersPageContent() {
  const {
    search,
    page,
    searchParams,
    replaceListState,
    onSearchChange,
    searchInputRef,
    clearSearch,
  } = useListPageState();
  const rawChannel = searchParams.get("channel") ?? "";
  const channel = Object.hasOwn(CHANNEL_LABELS, rawChannel) ? rawChannel : "";
  const rawOrderType = searchParams.get("type") ?? "";
  const orderType = rawOrderType === "READY_MADE" || rawOrderType === "CUSTOM" ? rawOrderType : "";
  const rawInternalStatus = searchParams.get("status") ?? "";
  const internalStatus = Object.hasOwn(INTERNAL_STATUS_LABELS, rawInternalStatus) ? rawInternalStatus : "";
  const createdAfter = validDateParam(searchParams.get("from"));
  const createdBefore = validDateParam(searchParams.get("to"));
  const rawAttention = searchParams.get("attention") ?? "";
  const attention = ATTENTION_FILTERS.some((option) => option.value === rawAttention) ? rawAttention : "";
  const rawSort = searchParams.get("sort");

  const { data: me } = trpc.user.me.useQuery();
  // เปิดออเดอร์ต้องสร้างเอกสารขายและเห็นราคาได้ — ด่านเดียวกับ route เพื่อไม่ให้ CTA พาไปชน AccessDenied
  const canCreateOrder = canCreateOrderWithPricing(me?.permissions);
  // ช่าง/กราฟิกไม่เห็นเงินฝั่งขาย — ซ่อนยอด + sort ยอด (ระหว่างโหลด me = ซ่อนไว้ก่อน ปลอดภัยกว่า)
  const canSeeMoney = permAllows(me?.permissions, "see_order_money");
  const { sortOptions, sort, sortBy, sortOrder } = resolveOrderListSort(rawSort, canSeeMoney);

  const [peekId, setPeekId] = useState<string | null>(null);
  // เปลี่ยนตัวกรอง/หน้า/การเรียง = ชุดแถวเปลี่ยน · ปิดดูย่อก่อน ไม่ให้แผงค้างใบที่หายไปจากตาราง
  const updateList = (updates: Record<string, string | null>) => {
    setPeekId(null);
    replaceListState(updates);
  };

  const sortColumn = (key: SortKey) => ({
    direction: sortBy === key ? sortOrder : null,
    defaultDirection: SORT_DEFAULT_DIRECTION[key],
    onSort: (direction: SortDirection) => {
      const value = `${key}:${direction}`;
      updateList({ sort: value === DEFAULT_SORT ? null : value, page: null });
    },
  });

  const { data, isLoading, isFetching, isError, refetch } = trpc.order.list.useQuery(
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
      limit: 20,
    },
    { placeholderData: (previous) => previous },
  );

  usePageClamp(page, data?.pages, replaceListState);

  const rows = data?.orders;
  const peekIndex = peekId && rows ? rows.findIndex((order) => order.id === peekId) : -1;
  const peekOrder = rows && peekIndex >= 0 ? rows[peekIndex]! : null;

  const closePeek = () => {
    if (peekId) focusPeekTrigger(peekId);
    setPeekId(null);
  };

  useEffect(() => {
    if (!peekId || !rows) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input,textarea,select,[contenteditable=true],[role=combobox],[role=menu],[role=dialog]")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        focusPeekTrigger(peekId);
        setPeekId(null);
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const index = rows.findIndex((order) => order.id === peekId);
      const next = rows[index + (event.key === "ArrowDown" ? 1 : -1)];
      if (!next) return;
      event.preventDefault();
      setPeekId(next.id);
      document.querySelector(`[data-order-row="${next.id}"]`)?.scrollIntoView({ block: "nearest" });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [peekId, rows]);

  const hasToolbarFilters = Boolean(channel || orderType || attention || createdAfter || createdBefore);
  const clearToolbarFilters = () => {
    updateList({ channel: null, type: null, attention: null, from: null, to: null, page: null });
  };
  // empty state ตอนหาไม่เจอ: นับทั้งสถานะ/วันที่/คำค้น แล้วล้างทุกอย่างในจังหวะเดียว
  const hasActiveFilters = hasActiveOrderListFilters({
    search,
    channel,
    orderType,
    internalStatus,
    attention,
    createdAfter,
    createdBefore,
  });
  const clearFiltersAndSearch = () => {
    setPeekId(null);
    clearSearch({ channel: null, type: null, status: null, attention: null, from: null, to: null });
  };

  const headline = ordersHeadline(data?.statusCounts, data?.overdueCounts);
  const canExport = Boolean(rows && rows.length > 0);

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-strong">ออเดอร์</h1>
          {data ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <span>
                <span className="font-medium tabular-nums text-secondary">{headline.total.toLocaleString("th-TH")}</span> ใบทั้งหมด
              </span>
              <span aria-hidden="true">·</span>
              <span>
                กำลังเดิน <span className="font-medium tabular-nums text-secondary">{headline.active.toLocaleString("th-TH")}</span>
              </span>
              {headline.overdue > 0 ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-red-700 dark:text-red-300">
                    เลยกำหนด <span className="tabular-nums">{headline.overdue.toLocaleString("th-TH")}</span>
                  </span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {canExport && rows ? (
            <Button variant="outline" onClick={() => exportOrdersCsv(rows, canSeeMoney)} className="hidden sm:inline-flex">
              <Download />
              ส่งออกหน้านี้
            </Button>
          ) : null}
          {canCreateOrder ? (
            <Button asChild>
              <Link href="/orders/new">
                <Plus />
                สร้างออเดอร์
              </Link>
            </Button>
          ) : null}
          {canExport && rows ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button variant="outline" size="icon" aria-label="เพิ่มเติม" className="sm:hidden">
                  <MoreHorizontal />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={6} className={cn(OVERLAY_PANEL, "z-50 min-w-48 p-1")}>
                  <DropdownMenu.Item
                    className={cn(MENU_ITEM, "min-h-11 rounded-lg")}
                    onSelect={() => exportOrdersCsv(rows, canSeeMoney)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      ส่งออกหน้านี้
                    </span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : null}
        </div>
      </header>

      <HomeCard id="orders-pipeline" title="เส้นทางงาน" icon={Workflow} tone="brand">
        <OrderPipeline
          counts={data?.statusCounts}
          overdue={data?.overdueCounts}
          selected={internalStatus}
          onSelect={(status) => updateList({ status: status || null, page: null })}
          isLoading={isLoading}
        />
      </HomeCard>

      <HomeCard
        id="orders-table"
        title={internalStatus ? INTERNAL_STATUS_LABELS[internalStatus as InternalStatus] : "ทุกสถานะ"}
        icon={ShoppingCart}
        action={
          hasToolbarFilters ? (
            <>
              {/* ป้ายตัวกรองความเร่งด่วนที่ค้างมาจากหน้าแรก (?attention=) — ต้องเห็นว่ากรองอะไรอยู่และล้างได้ */}
              {attention ? (
                <span className="inline-flex items-center gap-1.5 border-b-2 border-blue-600 py-1 pl-1 text-xs font-semibold text-blue-700 dark:border-blue-400 dark:text-blue-400">
                  {ATTENTION_FILTERS.find((f) => f.value === attention)?.label}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="ล้างตัวกรองความเร่งด่วน"
                    onClick={() => updateList({ attention: null, page: null })}
                    className="h-6 w-6 min-w-0 text-current"
                  >
                    <X />
                  </Button>
                </span>
              ) : null}
              <Button variant="ghost" size="sm" onClick={clearToolbarFilters} className="px-2 text-secondary">
                <X />
                ล้างตัวกรอง
              </Button>
            </>
          ) : undefined
        }
      >
        <div className="px-4 pb-3 sm:px-5">
          <Toolbar>
            <SearchInput
              ref={searchInputRef}
              containerClassName="@2xl:max-w-sm @2xl:flex-1"
              surface="raised"
              placeholder="ค้นหาเลขออเดอร์ หรือลูกค้า..."
              defaultValue={search}
              onChange={(event) => {
                setPeekId(null);
                onSearchChange(event.target.value);
              }}
            />
            <div className="grid w-full min-w-0 grid-cols-2 items-center gap-2 @2xl:flex @2xl:w-auto @2xl:flex-nowrap">
              {/* จอกว้างเรียงที่หัวคอลัมน์ · จอแคบเป็นการ์ดไม่มีหัวคอลัมน์ จึงยังต้องมีช่องเรียง */}
              <Select
                surface="raised"
                aria-label="เรียงลำดับ"
                value={sort}
                onChange={(e) => updateList({ sort: e.target.value === DEFAULT_SORT ? null : e.target.value, page: null })}
                className="w-full min-w-0 px-3 lg:hidden"
              >
                {sortOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <div className="min-w-0 [&>span]:w-full @2xl:flex-none">
                <DateRangePicker
                  from={createdAfter}
                  to={createdBefore}
                  className="w-full min-w-0 justify-start @2xl:w-auto"
                  onChange={(f, t) => updateList({ from: f || null, to: t || null, page: null })}
                />
              </div>
              <Select
                surface="raised"
                aria-label="กรองช่องทางออเดอร์"
                value={channel}
                onChange={(event) => updateList({ channel: event.target.value || null, page: null })}
                className="min-w-0 @2xl:w-40"
              >
                {CHANNEL_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </Select>
              <Select
                surface="raised"
                aria-label="กรองประเภทออเดอร์"
                value={orderType}
                onChange={(event) => updateList({ type: event.target.value || null, page: null })}
                className="min-w-0 @2xl:w-40"
              >
                {TYPE_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </Select>
            </div>
            {data ? (
              <p
                aria-busy={isFetching}
                aria-live="polite"
                className="self-end whitespace-nowrap text-xs tabular-nums text-muted @2xl:ml-auto @2xl:self-auto"
              >
                {isFetching ? "กำลังอัปเดต…" : `${data.total.toLocaleString("th-TH")} ออเดอร์`}
              </p>
            ) : null}
          </Toolbar>
        </div>

        {isError && !data ? (
          <div className="border-t border-divider">
            <QueryError message="โหลดรายการออเดอร์ไม่สำเร็จ" onRetry={() => void refetch()} />
          </div>
        ) : !rows ? (
          <div className="space-y-2 border-t border-divider px-4 py-4 sm:px-5" role="status" aria-label="กำลังโหลดรายการออเดอร์">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="border-t border-divider">
            <EmptyState
              icon={ShoppingCart}
              title="ไม่พบออเดอร์"
              description={hasActiveFilters ? "ลองล้างตัวกรองหรือปรับคำค้นหา" : undefined}
              action={
                hasActiveFilters ? (
                  <Button variant="outline" size="sm" onClick={clearFiltersAndSearch}>
                    ล้างตัวกรองและคำค้น
                  </Button>
                ) : canCreateOrder ? (
                  <Button asChild size="sm">
                    <Link href="/orders/new">
                      <Plus />
                      สร้างออเดอร์
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <div aria-busy={isFetching} className={cn("border-t border-divider transition-opacity", isFetching && "opacity-60")}>
              <OrdersTable
                orders={rows}
                canSeeMoney={canSeeMoney}
                peekId={peekOrder ? peekOrder.id : null}
                onPeek={setPeekId}
                sortColumn={sortColumn}
              />
            </div>
            {data && data.pages > 1 ? (
              <div className="border-t border-divider px-4 py-3 sm:px-5">
                <TablePagination
                  page={page}
                  totalPages={data.pages}
                  total={data.total}
                  limit={20}
                  onPageChange={(nextPage) => updateList({ page: String(nextPage) })}
                />
              </div>
            ) : null}
          </>
        )}
      </HomeCard>

      {peekOrder && rows ? (
        <OrderPeekPanel
          order={peekOrder}
          canSeeMoney={canSeeMoney}
          hasPrev={peekIndex > 0}
          hasNext={peekIndex < rows.length - 1}
          onPrev={() => setPeekId(rows[peekIndex - 1]?.id ?? peekOrder.id)}
          onNext={() => setPeekId(rows[peekIndex + 1]?.id ?? peekOrder.id)}
          onClose={closePeek}
        />
      ) : null}
    </div>
  );
}
