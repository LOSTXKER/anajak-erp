"use client";

import { Suspense, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { SearchInput } from "@/components/ui/search-input";
import { FilterChip } from "@/components/ui/filter-chip";
import { FilterPopover } from "@/components/ui/filter-popover";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { OrderStatusFlowBar } from "@/components/orders/order-status-flow-bar";
import { TablePagination } from "@/components/ui/table-pagination";
import { Select } from "@/components/ui/select";
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
  Download,
  ShoppingCart,
  ChevronRight,
  Clock3,
  MessageCircle,
  X,
} from "lucide-react";
import type { CustomerStatus, InternalStatus, OrderType } from "@prisma/client";
import { EmptyState } from "@/components/ui/empty-state";
import { FOCUS_BUTTON } from "@/components/ui/tokens";

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

// ทุกคอลัมน์มีครบสองทิศ — หัวตารางกดสลับทิศได้ ค่าที่ได้ต้องผ่านด่านตรวจ (validation) ตัวเดียวกัน
const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "วันที่ (ล่าสุด)" },
  { value: "createdAt:asc", label: "วันที่ (เก่าสุด)" },
  { value: "deadline:asc", label: "กำหนดส่ง (ใกล้สุด)" },
  { value: "deadline:desc", label: "กำหนดส่ง (ไกลสุด)" },
  { value: "totalAmount:desc", label: "ยอดรวม (มาก→น้อย)" },
  { value: "totalAmount:asc", label: "ยอดรวม (น้อย→มาก)" },
  { value: "orderNumber:desc", label: "เลขออเดอร์ (ล่าสุด)" },
  { value: "orderNumber:asc", label: "เลขออเดอร์ (เก่าสุด)" },
];

/** ทิศที่จะได้ตอนกดหัวคอลัมน์ครั้งแรก — งานใหม่/ยอดมากขึ้นก่อน, กำหนดส่งใกล้สุดขึ้นก่อน */
const SORT_DEFAULT_DIRECTION = {
  orderNumber: "desc",
  totalAmount: "desc",
  createdAt: "desc",
  deadline: "asc",
} as const;

type SortKey = keyof typeof SORT_DEFAULT_DIRECTION;

const ATTENTION_FILTERS = [
  { value: "", label: "ทุกงาน" },
  { value: "overdue", label: "เลยกำหนด" },
  { value: "due-soon", label: "ใกล้กำหนด 48 ชม." },
  { value: "stuck", label: "งานนิ่งเกิน 3 วัน" },
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
  if (due < now) return "font-medium text-red-700 dark:text-red-400";
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
    return <span className="text-xs text-slate-500 dark:text-slate-400">—</span>;
  }
  const days = daysUntil(deadline);
  const { label, dot, text } =
    days < 0
      ? {
          label: `เลย ${Math.abs(days)} วัน`,
          dot: "bg-red-500",
          text: "font-medium text-red-700 dark:text-red-400",
        }
      : days === 0
        ? {
            label: "วันนี้",
            dot: "bg-amber-600",
            text: "font-medium text-amber-800 dark:text-amber-300",
          }
        : days <= 2
          ? {
              label: `เหลือ ${days} วัน`,
              dot: "bg-amber-500",
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

/** ห้องแชทของลูกค้า — กดแล้วเปิดแชทจริงในแท็บใหม่
 *  รับเฉพาะลิงก์ http/https (ฝั่ง server กันไว้อีกชั้น) — ไม่ยอมให้ href กลายเป็นสคริปต์
 *  กันคลิกทะลุไปเปิดหน้าออเดอร์ด้วย stopPropagation เพราะแถวทั้งแถวกดได้บนมือถือ */
function ChatLink({
  name,
  url,
}: {
  name?: string | null;
  url?: string | null;
}) {
  if (!name && !url) return null;
  const safe = url && /^https?:\/\//i.test(url) ? url : null;
  const label = name || "เปิดแชท";
  if (!safe) {
    return (
      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
        {label}
      </p>
    );
  }
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex max-w-full items-center gap-1.5 truncate text-xs text-blue-600 hover:underline dark:text-blue-400"
    >
      <MessageCircle aria-hidden="true" className="h-3 w-3 shrink-0" />
      <span className="truncate">{label}</span>
    </a>
  );
}

