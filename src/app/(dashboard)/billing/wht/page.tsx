"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useListPageState } from "@/hooks/use-list-page-state";
import { Button } from "@/components/ui/button";
import { StatusLabel } from "@/components/ui/status-label";
import { SearchInput } from "@/components/ui/search-input";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { ListPageSkeleton } from "@/components/ui/page-skeleton";
import { QueryError } from "@/components/ui/query-error";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { StatCard } from "@/components/ui/stat-card";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { FileUpload } from "@/components/ui/file-upload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageShell } from "@/components/page-shell";
import { permAllows } from "@/lib/permissions";
import {
  ReceiptText,
  Download,
  Paperclip,
  FileCheck2,
  CheckCircle2,
  Hourglass,
  AlertTriangle,
  X,
} from "lucide-react";
import { FilterChip } from "@/components/ui/filter-chip";

// ทะเบียนหัก ณ ที่จ่ายขารับ (50ทวิ) — แถวเกิดอัตโนมัติตอนบัญชีบันทึกรับเงินที่มี WHT
// งานหน้านี้: ตามหนังสือรับรองจากลูกค้า (ไม่มีใบ = เครดิตภาษี 3% หายฟรี) + export CSV ให้นักบัญชี


type WhtRow = RouterOutput["wht"]["list"][number];

type FilterTab = "pending" | "received" | "all";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "pending", label: "รอใบ" },
  { key: "received", label: "ได้ใบแล้ว" },
  { key: "all", label: "ทั้งหมด" },
];

// ────────────────────────────────────────────────────────────
// CSV Export helper — pattern เดียวกับ exportOrdersCsv ใน orders/page.tsx
// (BOM U+FEFF นำหน้าให้ Excel ไทยอ่าน UTF-8 ถูก)
// ────────────────────────────────────────────────────────────

function exportWhtCsv(rows: WhtRow[]) {
  const header = [
    "วันที่จ่าย",
    "ลูกค้า",
    "เลขผู้เสียภาษี",
    "เลขที่บิล",
    "สถานะบิล",
    "ฐานก่อน VAT",
    "อัตรา%",
    "ยอดหัก",
    "เลขที่หนังสือรับรอง",
    "วันที่ในใบ",
    "สถานะ",
  ];

  const body = rows.map((r) => [
    new Date(r.payment.createdAt).toLocaleDateString("th-TH"),
    r.customer.name,
    r.customer.taxId ?? "",
    r.invoice.invoiceNumber,
    // บิลยกเลิกแถวยังอยู่ (ใบ 50ทวิ ที่รับแล้วคงเป็นหลักฐาน) — นักบัญชีต้องดูออกใน CSV
    r.invoice.isVoided ? "ยกเลิกแล้ว" : "ปกติ",
    r.baseAmount.toFixed(2),
    String(r.ratePct),
    r.amount.toFixed(2),
    r.certNumber ?? "",
    r.certDate ? new Date(r.certDate).toLocaleDateString("th-TH") : "",
    r.received ? "ได้ใบแล้ว" : "รอใบ",
  ]);

  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n"))
      return `"${v.replace(/"/g, '""')}"`;
    return v;
  };

  const csv =
    "\uFEFF" +
    [header, ...body].map((r) => r.map(escape).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wht-certificates-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ────────────────────────────────────────────────────────────
// Page component
// ────────────────────────────────────────────────────────────

export default function WhtRegisterPage() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <WhtRegisterPageContent />
    </Suspense>
  );
}

