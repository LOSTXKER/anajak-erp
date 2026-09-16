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
import { ListPageSkeleton } from "@/components/ui/page-skeleton";
import { QueryError } from "@/components/ui/query-error";
import { DataTable } from "@/components/ui/data-table";
import { TablePagination } from "@/components/ui/table-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { validDateParam } from "@/lib/order-list-contract";
import { KitDateRange } from "@/components/kit/date-range";
import { SegmentedControl } from "@/components/ui/segmented";
import { ChevronRight } from "lucide-react";
import { c, CardHead } from "@/components/kit/kit";
import { dueRowTone } from "@/lib/row-tone";
import { differenceInBangkokDays } from "@/lib/date-utils";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { Select } from "@/components/ui/select";
import { formatBaht, formatCurrency, formatDate } from "@/lib/utils";
import { PageShell } from "@/components/page-shell";
import { permAllows } from "@/lib/permissions";
import { INVOICE_TYPE_LABELS } from "@/lib/invoice-labels";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_VARIANTS } from "@/lib/status-config";
import {
  Wallet,
  Flame,
  Coins,
  Receipt,
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

/** จำนวนบิลต่อหน้า — ค่าเดียวกับที่ส่งเข้า query และที่แถบแบ่งหน้าใช้บอกช่วง "แสดง 1–50 จาก N" */
const PAGE_SIZE = 50;

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
    <Suspense fallback={<ListPageSkeleton />}>
      <BillingPageContent />
    </Suspense>
  );
}


/** ป้ายปุ่มกรองพร้อมจำนวน — รูปแบบเดียวกับแถบกรองหน้าออเดอร์ */
function pillLabel(label: string, count?: number) {
  return (
    <>
      {label}
      {typeof count === "number" && count > 0 ? <span className={c("n")}>{count.toLocaleString("th-TH")}</span> : null}
    </>
  );
}

/** บิลที่ไม่ต้องตามแล้ว — ชำระครบหรือยกเลิก (ไม่นับวันค้างกำหนดต่อ) */
function isSettled(status: string) {
  return status === "PAID" || status === "VOIDED";
}

/** ป้ายครบกำหนดของบิล (ต้นแบบ: ปิดแล้ว / เลยมา N วัน / อีก N วัน)
 *  ไม่ใช้ DueTag ของ kit เพราะคำของมันเป็นภาษากำหนดส่งงาน ("ส่งวันนี้") ไม่ใช่ภาษาบิล
 *  วันที่จริงยังอ่านได้จาก title และบนการ์ดจอแคบ */
function dueCell(dueDate: Date | string | null, settled: boolean) {
  if (settled) return <span className={c("due n")}>ปิดแล้ว</span>;
  const days = differenceInBangkokDays(dueDate, Date.now());
  if (days === null || !dueDate) return <span className={c("due n")}>ยังไม่กำหนด</span>;
  const date = formatDate(dueDate);
  if (days < 0)
    return (
      <span className={c("due bad")} title={date}>
        เลยมา {days * -1} วัน
      </span>
    );
  if (days === 0)
    return (
      <span className={c("due warn")} title={date}>
        ครบกำหนดวันนี้
      </span>
    );
  return (
    <span className={c("due", days <= 3 ? "warn" : "n")} title={date}>
      อีก {days} วัน
    </span>
  );
}

/** ยอดที่ยังค้าง = ยอดบิล − เงินที่รับมาแล้ว (ใบที่ปิดแล้วเหลือ 0) */
function outstandingOf(invoice: { totalAmount: number; payments: { amount: number }[] }) {
  const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
  return Math.max(0, invoice.totalAmount - paid);
}

