"use client";

import { Suspense } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useListPageState, usePageClamp } from "@/hooks/use-list-page-state";
import { permAllows } from "@/lib/permissions";
import { canCreateOrderWithPricing } from "@/lib/order-access";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { TablePagination } from "@/components/ui/table-pagination";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { StatusLabel, toneFromBadgeVariant } from "@/components/ui/status-label";
import { ListPageSkeleton } from "@/components/ui/page-skeleton";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { dueRowTone } from "@/lib/row-tone";
import { KitDateRange } from "@/components/kit/date-range";
import { SegmentedControl } from "@/components/ui/segmented";
import { differenceInBangkokDays } from "@/lib/date-utils";
import { c } from "@/components/kit/kit";
import { validDateParam } from "@/lib/order-list-contract";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { formatCurrency, formatDate } from "@/lib/utils";
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_VARIANTS } from "@/lib/status-config";
import { PageShell } from "@/components/page-shell";
import { Plus, ClipboardList, ChevronRight } from "lucide-react";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

/** จำนวนต่อหน้า — ค่าเดียวที่ใช้ทั้งการยิง query และข้อความ "แสดง 1–20 จาก N" */
const LIMIT = 20;

/* เรียงตามงานที่ต้องตามก่อน (ต้นแบบที่เบสเคาะ 2026-09-16):
   รอลูกค้าตอบ → อนุมัติ มาก่อน ร่าง/หมดอายุ · สองสถานะที่ต้นแบบไม่มี
   (ปฏิเสธ · เปิดออเดอร์แล้ว) เก็บท้ายแถว เพราะของจริงมี 6 สถานะ ไม่ใช่ 4 */
const QUOTATION_STATUSES = [
  { value: "", label: "ทั้งหมด" },
  { value: "SENT", label: "รอลูกค้าตอบ" },
  { value: "ACCEPTED", label: "อนุมัติ" },
  { value: "DRAFT", label: "ร่าง" },
  { value: "EXPIRED", label: "หมดอายุ" },
  { value: "REJECTED", label: "ปฏิเสธ" },
  { value: "CONVERTED", label: "เปิดออเดอร์แล้ว" },
];

// สถานะปลายทางของใบเสนอ — จบเรื่องแล้ว ไม่ขยับต่อ จึงย้อมข้อความให้สะดุดตาตอนไล่สายตา
// ที่เหลือ (ฉบับร่าง/ส่งแล้ว) เป็นระหว่างทาง ปล่อยให้จุดสีบอกอย่างเดียว
const QUOTATION_TERMINAL_STATUSES = new Set([
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "CONVERTED",
]);

function QuotationStatusLabel({ status }: { status: string }) {
  return (
    <StatusLabel
      label={
        QUOTATION_STATUS_LABELS[status as keyof typeof QUOTATION_STATUS_LABELS] ??
        status
      }
      tone={toneFromBadgeVariant(
        QUOTATION_STATUS_VARIANTS[status as keyof typeof QUOTATION_STATUS_VARIANTS]
      )}
      emphasize={QUOTATION_TERMINAL_STATUSES.has(status)}
    />
  );
}

export default function QuotationsPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <QuotationsPageContent />
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

/** วันหมดอายุของใบเสนอ — ทุกแถวเป็นป้ายกลมชุดเดียวกัน (.due ของ kit) ตามต้นแบบ
 *  ใบที่ยังรอลูกค้าตอบเท่านั้นที่บอกความรีบ · ใบที่จบเรื่องแล้วบอกว่าจบด้วยอะไร
 *  (เดิมสถานะอื่นเป็นตัวหนังสือจาง ๆ ทั้งที่เป็นข้อมูลที่ต้องกวาดสายตาหา)
 *
 *  คำบนป้ายเป็นคำของ "วันยืนราคา" ไม่ใช่ของ "วันส่งของ" — จึงไม่ใช้ DueTag กลาง
 *  ที่พูดว่า "ส่งวันนี้/ส่งพรุ่งนี้/ส่ง 12 ก.ย." ซึ่งผิดความหมายใต้หัวคอลัมน์ "หมดอายุ" */
function QuotationExpiry({
  validUntil,
  status,
  now,
}: {
  validUntil: Date | string | null;
  status: string;
  now: number;
}) {
  if (status === "CONVERTED") return <span className={c("due n")}>เปิดออเดอร์แล้ว</span>;
  if (status === "EXPIRED") return <span className={c("due n")}>หมดอายุแล้ว</span>;
  if (!validUntil) return <span className={c("due n")}>ไม่ได้กำหนดวันยืนราคา</span>;
  if (status === "SENT") {
    const days = differenceInBangkokDays(validUntil, now);
    if (days === null) return <span className={c("due n")}>ยืนราคาถึง {formatDate(validUntil)}</span>;
    if (days < 0) return <span className={c("due n")}>หมดอายุแล้ว</span>;
    // ≤ 2 วัน = ส้ม (กติกาเดียวกับเส้นขอบซ้ายของแถว)
    return (
      <span className={c("due", days <= 2 ? "warn" : "n")}>
        {days === 0 ? "หมดอายุวันนี้" : `อีก ${days.toLocaleString("th-TH")} วัน`}
      </span>
    );
  }
  return <span className={c("due n")}>ยืนราคาถึง {formatDate(validUntil)}</span>;
}