function PaymentIndicator({ status }: { status: string }) {
  const v = PAYMENT_DOT[status];
  if (!v) return <span className="text-xs text-slate-500 dark:text-slate-400">—</span>;
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
  const rawSort = searchParams.get("sort") ?? "createdAt:desc";
  const page = positivePage(searchParams.get("page"));
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
  const [sortBy, sortOrder] = sort.split(":") as [SortKey, "asc" | "desc"];

  /** props ให้หัวคอลัมน์ที่กดเรียงได้ — คอลัมน์ไหนกำลังเรียงอยู่ กดแล้วไปไหนต่อ */
  const sortColumn = (key: SortKey) => ({
    direction: sortBy === key ? sortOrder : null,
    defaultDirection: SORT_DEFAULT_DIRECTION[key],
    onSort: (direction: "asc" | "desc") =>
      replaceListState({ sort: `${key}:${direction}`, page: null }),
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

  useEffect(() => {
    if (data && page > data.pages && data.pages >= 1) {
      replaceListState({ page: String(data.pages) });
    }
  }, [data, page, replaceListState]);

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

  // empty state ตอนหาไม่เจอ: ล้างตัวกรอง + คำค้นในจังหวะเดียว (คนละปุ่มกับในกล่องตัวกรองที่ล้างเฉพาะ filter)
  const hasActiveFilters = activeFilterCount > 0 || Boolean(attention) || Boolean(search);
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
                <Download />
                Export
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
      <OrderStatusFlowBar
        counts={data?.statusCounts}
        selected={internalStatus}
        onSelect={(status: string) =>
          replaceListState({ status: status || null, page: null })
        }
        isLoading={isLoading || isFetching}
      />

      <Toolbar>
        <SearchInput
          ref={searchInputRef}
          containerClassName="@2xl:max-w-sm @2xl:flex-1"
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

        <ToolbarGroup>
          {/* ช่องเรียงเหลือไว้เฉพาะจอแคบ (เบสเคาะ 2026-07-31) — จอกว้างย้ายไปกดที่หัวตารางแทน
              แต่จอแคบเป็นการ์ด ไม่มีหัวตารางให้กด ถ้าถอดทิ้งด้วยจะเรียงไม่ได้เลย */}
          <Select
            shape="pill"
            aria-label="เรียงลำดับ"
            value={sort}
            onChange={(e) =>
              replaceListState({ sort: e.target.value, page: null })
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
                className="h-6 w-6 min-w-0 text-current hover:bg-blue-100 dark:hover:bg-blue-900"
              >
                <X />
              </Button>
            </span>
          )}
        </ToolbarGroup>
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
          // กำลังเรียงด้วยกำหนดส่งอยู่ = ต้องคงคอลัมน์ไว้ ไม่งั้นหัวที่เพิ่งกดหายไปทั้งอัน
          const showDeadline = orders.some((o) => o.deadline) || sortBy === "deadline";
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
                <DataTable.SortableTh {...sortColumn("deadline")}>
                  ระยะเวลาออเดอร์
                </DataTable.SortableTh>
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
                {/* ไม่ทำให้เรียงได้ — คอลัมน์ "ระยะเวลาออเดอร์" เรียงด้วยกำหนดส่งอยู่แล้ว
                    ถ้าให้เรียงได้ทั้งคู่ ตอนเรียงจะประกาศ aria-sort พร้อมกัน 2 คอลัมน์
                    ซึ่งผิดมาตรฐานและทำให้โปรแกรมอ่านหน้าจอสับสน (audit ก่อน merge จับได้) */}
                {showDeadline && <DataTable.Th>กำหนดส่ง</DataTable.Th>}
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
                        {order.orderType === "CUSTOM" && (
                          <Badge variant="accent" size="sm" className="ml-1.5">
                            Custom
                          </Badge>
                        )}
                      </p>
                      {/* ชื่องานถูกถอดออก (เบสสั่ง 2026-07-31 — ซ้ำกับชื่อลูกค้าและอ่านไม่ทัน
                          ตอนสแกนรายการ) แทนด้วยห้องแชทที่พาไปคุยต่อได้ในคลิกเดียว */}
                      <ChatLink
                        name={order.customer?.chatName}
                        url={order.customer?.chatUrl}
                      />
                    </div>
                  </DataTable.Td>
                  <DataTable.Td className="text-xs text-slate-600 dark:text-slate-400">
                    {CHANNEL_LABELS[order.channel] ?? order.channel}
                  </DataTable.Td>
                  <DataTable.Td>
                    <OrderCountdown
                      deadline={order.deadline}
                      internalStatus={order.internalStatus}
                    />
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
                    <ChevronRight aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" />
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

                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
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
