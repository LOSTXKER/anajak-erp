"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SearchInput } from "@/components/ui/search-input";
import { NativeSelect } from "@/components/ui/native-select";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { TablePagination } from "@/components/ui/table-pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { permAllows } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import {
  Users,
  DollarSign,
  AlertCircle,
  Hourglass,
  MessageSquare,
  Copy,
  Loader2,
} from "lucide-react";

type DunningTone = "gentle" | "firm";

// ลำดับ + ป้ายถังอายุหนี้ — ตรงกับ AGING_BUCKETS ใน services/receivables.ts
const BUCKETS = [
  { key: "current", label: "ยังไม่ครบกำหนด" },
  { key: "d1_30", label: "เลย 1-30 วัน" },
  { key: "d31_60", label: "เลย 31-60 วัน" },
  { key: "d61_90", label: "เลย 61-90 วัน" },
  { key: "d90plus", label: "เกิน 90 วัน" },
] as const;

const AGING_STATUS_OPTIONS = [
  { value: "", label: "ทุกช่วงอายุหนี้" },
  { value: "current", label: "ยังไม่ครบกำหนด" },
  { value: "overdue", label: "เลยกำหนดทั้งหมด" },
  ...BUCKETS.slice(1).map((bucket) => ({ value: bucket.key, label: bucket.label })),
] as const;

const AGING_SORT_OPTIONS = [
  { value: "total:desc", label: "ยอดค้างมากสุด" },
  { value: "overdue:desc", label: "ยอดเลยกำหนดมากสุด" },
  { value: "name:asc", label: "ชื่อลูกค้า ก-ฮ" },
] as const;

const PAGE_SIZE = 20;

function positivePage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default function AgingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <AgingPageContent />
    </Suspense>
  );
}

function AgingPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const rawStatus = searchParams.get("status") ?? "";
  const status = AGING_STATUS_OPTIONS.some((option) => option.value === rawStatus)
    ? rawStatus
    : "";
  const rawSort = searchParams.get("sort") ?? "total:desc";
  const sort = AGING_SORT_OPTIONS.some((option) => option.value === rawSort)
    ? rawSort
    : "total:desc";
  const page = positivePage(searchParams.get("page"));
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const replaceListState = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(updates)) {
        if (
          !value ||
          (key === "page" && value === "1") ||
          (key === "sort" && value === "total:desc")
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
  const canView = me ? permAllows(me.permissions, "manage_billing_docs") : true;
  const { data, isLoading, isFetching, isError, refetch } = trpc.billingNote.aging.useQuery(undefined, {
    enabled: canView,
  });

  // ร่างข้อความทวงต่อลูกค้า — ก๊อปส่งเอง (ไม่ยิงอัตโนมัติ) · โหลด draft เมื่อเลือกลูกค้า
  const [draftFor, setDraftFor] = useState<{ id: string; label: string } | null>(null);
  const [tone, setTone] = useState<DunningTone>("gentle");
  const draft = trpc.billingNote.dunningDraft.useQuery(
    { customerId: draftFor?.id ?? "", tone },
    { enabled: !!draftFor }
  );

  async function copyDraft(text: string) {
    // clipboard undefined บน insecure context (http LAN) — fallback textarea+execCommand
    const fallback = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    };
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = fallback();
    }
    toast.success(copied ? "คัดลอกข้อความแล้ว — วางส่งลูกค้าได้เลย" : "คัดลอกไม่สำเร็จ");
  }

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const needle = search.trim().toLocaleLowerCase("th");
    const rows = data.rows.filter((row) => {
      const label = `${row.name} ${row.company ?? ""}`.toLocaleLowerCase("th");
      if (needle && !label.includes(needle)) return false;
      if (!status) return true;
      if (status === "overdue") {
        return (
          row.buckets.d1_30 +
          row.buckets.d31_60 +
          row.buckets.d61_90 +
          row.buckets.d90plus
        ) > 0;
      }
      return row.buckets[status as (typeof BUCKETS)[number]["key"]] > 0;
    });

    return [...rows].sort((a, b) => {
      if (sort === "name:asc") {
        return (a.company || a.name).localeCompare(b.company || b.name, "th");
      }
      if (sort === "overdue:desc") {
        const overdueOf = (row: typeof a) =>
          row.buckets.d1_30 +
          row.buckets.d31_60 +
          row.buckets.d61_90 +
          row.buckets.d90plus;
        return overdueOf(b) - overdueOf(a);
      }
      return b.total - a.total;
    });
  }, [data, search, sort, status]);

  const filteredTotals = useMemo(() => {
    const totals = {
      current: 0,
      d1_30: 0,
      d31_60: 0,
      d61_90: 0,
      d90plus: 0,
      grandTotal: 0,
    };
    for (const row of filteredRows) {
      for (const bucket of BUCKETS) totals[bucket.key] += row.buckets[bucket.key];
      totals.grandTotal += row.total;
    }
    return totals;
  }, [filteredRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const visibleRows = data
    ? filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : undefined;

  useEffect(() => {
    if (data && page > totalPages) {
      replaceListState({ page: String(totalPages) });
    }
  }, [data, page, replaceListState, totalPages]);

  if (me && !canView) {
    return (
      <div className="space-y-5">
        <PageHeader title="ลูกหนี้ค้างชำระ" description="ยอดค้างแยกตามอายุหนี้" />
        <p className="text-sm text-slate-400">ต้องมีสิทธิ์ &quot;ออกใบแจ้งหนี้/ใบวางบิล/รายงานภาษี&quot; — เช็คสิทธิ์ที่ ตั้งค่า → ผู้ใช้</p>
      </div>
    );
  }

  const overdueTotal = data
    ? data.totals.d1_30 + data.totals.d31_60 + data.totals.d61_90 + data.totals.d90plus
    : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="ลูกหนี้ค้างชำระ (Aging)"
        description="ยอดค้างต่อลูกค้า แยกตามอายุหนี้นับจากวันครบกำหนด"
        breadcrumb={[{ label: "บิล/การเงิน", href: "/billing" }, { label: "ลูกหนี้" }]}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="ลูกหนี้รวม"
          value={formatCurrency(data?.grandTotal ?? 0)}
          icon={DollarSign}
        />
        <StatCard
          title="เลยกำหนดแล้ว"
          value={formatCurrency(overdueTotal)}
          icon={AlertCircle}
        />
        <StatCard
          title="ยังไม่ครบกำหนด"
          value={formatCurrency(data?.totals.current ?? 0)}
          icon={Hourglass}
        />
        <StatCard title="ลูกหนี้" value={data?.rows.length ?? 0} icon={Users} caption="ราย" />
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <SearchInput
          ref={searchInputRef}
          containerClassName="flex-1"
          placeholder="ค้นหาชื่อลูกค้าหรือบริษัท..."
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
        <NativeSelect
          aria-label="กรองช่วงอายุหนี้"
          value={status}
          onChange={(event) =>
            replaceListState({ status: event.target.value || null, page: null })
          }
          className="sm:w-48"
        >
          {AGING_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="เรียงรายการลูกหนี้"
          value={sort}
          onChange={(event) =>
            replaceListState({ sort: event.target.value, page: null })
          }
          className="sm:w-48"
        >
          {AGING_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <ResponsiveList
        items={visibleRows}
        isLoading={isLoading || isFetching}
        isError={isError}
        errorMessage="โหลดรายงานลูกหนี้ไม่สำเร็จ"
        onRetry={() => refetch()}
        label="ลูกหนี้"
        renderDesktop={(rows) => (
          <DataTable.Root>
            <DataTable.Head>
              <tr>
                <DataTable.Th>ลูกค้า</DataTable.Th>
                {BUCKETS.map((bucket) => (
                  <DataTable.Th key={bucket.key} align="right">
                    {bucket.label}
                  </DataTable.Th>
                ))}
                <DataTable.Th align="right">รวม</DataTable.Th>
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {rows.map((row) => (
                <DataTable.Row key={row.customerId}>
                  <DataTable.Td>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/customers/${row.customerId}`}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {row.company ? `${row.company} (${row.name})` : row.name}
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-slate-500 hover:text-blue-700 dark:hover:text-blue-300"
                        aria-label={`ร่างข้อความทวง ${row.company || row.name}`}
                        onClick={() => {
                          setTone("gentle");
                          setDraftFor({
                            id: row.customerId,
                            label: row.company ? `${row.company} (${row.name})` : row.name,
                          });
                        }}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </DataTable.Td>
                  {BUCKETS.map((bucket) => (
                    <DataTable.Td
                      key={bucket.key}
                      align="right"
                      className={`tabular-nums ${
                        row.buckets[bucket.key] === 0
                          ? "text-slate-400 dark:text-slate-600"
                          : bucket.key === "current"
                            ? ""
                            : "font-medium text-red-700 dark:text-red-300"
                      }`}
                    >
                      {row.buckets[bucket.key] === 0
                        ? "—"
                        : formatCurrency(row.buckets[bucket.key])}
                    </DataTable.Td>
                  ))}
                  <DataTable.Td
                    align="right"
                    className="font-semibold tabular-nums text-slate-900 dark:text-white"
                  >
                    {formatCurrency(row.total)}
                  </DataTable.Td>
                </DataTable.Row>
              ))}
              <DataTable.Row>
                <DataTable.Td className="font-semibold">รวมผลลัพธ์</DataTable.Td>
                {BUCKETS.map((bucket) => (
                  <DataTable.Td key={bucket.key} align="right" className="font-semibold tabular-nums">
                    {filteredTotals[bucket.key] === 0
                      ? "—"
                      : formatCurrency(filteredTotals[bucket.key])}
                  </DataTable.Td>
                ))}
                <DataTable.Td align="right" className="font-semibold tabular-nums">
                  {formatCurrency(filteredTotals.grandTotal)}
                </DataTable.Td>
              </DataTable.Row>
            </DataTable.Body>
          </DataTable.Root>
        )}
        renderMobile={(rows) => (
          <div role="list" aria-label="รายการลูกหนี้" className="space-y-3">
            {rows.map((row) => (
              <article key={row.customerId} role="listitem" className="card-surface rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/customers/${row.customerId}`}
                      className="font-semibold text-blue-700 hover:underline dark:text-blue-300"
                    >
                      {row.company || row.name}
                    </Link>
                    {row.company && (
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        ผู้ติดต่อ {row.name}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-right">
                    <span className="block text-xs text-slate-500 dark:text-slate-400">ค้างรวม</span>
                    <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                      {formatCurrency(row.total)}
                    </span>
                  </p>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                  {BUCKETS.filter((bucket) => row.buckets[bucket.key] > 0).map((bucket) => (
                    <div key={bucket.key} className="flex items-center justify-between gap-2">
                      <dt className="text-slate-500 dark:text-slate-400">{bucket.label}</dt>
                      <dd
                        className={`font-medium tabular-nums ${
                          bucket.key === "current"
                            ? "text-slate-900 dark:text-white"
                            : "text-red-700 dark:text-red-300"
                        }`}
                      >
                        {formatCurrency(row.buckets[bucket.key])}
                      </dd>
                    </div>
                  ))}
                </dl>

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => {
                    setTone("gentle");
                    setDraftFor({
                      id: row.customerId,
                      label: row.company ? `${row.company} (${row.name})` : row.name,
                    });
                  }}
                >
                  <MessageSquare className="h-4 w-4" />
                  ร่างข้อความทวง
                </Button>
              </article>
            ))}
          </div>
        )}
        emptyState={
          <EmptyState
            icon={Users}
            title="ไม่พบลูกหนี้"
            description={
              search || status
                ? "ลองเปลี่ยนคำค้นหาหรือช่วงอายุหนี้"
                : "ใบแจ้งหนี้ทุกใบชำระครบแล้ว หรือยังไม่มีการวางบิล"
            }
          />
        }
        pagination={
          filteredRows.length > 0 ? (
            <TablePagination
              page={page}
              totalPages={totalPages}
              total={filteredRows.length}
              onPageChange={(nextPage) =>
                replaceListState({ page: String(nextPage) })
              }
              label="ราย"
            />
          ) : undefined
        }
      />

      {/* ร่างข้อความทวงหนี้ — ก๊อปส่งเอง (ไม่ยิงอัตโนมัติ · เบสเลือก surface ให้คนตัดสิน) */}
      <Dialog open={draftFor !== null} onOpenChange={(open) => !open && setDraftFor(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>ร่างข้อความทวง</DialogTitle>
            <DialogDescription>
              {draftFor?.label} — ตรวจข้อความก่อน คัดลอกไปส่งลูกค้าเอง (ระบบไม่ส่งอัตโนมัติ)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-1.5">
              {(["gentle", "firm"] as const).map((t) => (
                <Button
                  key={t}
                  variant={tone === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTone(t)}
                >
                  {t === "gentle" ? "สุภาพ" : "หนักแน่น"}
                </Button>
              ))}
            </div>
            {draft.isLoading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังร่าง...
              </div>
            ) : draft.isError ? (
              <p className="py-8 text-center text-sm text-red-500">ร่างข้อความไม่สำเร็จ</p>
            ) : draft.data?.text ? (
              <>
                <Textarea
                  value={draft.data.text}
                  readOnly
                  rows={12}
                  className="font-mono text-xs"
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">
                    {draft.data.invoiceCount} ใบ · ค้างรวม {formatCurrency(draft.data.totalOutstanding)}
                  </p>
                  <Button size="sm" className="gap-1.5" onClick={() => copyDraft(draft.data!.text!)}>
                    <Copy className="h-3.5 w-3.5" />
                    คัดลอกข้อความ
                  </Button>
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">
                ลูกค้ารายนี้ไม่มียอดค้าง — ไม่มีอะไรต้องทวง
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