/** บรรทัดรองของคอลัมน์ "ลูกค้า / งาน" — ชื่องาน · จำนวนรายการ (ต้นแบบ)
 *  ไม่มีชื่องาน = คงชื่อผู้ติดต่อไว้แทน เพื่อไม่ให้ลูกค้านิติบุคคลเหลือแค่ชื่อบริษัท */
function customerSubLine(quotation: {
  description: string | null;
  customer: { name: string; company: string | null };
  _count: { items: number };
}) {
  const job = quotation.description?.trim() || (quotation.customer.company ? quotation.customer.name : "");
  const items = `${quotation._count.items.toLocaleString("th-TH")} รายการ`;
  return [job, items].filter(Boolean).join(" · ");
}

function QuotationsPageContent() {
  const { search, page, searchParams, replaceListState, onSearchChange, searchInputRef, clearSearch } =
    useListPageState();
  const rawStatus = searchParams.get("status") ?? "";
  const status = QUOTATION_STATUSES.some((option) => option.value === rawStatus)
    ? rawStatus
    : "";
  const dateFrom = validDateParam(searchParams.get("from"));
  const dateTo = validDateParam(searchParams.get("to"));
  const filtered = Boolean(search || status || dateFrom || dateTo);
  const clearFilters = () => clearSearch({ status: null, from: null, to: null });

  const { data: me } = trpc.user.me.useQuery();
  // เริ่มใบเสนอผ่านฟอร์มเปิดงานที่มีราคา — ใช้ด่านเดียวกับปลายทาง ไม่ให้ CTA ชน AccessDenied
  const canCreateQuotation = canCreateOrderWithPricing(me?.permissions);
  // ใบเสนอทั้งหน้าเป็นเรื่องราคาขาย — ช่าง/กราฟิกห้ามเห็น (Policy ⑦ · ตรงกับ requireRole ฝั่ง server)
  const canView = me ? permAllows(me.permissions, "see_order_money") : true;

  const { data, isLoading, isFetching, isError, refetch, dataUpdatedAt: listUpdatedAt } = trpc.quotation.list.useQuery(
    {
      search: search.trim() || undefined,
      status: status || undefined,
      from: dateFrom || undefined,
      to: dateTo || undefined,
      page,
      limit: LIMIT,
    },
    { enabled: canView }
  );

  usePageClamp(page, data?.pages, replaceListState);

  return (
    <PageShell
      title="ใบเสนอราคา"
      meta="เสนอราคาแล้วกดเปิดออเดอร์ได้เลยเมื่อลูกค้าตอบรับ"
      action={
        canCreateQuotation ? (
          <Button size="sm" asChild>
            <Link href="/orders/new?next=quote" title="ใบเสนอเริ่มจากการเปิดงาน ระบบจะพาไปกรอกงานก่อนแล้วออกใบเสนอให้">
              <Plus />
              สร้างใบเสนอราคา
            </Link>
          </Button>
        ) : undefined
      }
      denied={
        !!me &&
        !canView && {
          description:
            'ต้องมีสิทธิ์ "เห็นเงินฝั่งขาย" — เช็คสิทธิ์ที่ ตั้งค่า → ผู้ใช้',
        }
      }
    >
      <ResponsiveList
        toolbar={
          <Toolbar>
            <SearchInput
              surface="raised"
              ref={searchInputRef}
              containerClassName="@2xl:max-w-sm @2xl:flex-1"
              placeholder="ค้นเลขที่ใบเสนอ หรือชื่อลูกค้า"
              aria-label="ค้นเลขที่ใบเสนอ หรือชื่อลูกค้า"
              defaultValue={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            <KitDateRange
              label="ช่วงวันที่เสนอราคา"
              from={dateFrom}
              to={dateTo}
              onChange={(from, to) => replaceListState({ from: from || null, to: to || null, page: null })}
            />
            <ToolbarGroup>
              {/* แถบปุ่มกรองพร้อมจำนวนตามต้นแบบ — เลื่อนแนวนอนได้เองบนจอแคบ (.seg ของ kit) */}
              <SegmentedControl
                value={status}
                onChange={(value) => replaceListState({ status: value || null, page: null })}
                options={QUOTATION_STATUSES.map((f) => ({
                  value: f.value,
                  label: pillLabel(f.label, data?.counts?.[f.value]),
                }))}
                aria-label="กรองตามสถานะใบเสนอราคา"
              />
              {filtered ? <Button variant="ghost" size="sm" onClick={clearFilters}>ล้างตัวกรอง</Button> : null}
            </ToolbarGroup>
            {/* ตัวนับชิดขวาสุดของแถบเครื่องมือ (.cnt ของต้นแบบ) — บอกว่าตัวกรองที่เลือกอยู่เหลือกี่ใบ */}
            {data ? (
              <ToolbarGroup align="end">
                <span className="text-xs tabular-nums text-muted">
                  {data.total.toLocaleString("th-TH")} ใบ
                </span>
              </ToolbarGroup>
            ) : null}
          </Toolbar>
        }
        items={data?.quotations}
        isLoading={isLoading || isFetching}
        isError={isError}
        errorMessage="โหลดรายการใบเสนอราคาไม่สำเร็จ"
        onRetry={() => refetch()}
        label="ใบเสนอราคา"
        emptyState={
          <EmptyState
            icon={ClipboardList}
            title={filtered ? "ไม่มีใบเสนอราคาในกลุ่มนี้" : "ยังไม่มีใบเสนอราคา"}
            description={filtered ? "ลองเลือกกลุ่มอื่น หรือสร้างใบใหม่" : "เปิดงานก่อน แล้วค่อยเติมรายการและแชร์ใบเสนอจากงานใบเดิม"}
            action={
              filtered ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>ล้างตัวกรองและคำค้น</Button>
              ) : canCreateQuotation ? (
                <Button size="sm" asChild>
                  <Link href="/orders/new?next=quote" title="ใบเสนอเริ่มจากการเปิดงาน ระบบจะพาไปกรอกงานก่อนแล้วออกใบเสนอให้">
                    <Plus />
                    สร้างใบเสนอราคา
                  </Link>
                </Button>
              ) : undefined
            }
          />
        }
        renderMobile={(quotations) => (
          <ul aria-label="รายการใบเสนอราคา" className="space-y-3">
            {quotations.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/quotations/${q.id}`}
                  className={cn("card-surface card-surface-hover group block rounded-2xl p-4", FOCUS_BUTTON)}
                  aria-label={`เปิดใบเสนอ ${q.quotationNumber} ของ ${q.customer.name}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-blue-700 dark:text-blue-300">
                        {q.quotationNumber}
                      </p>
                      <p className="mt-1 truncate text-sm font-medium text-strong">
                        {q.customer.company || q.customer.name}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <QuotationStatusLabel status={q.status} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3 border-t border-divider pt-3">
                    <div className="min-w-0 space-y-1.5">
                      <p className="truncate text-sm text-secondary">{customerSubLine(q)}</p>
                      <QuotationExpiry validUntil={q.validUntil} status={q.status} now={listUpdatedAt} />
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums font-semibold text-strong">
                        {formatCurrency(q.totalAmount)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted" aria-hidden="true" />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        renderDesktop={(quotations) => (
          <DataTable.Root>
            <DataTable.Head>
              <tr>
                <DataTable.Th>เลขที่</DataTable.Th>
                <DataTable.Th>ลูกค้า / งาน</DataTable.Th>
                <DataTable.Th align="right">ยอดรวม</DataTable.Th>
                <DataTable.Th>สถานะ</DataTable.Th>
                <DataTable.Th>หมดอายุ</DataTable.Th>
                <DataTable.Th>คนทำ</DataTable.Th>
                <DataTable.Th align="right"><span className="sr-only">เปิดใบเสนอราคา</span></DataTable.Th>
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {quotations.map((q) => (
                <DataTable.Row key={q.id} href={`/quotations/${q.id}`} tone={dueRowTone(q.validUntil, q.status !== "SENT")}>
                  <DataTable.Td>
                    <Link
                      href={`/quotations/${q.id}`}
                      className="text-sm font-medium tabular-nums text-strong"
                    >
                      {q.quotationNumber}
                    </Link>
                  </DataTable.Td>
                  <DataTable.Td>
                    <div className={c("who")}>
                      <div className={c("t")}>
                        <div className={c("id")}>
                          <span className="truncate">{q.customer.company || q.customer.name}</span>
                        </div>
                        <div className={c("cu")}>{customerSubLine(q)}</div>
                      </div>
                    </div>
                  </DataTable.Td>
                  <DataTable.Td
                    align="right"
                    className="font-medium tabular-nums text-strong"
                  >
                    {formatCurrency(q.totalAmount)}
                  </DataTable.Td>
                  <DataTable.Td>
                    <QuotationStatusLabel status={q.status} />
                  </DataTable.Td>
                  <DataTable.Td className="whitespace-nowrap">
                    <QuotationExpiry validUntil={q.validUntil} status={q.status} now={listUpdatedAt} />
                  </DataTable.Td>
                  <DataTable.Td className="whitespace-nowrap text-xs text-secondary">
                    {q.createdBy?.name ?? "—"}
                  </DataTable.Td>
                  <DataTable.Td align="right">
                    <ChevronRight className="ml-auto h-4 w-4 text-muted" aria-hidden="true" />
                  </DataTable.Td>
                </DataTable.Row>
              ))}
            </DataTable.Body>
          </DataTable.Root>
        )}
        pagination={
          data && data.quotations.length > 0 ? (
            <TablePagination
              page={page}
              totalPages={data.pages}
              total={data.total}
              limit={LIMIT}
              onPageChange={(nextPage) =>
                replaceListState({ page: String(nextPage) })
              }
            />
          ) : undefined
        }
      />
    </PageShell>
  );
}