function WhtRegisterPageContent() {
  const { search, searchParams, replaceListState, onSearchChange, searchInputRef } =
    useListPageState();
  // แท็บสถานะอยู่ใน URL (?status=received|all) — ไม่มี param/ค่าเพี้ยน = "pending" (default)
  const rawTab = searchParams.get("status");
  const tab: FilterTab = rawTab === "received" || rawTab === "all" ? rawTab : "pending";

  // Dialog "บันทึกรับหนังสือรับรอง"
  const [markTarget, setMarkTarget] = useState<WhtRow | null>(null);
  const [certNumber, setCertNumber] = useState("");
  const [certDate, setCertDate] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [notes, setNotes] = useState("");

  const { data: me } = trpc.user.me.useQuery();
  const canView = me ? permAllows(me.permissions, "manage_billing_docs") : true;

  const utils = trpc.useUtils();
  const { data: rows, isLoading, isError, refetch } = trpc.wht.list.useQuery(
    {
      received: tab === "all" ? undefined : tab === "received",
      search: search.trim() || undefined,
    },
    { enabled: canView }
  );
  const stats = trpc.wht.stats.useQuery(undefined, { enabled: canView });

  const markReceived = useMutationWithInvalidation(trpc.wht.markReceived, {
    invalidate: [utils.wht.list, utils.wht.stats],
    onSuccess: () => {
      setMarkTarget(null);
      toast.success("บันทึกรับหนังสือรับรองแล้ว");
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "บันทึกไม่สำเร็จ");
    },
  });

  function openMarkDialog(row: WhtRow) {
    // reset ทุกครั้งที่เปิด — กันค่าของใบก่อนหน้าค้างมาแล้วบันทึกผิดใบ
    setCertNumber(row.certNumber ?? "");
    setCertDate(row.certDate ? new Date(row.certDate).toISOString().slice(0, 10) : "");
    setFileUrl(row.fileUrl ?? "");
    setNotes(row.notes ?? "");
    setMarkTarget(row);
  }

  function handleMarkReceived() {
    if (!markTarget) return;
    markReceived.mutate({
      id: markTarget.id,
      certNumber: certNumber.trim() || undefined,
      certDate: certDate ? new Date(certDate) : undefined,
      fileUrl: fileUrl || undefined,
      notes: notes.trim() || undefined,
    });
  }

  const list = rows ?? [];
  const hasSearch = search.trim().length > 0;
  const pendingAmount = stats.data?.pendingAmount ?? 0;

  return (
    <PageShell
      title="ทะเบียนหัก ณ ที่จ่าย (50ทวิ)"
      meta="ต้องมีหนังสือรับรองเพื่อใช้เครดิตภาษี"
      breadcrumb={[{ label: "บิล/การเงิน", href: "/billing" }, { label: "หัก ณ ที่จ่าย" }]}
      action={
        <Button
          variant="outline"
          onClick={() => exportWhtCsv(list)}
          disabled={list.length === 0}
          className="gap-1.5"
        >
          <Download />
          Export CSV
        </Button>
      }
      error={
        isError
          ? { message: "เกิดข้อผิดพลาดในการโหลดข้อมูล", onRetry: () => refetch() }
          : null
      }
      denied={
        me && !canView
          ? {
              description:
                'ต้องมีสิทธิ์ "ออกใบแจ้งหนี้/ใบวางบิล/รายงานภาษี" — เช็คสิทธิ์ที่ ตั้งค่า → ผู้ใช้',
            }
          : undefined
      }
    >
      {/* ── สถิติ 3 ใบ ── */}
      {/* stats พังต้องบอก — เลขภาษีโชว์ 0/฿0 เงียบๆ อ่านเป็น "ไม่มียอดรอใบ" ได้ (ขัด DESIGN.md) */}
      {stats.isError ? (
        <QueryError
          message="โหลดสถิติไม่สำเร็จ"
          onRetry={() => stats.refetch()}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            title="รอใบจากลูกค้า"
            value={stats.data?.pendingCount ?? 0}
            icon={Hourglass}
            caption="รายการ"
          />
          {/* ยอดรอใบ — เด่น amber เมื่อ >0 (UX4.3: StatCard รับ tone แล้ว เลิกการ์ดทำมือ) */}
          <StatCard
            title="ยอดหักที่ยังไม่มีใบ"
            value={formatCurrency(pendingAmount)}
            icon={AlertTriangle}
            tone={pendingAmount > 0 ? "warning" : "muted"}
            caption="ไม่ได้ใบ = เครดิตภาษีส่วนนี้หายฟรี"
          />
          <StatCard
            title="ได้ใบแล้วรวม"
            value={formatCurrency(stats.data?.receivedAmount ?? 0)}
            icon={CheckCircle2}
            caption="บาท"
          />
        </div>
      )}

      {/* ── filter แท็บ + ค้นหา ── */}
      <Toolbar>
        <SearchInput
          surface="raised"
          ref={searchInputRef}
          placeholder="ค้นหาลูกค้า / เลขบิล / เลขใบรับรอง..."
          defaultValue={search}
          onChange={(e) => onSearchChange(e.target.value)}
          containerClassName="@2xl:max-w-sm @2xl:flex-1"
        />
        <ToolbarGroup>
          {FILTER_TABS.map((t) => (
            <FilterChip
              key={t.key}
              surface="raised"
              selected={tab === t.key}
              // "pending" = ค่า default → ส่ง null ให้ลบ param (URL สะอาด)
              onClick={() =>
                replaceListState({ status: t.key === "pending" ? null : t.key, page: null })
              }
            >
              {t.label}
            </FilterChip>
          ))}
        </ToolbarGroup>
      </Toolbar>

      {/* โหลด/ว่าง/สลับตาราง↔การ์ดที่ lg — ResponsiveList จัดการ (error หลักอยู่ที่ PageShell แล้ว) */}
      <ResponsiveList
        items={rows}
        isLoading={isLoading}
        emptyState={
          hasSearch ? (
            <EmptyState
              icon={ReceiptText}
              title="ไม่พบรายการที่ค้นหา"
              description="ลองคำค้นอื่น — ค้นได้ด้วยชื่อลูกค้า เลขบิล หรือเลขที่หนังสือรับรอง"
            />
          ) : tab === "pending" ? (
            <EmptyState
              icon={ReceiptText}
              title="ไม่มีรายการรอใบ"
              description="ลูกค้าส่งหนังสือรับรองครบแล้ว หรือยังไม่มีการรับเงินที่ถูกหัก ณ ที่จ่าย"
            />
          ) : (
            <EmptyState
              icon={ReceiptText}
              title="ยังไม่มีรายการ"
              description="แถวทะเบียนจะเกิดอัตโนมัติเมื่อบันทึกรับเงินที่มีหัก ณ ที่จ่าย"
            />
          )
        }
        renderDesktop={(items) => (
          <DataTable.Root bordered={false} flush>
            <DataTable.Head>
              <tr>
                <DataTable.Th>วันที่รับเงิน</DataTable.Th>
                <DataTable.Th>ลูกค้า</DataTable.Th>
                <DataTable.Th>เลขบิล</DataTable.Th>
                <DataTable.Th align="right">ฐานก่อน VAT</DataTable.Th>
                <DataTable.Th align="right">อัตรา</DataTable.Th>
                <DataTable.Th align="right">ยอดหัก</DataTable.Th>
                <DataTable.Th>สถานะ</DataTable.Th>
                <DataTable.Th align="right">
                  <span className="sr-only">จัดการ</span>
                </DataTable.Th>
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {items.map((row) => (
                <DataTable.Row key={row.id}>
                  <DataTable.Td className="text-xs tabular-nums text-muted">
                    {formatDate(row.payment.createdAt)}
                  </DataTable.Td>
                  <DataTable.Td>
                    <p className="font-medium text-strong">
                      {row.customer.name}
                    </p>
                    {row.customer.taxId && (
                      <p className="text-xs tabular-nums text-muted">
                        {row.customer.taxId}
                      </p>
                    )}
                  </DataTable.Td>
                  <DataTable.Td>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/orders/${row.invoice.orderId}`}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {row.invoice.invoiceNumber}
                      </Link>
                      {/* บิลถูกยกเลิกหลังหักแล้ว — แถวคงไว้เป็นหลักฐาน แต่ต้องดูออก */}
                      {row.invoice.isVoided && (
                        <StatusLabel label="บิลยกเลิก" tone="danger" emphasize />
                      )}
                    </div>
                  </DataTable.Td>
                  <DataTable.Td align="right" className="tabular-nums">
                    {formatCurrency(row.baseAmount)}
                  </DataTable.Td>
                  <DataTable.Td align="right" className="tabular-nums">
                    {row.ratePct}%
                  </DataTable.Td>
                  <DataTable.Td
                    align="right"
                    className="font-semibold tabular-nums text-strong"
                  >
                    {formatCurrency(row.amount)}
                  </DataTable.Td>
                  <DataTable.Td>
                    {row.received ? (
                      /* ได้ใบแล้ว = ปลายทางของแถวนี้ → ย้อมข้อความให้สแกนเจอ · เลขใบเป็นบรรทัดรอง */
                      <StatusLabel
                        label="ได้ใบแล้ว"
                        tone="success"
                        emphasize
                        sub={row.certNumber}
                      />
                    ) : (
                      <StatusLabel label="รอใบ" tone="warning" />
                    )}
                  </DataTable.Td>
                  <DataTable.Td align="right">
                    <div className="flex items-center justify-end gap-1.5">
                      {row.fileUrl && (
                        <Button
                          asChild
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted hover:text-strong dark:hover:text-strong"
                        >
                          <a
                            href={row.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="ดูไฟล์หนังสือรับรอง"
                            aria-label="ดูไฟล์หนังสือรับรอง"
                          >
                            <Paperclip />
                          </a>
                        </Button>
                      )}
                      {!row.received && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openMarkDialog(row)}
                          className="gap-1.5"
                        >
                          <FileCheck2 />
                          ได้ใบแล้ว
                        </Button>
                      )}
                    </div>
                  </DataTable.Td>
                </DataTable.Row>
              ))}
            </DataTable.Body>
          </DataTable.Root>
        )}
        renderMobile={(items) => (
          <div className="space-y-3">
            {items.map((row) => (
              <div
                key={row.id}
                className="card-surface rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-strong">
                      {row.customer.name}
                    </p>
                    {row.customer.taxId && (
                      <p className="text-xs tabular-nums text-muted">
                        {row.customer.taxId}
                      </p>
                    )}
                  </div>
                  {row.received ? (
                    <StatusLabel
                      label="ได้ใบแล้ว"
                      tone="success"
                      emphasize
                      className="shrink-0"
                    />
                  ) : (
                    <StatusLabel label="รอใบ" tone="warning" className="shrink-0" />
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                  {/* div ไม่ใช่ span — ป้ายสถานะเป็น block ซ้อนใน span ไม่ได้ (HTML ไม่ถูกต้อง) */}
                  <div className="flex min-w-0 items-center gap-2">
                    <Link
                      href={`/orders/${row.invoice.orderId}`}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {row.invoice.invoiceNumber}
                    </Link>
                    {row.invoice.isVoided && (
                      <StatusLabel label="บิลยกเลิก" tone="danger" emphasize />
                    )}
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    รับเงิน {formatDate(row.payment.createdAt)}
                  </span>
                </div>

                <p className="mt-1.5 text-sm tabular-nums text-secondary">
                  ฐาน {formatCurrency(row.baseAmount)} × {row.ratePct}% = หัก{" "}
                  <span className="font-semibold text-strong">
                    {formatCurrency(row.amount)}
                  </span>
                </p>
                {row.received && row.certNumber && (
                  <p className="mt-0.5 text-xs text-muted">
                    เลขใบ {row.certNumber}
                  </p>
                )}

                {(row.fileUrl || !row.received) && (
                  <div className="mt-3 flex items-center gap-2">
                    {!row.received && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openMarkDialog(row)}
                        className="h-10 flex-1 gap-1.5"
                      >
                        <FileCheck2 />
                        ได้ใบแล้ว
                      </Button>
                    )}
                    {row.fileUrl && (
                      <Button asChild size="sm" variant="ghost" className="h-10 gap-1.5">
                        <a href={row.fileUrl} target="_blank" rel="noreferrer">
                          <Paperclip />
                          ดูไฟล์
                        </a>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      />

      {/* ── Dialog บันทึกรับหนังสือรับรอง ── */}
      <Dialog open={markTarget !== null} onOpenChange={(open) => !open && setMarkTarget(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>บันทึกรับหนังสือรับรอง</DialogTitle>
            <DialogDescription>
              {markTarget &&
                `${markTarget.customer.name} · ${markTarget.invoice.invoiceNumber} · ยอดหัก ${formatCurrency(markTarget.amount)}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="เลขที่ใบ (ถ้ามี)">
                <Input
                  value={certNumber}
                  onChange={(e) => setCertNumber(e.target.value)}
                  placeholder="เลขที่ในหนังสือรับรอง"
                />
              </Field>
              <Field label="วันที่ในใบ">
                <DatePicker
                  value={certDate}
                  onChange={(v) => setCertDate(v)}
                />
              </Field>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-secondary">
                แนบสแกนหนังสือรับรอง (ถ้ามี)
              </p>
              {fileUrl && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 min-w-0 items-center gap-1.5 text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <Paperclip className="h-4 w-4 shrink-0" />
                    <span className="truncate">เปิดไฟล์ที่แนบ</span>
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setFileUrl("")}
                    className="shrink-0 text-muted hover:text-red-600 dark:hover:text-red-400"
                    title="เอาไฟล์ออก"
                  >
                    <X />
                  </Button>
                </div>
              )}
              {markTarget && (
                <FileUpload
                  bucket="designs"
                  pathPrefix={`wht/${markTarget.id}`}
                  accept="image/*,.pdf"
                  onUploaded={(url) => setFileUrl(url)}
                  onError={(msg) => toast.error(msg)}
                />
              )}
            </div>

            <Field label="หมายเหตุ">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="เช่น ลูกค้าส่งตัวจริงมาทางไปรษณีย์"
              />
            </Field>
          </div>

          <DialogSubmitFooter
            pending={markReceived.isPending}
            submitLabel="บันทึกได้ใบแล้ว"
            submitIcon={<FileCheck2 />}
            onCancel={() => setMarkTarget(null)}
            onSubmit={handleMarkReceived}
          />
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