function BillingPageContent() {
  const { search, page, searchParams, replaceListState, onSearchChange, searchInputRef } =
    useListPageState();
  const rawStatus = searchParams.get("status");
  const dateFrom = validDateParam(searchParams.get("from"));
  const dateTo = validDateParam(searchParams.get("to"));
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
      from: dateFrom || undefined,
      to: dateTo || undefined,
      page,
      limit: PAGE_SIZE,
    },
    // เปลี่ยนหน้า/ตัวกรองแล้วค้างข้อมูลเดิมไว้ระหว่างโหลด — ไม่งั้นตารางยุบเหลือ
    // skeleton + แถบ pagination หายใต้เคอร์เซอร์ (pattern B7)
    { enabled: canView, placeholderData: (prev) => prev }
  );

  usePageClamp(page, data?.pages, replaceListState);

  // ว่างเพราะกรอง หรือว่างเพราะยังไม่มีบิล — ช่วงวันที่ก็เป็นตัวกรอง ต้องนับด้วย
  const hasFilters =
    !!search || statusFilter !== ALL || typeFilter !== ALL || !!dateFrom || !!dateTo;

  return (
    <PageShell
      title="บิลและการเงิน"
      meta="ออกบิล รับชำระ และตามเงินค้าง"
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
        // กริดช่องตัวเลขชุดกลาง (.metrics ของ kit) — ระยะห่างเท่าหน้าแรก
        <div className={c("metrics")}>
          {/* สองใบแรกคือเลขเสี่ยง (UX4.3) — เด่น + กดไปดูรายการได้ · ศูนย์จริงลดเป็นสีจาง
              ไอคอนตามต้นแบบ: Wallet · Flame · Coins · Receipt */}
          <StatCard loading={stats.isLoading} moduleTone="finance"
            title="ค้างชำระ"
            value={formatCurrency(stats.data?.totalUnpaid ?? 0)}
            icon={Wallet}
            tone={(stats.data?.totalUnpaid ?? 0) > 0 ? "default" : "muted"}
            href="/billing/aging"
            caption="ดูรายงานลูกหนี้"
          />
          {/* ต้นแบบโชว์ "ยอดเงินที่เลยกำหนด" ตรงนี้ · billing.stats ยังคืนแต่จำนวนใบ
              จึงคงค่าจริงไว้และใช้คำของต้นแบบ (ดู blockers ในผลตรวจ) */}
          <StatCard loading={stats.isLoading} moduleTone="finance"
            title="เลยกำหนดแล้ว"
            value={stats.data?.overdueCount ?? 0}
            icon={Flame}
            caption="ใบ"
            tone={(stats.data?.overdueCount ?? 0) > 0 ? "danger" : "muted"}
            href="/billing?status=OVERDUE"
          />
          <StatCard loading={stats.isLoading} moduleTone="finance"
            title="รายได้เดือนนี้"
            value={formatCurrency(stats.data?.revenueThisMonth ?? 0)}
            icon={Coins}
          />
          <StatCard loading={stats.isLoading} moduleTone="finance"
            title="รับชำระเดือนนี้"
            value={formatCurrency(stats.data?.paidThisMonth ?? 0)}
            icon={Receipt}
          />
        </div>
      )}

      {/* แถบเครื่องมือใช้โครงกลาง — จุดตัดวัดจากพื้นที่เนื้อหาจริง (@container)
          ไม่ใช่ความกว้างหน้าต่าง จะได้แตกแถวจังหวะเดียวกับหน้ารายการอื่น */}

      <ResponsiveList
        toolbar={
          <>
            {/* หัวการ์ดตามต้นแบบ (.ch) — ชื่อรายการ + ทางไปลูกหนี้ ยืนในการ์ดใบเดียวกับแถบเครื่องมือ
                .ch มีระยะของตัวเองแล้ว จึงถอนระยะของช่อง toolbar ออกก่อนไม่ให้ซ้อนสองชั้น
                (ขอ slot header ของ ResponsiveList ไว้แล้ว — ดู sharedFileRequests) */}
            <div className="-mx-4.5 -mt-3.5">
              <CardHead
                icon={Receipt}
                tone="blue"
                title="บิลทั้งหมด"
                right={
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/billing/aging">
                      ดูลูกหนี้
                      <ArrowRight />
                    </Link>
                  </Button>
                }
              />
            </div>
            <Toolbar>
              <SearchInput
                surface="raised"
                ref={searchInputRef}
                containerClassName="@2xl:max-w-sm @2xl:flex-1"
                placeholder="ค้นเลขบิล หรือชื่อลูกค้า"
                defaultValue={search}
                onChange={(e) => onSearchChange(e.target.value)}
              />

              <KitDateRange
                label="ช่วงวันที่ออกบิล"
                from={dateFrom}
                to={dateTo}
                onChange={(from, to) => replaceListState({ from: from || null, to: to || null, page: null })}
              />

              {/* flex-wrap: จอแคบให้ตัวกรองเต็มความกว้างคนละบรรทัดเหมือนเดิม — ถ้าบีบสองช่องลงแถวเดียว
                  ป้ายยาวอย่าง "ใบแจ้งหนี้ส่วนที่เหลือ" จะถูกตัดกลางคำ · จอกว้างค่อยยืนเรียงกัน */}
              <ToolbarGroup className="flex-wrap">
                <SegmentedControl
                  value={statusFilter === ALL ? "" : statusFilter}
                  onChange={(value) => replaceListState({ status: value || null, page: null })}
                  options={[
                    { value: "", label: pillLabel("ทั้งหมด", data?.counts?.[""]) },
                    ...Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => ({
                      value,
                      label: pillLabel(label, data?.counts?.[value]),
                    })),
                  ]}
                  aria-label="กรองตามสถานะ"
                />
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

              {/* ตัวนับผลลัพธ์ชิดขวาสุดของแถบ (.cnt ของต้นแบบ) — กรองแล้วเหลือหน้าเดียว
                  แถบแบ่งหน้าจะซ่อนตัว ถ้าไม่มีบรรทัดนี้จะไม่รู้ว่าเหลือกี่ใบ */}
              <span
                className="text-xs tabular-nums text-muted @2xl:ml-auto"
                aria-live="polite"
                aria-busy={isFetching}
              >
                {data ? `${data.total.toLocaleString("th-TH")} ใบ` : ""}
              </span>
            </Toolbar>
          </>
        }
        items={data?.invoices}
        isLoading={isLoading || isFetching}
        isError={isError}
        errorMessage="โหลดรายการบิลไม่สำเร็จ"
        onRetry={() => refetch()}
        label="บิล"
        emptyState={
          <EmptyState
            icon={FileText}
            title={hasFilters ? "ไม่พบบิลตามเงื่อนไข" : "ยังไม่มีบิล"}
            description={
              hasFilters
                ? "ลองปรับคำค้น ช่วงวันที่ หรือตัวกรอง"
                : "สร้างบิลได้จากหน้าออเดอร์ — แท็บ เงิน/บิล"
            }
          />
        }
        renderMobile={(invoices) => (
          <div role="list" aria-label="รายการบิล" className="space-y-3">
            {invoices.map((inv) => {
              const status = paymentStatusProps(inv.paymentStatus);
              const moneyHref = `/orders/${inv.orderId}?tab=money`;
              return (
                <article key={inv.id} role="listitem" className="card-surface rounded-2xl p-4">
                  <Link
                    href={moneyHref}
                    className={cn("block rounded-lg", FOCUS_BUTTON)}
                    aria-label={`เปิดออเดอร์ ${inv.order.orderNumber} ที่แท็บเงินและบิล`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={cn("font-semibold text-strong", c("mono"))}>
                          {inv.invoiceNumber}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted">
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
                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-divider pt-3">
                      <div className="min-w-0">
                        <p className="text-xs text-muted">ลูกค้า</p>
                        <p className="mt-1 truncate text-sm font-medium text-strong">
                          {inv.customer.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted">ยอดบิล</p>
                        <p className="mt-1 tabular-nums font-semibold text-strong">
                          {formatBaht(inv.totalAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted">ออเดอร์</p>
                        <p className={cn("mt-1 text-sm text-secondary", c("mono"))}>
                          {inv.order.orderNumber}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted">ครบกำหนด</p>
                        <p className="mt-1 text-sm text-secondary">
                          {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                        </p>
                      </div>
                    </div>
                  </Link>
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-divider pt-3">
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
                    <Button size="sm" variant={inv.paymentStatus === "PAID" ? "outline" : "default"} asChild>
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
          // ระยะเซลล์ใช้ค่า default ของชุดกลาง (เซลล์ 14px · คอลัมน์แรก 18px) เหมือนหน้ารายการอื่น
          <DataTable.Root>
            <DataTable.Head>
              <tr>
                <DataTable.Th>เลขบิล</DataTable.Th>
                <DataTable.Th>ลูกค้า / ออเดอร์</DataTable.Th>
                <DataTable.Th align="right">ยอดบิล</DataTable.Th>
                <DataTable.Th align="right">ค้างชำระ</DataTable.Th>
                <DataTable.Th>สถานะ</DataTable.Th>
                <DataTable.Th>ครบกำหนด</DataTable.Th>
                <DataTable.Th align="right"><span className="sr-only">เปิดบิล</span></DataTable.Th>
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {invoices.map((inv) => {
                const status = paymentStatusProps(inv.paymentStatus);
                const settled = isSettled(inv.paymentStatus);
                const moneyHref = `/orders/${inv.orderId}?tab=money`;
                return (
                  <DataTable.Row
                    key={inv.id}
                    href={moneyHref}
                    tone={dueRowTone(inv.dueDate, settled)}
                  >
                    <DataTable.Td className="whitespace-nowrap font-medium text-strong">
                      <Link href={moneyHref} className={cn("rounded font-medium text-strong", c("mono"), FOCUS_BUTTON)}>
                        {inv.invoiceNumber}
                      </Link>
                    </DataTable.Td>
                    <DataTable.Td>
                      <div className={c("who")}>
                        <div className={c("t")}>
                          <div className={c("id")}>{inv.customer.name}</div>
                          <div className={c("cu")}>
                            <span className={c("mono")}>{inv.order.orderNumber}</span> ·{" "}
                            {INVOICE_TYPE_LABELS[inv.type] ?? inv.type}
                          </div>
                        </div>
                      </div>
                    </DataTable.Td>
                    <DataTable.Td align="right" className="font-medium tabular-nums text-strong">
                      {formatBaht(inv.totalAmount)}
                    </DataTable.Td>
                    <DataTable.Td align="right" className="tabular-nums">
                      {outstandingOf(inv) > 0 ? (
                        <span className="font-medium text-strong">{formatBaht(outstandingOf(inv))}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </DataTable.Td>
                    <DataTable.Td>
                      <StatusLabel label={status.label} tone={status.tone} emphasize={status.emphasize} />
                    </DataTable.Td>
                    <DataTable.Td>{dueCell(inv.dueDate, settled)}</DataTable.Td>
                    <DataTable.Td align="right">
                      <ChevronRight className="ml-auto h-4 w-4 text-muted" aria-hidden="true" />
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
              limit={PAGE_SIZE}
            />
          ) : undefined
        }
      />
    </PageShell>
  );
}
