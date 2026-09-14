"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Download, Filter, Plus, Search, ShoppingCart, Workflow, X } from "lucide-react";
import type { CustomerStatus, InternalStatus, OrderType } from "@prisma/client";
import { useListPageState, usePageClamp } from "@/hooks/use-list-page-state";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { canCreateOrderWithPricing } from "@/lib/order-access";
import { c, CardHead } from "@/components/orders/orders-ui";
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
import { BANGKOK_TZ, formatDateCompact } from "@/lib/utils";

/* ============================================================
   หน้ารายการออเดอร์ — ต้นแบบรอบ 2 listPage() ทีละชิ้น
   (รื้อเขียนใหม่ 2026-09-15 หลังเบสบอก "UI มันไม่เหมือนกันเลย … รื้อเขียนใหม่ refactor ไปเลย")
   ต้นแบบ: สมอง records/projects/anajak-erp/mockup-orders-minimal-2026-09-14.html

   หัวหน้า (ทั้งหมด/กำลังเดิน/เลยกำหนด) → การ์ดเส้นทางงาน (ราง pipeline กรองสถานะ) → การ์ดรายการ
   (ค้นหา / ช่วงวันที่ / ช่องทาง / ประเภท / จำนวน) → ตาราง → แบ่งหน้า · กดแถวดูย่อทางขวา ↑↓ ไล่ใบ Esc ปิด
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

/** คืนโฟกัสให้ปุ่มเลขออเดอร์ของแถวที่ดูย่อ: ทำทันที (rAF หยุดในแท็บที่ถูกซ่อน) รอเฟรมถัดไปเฉพาะตอนแถวยังไม่ขึ้น */
function focusPeekTrigger(id: string) {
  const find = () => document.querySelector<HTMLElement>(`[data-peek-trigger="${id}"]`);
  const trigger = find();
  if (trigger) trigger.focus();
  else requestAnimationFrame(() => find()?.focus());
}

const DAY_MS = 24 * 60 * 60 * 1000;
const bangkokYmd = new Intl.DateTimeFormat("en-CA", {
  timeZone: BANGKOK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const monthLabel = new Intl.DateTimeFormat("th-TH", { month: "short", year: "2-digit", timeZone: BANGKOK_TZ });

/** ช่วงวันที่เปิดออเดอร์แบบเลือกสำเร็จ (ต้นแบบ select ช่วงวันที่) — คิดเป็นวันปฏิทินไทย */
function datePresets(now: Date) {
  const today = bangkokYmd.format(now);
  return [
    { value: "7", label: "7 วันล่าสุด", from: bangkokYmd.format(new Date(now.getTime() - 6 * DAY_MS)), to: today },
    { value: "30", label: "30 วันล่าสุด", from: bangkokYmd.format(new Date(now.getTime() - 29 * DAY_MS)), to: today },
    { value: "m", label: `เดือนนี้ (${monthLabel.format(now)})`, from: `${today.slice(0, 8)}01`, to: today },
  ];
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
  const [now] = useState(() => new Date());

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

  const presets = datePresets(now);
  const rangeValue =
    !createdAfter && !createdBefore
      ? ""
      : (presets.find((preset) => preset.from === createdAfter && preset.to === createdBefore)?.value ?? "custom");

  const headline = ordersHeadline(data?.statusCounts, data?.overdueCounts);
  const canExport = Boolean(rows && rows.length > 0);

  return (
    <div className={c("tokens page")}>
      <div className={c("head")}>
        <div>
          <h1>ออเดอร์</h1>
          {data ? (
            <p className={c("date")}>
              <span className={c("num")}>{headline.total.toLocaleString("th-TH")}</span> ใบทั้งหมด · กำลังเดิน{" "}
              <b className={c("num")}>{headline.active.toLocaleString("th-TH")}</b>
              {headline.overdue > 0 ? (
                <>
                  {" · "}
                  <span className={c("late")}>เลยกำหนด {headline.overdue.toLocaleString("th-TH")}</span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className={c("acts")}>
          <button
            type="button"
            className={c("btn")}
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
        <CardHead
          icon={Workflow}
          tone="blue"
          title="เส้นทางงาน"
          right={
            <span className={c("legend")}>
              <span>
                <i className={c("ok")} />
                ตามกำหนด
              </span>
              <span>
                <i className={c("bad")} />
                มีงานเลยกำหนด
              </span>
            </span>
          }
        />
        <OrderPipeline
          counts={data?.statusCounts}
          overdue={data?.overdueCounts}
          selected={internalStatus}
          onSelect={(status) => updateList({ status: status || null, page: null })}
          isLoading={isLoading}
        />
      </section>

      <section className={c("card")} aria-label="รายการออเดอร์">
        <CardHead
          icon={ShoppingCart}
          title={internalStatus ? INTERNAL_STATUS_LABELS[internalStatus as InternalStatus] : "ทุกสถานะ"}
          right={
            hasActiveFilters ? (
              <>
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
                <button type="button" className={c("btn ghost sm")} onClick={clearFiltersAndSearch}>
                  <X aria-hidden="true" />
                  ล้างตัวกรอง
                </button>
              </>
            ) : undefined
          }
        />

        <div className={c("tools")}>
          <label className={c("sinput")}>
            <Search aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="search"
              defaultValue={search}
              placeholder="ค้นหาเลขออเดอร์ หรือลูกค้า"
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
          <select
            className={c("sel", rangeValue && "on")}
            aria-label="ช่วงวันที่เปิดออเดอร์"
            value={rangeValue}
            onChange={(event) => {
              const preset = presets.find((item) => item.value === event.target.value);
              updateList({ from: preset?.from ?? null, to: preset?.to ?? null, page: null });
            }}
          >
            <option value="">ทุกช่วงวันที่</option>
            {presets.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
            {rangeValue === "custom" ? (
              <option value="custom">
                {createdAfter ? formatDateCompact(createdAfter) : "…"} – {createdBefore ? formatDateCompact(createdBefore) : "…"}
              </option>
            ) : null}
          </select>
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
          <span className={c("cnt")} aria-live="polite" aria-busy={isFetching}>
            {!data ? "" : isFetching ? "กำลังอัปเดต…" : `${data.total.toLocaleString("th-TH")} ออเดอร์`}
          </span>
        </div>

        {isError && !data ? (
          <div className={c("noresult")} role="alert">
            <AlertTriangle aria-hidden="true" />
            <span>โหลดรายการออเดอร์ไม่สำเร็จ</span>
            <button type="button" className={c("btn sm")} onClick={() => void refetch()}>
              ลองอีกครั้ง
            </button>
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
          <div className={c("noresult")}>
            <Search aria-hidden="true" />
            {hasActiveFilters ? (
              <>
                <span>ไม่พบออเดอร์ตามตัวกรองนี้</span>
                <button type="button" className={c("btn sm")} onClick={clearFiltersAndSearch}>
                  ล้างตัวกรองและคำค้น
                </button>
              </>
            ) : (
              <>
                <span>ยังไม่มีออเดอร์</span>
                {canCreateOrder ? (
                  <Link href="/orders/new" className={c("btn primary sm")}>
                    <Plus aria-hidden="true" />
                    สร้างออเดอร์
                  </Link>
                ) : null}
              </>
            )}
          </div>
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
