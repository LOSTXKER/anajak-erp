"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useListPageState, usePageClamp } from "@/hooks/use-list-page-state";
import { StatCard } from "@/components/ui/stat-card";
import { ListPageSkeleton } from "@/components/ui/page-skeleton";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { TablePagination } from "@/components/ui/table-pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { permAllows } from "@/lib/permissions";
import { PageShell } from "@/components/page-shell";
import { Users, DollarSign, AlertCircle, Hourglass, MessageSquare, Copy } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

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

export default function AgingPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <AgingPageContent />
    </Suspense>
  );
}

function AgingPageContent() {
  const { search, page, searchParams, replaceListState, onSearchChange, searchInputRef } =
    useListPageState();
  const rawStatus = searchParams.get("status") ?? "";
  const status = AGING_STATUS_OPTIONS.some((option) => option.value === rawStatus)
    ? rawStatus
    : "";
  const rawSort = searchParams.get("sort") ?? "total:desc";
  const sort = AGING_SORT_OPTIONS.some((option) => option.value === rawSort)
    ? rawSort
    : "total:desc";

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

  usePageClamp(page, data ? totalPages : undefined, replaceListState);

  const overdueTotal = data
    ? data.totals.d1_30 + data.totals.d31_60 + data.totals.d61_90 + data.totals.d90plus
    : 0;

  return (
    <PageShell
      title="ลูกหนี้ค้างชำระ"
      help="อายุหนี้นับจากวันครบกำหนดของเอกสาร"
      breadcrumb={[{ label: "บิล/การเงิน", href: "/billing" }, { label: "ลูกหนี้" }]}
      denied={
        me && !canView
          ? {
              description:
                'ต้องมีสิทธิ์ "ออกใบแจ้งหนี้/ใบวางบิล/รายงานภาษี" — เช็คสิทธิ์ที่ ตั้งค่า → ผู้ใช้',
            }
          : null
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="ลูกหนี้รวม"
          value={formatCurrency(data?.grandTotal ?? 0)}
          icon={DollarSign}
        />
        {/* เลขเสี่ยงของหน้านี้ — แดงเมื่อมีจริง ให้ตรงกับเซลล์แดงในตารางข้างล่าง (UX4.3) */}
        <StatCard
          title="เลยกำหนดแล้ว"
          value={formatCurrency(overdueTotal)}
          icon={AlertCircle}
          tone={overdueTotal > 0 ? "danger" : "muted"}
        />
        <StatCard
          title="ยังไม่ครบกำหนด"
          value={formatCurrency(data?.totals.current ?? 0)}
          icon={Hourglass}
        />
        <StatCard title="ลูกหนี้" value={data?.rows.length ?? 0} icon={Users} caption="ราย" />
      </div>

      {/* แถบเครื่องมือของกลาง — จุดตัดวัดจากความกว้างพื้นที่เนื้อหาจริง (@container)
          ไม่ใช่ความกว้างหน้าต่าง เลยใช้ @2xl: แทน sm: ที่เขียนไว้เดิม
          ตัวกรองช่วงอายุหนี้ + การเรียง อยู่กลุ่มเดียวกัน ห้ามแตกแถวคั่นกลาง */}
      <Toolbar>
        <SearchInput
          surface="raised"
          ref={searchInputRef}
          containerClassName="@2xl:max-w-sm @2xl:flex-1"
          placeholder="ค้นหาชื่อลูกค้าหรือบริษัท..."
          defaultValue={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />

        {/* flex-wrap: จอมือถือให้ช่องเลือกซ้อนกันเต็มความกว้างเหมือนเดิม —
            ถ้าปล่อยเรียงคู่กัน ป้ายยาวอย่าง "ยอดเลยกำหนดมากสุด" จะโดนตัดจนอ่านไม่ออก */}
        <ToolbarGroup className="flex-wrap">
          <Select
            shape="pill"
            surface="raised"
            aria-label="กรองช่วงอายุหนี้"
            value={status}
            onChange={(event) =>
              replaceListState({ status: event.target.value || null, page: null })
            }
            className="@2xl:w-48"
          >
            {AGING_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select
            shape="pill"
            surface="raised"
            aria-label="เรียงรายการลูกหนี้"
            value={sort}
            onChange={(event) =>
              // sort ค่า default ไม่เก็บใน URL (ให้ URL สะอาด) — hook ลบ param เมื่อได้ null
              replaceListState({
                sort: event.target.value === "total:desc" ? null : event.target.value,
                page: null,
              })
            }
            className="@2xl:w-48"
          >
            {AGING_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </ToolbarGroup>
      </Toolbar>

      <ResponsiveList
        items={visibleRows}
        isLoading={isLoading || isFetching}
        isError={isError}
        errorMessage="โหลดรายงานลูกหนี้ไม่สำเร็จ"
        onRetry={() => refetch()}
        label="ลูกหนี้"
        renderDesktop={(rows) => (
          <DataTable.Root bordered={false} flush>
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
                        className="shrink-0 text-muted hover:text-strong dark:hover:text-strong"
                        aria-label={`ร่างข้อความทวง ${row.company || row.name}`}
                        onClick={() => {
                          setTone("gentle");
                          setDraftFor({
                            id: row.customerId,
                            label: row.company ? `${row.company} (${row.name})` : row.name,
                          });
                        }}
                      >
                        <MessageSquare />
                      </Button>
                    </div>
                  </DataTable.Td>
                  {BUCKETS.map((bucket) => (
                    <DataTable.Td
                      key={bucket.key}
                      align="right"
                      // หัวคอลัมน์บอกช่วงอายุหนี้อยู่แล้ว — ย้อมแดงทุกช่องที่ไม่ใช่
                      // "ยังไม่ครบกำหนด" ทำให้ทั้งตารางแดงจนของที่เจ็บจริงแข่งไม่ขึ้น
                      // เก็บแดงไว้ช่วงเกิน 90 วันช่องเดียว ที่เหลือไล่ด้วยน้ำหนักแทน
                      className={`tabular-nums ${
                        row.buckets[bucket.key] === 0
                          ? "text-muted"
                          : bucket.key === "current"
                            ? ""
                            : bucket.key === "d90plus"
                              ? "font-medium text-red-700 dark:text-red-300"
                              : "font-medium text-secondary"
                      }`}
                    >
                      {row.buckets[bucket.key] === 0
                        ? "—"
                        : formatCurrency(row.buckets[bucket.key])}
                    </DataTable.Td>
                  ))}
                  <DataTable.Td
                    align="right"
                    className="font-semibold tabular-nums text-strong"
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
              <article key={row.customerId} role="listitem" className="card-surface rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/customers/${row.customerId}`}
                      className="font-semibold text-blue-700 hover:underline dark:text-blue-300"
                    >
                      {row.company || row.name}
                    </Link>
                    {row.company && (
                      <p className="mt-0.5 text-xs text-muted">
                        ผู้ติดต่อ {row.name}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-right">
                    <span className="block text-xs text-muted">ค้างรวม</span>
                    <span className="font-semibold tabular-nums text-strong">
                      {formatCurrency(row.total)}
                    </span>
                  </p>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-divider pt-3 text-xs">
                  {BUCKETS.filter((bucket) => row.buckets[bucket.key] > 0).map((bucket) => (
                    <div key={bucket.key} className="flex items-center justify-between gap-2">
                      <dt className="text-muted">{bucket.label}</dt>
                      <dd
                        className={`font-medium tabular-nums ${
                          bucket.key === "current"
                            ? "text-strong"
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
                  <MessageSquare />
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
              <div className="flex items-center gap-2 py-8 text-sm text-muted">
                <Spinner size="md" />
                กำลังร่าง...
              </div>
            ) : draft.isError ? (
              <p className="py-8 text-center text-sm text-red-600 dark:text-red-400">ร่างข้อความไม่สำเร็จ</p>
            ) : draft.data?.text ? (
              <>
                <Textarea
                  value={draft.data.text}
                  readOnly
                  rows={12}
                  className="font-mono text-xs"
                />
                {/* ปุ่มคัดลอก = action หลักของ dialog นี้ — ใช้ DialogFooter ให้ปักก้นกรอบ
                    เหมือน dialog อื่น (ข้อความทวงยาวตามจำนวนใบ ดันปุ่มตกนอกสายตาได้) */}
                <DialogFooter className="flex-row items-center justify-between sm:justify-between">
                  <p className="text-xs text-muted">
                    {draft.data.invoiceCount} ใบ · ค้างรวม {formatCurrency(draft.data.totalOutstanding)}
                  </p>
                  <Button size="sm" className="gap-1.5" onClick={() => copyDraft(draft.data!.text!)}>
                    <Copy />
                    คัดลอกข้อความ
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted">
                ลูกค้ารายนี้ไม่มียอดค้าง — ไม่มีอะไรต้องทวง
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
