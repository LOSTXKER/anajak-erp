"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useListPageState, usePageClamp } from "@/hooks/use-list-page-state";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { canCreateOrderWithPricing } from "@/lib/order-access";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { SearchInput } from "@/components/ui/search-input";
import { FilterChip } from "@/components/ui/filter-chip";
import { FilterPopover } from "@/components/ui/filter-popover";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { OrderStatusFilter } from "@/components/orders/order-status-filter";
import { TablePagination } from "@/components/ui/table-pagination";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { cn, formatCurrency, formatDate, formatBaht } from "@/lib/utils";
import {
  CUSTOMER_STATUS_LABELS,
  INTERNAL_STATUS_LABELS,
  CHANNEL_LABELS,
  ORDER_TYPE_UI_LABELS,
} from "@/lib/order-status";
import { PageHeader } from "@/components/page-header";
import {
  Plus,
  Download,
  ShoppingCart,
  ChevronRight,
  Clock3,
  X,
} from "lucide-react";
import type { CustomerStatus, InternalStatus, OrderType } from "@prisma/client";
import { EmptyState } from "@/components/ui/empty-state";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
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
} from "@/lib/order-list-contract";
import { ChatLink } from "@/components/customers/chat-link";
import { EntityMark } from "@/components/ui/entity-mark";

// ────────────────────────────────────────────────────────────
// Payment status: dot + text (no pill)
// ────────────────────────────────────────────────────────────

const PAYMENT_DOT: Record<string, { label: string; dot: string; text: string }> = {
  paid: { label: "ชำระแล้ว", dot: "bg-green-500", text: "text-green-700 dark:text-green-300" },
  unpaid: { label: "ค้างชำระ", dot: "bg-red-500", text: "text-red-700 dark:text-red-300" },
  partial: { label: "บางส่วน", dot: "bg-amber-700 dark:bg-amber-500", text: "text-amber-700 dark:text-amber-300" },
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

/** นับถอยหลังถึงกำหนดส่ง (เบสเคาะ 2026-08-01 — เดิมเป็นป้าย "เร่งด่วน" ที่บอกแค่หมวด
 *  ตัวเลขวันบอกได้มากกว่าและตัดสินใจได้ทันทีว่าจะจับงานไหนก่อน)
 *
 *  งานร่าง/ส่งแล้ว/จบ/ยกเลิก ไม่นับถอยหลัง — เกณฑ์เดียวกับตัวกรองความเร่งด่วนฝั่ง server
 *  ใช้เที่ยงคืนเป็นเส้นแบ่งวัน ไม่ใช่ 24 ชม.เป๊ะ ("พรุ่งนี้" ต้องขึ้นว่าเหลือ 1 วันเสมอ
 *  ไม่ว่าจะเปิดดูตอนเช้าหรือตอนดึก)
 */
function daysUntil(deadline: Date | string): number {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const due = new Date(deadline);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - startOfToday.getTime()) / 86400000);
}

function OrderCountdown({
  deadline,
  internalStatus,
}: {
  deadline: Date | string | null | undefined;
  internalStatus: string;
}) {
  if (!deadline || ATTENTION_EXEMPT_STATUSES.has(internalStatus)) {
    return <span className="text-xs text-muted">—</span>;
  }
  const days = daysUntil(deadline);
  const { label, dot, text } =
    days < 0
      ? {
          label: `เลย ${Math.abs(days)} วัน`,
          dot: "bg-red-500",
          text: "font-medium text-red-600 dark:text-red-400",
        }
      : days === 0
        ? {
            label: "วันนี้",
            dot: "bg-amber-700 dark:bg-amber-500",
            text: "font-medium text-amber-700 dark:text-amber-400",
          }
        : days <= 2
          ? {
              label: `เหลือ ${days} วัน`,
              dot: "bg-amber-700 dark:bg-amber-500",
              text: "text-amber-700 dark:text-amber-400",
            }
          : {
              label: `เหลือ ${days} วัน`,
              dot: "bg-slate-300 dark:bg-slate-600",
              text: "text-slate-600 dark:text-slate-400",
            };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-xs tabular-nums",
        text,
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
      {label}
    </span>
  );
}

