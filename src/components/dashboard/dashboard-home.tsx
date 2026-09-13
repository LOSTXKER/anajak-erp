"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CircleAlert,
  Eye,
  LayoutGrid,
  Plus,
  Search,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { canCreateOrderWithPricing } from "@/lib/order-access";
import { permAllows } from "@/lib/permissions";
import { cn, formatBaht } from "@/lib/utils";
import { differenceInBangkokDays, toBangkokDateInput } from "@/lib/date-utils";
import { orderMockupCover } from "@/lib/mockup";
import { buildDashboardAttentionItems } from "@/lib/dashboard";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { DataTable } from "@/components/ui/data-table";
import { DueTag } from "@/components/ui/due-tag";
import { ToneMark } from "@/components/ui/section";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { MockupThumbnail } from "@/components/mockup/mockup-thumbnail";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import { FOCUS_INSET } from "@/components/ui/tokens";
import styles from "./dashboard-home.module.css";

/* ============================================================
   หน้าแรกของหัวหน้า/เจ้าของ — โครงตามต้นแบบที่เบสเคาะ 2026-09-13/14
   (ต้นแบบอยู่ในสมอง records/projects/anajak-erp/mockup-order-home-notion-2026-09-13.html)

   คิวออเดอร์ที่ยังเดินอยู่เป็นของหลัก เรียงตามกำหนดส่ง กรอง ส่งวันนี้/ต้องเช็ก ค้นหาได้
   ฝั่งขวา = แบบที่รอลูกค้าตัดสิน กับกำหนดส่งรายวัน · ตัวเลขทุกตัวบนหน้านับจากคิวชุดเดียวกัน
   ไม่มีปุ่มทางลัด/CTA ซ้ำ (เมนูซ้ายพาไปได้อยู่แล้ว) · ปุ่มเดียวคือเปิดงานใหม่
   ============================================================ */

type Filter = "all" | "today" | "attention";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "today", label: "ส่งวันนี้" },
  { key: "attention", label: "ต้องเช็ก" },
];

/** งานที่ต้องหยิบมาดูก่อน — นิยามเดียวกับป้ายในแถว จึงนับตรงกันเสมอ */
function issueOf(row: {
  dueInDays: number | null;
  internalStatus: string;
  stockReservationError: string | null;
  designPending: boolean;
}): { text: string; tone: "danger" | "warning" } | null {
  if (row.stockReservationError) return { text: "จองสต๊อกไม่ครบ", tone: "danger" };
  // เลยกำหนด: ป้ายกำหนดส่งในแถวเดียวกันบอกเป็นสีแดงอยู่แล้ว ไม่พิมพ์ซ้ำ แต่ยังนับเป็น "ต้องเช็ก"
  if (
    row.dueInDays !== null &&
    row.dueInDays < 0 &&
    !["SHIPPED", "DRAFT"].includes(row.internalStatus)
  ) {
    return { text: "", tone: "danger" };
  }
  if (row.designPending) return { text: "รอลูกค้าตัดสินแบบ", tone: "warning" };
  return null;
}

const THAI_LONG_DATE = new Intl.DateTimeFormat("th-TH", {
  weekday: "long",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});
const THAI_SHORT_DATE = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Bangkok",
});
const THAI_WEEKDAY = new Intl.DateTimeFormat("th-TH", { weekday: "short", timeZone: "Asia/Bangkok" });

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 rounded-2xl" />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );
}

