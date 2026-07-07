"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { SegmentedControl } from "@/components/ui/segmented";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/ui/file-upload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { permAllows } from "@/lib/permissions";
import {
  ReceiptText,
  Download,
  Paperclip,
  FileCheck2,
  CheckCircle2,
  Hourglass,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";

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
  const [tab, setTab] = useState<FilterTab>("pending");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Dialog "บันทึกรับหนังสือรับรอง"
  const [markTarget, setMarkTarget] = useState<WhtRow | null>(null);
  const [certNumber, setCertNumber] = useState("");
  const [certDate, setCertDate] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [notes, setNotes] = useState("");

  // debounce 300ms — pattern เดียวกับหน้าคลังฟิล์ม
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: me } = trpc.user.me.useQuery();
  const canView = me ? permAllows(me.permissions, "manage_billing_docs") : true;

  const utils = trpc.useUtils();
  const { data: rows, isLoading, isError, refetch } = trpc.wht.list.useQuery(
    {
      received: tab === "all" ? undefined : tab === "received",
      search: debouncedSearch.trim() || undefined,
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

  if (me && !canView) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="ทะเบียนหัก ณ ที่จ่าย (50ทวิ)"
          description="ตามหนังสือรับรองหัก ณ ที่จ่ายจากลูกค้า"
        />
        <p className="text-sm text-slate-400">ต้องมีสิทธิ์ &quot;ออกใบแจ้งหนี้/ใบวางบิล/รายงานภาษี&quot; — เช็คสิทธิ์ที่ ตั้งค่า → ผู้ใช้</p>
      </div>
    );
  }

  if (isError) return <QueryError onRetry={() => refetch()} />;

  const list = rows ?? [];
  const hasSearch = debouncedSearch.trim().length > 0;
  const pendingAmount = stats.data?.pendingAmount ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="ทะเบียนหัก ณ ที่จ่าย (50ทวิ)"
        description="ลูกค้าหัก 3% แล้วต้องส่งหนังสือรับรองมาให้ — ไม่มีใบ เครดิตภาษีหายฟรี"
        breadcrumb={[{ label: "บิล/การเงิน", href: "/billing" }, { label: "หัก ณ ที่จ่าย" }]}
        action={
          <Button
            variant="outline"
            onClick={() => exportWhtCsv(list)}
            disabled={list.length === 0}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

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
          {/* ยอดรอใบ — เด่น amber เมื่อ >0 (StatCard ไม่รับสี value เลยทำการ์ดเอง โครงเดียวกัน) */}
          <div className="card-surface rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
                ยอดหักที่ยังไม่มีใบ
              </p>
              <AlertTriangle
                className={cn(
                  "h-4 w-4",
                  pendingAmount > 0
                    ? "text-amber-500"
                    : "text-slate-400 dark:text-slate-500"
                )}
                strokeWidth={1.75}
              />
            </div>
            <p
              className={cn(
                "mt-2.5 text-[28px] font-semibold leading-none tracking-tight tabular-nums",
                pendingAmount > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-slate-900 dark:text-white"
              )}
            >
              {formatCurrency(pendingAmount)}
            </p>
            <p className="mt-2 text-[12px] text-slate-400 dark:text-slate-500">
              ไม่ได้ใบ = เครดิตภาษีส่วนนี้หายฟรี
            </p>
          </div>
          <StatCard
            title="ได้ใบแล้วรวม"
            value={formatCurrency(stats.data?.receivedAmount ?? 0)}
            icon={CheckCircle2}
            caption="บาท"
          />
        </div>
      )}

      {/* ── filter แท็บ + ค้นหา ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={FILTER_TABS.map((t) => ({ value: t.key, label: t.label }))}
          className="w-fit shrink-0"
        />
        <SearchInput
          placeholder="ค้นหาลูกค้า / เลขบิล / เลขใบรับรอง..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          containerClassName="flex-1"
          className="h-11"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="card-surface rounded-2xl">
          {hasSearch ? (
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
          )}
        </div>
      ) : (
        <>
          {/* ── จอใหญ่ = ตาราง ── */}
          <DataTable.Root className="hidden md:block">
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
              {list.map((row) => (
                <DataTable.Row key={row.id}>
                  <DataTable.Td className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {formatDate(row.payment.createdAt)}
                  </DataTable.Td>
                  <DataTable.Td>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {row.customer.name}
                    </p>
                    {row.customer.taxId && (
                      <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {row.customer.taxId}
                      </p>
                    )}
                  </DataTable.Td>
                  <DataTable.Td>
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/orders/${row.invoice.orderId}`}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {row.invoice.invoiceNumber}
                      </Link>
                      {/* บิลถูกยกเลิกหลังหักแล้ว — แถวคงไว้เป็นหลักฐาน แต่ต้องดูออก */}
                      {row.invoice.isVoided && (
                        <Badge variant="destructive" size="sm">
                          บิลยกเลิก
                        </Badge>
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
                    className="font-semibold tabular-nums text-slate-900 dark:text-white"
                  >
                    {formatCurrency(row.amount)}
                  </DataTable.Td>
                  <DataTable.Td>
                    {row.received ? (
                      <>
                        <Badge variant="success">ได้ใบแล้ว</Badge>
                        {row.certNumber && (
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {row.certNumber}
                          </p>
                        )}
                      </>
                    ) : (
                      <Badge variant="warning">รอใบ</Badge>
                    )}
                  </DataTable.Td>
                  <DataTable.Td align="right">
                    <div className="flex items-center justify-end gap-1.5">
                      {row.fileUrl && (
                        <a
                          href={row.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded p-1.5 text-slate-400 transition-colors hover:text-blue-600 dark:hover:text-blue-400"
                          title="ดูไฟล์หนังสือรับรอง"
                        >
                          <Paperclip className="h-4 w-4" />
                        </a>
                      )}
                      {!row.received && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openMarkDialog(row)}
                          className="gap-1.5"
                        >
                          <FileCheck2 className="h-4 w-4" />
                          ได้ใบแล้ว
                        </Button>
                      )}
                    </div>
                  </DataTable.Td>
                </DataTable.Row>
              ))}
            </DataTable.Body>
          </DataTable.Root>

          {/* ── มือถือ = การ์ด ── */}
          <div className="space-y-3 md:hidden">
            {list.map((row) => (
              <div
                key={row.id}
                className="card-surface rounded-2xl p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {row.customer.name}
                    </p>
                    {row.customer.taxId && (
                      <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {row.customer.taxId}
                      </p>
                    )}
                  </div>
                  {row.received ? (
                    <Badge variant="success" size="sm">
                      ได้ใบแล้ว
                    </Badge>
                  ) : (
                    <Badge variant="warning" size="sm">
                      รอใบ
                    </Badge>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Link
                      href={`/orders/${row.invoice.orderId}`}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {row.invoice.invoiceNumber}
                    </Link>
                    {row.invoice.isVoided && (
                      <Badge variant="destructive" size="sm">
                        บิลยกเลิก
                      </Badge>
                    )}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    รับเงิน {formatDate(row.payment.createdAt)}
                  </span>
                </div>

                <p className="mt-1.5 text-sm tabular-nums text-slate-600 dark:text-slate-300">
                  ฐาน {formatCurrency(row.baseAmount)} × {row.ratePct}% = หัก{" "}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(row.amount)}
                  </span>
                </p>
                {row.received && row.certNumber && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
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
                        <FileCheck2 className="h-4 w-4" />
                        ได้ใบแล้ว
                      </Button>
                    )}
                    {row.fileUrl && (
                      <Button asChild size="sm" variant="ghost" className="h-10 gap-1.5">
                        <a href={row.fileUrl} target="_blank" rel="noreferrer">
                          <Paperclip className="h-4 w-4" />
                          ดูไฟล์
                        </a>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

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
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  เลขที่ใบ (ถ้ามี)
                </label>
                <Input
                  value={certNumber}
                  onChange={(e) => setCertNumber(e.target.value)}
                  placeholder="เลขที่ในหนังสือรับรอง"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  วันที่ในใบ
                </label>
                <Input
                  type="date"
                  value={certDate}
                  onChange={(e) => setCertDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                แนบสแกนหนังสือรับรอง (ถ้ามี)
              </p>
              {fileUrl && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 items-center gap-1.5 text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <Paperclip className="h-4 w-4 shrink-0" />
                    <span className="truncate">เปิดไฟล์ที่แนบ</span>
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setFileUrl("")}
                    className="shrink-0 text-slate-400 hover:text-red-600"
                    title="เอาไฟล์ออก"
                  >
                    <X className="h-3.5 w-3.5" />
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

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                หมายเหตุ
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="เช่น ลูกค้าส่งตัวจริงมาทางไปรษณีย์"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMarkTarget(null)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleMarkReceived}
              disabled={markReceived.isPending}
              className="gap-1.5"
            >
              {markReceived.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileCheck2 className="h-4 w-4" />
              )}
              บันทึกได้ใบแล้ว
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
