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
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { formatCurrency, formatDate } from "@/lib/utils";
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_VARIANTS } from "@/lib/status-config";
import { PageShell } from "@/components/page-shell";
import { Plus, ClipboardList, ChevronRight } from "lucide-react";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";

const QUOTATION_STATUSES = [
  { value: "", label: "ทั้งหมด" },
  { value: "DRAFT", label: "ฉบับร่าง" },
  { value: "SENT", label: "ส่งแล้ว" },
  { value: "ACCEPTED", label: "อนุมัติ" },
  { value: "REJECTED", label: "ปฏิเสธ" },
  { value: "EXPIRED", label: "หมดอายุ" },
  { value: "CONVERTED", label: "แปลงแล้ว" },
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
    <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
      <QuotationsPageContent />
    </Suspense>
  );
}

function QuotationsPageContent() {
  const { search, page, searchParams, replaceListState, onSearchChange, searchInputRef } =
    useListPageState();
  const rawStatus = searchParams.get("status") ?? "";
  const status = QUOTATION_STATUSES.some((option) => option.value === rawStatus)
    ? rawStatus
    : "";

  const { data: me } = trpc.user.me.useQuery();
  // เริ่มใบเสนอผ่านฟอร์มเปิดงานที่มีราคา — ใช้ด่านเดียวกับปลายทาง ไม่ให้ CTA ชน AccessDenied
  const canCreateQuotation = canCreateOrderWithPricing(me?.permissions);
  // ใบเสนอทั้งหน้าเป็นเรื่องราคาขาย — ช่าง/กราฟิกห้ามเห็น (Policy ⑦ · ตรงกับ requireRole ฝั่ง server)
  const canView = me ? permAllows(me.permissions, "see_order_money") : true;

  const { data, isLoading, isFetching, isError, refetch } = trpc.quotation.list.useQuery(
    {
      search: search.trim() || undefined,
      status: status || undefined,
      page,
      limit: 20,
    },
    { enabled: canView }
  );

  usePageClamp(page, data?.pages, replaceListState);

  return (
    <PageShell
      title="ใบเสนอราคา"
      action={
        canCreateQuotation ? (
          <Button size="sm" asChild>
            <Link href="/orders/new?next=quote">
              <Plus />
              เปิดงานเพื่อออกใบเสนอ
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
      headerChildren={
        <Toolbar>
          <SearchInput
            surface="raised"
            ref={searchInputRef}
            containerClassName="@2xl:max-w-sm @2xl:flex-1"
            placeholder="ค้นหาเลขใบเสนอราคา, ชื่อ, ลูกค้า..."
            defaultValue={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <ToolbarGroup>
            {/* 7 ตัวเลือก = เกิน 5 → ดรอปดาวน์ (ชิป 7 ตัวล้นแถวบนมือถือ) · กติกาใน tokens.ts */}
            <Select
              shape="pill"
              surface="raised"
              className="@2xl:w-52"
              aria-label="กรองตามสถานะใบเสนอราคา"
              value={status}
              onChange={(e) =>
                replaceListState({ status: e.target.value || null, page: null })
              }
            >
              {QUOTATION_STATUSES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </ToolbarGroup>
        </Toolbar>
      }
    >
      <ResponsiveList
        items={data?.quotations}
        isLoading={isLoading || isFetching}
        isError={isError}
        errorMessage="โหลดรายการใบเสนอราคาไม่สำเร็จ"
        onRetry={() => refetch()}
        label="ใบเสนอราคา"
        emptyState={
          <div className="card-surface rounded-lg">
            <EmptyState
              icon={ClipboardList}
              title="ไม่พบใบเสนอราคา"
              description="เปิดงานก่อน แล้วค่อยเติมรายการและแชร์ใบเสนอจากงานใบเดิม"
              action={
                canCreateQuotation ? (
                  <Button size="sm" asChild>
                    <Link href="/orders/new?next=quote">
                      <Plus />
                      เปิดงานเพื่อออกใบเสนอ
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          </div>
        }
        renderMobile={(quotations) => (
          <div className="space-y-3">
            {quotations.map((q) => (
              <Link
                key={q.id}
                href={`/quotations/${q.id}`}
                className={cn("card-surface card-surface-hover group block rounded-lg p-4", FOCUS_BUTTON)}
                aria-label={`เปิดใบเสนอ ${q.quotationNumber} ของ ${q.customer.name}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-blue-700 dark:text-blue-300">
                      {q.quotationNumber}
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-strong">
                      {q.title}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <QuotationStatusLabel status={q.status} />
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3 border-t border-divider pt-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-secondary">
                      {q.customer.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 group-hover:text-secondary group-active:text-secondary dark:text-slate-400 dark:group-hover:text-secondary dark:group-active:text-secondary">
                      {formatDate(q.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums font-semibold text-strong">
                      {formatCurrency(q.totalAmount)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        renderDesktop={(quotations) => (
          <DataTable.Root bordered={false} flush>
            <DataTable.Head>
              <tr>
                <DataTable.Th>เลขที่</DataTable.Th>
                <DataTable.Th>ชื่อ</DataTable.Th>
                <DataTable.Th>ลูกค้า</DataTable.Th>
                <DataTable.Th align="right">ยอดรวม</DataTable.Th>
                <DataTable.Th>สถานะ</DataTable.Th>
                <DataTable.Th>วันที่สร้าง</DataTable.Th>
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {quotations.map((q) => (
                <DataTable.Row key={q.id} href={`/quotations/${q.id}`}>
                  <DataTable.Td>
                    <Link
                      href={`/quotations/${q.id}`}
                      className="text-sm font-medium tabular-nums text-strong hover:underline"
                    >
                      {q.quotationNumber}
                    </Link>
                  </DataTable.Td>
                  <DataTable.Td className="text-strong">
                    {q.title}
                  </DataTable.Td>
                  <DataTable.Td>
                    <p className="text-sm text-strong">{q.customer.name}</p>
                    {q.customer.company && (
                      <p className="text-xs text-muted">
                        {q.customer.company}
                      </p>
                    )}
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
                  <DataTable.Td className="text-xs text-muted">
                    {formatDate(q.createdAt)}
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
