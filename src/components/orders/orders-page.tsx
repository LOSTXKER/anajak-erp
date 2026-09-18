"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { Download, Filter, Plus, Search, X } from "lucide-react";
import type { CustomerStatus, InternalStatus, OrderType } from "@prisma/client";
import { useListPageState, usePageClamp } from "@/hooks/use-list-page-state";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { canCreateOrderWithPricing } from "@/lib/order-access";
import { c, Empty } from "@/components/kit/kit";
import { QueryError } from "@/components/ui/query-error";
import { KitDateRange } from "@/components/kit/date-range";
import { OrderPipeline } from "@/components/orders/list/order-pipeline";
import { OrderPeekPanel } from "@/components/orders/list/order-peek-panel";
import { OrdersPager } from "@/components/orders/list/orders-pager";
import { OrdersTable } from "@/components/orders/list/orders-table";
import {
  CHANNEL_LABELS,
  CUSTOMER_STATUS_LABELS,
  INTERNAL_STATUS_LABELS,
  ORDER_TYPE_UI_LABELS,
} from "@/lib/order-status";
import { hasActiveOrderListFilters } from "@/lib/order-list-ui";
import { formatDateNumeric } from "@/lib/utils";
import { PAYMENT_STATUS_LABELS } from "@/lib/status-config";
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
   หน้ารายการออเดอร์ — ต้นแบบรอบ 2 listPage() ทีละชิ้น
   (รื้อเขียนใหม่ 2026-09-15 หลังเบสบอก "UI มันไม่เหมือนกันเลย … รื้อเขียนใหม่ refactor ไปเลย")
   ต้นแบบ: สมอง records/projects/anajak-erp/mockup-orders-minimal-2026-09-14.html

   รอบโล่งขึ้น 2026-09-16 (ต้นแบบ mockup-orders-list-lite-2026-09-16): หัวไม่มีบรรทัดสรุป · การ์ดเส้นสถานะไม่มีหัว
   → การ์ดรายการ (ค้นหา / ปฏิทินช่วงวันที่ / ช่องทาง / ประเภท / ป้ายตัวกรองที่ล้างได้) → ตาราง → แบ่งหน้า
   กดแถวดูย่อทางขวา ↑↓ ไล่ใบ Esc ปิด
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
  // ไฟล์ที่ส่งออกต้องอ่านแล้วตรงกับที่เห็นบนตาราง — คำเดียวกับ PayTag/หน้าการเงิน
  const paymentLabelMap: Record<string, string> = {
    paid: PAYMENT_STATUS_LABELS.PAID,
    unpaid: PAYMENT_STATUS_LABELS.UNPAID,
    partial: PAYMENT_STATUS_LABELS.PARTIALLY_PAID,
    overdue: PAYMENT_STATUS_LABELS.OVERDUE,
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
    formatDateNumeric(o.createdAt),
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

/** คืนโฟกัสให้ปุ่มเลขออเดอร์ของแถวที่ดูย่อ: ทำทันที (rAF หยุดในแท็บที่ถูกซ่อน) รอเฟรมถัดไปเฉพาะตอนแถวยังไม่ขึ้น */
function focusPeekTrigger(id: string) {
  const find = () => document.querySelector<HTMLElement>(`[data-peek-trigger="${id}"]`);
  const trigger = find();
  if (trigger) trigger.focus();
  else requestAnimationFrame(() => find()?.focus());
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<OrdersLoading />}>
      <OrdersPageContent />
    </Suspense>
  );
}

function OrdersLoading() {
  return (
    <div className={c("tokens page")} role="status" aria-label="กำลังโหลดรายการออเดอร์">
      <span className={c("sk")} style={{ height: 56, width: "40%" }} />
      <span className={c("sk")} style={{ height: 140 }} />
      <span className={c("sk")} style={{ height: 420 }} />
    </div>
  );
}

