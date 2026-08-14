"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useListPageState, usePageClamp } from "@/hooks/use-list-page-state";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { StatusLabel, toneFromBadgeVariant } from "@/components/ui/status-label";
import { SearchInput } from "@/components/ui/search-input";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { DataTable } from "@/components/ui/data-table";
import { TablePagination } from "@/components/ui/table-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { Select } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageShell } from "@/components/page-shell";
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
import { FOCUS_BUTTON } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

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

// ป้ายสถานะการชำระ — คิดที่เดียว ใช้ทั้งการ์ดมือถือและตารางเดสก์ท็อป
// (เดิมสองที่คำนวณเองซ้ำกัน แก้ทีต้องแก้สองแห่ง)
function paymentStatusProps(status: string) {
  const label =
    PAYMENT_STATUS_LABELS[status as keyof typeof PAYMENT_STATUS_LABELS] ??
    PAYMENT_STATUS_LABELS.UNPAID;
  const tone = toneFromBadgeVariant(
    PAYMENT_STATUS_VARIANTS[status as keyof typeof PAYMENT_STATUS_VARIANTS] ?? "warning"
  );
  // ย้อมข้อความเฉพาะสถานะปลายทาง (ชำระแล้ว/เกินกำหนด/ยกเลิก) — ระหว่างทางปล่อยให้จุดสีบอกพอ
  // ถ้าย้อมทุกสถานะ ตารางจะเป็นรุ้งจนหาบิลที่ต้องตามไม่เจอ
  const emphasize = status === "PAID" || status === "OVERDUE" || status === "VOIDED";
  return { label, tone, emphasize };
}

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
  const { search, page, searchParams, replaceListState, onSearchChange, searchInputRef } =
    useListPageState();
  const rawStatus = searchParams.get("status");
  const statusFilter = rawStatus && rawStatus in PAYMENT_STATUS_LABELS ? rawStatus : ALL;
  const rawType = searchParams.get("type");
  const typeFilter = rawType && TYPE_FILTER_OPTIONS.some((type) => type === rawType)
    ? rawType
    : ALL;

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

  usePageClamp(page, data?.pages, replaceListState);

  return (
    <PageShell
      title="บิล/การเงิน"
      denied={
        me && !canView
          ? {
              description:
                'ต้องมีสิทธิ์ "ออกใบแจ้งหนี้/ใบวางบิล/รายงานภาษี" — เช็คสิทธิ์ที่ ตั้งค่า → ผู้ใช้',
            }
          : undefined
      }
    >
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

      {/* แถบเครื่องมือใช้โครงกลาง — จุดตัดวัดจากพื้นที่เนื้อหาจริง (@container)
          ไม่ใช่ความกว้างหน้าต่าง จะได้แตกแถวจังหวะเดียวกับหน้ารายการอื่น */}
      <Toolbar>
        <SearchInput
          surface="raised"
          ref={searchInputRef}
          containerClassName="@2xl:max-w-sm @2xl:flex-1"
          placeholder="ค้นหาเลขบิล, ชื่อลูกค้า..."
          defaultValue={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />

        {/* flex-wrap: จอแคบให้ตัวกรองเต็มความกว้างคนละบรรทัดเหมือนเดิม — ถ้าบีบสองช่องลงแถวเดียว
            ป้ายยาวอย่าง "ใบแจ้งหนี้ส่วนที่เหลือ" จะถูกตัดกลางคำ · จอกว้างค่อยยืนเรียงกัน */}
        <ToolbarGroup className="flex-wrap">
          <Select value={statusFilter} surface="raised"
            onChange={(e) => {
              replaceListState({ status: e.target.value === ALL ? null : e.target.value, page: null });
            }} shape="pill" className="w-full @2xl:w-40" aria-label="กรองตามสถานะ">
              <option value={ALL}>ทุกสถานะ</option>
              {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          <Select value={typeFilter} surface="raised"
            onChange={(e) => {
              replaceListState({ type: e.target.value === ALL ? null : e.target.value, page: null });
            }} shape="pill" className="w-full @2xl:w-48" aria-label="กรองตามประเภท">
              <option value={ALL}>ทุกประเภท</option>
              {TYPE_FILTER_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {INVOICE_TYPE_LABELS[value]}
                </option>
              ))}
            </Select>
        </ToolbarGroup>
      </Toolbar>

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
              const status = paymentStatusProps(inv.paymentStatus);
              const moneyHref = `/orders/${inv.orderId}?tab=money`;
              return (
                <article key={inv.id} className="card-surface rounded-2xl p-4">
                  <Link
                    href={moneyHref}
                    className={cn("block rounded-xl", FOCUS_BUTTON)}
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
                      <StatusLabel
                        label={status.label}
                        tone={status.tone}
                        emphasize={status.emphasize}
                        className="shrink-0"
                      />
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
                        <Printer />
                        พิมพ์
                      </Link>
                    </Button>
                    <Button size="sm" asChild>
                      <Link href={moneyHref}>
                        {paymentActionLabel(inv.paymentStatus, inv.type)}
                        <ArrowRight />
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
                const status = paymentStatusProps(inv.paymentStatus);
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
                        <StatusLabel
                          label={status.label}
                          tone={status.tone}
                          emphasize={status.emphasize}
                        />
                      </Link>
                    </DataTable.Td>
                    <DataTable.Td className="p-0 text-xs text-slate-500 dark:text-slate-400">
                      <Link href={moneyHref} className="block px-5 py-3">
                        {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                      </Link>
                    </DataTable.Td>
                    <DataTable.Td align="right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="ghost" size="icon-sm" asChild>
                          <Link
                            href={`/print/invoice/${inv.id}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`พิมพ์ ${inv.invoiceNumber}`}
                            title="พิมพ์"
                          >
                            <Printer />
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
    </PageShell>
  );
}
