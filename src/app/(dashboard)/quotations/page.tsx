"use client";

import { Suspense, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { FilterChip } from "@/components/ui/filter-chip";
import { TablePagination } from "@/components/ui/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { formatCurrency, formatDate } from "@/lib/utils";
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_VARIANTS } from "@/lib/status-config";
import { PageHeader } from "@/components/page-header";
import { Plus, ClipboardList, ChevronRight } from "lucide-react";

const QUOTATION_STATUSES = [
  { value: "", label: "ทั้งหมด" },
  { value: "DRAFT", label: "ฉบับร่าง" },
  { value: "SENT", label: "ส่งแล้ว" },
  { value: "ACCEPTED", label: "อนุมัติ" },
  { value: "REJECTED", label: "ปฏิเสธ" },
  { value: "EXPIRED", label: "หมดอายุ" },
  { value: "CONVERTED", label: "แปลงแล้ว" },
];

function positivePage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default function QuotationsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <QuotationsPageContent />
    </Suspense>
  );
}

function QuotationsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const rawStatus = searchParams.get("status") ?? "";
  const status = QUOTATION_STATUSES.some((option) => option.value === rawStatus)
    ? rawStatus
    : "";
  const page = positivePage(searchParams.get("page"));
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const replaceListState = useCallback(
    (updates: Record<string, string | null>) => {
      // อ่าน URL สดตอนกดจริง — กัน debounce คำค้นที่เริ่มก่อนผู้ใช้เปลี่ยน filter
      // แล้ว callback เก่าเขียนทับ status/page ที่เพิ่งเลือก
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
  // สร้างใบเสนอ = สิทธิ์ขาย (quotation.create ใช้ salesUp) — ช่าง/กราฟิก/บัญชี ไม่โชว์ (B12)
  const canCreateQuotation = permAllows(me?.permissions, "create_sales_docs");
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

  useEffect(() => {
    if (data && page > data.pages && data.pages >= 1) {
      replaceListState({ page: String(data.pages) });
    }
  }, [data, page, replaceListState]);

  if (me && !canView) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="ใบเสนอราคา"
          description="จัดการใบเสนอราคาทั้งหมด"
        />
        <p className="text-sm text-slate-400">
          ต้องมีสิทธิ์ &quot;เห็นเงินฝั่งขาย&quot; — เช็คสิทธิ์ที่ ตั้งค่า → ผู้ใช้
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="ใบเสนอราคา"
        description="จัดการใบเสนอราคาทั้งหมด"
        action={
          canCreateQuotation ? (
            <Button size="sm" asChild>
              <Link href="/orders/new?next=quote">
                <Plus className="h-4 w-4" />
                เปิดงานเพื่อออกใบเสนอ
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <SearchInput
          ref={searchInputRef}
          containerClassName="flex-1"
          placeholder="ค้นหาเลขใบเสนอราคา, ชื่อ, ลูกค้า..."
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
        <div className="flex flex-wrap gap-1">
          {QUOTATION_STATUSES.map((f) => (
            <FilterChip
              key={f.value}
              selected={status === f.value}
              onClick={() => {
                replaceListState({ status: f.value || null, page: null });
              }}
            >
              {f.label}
            </FilterChip>
          ))}
        </div>
      </div>

      <ResponsiveList
        items={data?.quotations}
        isLoading={isLoading || isFetching}
        isError={isError}
        errorMessage="โหลดรายการใบเสนอราคาไม่สำเร็จ"
        onRetry={() => refetch()}
        label="ใบเสนอราคา"
        emptyState={
          <div className="card-surface rounded-2xl">
            <EmptyState
              icon={ClipboardList}
              title="ไม่พบใบเสนอราคา"
              description="เปิดงานก่อน แล้วค่อยเติมรายการและแชร์ใบเสนอจากงานใบเดิม"
              action={
                canCreateQuotation ? (
                  <Button size="sm" asChild>
                    <Link href="/orders/new?next=quote">
                      <Plus className="h-4 w-4" />
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
                className="card-surface block rounded-2xl p-4 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-slate-900"
                aria-label={`เปิดใบเสนอ ${q.quotationNumber} ของ ${q.customer.name}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-blue-700 dark:text-blue-300">
                      {q.quotationNumber}
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-slate-900 dark:text-white">
                      {q.title}
                    </p>
                  </div>
                  <Badge
                    variant={
                      QUOTATION_STATUS_VARIANTS[
                        q.status as keyof typeof QUOTATION_STATUS_VARIANTS
                      ] ?? "default"
                    }
                  >
                    {QUOTATION_STATUS_LABELS[
                      q.status as keyof typeof QUOTATION_STATUS_LABELS
                    ] ?? q.status}
                  </Badge>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-700 dark:text-slate-300">
                      {q.customer.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(q.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums font-semibold text-slate-900 dark:text-white">
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
          <DataTable.Root>
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
                <DataTable.Row key={q.id}>
                  <DataTable.Td>
                    <Link
                      href={`/quotations/${q.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {q.quotationNumber}
                    </Link>
                  </DataTable.Td>
                  <DataTable.Td className="text-slate-900 dark:text-white">
                    {q.title}
                  </DataTable.Td>
                  <DataTable.Td>
                    <p className="text-sm text-slate-900 dark:text-white">{q.customer.name}</p>
                    {q.customer.company && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {q.customer.company}
                      </p>
                    )}
                  </DataTable.Td>
                  <DataTable.Td
                    align="right"
                    className="font-medium tabular-nums text-slate-900 dark:text-white"
                  >
                    {formatCurrency(q.totalAmount)}
                  </DataTable.Td>
                  <DataTable.Td>
                    <Badge
                      variant={
                        QUOTATION_STATUS_VARIANTS[
                          q.status as keyof typeof QUOTATION_STATUS_VARIANTS
                        ] ?? "default"
                      }
                    >
                      {QUOTATION_STATUS_LABELS[
                        q.status as keyof typeof QUOTATION_STATUS_LABELS
                      ] ?? q.status}
                    </Badge>
                  </DataTable.Td>
                  <DataTable.Td className="text-xs text-slate-500 dark:text-slate-400">
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
    </div>
  );
}