function PaymentIndicator({ status }: { status: string }) {
  const v = PAYMENT_DOT[status];
  if (!v) return <span className="text-xs text-muted">—</span>;
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
    ORDER_TYPE_UI_LABELS[o.orderType as OrderType] ?? o.orderType,
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
  const orderType = rawOrderType === "READY_MADE" || rawOrderType === "CUSTOM"
    ? rawOrderType
    : "";
  // ตัวกรอง "สถานะลูกค้า" ถูกถอดออกทั้งหมด (เบสสั่ง 2026-07-31) — ไม่มีหน้าไหนลิงก์มาด้วย
  // พารามิเตอร์นี้ ถอดได้สะอาดโดยไม่ทำลายทางเข้าเดิม · สถานะภายในไปอยู่แถบการ์ดด้านบนแทน
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
  const rawSort = searchParams.get("sort");

  const { data: me } = trpc.user.me.useQuery();
  // เปิดออเดอร์ต้องสร้างเอกสารขายและเห็นราคาได้ — ใช้ด่านเดียวกับ route เพื่อไม่ให้ CTA พาไปชน AccessDenied
  const canCreateOrder = canCreateOrderWithPricing(me?.permissions);
  // ⑦ ช่าง/กราฟิกไม่เห็นเงินฝั่งขาย — ซ่อนคอลัมน์ยอดรวม + sort ยอดรวม (ระหว่างโหลด me = ซ่อนไว้ก่อน ปลอดภัยกว่า)
  const canSeeMoney = permAllows(me?.permissions, "see_order_money");
  const { sortOptions, sort, sortBy, sortOrder } = resolveOrderListSort(
    rawSort,
    canSeeMoney
  );

  /** props ให้หัวคอลัมน์ที่กดเรียงได้ — คอลัมน์ไหนกำลังเรียงอยู่ กดแล้วไปไหนต่อ */
  const sortColumn = (key: SortKey) => ({
    direction: sortBy === key ? sortOrder : null,
    defaultDirection: SORT_DEFAULT_DIRECTION[key],
    onSort: (direction: SortDirection) => {
      const value = `${key}:${direction}`;
      replaceListState({
        sort: value === DEFAULT_SORT ? null : value,
        page: null,
      });
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
    { placeholderData: (previous) => previous }
  );

  usePageClamp(page, data?.pages, replaceListState);

  // attention ไม่นับในป้ายกล่องตัวกรอง — มันมีบ้านเป็นแถว chip บนผิวหน้าแล้ว
  // นับเฉพาะตัวกรองที่ซ่อนอยู่ในกล่อง — ช่วงวันที่มีปุ่มของตัวเองบนแถบ เห็นอยู่แล้วว่าเลือกอะไร
  const activeFilterCount = [channel, orderType].filter(Boolean).length;

  const clearFilters = () => {
    replaceListState({
      channel: null,
      type: null,
      attention: null,
      from: null,
      to: null,
      page: null,
    });
  };

  // empty state ตอนหาไม่เจอ: นับทั้งสถานะ/วันที่/คำค้น แล้วล้างทุกอย่างในจังหวะเดียว
  // (คนละปุ่มกับในกล่องตัวกรองที่ล้างเฉพาะ filter)
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
    if (searchTimer.current) clearTimeout(searchTimer.current);
    replaceListState({
      q: null,
      channel: null,
      type: null,
      status: null,
      attention: null,
      from: null,
      to: null,
      page: null,
    });
  };

  return (
    // 24px = จังหวะระดับหน้าค่าเดียวทั้งเว็บ (เบสเคาะ 2026-08-04 — เดิม 3 หน้า 3 ค่า)
    <div className="space-y-6">
      <PageHeader
        title="ออเดอร์ทั้งหมด"
        action={
          <>
            {data && data.orders.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportOrdersCsv(data.orders, canSeeMoney)}
              >
                <Download />
                ส่งออก CSV
              </Button>
            )}
            {canCreateOrder && (
              <Button asChild size="sm">
                <Link href="/orders/new">
                  <Plus />
                  สร้างออเดอร์
                </Link>
              </Button>
            )}
          </>
        }
      />

      {/* Toolbar + attention filter (คำถามหลักของหน้านี้ — โชว์ตลอด ไม่ต้องกางกล่องตัวกรอง)
          แถวเดียวจบเมื่อจอกว้าง: ค้นหา · เรียง | กรอง · ชิปความเร่งด่วนชิดขวา
          (เบสสั่ง 2026-07-31 "ส่วนบนดีได้กว่านี้" — เดิมชิปแยกไปอีกแถวทั้งที่ขวายังว่าง
          และช่องค้นหายืดเต็มจอจนเป็นแถบว่างยาวบนจอใหญ่) */}
      {/* การ์ดสถานะงานมาก่อนแถบค้นหา/ตัวกรอง (เบสสั่ง 2026-08-01 — เรียงแบบระบบเก่า)
          เปิดหน้ามาเห็นภาพรวมทั้งกระดานก่อน แล้วค่อยเจาะด้วยค้นหา/ตัวกรอง */}
      <OrderStatusFilter
        counts={data?.statusCounts}
        total={data?.total}
        selected={internalStatus}
        onSelect={(status) =>
          replaceListState({ status: status || null, page: null })
        }
        isLoading={isLoading}
      />

      <Toolbar>
        <SearchInput
          ref={searchInputRef}
          containerClassName="@2xl:max-w-sm @2xl:flex-1"
          surface="raised"
          placeholder="ค้นหาเลขออเดอร์, ชื่อ, ลูกค้า..."
          defaultValue={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />

        <ToolbarGroup className="w-full flex-wrap @2xl:w-auto @2xl:flex-nowrap">
          {/* ช่องเรียงเหลือไว้เฉพาะจอแคบ (เบสเคาะ 2026-07-31) — จอกว้างย้ายไปกดที่หัวตารางแทน
              แต่จอแคบเป็นการ์ด ไม่มีหัวตารางให้กด ถ้าถอดทิ้งด้วยจะเรียงไม่ได้เลย */}
          <Select
            shape="pill"
            surface="raised"
            aria-label="เรียงลำดับ"
            value={sort}
            onChange={(e) =>
              replaceListState({
                sort: e.target.value === DEFAULT_SORT ? null : e.target.value,
                page: null,
              })
            }
            className="w-auto px-3 lg:hidden"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>

          {/* ช่วงวันที่ออกมาอยู่นอกกล่องตัวกรอง (เบสสั่ง 2026-08-01) — เป็นตัวกรองที่ใช้บ่อยสุด
              ไม่ควรต้องกดเปิดกล่องก่อน · มีปุ่มทางลัด เดือนนี้/ปีนี้/สัปดาห์นี้ ในตัว */}
          <DateRangePicker
            from={createdAfter}
            to={createdBefore}
            onChange={(f, t) =>
              replaceListState({ from: f || null, to: t || null, page: null })
            }
          />

          {/* ตัวกรองลอยใต้ปุ่ม — ตารางไม่ขยับ (เบสเคาะ 2026-07-31 แบบ ข)
              เหลือ 2 หมวด: สถานะลูกค้าถอดตามคำสั่ง · สถานะภายในอยู่แถบด้านบน · วันที่ออกมาข้างนอก */}
          <FilterPopover
            activeCount={activeFilterCount}
            onClear={clearFilters}
            resultLabel={`ดูผลลัพธ์ ${data?.total ?? 0} รายการ`}
          >
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
          </FilterPopover>

          {/* แถวชิปความเร่งด่วนถูกถอดออกแล้ว (เบสสั่ง 2026-07-31 — ย้ายไปเป็นคอลัมน์
              "เร่งด่วน" ที่เรียงได้แทน) · แต่แดชบอร์ดยังลิงก์มาด้วย ?attention= 3 ทาง
              ถ้าไม่มีอะไรบอกเลย คนกดมาจากแดชบอร์ดจะเห็นรายการถูกกรองอยู่โดยไม่รู้ว่ากรองอะไร
              และล้างไม่ได้ — จึงโชว์ป้ายเดียวเฉพาะตอนกรองค้างอยู่ กดกากบาทเพื่อล้าง */}
          {attention && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 py-1 pl-3 pr-1 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              {ATTENTION_FILTERS.find((f) => f.value === attention)?.label}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="ล้างตัวกรองความเร่งด่วน"
                onClick={() => replaceListState({ attention: null, page: null })}
                className="h-6 w-6 min-w-0 text-current hover:bg-interactive-hover dark:hover:bg-interactive-hover"
              >
                <X />
              </Button>
            </span>
          )}
        </ToolbarGroup>

        {data && (
          <p
            aria-busy={isFetching}
            aria-live="polite"
            className="self-end whitespace-nowrap text-xs tabular-nums text-slate-500 @2xl:ml-auto @2xl:self-auto dark:text-slate-400"
          >
            {isFetching
              ? "กำลังอัปเดต…"
              : `${data.total.toLocaleString("th-TH")} ออเดอร์`}
          </p>
        )}
      </Toolbar>

      <ResponsiveList
        items={data?.orders}
        isLoading={isLoading || isFetching}
        isError={isError}
        errorMessage="โหลดรายการออเดอร์ไม่สำเร็จ"
        onRetry={() => refetch()}
        label="ออเดอร์"
        renderDesktop={(orders) => {
          // คอลัมน์ที่ไม่มีข้อมูลสักแถวในหน้านี้ = กินที่เปล่าๆ (เบสสั่ง 2026-07-31
          // หลังเห็นจอจริงว่า "การชำระ" กับ "กำหนดส่ง" เป็น — ทั้งคอลัมน์)
          // ดูเฉพาะหน้าที่กำลังแสดง — พอเปลี่ยนหน้า/ตัวกรองแล้วมีข้อมูล คอลัมน์กลับมาเอง
          const showPayment = orders.some((o) => o.paymentLabel !== "none");
          const hasDeadline = orders.some((o) => o.deadline);
          const hasTrackableDeadline = orders.some(
            (o) => o.deadline && !ATTENTION_EXEMPT_STATUSES.has(o.internalStatus),
          );
          // คอลัมน์นับถอยหลังไม่มีประโยชน์เมื่อทั้งหน้าเป็นขีด — แต่ถ้าผู้ใช้กำลังเรียง
          // ด้วยกำหนดส่ง ต้องคงหัว sortable ไว้ ไม่ให้ control ที่เพิ่งกดหายไป
          const showCountdown = hasTrackableDeadline || sortBy === "deadline";
          const showDeadline = hasDeadline;
          return (
          <DataTable.Root>
            <DataTable.Head>
              <tr>
                {/* การเรียงย้ายมาอยู่ที่หัวคอลัมน์แล้ว (เบสสั่ง 2026-07-31) — กดซ้ำสลับทิศ
                    เรียงได้เท่าที่ฐานข้อมูลรองรับ: เลขออเดอร์ · ยอดรวม · วันที่ · กำหนดส่ง */}
                <DataTable.SortableTh {...sortColumn("orderNumber")}>
                  เลขออเดอร์
                </DataTable.SortableTh>
                <DataTable.Th>ลูกค้า / งาน</DataTable.Th>
                <DataTable.Th>ช่องทาง</DataTable.Th>
                {showCountdown && (
                  <DataTable.SortableTh {...sortColumn("deadline")}>
                    เหลือเวลา
                  </DataTable.SortableTh>
                )}
                <DataTable.Th>สถานะ</DataTable.Th>
                {canSeeMoney && (
                  <DataTable.SortableTh align="right" {...sortColumn("totalAmount")}>
                    ยอดรวม
                  </DataTable.SortableTh>
                )}
                {showPayment && <DataTable.Th>การชำระ</DataTable.Th>}
                <DataTable.SortableTh {...sortColumn("createdAt")}>
                  วันที่
                </DataTable.SortableTh>
                {/* ไม่ทำให้เรียงได้ — คอลัมน์ "เหลือเวลา" เรียงด้วยกำหนดส่งอยู่แล้ว
                    ถ้าให้เรียงได้ทั้งคู่ ตอนเรียงจะประกาศ aria-sort พร้อมกัน 2 คอลัมน์
                    ซึ่งผิดมาตรฐานและทำให้โปรแกรมอ่านหน้าจอสับสน (audit ก่อน merge จับได้) */}
                {showDeadline && <DataTable.Th>กำหนดส่ง</DataTable.Th>}
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {orders.map((order) => (
                <DataTable.Row key={order.id} href={`/orders/${order.id}`}>
                  <DataTable.Td>
                    <div className="flex items-center gap-3">
                      <EntityMark label={order.orderNumber} icon={ShoppingCart} fallback="icon" size="sm" />
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {order.orderNumber}
                      </Link>
                    </div>
                  </DataTable.Td>
                  <DataTable.Td>
                    <div className="flex min-w-0 items-start gap-3">
                      <EntityMark label={order.customer?.name ?? order.orderNumber} size="sm" shape="avatar" />
                      <div className="min-w-0">
                      <p className="truncate text-slate-900 dark:text-white">
                        {order.customer?.name ?? "—"}
                        {order.orderType === "CUSTOM" && (
                          <Badge variant="accent" size="sm" className="ml-1.5">
                            {ORDER_TYPE_UI_LABELS[order.orderType]}
                          </Badge>
                        )}
                      </p>
                      {/* ชื่องานถูกถอดออก (เบสสั่ง 2026-07-31 — ซ้ำกับชื่อลูกค้าและอ่านไม่ทัน
                          ตอนสแกนรายการ) แทนด้วยห้องแชทที่พาไปคุยต่อได้ในคลิกเดียว */}
                      <ChatLink
                        stopPropagation
                        name={order.customer?.chatName}
                        url={order.customer?.chatUrl}
                      />
                      </div>
                    </div>
                  </DataTable.Td>
                  <DataTable.Td className="text-xs text-slate-600 dark:text-slate-400">
                    {CHANNEL_LABELS[order.channel] ?? order.channel}
                  </DataTable.Td>
                  {showCountdown && (
                    <DataTable.Td>
                      <OrderCountdown
                        deadline={order.deadline}
                        internalStatus={order.internalStatus}
                      />
                    </DataTable.Td>
                  )}
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
                      // เงินในคอลัมน์ = ทศนิยม 2 ตำแหน่งเสมอ ให้หลักสตางค์เรียงแนวดิ่ง
                      // น้ำหนักปกติ — คอลัมน์นำของแถวคือเลขออเดอร์ตัวเดียว (benchmark 2026-08-04)
                      className="tabular-nums text-slate-900 dark:text-white"
                    >
                      {formatBaht(order.totalAmount ?? 0)}
                    </DataTable.Td>
                  )}
                  {showPayment && (
                    <DataTable.Td>
                      <PaymentIndicator status={order.paymentLabel} />
                    </DataTable.Td>
                  )}
                  {/* วันที่เปิดออเดอร์ — วางติดกำหนดส่งให้อ่านเป็นคู่ ต้นทาง–ปลายทาง */}
                  <DataTable.Td className="whitespace-nowrap text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {formatDate(order.createdAt)}
                  </DataTable.Td>
                  {showDeadline && (
                    <DataTable.Td
                      className={cn(
                        "text-xs",
                        deadlineToneClass(order.deadline, order.internalStatus) ??
                          "text-slate-500 dark:text-slate-400"
                      )}
                    >
                      {order.deadline ? formatDate(order.deadline) : "—"}
                    </DataTable.Td>
                  )}
                </DataTable.Row>
              ))}
            </DataTable.Body>
          </DataTable.Root>
          );
        }}
        renderMobile={(orders) => (
          <div role="list" aria-label="รายการออเดอร์" className="space-y-3">
            {orders.map((order) => (
              <article key={order.id} role="listitem" className="card-surface rounded-2xl">
                <Link
                  href={`/orders/${order.id}`}
                  className={cn("block min-h-11 rounded-2xl p-4", FOCUS_BUTTON)}
                  aria-label={`เปิดออเดอร์ ${order.orderNumber} ${order.customer?.name ?? ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <EntityMark label={order.orderNumber} icon={ShoppingCart} fallback="icon" />
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
                      <Badge variant="accent" size="sm">
                        {ORDER_TYPE_UI_LABELS[order.orderType]}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">ช่องทาง</p>
                      <p className="mt-0.5 text-slate-800 dark:text-slate-200">
                        {CHANNEL_LABELS[order.channel] ?? order.channel}
                      </p>
                    </div>
                    {order.paymentLabel !== "none" ? (
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">การชำระ</p>
                        <div className="mt-0.5"><PaymentIndicator status={order.paymentLabel} /></div>
                      </div>
                    ) : canSeeMoney ? (
                      <p className="text-right font-semibold tabular-nums text-slate-900 dark:text-white">
                        {formatCurrency(order.totalAmount ?? 0)}
                      </p>
                    ) : null}
                    {/* วันที่เปิดโชว์เสมอ (เดิมโชว์ต่อเมื่อไม่มีกำหนดส่ง) — คู่กับคอลัมน์วันที่ในตาราง */}
                    <div>
                      {order.deadline && (
                        <div
                          className={cn(
                            "inline-flex items-center gap-1.5",
                            deadlineToneClass(order.deadline, order.internalStatus) ??
                              "text-slate-500 dark:text-slate-400"
                          )}
                        >
                          <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
                          {`กำหนด ${formatDate(order.deadline)}`}
                        </div>
                      )}
                      <p className="text-slate-500 dark:text-slate-400">
                        {`เปิด ${formatDate(order.createdAt)}`}
                      </p>
                    </div>
                    {canSeeMoney && order.paymentLabel !== "none" && (
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
                    <Plus />
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
              limit={20}
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