export function DashboardHome() {
  const meQuery = trpc.user.me.useQuery();
  const me = meQuery.data;
  const canViewPulse = permAllows(me?.permissions, "view_admin_reports");
  const canCreateOrder = canCreateOrderWithPricing(me?.permissions);
  const canViewBilling = permAllows(me?.permissions, "manage_billing_docs");
  const canViewQuotations = permAllows(me?.permissions, "see_order_money");
  const showMoney = permAllows(me?.permissions, "see_order_money");

  // งานที่ยังเดินอยู่ทั้งหมด เรียงตามกำหนดส่ง (ไม่ระบุกำหนดอยู่ท้าย) — ชุดเดียวใช้ทั้งตาราง ตัวเลข และฝั่งขวา
  const queue = trpc.order.list.useQuery({
    excludeClosed: true,
    sortBy: "deadline",
    sortOrder: "asc",
    limit: 100,
  });
  const pulseQuery = trpc.analytics.ownerPulse.useQuery(undefined, {
    enabled: canViewPulse,
    retry: false,
  });

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const now = useMemo(() => new Date(), []);
  const todayKey = toBangkokDateInput(now);

  const rows = useMemo(
    () =>
      (queue.data?.orders ?? []).map((order) => {
        const dueInDays = differenceInBangkokDays(order.deadline, now);
        const designPending = order.designs?.[0]?.approvalStatus === "PENDING";
        const row = {
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customer?.company || order.customer?.name || "ยังไม่ระบุลูกค้า",
          deadline: order.deadline,
          dueInDays,
          dueKey: order.deadline ? toBangkokDateInput(order.deadline) : null,
          internalStatus: order.internalStatus,
          totalAmount: order.totalAmount,
          stockReservationError: order.stockReservationError,
          designPending,
          cover: orderMockupCover(order),
        };
        return { ...row, issue: issueOf(row) };
      }),
    [queue.data, now],
  );

  const todayRows = rows.filter((row) => row.dueKey === todayKey);
  const attentionRows = rows.filter((row) => row.issue);
  const pendingDesignRows = rows.filter((row) => row.designPending);

  const q = search.trim().toLowerCase();
  const visibleRows = rows.filter((row) => {
    if (filter === "today" && row.dueKey !== todayKey) return false;
    if (filter === "attention" && !row.issue) return false;
    if (!q) return true;
    return `${row.orderNumber} ${row.customerName}`.toLowerCase().includes(q);
  });
  const filterCount: Record<Filter, number> = {
    all: rows.length,
    today: todayRows.length,
    attention: attentionRows.length,
  };

  // กำหนดส่งรายวัน: เลยกำหนดรวมเป็นแถวเดียว แล้วไล่วันข้างหน้าที่มีงานจริง (ไม่สร้างวันว่าง)
  const dayGroups = useMemo(() => {
    const late = rows.filter((row) => row.dueInDays !== null && row.dueInDays < 0);
    const upcoming = new Map<string, typeof rows>();
    for (const row of rows) {
      if (row.dueKey === null || row.dueInDays === null || row.dueInDays < 0) continue;
      upcoming.set(row.dueKey, [...(upcoming.get(row.dueKey) ?? []), row]);
    }
    const days = [...upcoming.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(0, 7)
      .map(([key, list]) => ({ key, late: false, list, date: list[0].deadline! }));
    return late.length ? [{ key: "late", late: true, list: late, date: null }, ...days] : days;
  }, [rows]);
  const maxPerDay = Math.max(1, ...dayGroups.map((group) => group.list.length));

  // เรื่องเงิน/ใบเสนอ/ร้านนอกจาก Owner Pulse — คิวมองไม่เห็นเพราะไม่ใช่ออเดอร์ที่เดินอยู่
  const pulseLinks = pulseQuery.data
    ? buildDashboardAttentionItems(pulseQuery.data, { canViewBilling, canViewQuotations }).filter((item) =>
        ["overdue-invoice", "quotation", "outsource"].includes(item.kind),
      )
    : [];

  const loading = meQuery.isLoading || (!queue.data && (queue.isLoading || queue.isFetching));
  const error = meQuery.isError || queue.isError || (!loading && (!me || !queue.data));

  return (
    <div className={cn(styles.page, "-mx-4 -mt-5 min-h-full bg-surface px-4 pb-6 pt-5 sm:-mx-6 sm:-mt-7 sm:px-6 sm:pt-7 lg:-mx-8 lg:px-8")}>
      <PageShell
        className="mx-auto max-w-6xl"
        title="วันนี้"
        meta={THAI_LONG_DATE.format(now)}
        icon={LayoutGrid}
        tone="brand"
        action={
          canCreateOrder ? (
            <Button asChild>
              <Link href="/orders/new">
                <Plus />
                เปิดงานใหม่
              </Link>
            </Button>
          ) : undefined
        }
        loading={loading}
        skeleton={<DashboardSkeleton />}
        error={
          error
            ? {
                message: "โหลดคิวออเดอร์ไม่สำเร็จ",
                onRetry: () => {
                  void meQuery.refetch();
                  void queue.refetch();
                },
              }
            : null
        }
      >
        {/* ตัวเลขที่ต้องเห็นก่อน — นับจากคิวชุดเดียวกับตารางข้างล่าง */}
        <dl className={styles.strip} aria-label="สรุปวันนี้">
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-medium text-secondary">
              <ShoppingCart className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              ออเดอร์ที่เปิดอยู่
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-module-brand-text sm:text-3xl">
              {queue.data?.total ?? rows.length}
              <span className="ml-1.5 text-sm font-normal text-muted">ออเดอร์</span>
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-medium text-secondary">
              <Truck className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              กำหนดส่งวันนี้
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-strong sm:text-3xl">
              {todayRows.length}
              <span className="ml-1.5 text-sm font-normal text-muted">ออเดอร์</span>
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-medium text-secondary">
              <CircleAlert className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              ต้องเช็ก
            </dt>
            <dd
              className={cn(
                "mt-1 text-2xl font-semibold tabular-nums sm:text-3xl",
                attentionRows.length > 0 ? "text-red-600 dark:text-red-400" : "text-strong",
              )}
            >
              {attentionRows.length}
              <span className="ml-1.5 text-sm font-normal text-muted">รายการ</span>
            </dd>
          </div>
        </dl>

        {pulseLinks.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="เรื่องเงินและงานนอกคิวที่ต้องตาม">
            {pulseLinks.map((item) => (
              <li key={item.kind}>
                <Link
                  href={item.href}
                  className={cn(
                    CONTROL_MIN_H,
                    FOCUS_INSET,
                    "inline-flex items-center gap-2 rounded-full border border-border px-3 text-sm text-secondary",
                    item.tone === "danger" && "border-red-200 text-red-700 dark:border-red-900 dark:text-red-300",
                  )}
                >
                  {item.title}
                  <span className="font-semibold tabular-nums">{item.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section aria-labelledby="dashboard-queue-title" className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="dashboard-queue-title" className="text-base font-semibold text-strong">
                คิวออเดอร์
              </h2>
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                <Input
                  type="search"
                  name="queue-search"
                  aria-label="ค้นหาเลขออเดอร์หรือลูกค้าในคิว"
                  placeholder="ค้นหาเลขออเดอร์หรือลูกค้า"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 border-b border-divider" role="group" aria-label="กรองคิวออเดอร์">
              {FILTERS.map((item) => (
                <FilterChip
                  key={item.key}
                  selected={filter === item.key}
                  onClick={() => setFilter(item.key)}
                  aria-label={`${item.label} ${filterCount[item.key]} ออเดอร์`}
                >
                  {item.label}
                  <span className="tabular-nums text-muted">{filterCount[item.key]}</span>
                </FilterChip>
              ))}
            </div>

            {rows.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="ยังไม่มีออเดอร์ที่เดินอยู่"
                action={
                  canCreateOrder ? (
                    <Button asChild>
                      <Link href="/orders/new">เปิดงานแรก</Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : visibleRows.length === 0 ? (
              <EmptyState
                icon={Search}
                title="ไม่พบออเดอร์ตามที่กรอง"
                density="compact"
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setFilter("all");
                    }}
                  >
                    ล้างตัวกรอง
                  </Button>
                }
              />
            ) : (
              <DataTable.Root cellPadding="compact" bordered={false} className="border-t border-divider">
                <DataTable.Head>
                  <tr>
                    <DataTable.Th>ออเดอร์</DataTable.Th>
                    <DataTable.Th>กำหนดส่ง</DataTable.Th>
                    <DataTable.Th>สถานะ</DataTable.Th>
                    {showMoney && <DataTable.Th align="right">ยอดรวม</DataTable.Th>}
                  </tr>
                </DataTable.Head>
                <DataTable.Body>
                  {visibleRows.map((row) => (
                    <DataTable.Row key={row.id} href={`/orders/${row.id}`} className={styles.queueRow}>
                      <DataTable.Td>
                        <div className="min-w-0">
                          <p className="font-mono text-xs text-muted">{row.orderNumber}</p>
                          <p className="mt-0.5 text-sm font-semibold text-strong [overflow-wrap:anywhere]">
                            <Link href={`/orders/${row.id}`} className={cn("rounded", FOCUS_INSET)}>
                              {row.customerName}
                            </Link>
                          </p>
                          {row.issue?.text && (
                            <p
                              className={cn(
                                "mt-1 flex items-center gap-1 text-xs font-medium",
                                row.issue.tone === "danger"
                                  ? "text-red-700 dark:text-red-300"
                                  : "text-amber-700 dark:text-amber-300",
                              )}
                            >
                              <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              {row.issue.text}
                            </p>
                          )}
                        </div>
                      </DataTable.Td>
                      <DataTable.Td>
                        <DueTag
                          dueInDays={row.dueInDays}
                          dateLabel={row.deadline ? THAI_SHORT_DATE.format(new Date(row.deadline)) : null}
                          size="sm"
                        />
                      </DataTable.Td>
                      <DataTable.Td>
                        <OrderStatusBadge internalStatus={row.internalStatus} compact />
                      </DataTable.Td>
                      {showMoney && (
                        <DataTable.Td align="right">
                          {row.totalAmount != null ? (
                            <span className="font-semibold tabular-nums text-strong">{formatBaht(row.totalAmount)}</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </DataTable.Td>
                      )}
                    </DataTable.Row>
                  ))}
                </DataTable.Body>
              </DataTable.Root>
            )}
            {visibleRows.length > 0 && (
              <p className="px-1 text-xs text-secondary">
                {visibleRows.length} ออเดอร์
                {showMoney && (
                  <span className="float-right tabular-nums">
                    {formatBaht(visibleRows.reduce((sum, row) => sum + (row.totalAmount ?? 0), 0))}
                  </span>
                )}
              </p>
            )}
          </section>

          <aside className="min-w-0 space-y-8">
            <section aria-labelledby="dashboard-pending-design-title">
              <h2
                id="dashboard-pending-design-title"
                className="flex items-center gap-2 border-b border-divider pb-2 text-sm font-semibold text-strong"
              >
                <ToneMark icon={Eye} tone="product" />
                รอตัดสินแบบ
                <span className="ml-auto text-xs font-normal tabular-nums text-muted">{pendingDesignRows.length}</span>
              </h2>
              {pendingDesignRows.length === 0 ? (
                <p className="py-4 text-sm text-secondary">ไม่มีแบบค้างตัดสิน</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {pendingDesignRows.slice(0, 5).map((row) => (
                    <li key={row.id}>
                      <Link
                        href={`/orders/${row.id}?tab=files`}
                        className={cn(CONTROL_MIN_H, FOCUS_INSET, "flex items-center gap-3 rounded-xl py-2 pr-1")}
                      >
                        <MockupThumbnail cover={row.cover} size="sm" className="rounded-lg" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-mono text-xs text-muted">{row.orderNumber}</span>
                          <span className="block truncate text-sm font-medium text-strong">{row.customerName}</span>
                        </span>
                        <DueTag dueInDays={row.dueInDays} size="sm" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="dashboard-days-title">
              <h2
                id="dashboard-days-title"
                className="flex items-center gap-2 border-b border-divider pb-2 text-sm font-semibold text-strong"
              >
                <ToneMark icon={CalendarClock} tone="production" />
                กำหนดส่ง
              </h2>
              {dayGroups.length === 0 ? (
                <p className="py-4 text-sm text-secondary">ยังไม่มีงานที่ระบุกำหนดส่ง</p>
              ) : (
                <ol className="mt-2 space-y-1">
                  {dayGroups.map((group) => (
                    <li
                      key={group.key}
                      className={cn("grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3 py-2", group.late && styles.dayLate)}
                    >
                      <span className="text-center leading-tight">
                        {group.late ? (
                          <span className="block text-xs font-semibold text-red-700 dark:text-red-300">เลย<br />กำหนด</span>
                        ) : (
                          <>
                            <span
                              className={cn(
                                "block text-lg font-semibold tabular-nums",
                                group.key === todayKey ? "text-module-brand-text" : "text-strong",
                              )}
                            >
                              {new Date(group.date!).getDate()}
                            </span>
                            <span className="block text-xs text-muted">
                              {group.key === todayKey ? "วันนี้" : THAI_WEEKDAY.format(new Date(group.date!))}
                            </span>
                          </>
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center justify-between text-sm">
                          <span className="font-medium text-strong">{group.list.length} ออเดอร์</span>
                          {!group.late && (
                            <span className="text-xs text-secondary">{THAI_SHORT_DATE.format(new Date(group.date!))}</span>
                          )}
                        </span>
                        <span className={cn("mt-1.5", styles.dayTrack)}>
                          <span style={{ width: `${Math.round((group.list.length / maxPerDay) * 100)}%` }} />
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </aside>
        </div>
        {queue.data && queue.data.total > rows.length && (
          <p className="text-xs text-secondary">
            แสดง {rows.length} จาก {queue.data.total} ออเดอร์ — ที่เหลือดูได้ที่{" "}
            <Link href="/orders" className="font-medium text-module-brand-text underline">รายการออเดอร์</Link>
          </p>
        )}
      </PageShell>
    </div>
  );
}
