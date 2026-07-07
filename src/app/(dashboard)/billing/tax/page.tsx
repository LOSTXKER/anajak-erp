"use client";

import { useState } from "react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { formatCurrency } from "@/lib/utils";
import {
  salesTaxReportCsv,
  peakImportCsv,
  formatThaiDateBE,
  SALES_TAX_DOC_LABELS,
  type SalesTaxRow,
} from "@/lib/sales-tax-report";
import { Download, FileSpreadsheet, ReceiptText, Ban, Coins } from "lucide-react";
import { permAllows } from "@/lib/permissions";

// รายงานภาษีขายรายเดือน (Gate B5) — ใบกำกับภาษีของงวด (ใบเสร็จ/ใบกำกับ + ใบลดหนี้/เพิ่มหนี้)
// งวดตาม issueDate (tax point B3) · export 2 แบบ: CSV รายงานภาษีขาย (ยื่น ภ.พ.30) + CSV
// คอลัมน์ตาม field PEAK (นักบัญชีวางลง template จริง — ล็อกคอลัมน์เป๊ะตอนรีวิว B6)


const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

type ReportData = RouterOutput["billing"]["salesTaxReport"];

// ย้อนหลัง 24 เดือนพอสำหรับตามงวดเก่า (ระบบเพิ่งเริ่มใช้)
// เดือนตั้งต้น = เดือนปัจจุบัน "เวลาไทย" — งวดภาษีเป็นงวดไทยเสมอ ห้ามเพี้ยนตาม
// timezone เครื่องผู้ใช้ (คาบเดือนจะ default ผิดงวด · review B5 จับ)
function monthOptions(): { year: number; month: number; label: string }[] {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  let year = Number(parts.find((p) => p.type === "year")!.value);
  let month = Number(parts.find((p) => p.type === "month")!.value);
  const opts: { year: number; month: number; label: string }[] = [];
  for (let i = 0; i < 24; i++) {
    opts.push({ year, month, label: `${THAI_MONTHS[month - 1]} ${year + 543}` });
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return opts;
}

function downloadCsv(content: string, filename: string) {
  // BOM นำหน้าให้ Excel ไทยอ่าน UTF-8 ถูก — pattern เดียวกับ exportWhtCsv
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SalesTaxReportPage() {
  const options = monthOptions();
  const [selected, setSelected] = useState(`${options[0].year}-${options[0].month}`);
  const [yearStr, monthStr] = selected.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const periodLabel = `${THAI_MONTHS[month - 1]} ${year + 543}`;

  const { data: me } = trpc.user.me.useQuery();
  const canView = me ? permAllows(me.permissions, "manage_billing_docs") : true;

  const { data, isLoading, isError, refetch } = trpc.billing.salesTaxReport.useQuery(
    { year, month },
    { enabled: canView }
  );

  if (me && !canView) {
    return (
      <div className="space-y-5">
        <PageHeader title="ภาษีขาย" description="รายงานภาษีขายรายเดือน" />
        <p className="text-sm text-slate-400">ต้องมีสิทธิ์ &quot;ออกใบแจ้งหนี้/ใบวางบิล/รายงานภาษี&quot; — เช็คสิทธิ์ที่ ตั้งค่า → ผู้ใช้</p>
      </div>
    );
  }

  if (isError) return <QueryError onRetry={() => refetch()} />;

  const rows: SalesTaxRow[] = (data?.rows ?? []).map((r) => ({
    ...r,
    date: new Date(r.date),
  }));
  const summary: ReportData["summary"] | undefined = data?.summary;
  const fileStamp = `${year}-${String(month).padStart(2, "0")}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="ภาษีขาย"
        description="ใบกำกับภาษีของงวด (ใบเสร็จ/ใบกำกับ · ใบลดหนี้ · ใบเพิ่มหนี้) — งวดตามวันที่เอกสาร"
        breadcrumb={[{ label: "บิล/การเงิน", href: "/billing" }, { label: "ภาษีขาย" }]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="h-10 w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={rows.length === 0}
              onClick={() =>
                downloadCsv(salesTaxReportCsv(rows, periodLabel), `sales-tax-${fileStamp}.csv`)
              }
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              CSV รายงานภาษีขาย
            </Button>
            <Button
              variant="outline"
              disabled={rows.filter((r) => !r.isVoided).length === 0}
              onClick={() => downloadCsv(peakImportCsv(rows), `peak-import-${fileStamp}.csv`)}
              className="gap-1.5"
            >
              <FileSpreadsheet className="h-4 w-4" />
              CSV สำหรับ PEAK
            </Button>
          </div>
        }
      />

      {/* ── สรุปงวด ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="เอกสารในงวด" value={summary?.docCount ?? 0} icon={ReceiptText} />
        <StatCard
          title="ฐานภาษี (หลังหักลดหนี้)"
          value={formatCurrency(summary?.totalBase ?? 0)}
          icon={Coins}
        />
        <StatCard title="VAT งวดนี้" value={formatCurrency(summary?.totalVat ?? 0)} icon={Coins} />
        <StatCard title="ใบยกเลิก" value={summary?.voidedCount ?? 0} icon={Ban} />
      </div>

      <Alert variant="info">
        ไฟล์ PEAK เป็นคอลัมน์ตามข้อมูลที่ template นำเข้าของ PEAK ใช้ — รอบแรกให้นักบัญชีเทียบกับ
        template จริงที่ดาวน์โหลดจากระบบ PEAK ก่อน (ใบลดหนี้ในไฟล์เป็นยอดบวก — นำเข้าเป็นเอกสารลดหนี้ฝั่ง PEAK) ·
        ใบยกเลิกโชว์ในรายงานภาษีขาย (เลขที่ไม่โดด) แต่ไม่ออกในไฟล์ PEAK ·
        ใบลดหนี้/เพิ่มหนี้ที่อ้าง &quot;ใบแจ้งหนี้&quot; ไม่เข้ารายงานนี้ (เป็นการปรับยอดค้าง — VAT สะท้อนในใบเสร็จตอนรับเงินแล้ว)
      </Alert>

      {/* ใบแก้ tax มือที่ไม่ตรง 7% — PEAK คำนวณจากอัตราเองไม่ได้ ต้องคีย์ยอดจากคอลัมน์มูลค่าภาษี */}
      {rows.some((r) => r.vatNonStandard && !r.isVoided) && (
        <Alert variant="warning">
          งวดนี้มีใบที่ยอดภาษีไม่ตรงฐาน×7% จำนวน{" "}
          {rows.filter((r) => r.vatNonStandard && !r.isVoided).length} ใบ (อัตราโชว์เป็น
          &quot;อื่นๆ&quot;) — นำเข้า PEAK ให้ใช้ยอดจากคอลัมน์ &quot;มูลค่าภาษี (บาท)&quot; คีย์มือ
        </Alert>
      )}

      {/* ── ตารางรายการ ── */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={`งวด ${periodLabel} ยังไม่มีใบกำกับภาษี`}
          description="ใบเสร็จ/ใบกำกับเกิดตอนบันทึกรับเงินแล้วกดออกใบที่งวดนั้น (tax point จ้างทำของ)"
        />
      ) : (
        <div className="card-surface overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500 dark:border-slate-800">
                <th className="px-3 py-2.5 font-medium">#</th>
                <th className="px-3 py-2.5 font-medium">วันที่</th>
                <th className="px-3 py-2.5 font-medium">เลขที่</th>
                <th className="px-3 py-2.5 font-medium">ประเภท</th>
                <th className="px-3 py-2.5 font-medium">ผู้ซื้อ</th>
                <th className="px-3 py-2.5 font-medium">เลขภาษี/สาขา</th>
                <th className="px-3 py-2.5 text-right font-medium">ฐานภาษี</th>
                <th className="px-3 py-2.5 text-right font-medium">VAT</th>
                <th className="px-3 py-2.5 text-right font-medium">รวม</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.invoiceNumber}
                  className={`border-b border-slate-50 last:border-0 dark:border-slate-800/60 ${
                    r.isVoided ? "text-slate-400 line-through" : ""
                  }`}
                >
                  <td className="px-3 py-2.5 tabular-nums text-slate-400">{r.seq}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                    {formatThaiDateBE(r.date)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap font-medium">
                    {r.invoiceNumber}
                    {r.isVoided && (
                      <Badge variant="destructive" size="sm" className="ml-1.5 no-underline">
                        ยกเลิก
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {SALES_TAX_DOC_LABELS[r.docType]}
                  </td>
                  <td className="max-w-[220px] px-3 py-2.5">
                    <p className="truncate">{r.customerName}</p>
                    {r.note && <p className="truncate text-xs text-slate-400">{r.note}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">
                    {r.taxId || "—"}
                    {r.branch && <p>{r.branch}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.base.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.vat.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                    {r.total.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            {summary && (
              <tfoot>
                <tr className="border-t border-slate-200 font-semibold dark:border-slate-700">
                  <td colSpan={6} className="px-3 py-2.5 text-right">
                    รวมงวด {periodLabel} ({summary.docCount} ฉบับ
                    {summary.voidedCount > 0 ? ` · ยกเลิก ${summary.voidedCount}` : ""})
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {summary.totalBase.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {summary.totalVat.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {summary.totalAmount.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