function OrdersPageContent() {
  const { search, page, searchParams, replaceListState, onSearchChange, searchInputRef, clearSearch } =
    useListPageState();
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

  // คีย์ลัด "/" = ไปช่องค้นหา (ป้าย / ในช่อง) · ไม่แย่งตอนกำลังพิมพ์/อยู่ในเมนู
  useEffect(() => {
    const onSlash = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input,textarea,select,[contenteditable=true],[role=combobox],[role=menu],[role=dialog]")) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    };
    document.addEventListener("keydown", onSlash);
    return () => document.removeEventListener("keydown", onSlash);
  }, [searchInputRef]);

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

  const canExport = Boolean(rows && rows.length > 0);

  return (
    <div className={c("tokens page")}>
      <div className={c("head")}>
        <h1>ออเดอร์</h1>
        <div className={c("acts")}>
          <button
            type="button"
            className={c("btn ghost")}
            disabled={!canExport}
            onClick={() => rows && exportOrdersCsv(rows, canSeeMoney)}
          >
            <Download aria-hidden="true" />
            ส่งออกหน้านี้
          </button>
          {canCreateOrder ? (
            <Link href="/orders/new" className={c("btn primary")}>
              <Plus aria-hidden="true" />
              สร้างออเดอร์
            </Link>
          ) : null}
        </div>
      </div>

      <section className={c("card")} aria-label="เส้นทางงาน">
        <OrderPipeline
          counts={data?.statusCounts}
          overdue={data?.overdueCounts}
          selected={internalStatus}
          onSelect={(status) => updateList({ status: status || null, page: null })}
          isLoading={isLoading}
        />
      </section>

      <section className={c("card lst")} aria-label="รายการออเดอร์">
        <div className={c("tools")}>
          <label className={c("sinput")}>
            <Search aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="search"
              defaultValue={search}
              placeholder="ค้นเลขออเดอร์หรือลูกค้า"
              aria-label="ค้นหาออเดอร์"
              onChange={(event) => {
                setPeekId(null);
                onSearchChange(event.target.value);
              }}
            />
            {search ? (
              <button
                type="button"
                className={c("clr")}
                aria-label="ล้างคำค้น"
                onClick={() => {
                  setPeekId(null);
                  clearSearch();
                  searchInputRef.current?.focus();
                }}
              >
                <X aria-hidden="true" />
              </button>
            ) : (
              <kbd aria-hidden="true">/</kbd>
            )}
          </label>
          {/* จอแคบเป็นการ์ดไม่มีหัวคอลัมน์ให้กดเรียง จึงมีช่องเรียงเฉพาะจอแคบ */}
          <select
            className={c("sel mobileonly")}
            aria-label="เรียงลำดับ"
            value={sort}
            onChange={(event) => updateList({ sort: event.target.value === DEFAULT_SORT ? null : event.target.value, page: null })}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <KitDateRange
            label="ช่วงวันที่เปิดออเดอร์"
            from={createdAfter}
            to={createdBefore}
            onChange={(from, to) => updateList({ from: from || null, to: to || null, page: null })}
          />
          <select
            className={c("sel", channel && "on")}
            aria-label="กรองช่องทาง"
            value={channel}
            onChange={(event) => updateList({ channel: event.target.value || null, page: null })}
          >
            {CHANNEL_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
          <select
            className={c("sel", orderType && "on")}
            aria-label="กรองประเภทงาน"
            value={orderType}
            onChange={(event) => updateList({ type: event.target.value || null, page: null })}
          >
            {TYPE_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
          {internalStatus ? (
            <span className={c("fchip")}>
              {INTERNAL_STATUS_LABELS[internalStatus as InternalStatus]}
              <button type="button" aria-label="ล้างตัวกรองสถานะ" onClick={() => updateList({ status: null, page: null })}>
                <X aria-hidden="true" />
              </button>
            </span>
          ) : null}
          {attention ? (
            <span className={c("fchip")}>
              <Filter aria-hidden="true" />
              {ATTENTION_FILTERS.find((filter) => filter.value === attention)?.label}
              <button
                type="button"
                aria-label="ล้างตัวกรองความเร่งด่วน"
                onClick={() => updateList({ attention: null, page: null })}
              >
                <X aria-hidden="true" />
              </button>
            </span>
          ) : null}
          <span className={c("grow")} />
          {hasActiveFilters ? (
            <button type="button" className={c("btn ghost sm")} onClick={clearFiltersAndSearch}>
              ล้างตัวกรอง
            </button>
          ) : null}
          <span className={c("sr")} aria-live="polite" aria-busy={isFetching}>
            {!data ? "" : isFetching ? "กำลังอัปเดต…" : `${data.total.toLocaleString("th-TH")} ออเดอร์`}
          </span>
        </div>

        {isError && !data ? (
          /* กล่องโหลดไม่สำเร็จใช้ชิ้นเดียวกับหน้าอื่นทั้งเว็บ (QueryError) — เดิมวาด .noresult เอง
             จนคำและปุ่มลองใหม่ของหน้านี้ไม่ตรงกับหน้าที่เหลือ
             เส้นคั่นบนใส่เองเหมือนที่ ResponsiveList ใส่ให้หน้าอื่น เพราะการ์ดนี้แยกแถบเครื่องมือ
             ออกจากเนื้อรายการด้วยเส้น (กล่องว่าง .empty ข้างล่างก็มีเส้นเดียวกัน) */
          <div className="border-t border-divider/60">
            <QueryError message="โหลดรายการออเดอร์ไม่สำเร็จ" onRetry={() => void refetch()} />
          </div>
        ) : !rows ? (
          <div className={c("cb")} role="status" aria-label="กำลังโหลดรายการออเดอร์">
            <div className={c("skstack")}>
              <span className={c("sk skrow")} />
              <span className={c("sk skrow")} />
              <span className={c("sk skrow")} />
            </div>
          </div>
        ) : rows.length === 0 ? (
          /* กล่องว่างใช้ชิ้นเดียวกับที่อื่นทั้งเว็บ (Empty ของชุดกลาง) — เดิมวาด .noresult เอง
             จนกล่อง "ไม่เจอ" หน้านี้ไม่เหมือนหน้าอื่น */
          hasActiveFilters ? (
            <Empty
              icon={Search}
              title="ไม่พบออเดอร์ตามตัวกรองนี้"
              action={
                <button type="button" className={c("btn sm")} onClick={clearFiltersAndSearch}>
                  ล้างตัวกรองและคำค้น
                </button>
              }
            />
          ) : (
            <Empty
              icon={Search}
              title="ยังไม่มีออเดอร์"
              action={
                canCreateOrder ? (
                  <Link href="/orders/new" className={c("btn primary sm")}>
                    <Plus aria-hidden="true" />
                    สร้างออเดอร์
                  </Link>
                ) : undefined
              }
            />
          )
        ) : (
          <>
            <div aria-busy={isFetching} className={c(isFetching && "busy")}>
              <OrdersTable
                orders={rows}
                canSeeMoney={canSeeMoney}
                peekId={peekOrder ? peekOrder.id : null}
                onPeek={setPeekId}
                sortColumn={sortColumn}
              />
            </div>
            <OrdersPager
              page={page}
              pages={data?.pages ?? 1}
              total={data?.total ?? rows.length}
              limit={20}
              onPageChange={(nextPage) => updateList({ page: String(nextPage) })}
            />
          </>
        )}
      </section>

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
