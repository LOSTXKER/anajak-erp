"use client";

import { Suspense, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { DataTable } from "@/components/ui/data-table";
import { TablePagination } from "@/components/ui/table-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveList } from "@/components/ui/responsive-list";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { permAllows } from "@/lib/permissions";
import { INVOICE_TYPE_LABELS } from "@/lib/invoice-labels";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_VARIANTS } from "@/lib/status-config";
import {
  DollarSign,
  AlertCircle,
  TrendingUp,
  CreditCard,
  FileText,
  Printer,
  ArrowRight,
} from "lucide-react";

// ภาษาสีสถานะการชำระใช้ชุดกลางที่เดียว (UX4.2) — ห้ามประกาศ local ซ้ำ
// ป้าย+สีจะได้ตรงกับแท็บเงินในออเดอร์ที่ทีมเปิดคู่กันทุกวัน

// ตัวเลือกกรองชนิดใบ — เรียงตาม flow เงิน (QUOTATION ไม่ออกเป็น invoice แล้ว ไม่ใส่ตัวกรอง
// แต่แถว legacy ยังโชว์ป้ายถูกผ่าน INVOICE_TYPE_LABELS ตอนเลือก "ทั้งหมด")
const TYPE_FILTER_OPTIONS = [
  "DEPOSIT_INVOICE",
  "FINAL_INVOICE",
  "RECEIPT",
  "CREDIT_NOTE",
  "DEBIT_NOTE",
] as const;

// Radix Select ห้าม value ว่าง — ใช้ sentinel แล้วแปลงเป็น undefined ตอนยิง query
const ALL = "ALL";

function paymentActionLabel(status: string, type: string) {
  if (type === "CREDIT_NOTE") return "ดูการลดหนี้";
  if (status === "PAID") return "ดูการชำระ";
  if (status === "VOIDED") return "ดูประวัติ";
  return "เปิดจัดการบิล";
}

export default function BillingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <BillingPageContent />
    </Suspense>
  );
}

function BillingPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const rawStatus = searchParams.get("status");
  const statusFilter = rawStatus && rawStatus in PAYMENT_STATUS_LABELS ? rawStatus : ALL;
  const rawType = searchParams.get("type");
  const typeFilter = rawType && TYPE_FILTER_OPTIONS.some((type) => type === rawType)
    ? rawType
    : ALL;
  const parsedPage = Number(searchParams.get("page"));
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const replaceListState = useCallback(
    (updates: Record<string, string | null>) => {
      // อ่าน URL สดตอนกดจริง — กัน debounce คำค้นที่เริ่มก่อนผู้ใช้เปลี่ยน filter
      // แล้ว callback เก่าเขียนทับ status/type/page ที่เพิ่งเลือก
      const next = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(updates)) {
        if (!value || (key === "page" && value === "1")) next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  // debounce คำค้นลง URL 300ms และยกเลิก timer เมื่อออกจากหน้า
  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    []
  );

  // browser back/forward ต้องคืนคำค้นในช่อง โดยไม่ remount input จน focus หลุด
  useEffect(() => {
    if (searchInputRef.current && searchInputRef.current.value !== search) {
      searchInputRef.current.value = search;
    }
  }, [search]);

  const { data: me } = trpc.user.me.useQuery();
  // หน้าการเงินทั้งหน้าเป็นของฝั่งบริหาร-บัญชี (ตรงกับ requireRole ฝั่ง server)
  const canView = me ? permAllows(me.permissions, "manage_billing_docs") : true;
  const stats = trpc.billing.stats.useQuery(undefined, {
    enabled: canView,
  });
  const { data, isLoading, isFetching, isError, refetch } = trpc.billing.list.useQuery(
    {
      search: search.trim() || undefined,
      status: statusFilter === ALL ? undefined : statusFilter,
      type: typeFilter === ALL ? undefined : typeFilter,
      page,
      limit: 50,
    },
    // เปลี่ยนหน้า/ตัวกรองแล้วค้างข้อมูลเดิมไว้ระหว่างโหลด — ไม่งั้นตารางยุบเหลือ
    // skeleton + แถบ pagination หายใต้เคอร์เซอร์ (pattern B7)
    { enabled: canView, placeholderData: (prev) => prev }
  );

  // clamp หน้าเกินช่วง — กดหน้าถัดไปช่วง placeholder ค้างเลขหน้าชุดกรองเก่า แล้วชุดใหม่
  // มีหน้าน้อยกว่า จะค้างบนหน้าว่างที่ไม่มีแถบ pagination ให้ถอยกลับ (review จับ)
  useEffect(() => {
    if (data && page > data.pages && data.pages >= 1) {
      replaceListState({ page: String(data.pages) });
    }
  }, [data, page, replaceListState]);

  if (me && !canView) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="บิล/การเงิน"
          description="ใบแจ้งหนี้ ใบเสร็จ และสถานะรับชำระ"
        />
        <p className="text-sm text-slate-400">
          ต้องมีสิทธิ์ &quot;ออกใบแจ้งหนี้/ใบวางบิล/รายงานภาษี&quot; — เช็คสิทธิ์ที่ ตั้งค่า → ผู้ใช้
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="บิล/การเงิน"
        description="ใบแจ้งหนี้ ใบเสร็จ และสถานะรับชำระ"
      />

      {/* stats พังต้องบอก — เลขเงินโชว์ ฿0 เงียบๆ อ่านเป็น "ไม่มียอดค้าง" ได้ (ขัด DESIGN.md) */}
      {stats.isError ? (
        <QueryError
          message="โหลดสถิติการเงินไม่สำเร็จ"
          onRetry={() => stats.refetch()}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* สองใบแรกคือเลขเสี่ยง (UX4.3) — เด่น + กดไปดูรายการได้ · ศูนย์จริงลดเป็นสีจาง */}
          <StatCard
            title="ค้างชำระ"
            value={formatCurrency(stats.data?.totalUnpaid ?? 0)}
            icon={DollarSign}
            tone={(stats.data?.totalUnpaid ?? 0) > 0 ? "default" : "muted"}
            href="/billing/aging"
            caption="ดูรายงานลูกหนี้"
          />
          <StatCard
            title="เกินกำหนด"
            value={stats.data?.overdueCount ?? 0}
            icon={AlertCircle}
            caption="บิล"
            tone={(stats.data?.overdueCount ?? 0) > 0 ? "danger" : "muted"}
            href="/billing?status=OVERDUE"
          />
          <StatCard
            title="รายได้เดือนนี้"
            value={formatCurrency(stats.data?.revenueThisMonth ?? 0)}
            icon={TrendingUp}
          />
          <StatCard
            title="รับชำระเดือนนี้"
            value={formatCurrency(stats.data?.paidThisMonth ?? 0)}
            icon={CreditCard}
          />
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <SearchInput
            ref={searchInputRef}
            placeholder="ค้นหาเลขบิล, ชื่อลูกค้า..."
            defaultValue={search}
            onChange={(e) => {
              const value = e.target.value;
              if (searchTimer.current) clearTimeout(searchTimer.current);
              searchTimer.current = setTimeout(
                () => replaceListState({ q: value.trim() || null, page: null }),
                300
              );
            }}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            replaceListState({ status: v === ALL ? null : v, page: null });
          }}
        >
          <SelectTrigger className="w-full sm:w-40" aria-label="กรองตามสถานะ">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>ทุกสถานะ</SelectItem>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            replaceListState({ type: v === ALL ? null : v, page: null });
          }}
        >
          <SelectTrigger className="w-full sm:w-48" aria-label="กรองตามประเภท">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>ทุกประเภท</SelectItem>
            {TYPE_FILTER_OPTIONS.map((value) => (
              <SelectItem key={value} value={value}>
                {INVOICE_TYPE_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ResponsiveList
        items={data?.invoices}
        isLoading={isLoading || isFetching}
        isError={isError}
        errorMessage="โหลดรายการบิลไม่สำเร็จ"
        onRetry={() => refetch()}
        label="บิล"
        emptyState={
          <div className="card-surface rounded-2xl">
            <EmptyState
              icon={FileText}
              title={
                search || statusFilter !== ALL || typeFilter !== ALL
                  ? "ไม่พบบิลตามเงื่อนไข"
                  : "ยังไม่มีบิล"
              }
              description={
                search || statusFilter !== ALL || typeFilter !== ALL
                  ? "ลองปรับคำค้นหรือตัวกรอง"
                  : "สร้างบิลได้จากหน้าออเดอร์ — แท็บ เงิน/บิล"
              }
            />
          </div>
        }
        renderMobile={(invoices) => (
          <div className="space-y-3">
            {invoices.map((inv) => {
              const statusVariant =
                PAYMENT_STATUS_VARIANTS[
                  inv.paymentStatus as keyof typeof PAYMENT_STATUS_VARIANTS
                ] ?? "warning";
              const statusLabel =
                PAYMENT_STATUS_LABELS[
                  inv.paymentStatus as keyof typeof PAYMENT_STATUS_LABELS
                ] ?? PAYMENT_STATUS_LABELS.UNPAID;
              const moneyHref = `/orders/${inv.orderId}?tab=money`;
              return (
                <article key={inv.id} className="card-surface rounded-2xl p-4">
                  <Link
                    href={moneyHref}
                    className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                    aria-label={`เปิดออเดอร์ ${inv.order.orderNumber} ที่แท็บเงินและบิล`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-blue-700 dark:text-blue-300">
                          {inv.invoiceNumber}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                          {INVOICE_TYPE_LABELS[inv.type] ?? inv.type}
                        </p>
                      </div>
                      <Badge variant={statusVariant}>{statusLabel}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500 dark:text-slate-400">ลูกค้า</p>
                        <p className="mt-1 truncate text-sm font-medium text-slate-900 dark:text-white">
                          {inv.customer.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 dark:text-slate-400">ยอดบิล</p>
                        <p className="mt-1 tabular-nums font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(inv.totalAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">ออเดอร์</p>
                        <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                          {inv.order.orderNumber}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 dark:text-slate-400">ครบกำหนด</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                        </p>
                      </div>
                    </div>
                  </Link>
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        href={`/print/invoice/${inv.id}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`พิมพ์ ${inv.invoiceNumber}`}
                      >
                        <Printer className="h-4 w-4" />
                        พิมพ์
                      </Link>
                    </Button>
                    <Button size="sm" asChild>
                      <Link href={moneyHref}>
                        {paymentActionLabel(inv.paymentStatus, inv.type)}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        renderDesktop={(invoices) => (
          <DataTable.Root>
            <DataTable.Head>
              <tr>
                <DataTable.Th>เลขบิล</DataTable.Th>
                <DataTable.Th>ประเภท</DataTable.Th>
                <DataTable.Th>ลูกค้า</DataTable.Th>
                <DataTable.Th>ออเดอร์</DataTable.Th>
                <DataTable.Th align="right">จำนวนเงิน</DataTable.Th>
                <DataTable.Th>สถานะ</DataTable.Th>
                <DataTable.Th>ครบกำหนด</DataTable.Th>
                <DataTable.Th align="right">ทำต่อ</DataTable.Th>
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {invoices.map((inv) => {
                const statusVariant =
                  PAYMENT_STATUS_VARIANTS[
                    inv.paymentStatus as keyof typeof PAYMENT_STATUS_VARIANTS
                  ] ?? "warning";
                const statusLabel =
                  PAYMENT_STATUS_LABELS[
                    inv.paymentStatus as keyof typeof PAYMENT_STATUS_LABELS
                  ] ?? PAYMENT_STATUS_LABELS.UNPAID;
                const moneyHref = `/orders/${inv.orderId}?tab=money`;
                return (
                  <DataTable.Row key={inv.id}>
                    <DataTable.Td className="p-0 font-medium text-slate-900 dark:text-white">
                      <Link href={moneyHref} className="block px-5 py-3 text-blue-700 dark:text-blue-300">
                        {inv.invoiceNumber}
                      </Link>
                    </DataTable.Td>
                    <DataTable.Td className="p-0 text-xs text-slate-500 dark:text-slate-400">
                      <Link href={moneyHref} className="block px-5 py-3">
                        {INVOICE_TYPE_LABELS[inv.type] ?? inv.type}
                      </Link>
                    </DataTable.Td>
                    <DataTable.Td className="p-0">
                      <Link href={moneyHref} className="block px-5 py-3">{inv.customer.name}</Link>
                    </DataTable.Td>
                    <DataTable.Td className="p-0 text-blue-600 dark:text-blue-400">
                      <Link href={moneyHref} className="block px-5 py-3">{inv.order.orderNumber}</Link>
                    </DataTable.Td>
                    <DataTable.Td
                      align="right"
                      className="p-0 font-medium tabular-nums text-slate-900 dark:text-white"
                    >
                      <Link href={moneyHref} className="block px-5 py-3 text-right">
                        {formatCurrency(inv.totalAmount)}
                      </Link>
                    </DataTable.Td>
                    <DataTable.Td className="p-0">
                      <Link href={moneyHref} className="block px-5 py-3">
                        <Badge variant={statusVariant}>{statusLabel}</Badge>
                      </Link>
                    </DataTable.Td>
                    <DataTable.Td className="p-0 text-xs text-slate-500 dark:text-slate-400">
                      <Link href={moneyHref} className="block px-5 py-3">
                        {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                      </Link>
                    </DataTable.Td>
                    <DataTable.Td align="right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" asChild>
                          <Link
                            href={`/print/invoice/${inv.id}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`พิมพ์ ${inv.invoiceNumber}`}
                            title="พิมพ์"
                          >
                            <Printer className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={moneyHref}>
                            {paymentActionLabel(inv.paymentStatus, inv.type)}
                          </Link>
                        </Button>
                      </div>
                    </DataTable.Td>
                  </DataTable.Row>
                );
              })}
            </DataTable.Body>
          </DataTable.Root>
        )}
        pagination={
          data && data.invoices.length > 0 ? (
            <TablePagination
              page={page}
              totalPages={data.pages}
              total={data.total}
              onPageChange={(nextPage) =>
                replaceListState({ page: String(nextPage) })
              }
              label="ใบ"
            />
          ) : undefined
        }
      />
    </div>
  );
}
