"use client";

import { useState } from "react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { ResponsiveList } from "@/components/ui/responsive-list";
import { PageShell } from "@/components/page-shell";
import { cn, formatCurrency } from "@/lib/utils";
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

  const rows: SalesTaxRow[] = (data?.rows ?? []).map((r) => ({
    ...r,
    date: new Date(r.date),
  }));
  const summary: ReportData["summary"] | undefined = data?.summary;
  const fileStamp = `${year}-${String(month).padStart(2, "0")}`;

  return (
    <PageShell
      title="ภาษีขาย"
      help="จัดงวดตามวันที่ที่ระบุบนเอกสาร"
      breadcrumb={[{ label: "บิล/การเงิน", href: "/billing" }, { label: "ภาษีขาย" }]}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            shape="pill"
            surface="raised"
            className="w-[180px]"
          >
              {options.map((o) => (
                <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>
                  {o.label}
                </option>
              ))}
            </Select>
          <Button
            variant="outline"
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv(salesTaxReportCsv(rows, periodLabel), `sales-tax-${fileStamp}.csv`)
            }
            className="gap-1.5"
          >
            <Download />
            CSV รายงานภาษีขาย
          </Button>
          <Button
            variant="outline"
            disabled={rows.filter((r) => !r.isVoided).length === 0}
            onClick={() => downloadCsv(peakImportCsv(rows), `peak-import-${fileStamp}.csv`)}
            className="gap-1.5"
          >
            <FileSpreadsheet />
            CSV สำหรับ PEAK
          </Button>
        </div>
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
        รอบแรกให้นักบัญชีเทียบไฟล์ PEAK กับ template จริงก่อน · ใบลดหนี้ในไฟล์เป็นยอดบวก
        (นำเข้าเป็นเอกสารลดหนี้) · ใบยกเลิกอยู่ในรายงานภาษีขาย แต่ไม่ออกในไฟล์ PEAK ·
        ใบลดหนี้/เพิ่มหนี้ที่อ้างใบแจ้งหนี้ ไม่เข้ารายงานนี้ (VAT ไปแล้วตอนออกใบเสร็จ)
      </Alert>

      {/* ใบแก้ tax มือที่ไม่ตรง 7% — PEAK คำนวณจากอัตราเองไม่ได้ ต้องคีย์ยอดจากคอลัมน์มูลค่าภาษี */}
      {rows.some((r) => r.vatNonStandard && !r.isVoided) && (
        <Alert variant="warning">
          งวดนี้มีใบที่ยอดภาษีไม่ตรงฐาน×7% จำนวน{" "}
          {rows.filter((r) => r.vatNonStandard && !r.isVoided).length} ใบ (อัตราโชว์เป็น
          &quot;อื่นๆ&quot;) — นำเข้า PEAK ให้ใช้ยอดจากคอลัมน์ &quot;มูลค่าภาษี (บาท)&quot; คีย์มือ
        </Alert>
      )}

      {/* ── รายการเอกสาร ── */}
      <ResponsiveList
        items={rows}
        isLoading={isLoading}
        label="ใบกำกับภาษี"
        emptyState={
          <EmptyState
            icon={ReceiptText}
            title={`งวด ${periodLabel} ยังไม่มีใบกำกับภาษี`}
            description="ใบเสร็จ/ใบกำกับเกิดตอนบันทึกรับเงินแล้วกดออกใบที่งวดนั้น (tax point จ้างทำของ)"
          />
        }
        renderDesktop={(items) => (
          // พื้นที่หลังหัก sidebar ที่ช่วง tablet ไม่พอสำหรับ 9 คอลัมน์ —
          // ล็อกความกว้างขั้นต่ำให้ตารางเลื่อนข้างแทนการบีบคอลัมน์
          <DataTable.Root className="[&_table]:min-w-[880px]">
            <DataTable.Head>
              <tr>
                <DataTable.Th>#</DataTable.Th>
                <DataTable.Th>วันที่</DataTable.Th>
                <DataTable.Th>เลขที่</DataTable.Th>
                <DataTable.Th>ประเภท</DataTable.Th>
                <DataTable.Th>ผู้ซื้อ</DataTable.Th>
                <DataTable.Th>เลขภาษี/สาขา</DataTable.Th>
                <DataTable.Th align="right">ฐานภาษี</DataTable.Th>
                <DataTable.Th align="right">VAT</DataTable.Th>
                <DataTable.Th align="right">รวม</DataTable.Th>
              </tr>
            </DataTable.Head>
            <DataTable.Body>
              {items.map((r) => (
                <DataTable.Row
                  key={r.invoiceNumber}
                  className={r.isVoided ? "text-slate-400 line-through" : undefined}
                >
                  <DataTable.Td className="tabular-nums text-slate-400">{r.seq}</DataTable.Td>
                  <DataTable.Td
                    className={cn(
                      "whitespace-nowrap tabular-nums",
                      r.isVoided && "text-slate-400"
                    )}
                  >
                    {formatThaiDateBE(r.date)}
                  </DataTable.Td>
                  <DataTable.Td
                    className={cn(
                      "whitespace-nowrap font-medium",
                      r.isVoided && "text-slate-400"
                    )}
                  >
                    {r.invoiceNumber}
                    {r.isVoided && (
                      <Badge variant="destructive" size="sm" className="ml-1.5 no-underline">
                        ยกเลิก
                      </Badge>
                    )}
                  </DataTable.Td>
                  <DataTable.Td
                    className={cn("whitespace-nowrap", r.isVoided && "text-slate-400")}
                  >
                    {SALES_TAX_DOC_LABELS[r.docType]}
                  </DataTable.Td>
                  <DataTable.Td
                    className={cn("max-w-[220px]", r.isVoided && "text-slate-400")}
                  >
                    <p className="truncate">{r.customerName}</p>
                    {r.note && <p className="truncate text-xs text-slate-400">{r.note}</p>}
                  </DataTable.Td>
                  <DataTable.Td className="text-xs text-muted">
                    {r.taxId || "—"}
                    {r.branch && <p>{r.branch}</p>}
                  </DataTable.Td>
                  <DataTable.Td
                    align="right"
                    className={cn("tabular-nums", r.isVoided && "text-slate-400")}
                  >
                    {r.base.toFixed(2)}
                  </DataTable.Td>
                  <DataTable.Td
                    align="right"
                    className={cn("tabular-nums", r.isVoided && "text-slate-400")}
                  >
                    {r.vat.toFixed(2)}
                  </DataTable.Td>
                  <DataTable.Td
                    align="right"
                    className={cn("font-medium tabular-nums", r.isVoided && "text-slate-400")}
                  >
                    {r.total.toFixed(2)}
                  </DataTable.Td>
                </DataTable.Row>
              ))}
            </DataTable.Body>
            {summary && (
              <tfoot>
                <tr className="border-t border-slate-200 font-semibold dark:border-slate-700">
                  <DataTable.Td colSpan={6} align="right">
                    รวมงวด {periodLabel} ({summary.docCount} ฉบับ
                    {summary.voidedCount > 0 ? ` · ยกเลิก ${summary.voidedCount}` : ""})
                  </DataTable.Td>
                  <DataTable.Td align="right" className="tabular-nums">
                    {summary.totalBase.toFixed(2)}
                  </DataTable.Td>
                  <DataTable.Td align="right" className="tabular-nums">
                    {summary.totalVat.toFixed(2)}
                  </DataTable.Td>
                  <DataTable.Td align="right" className="tabular-nums">
                    {summary.totalAmount.toFixed(2)}
                  </DataTable.Td>
                </tr>
              </tfoot>
            )}
          </DataTable.Root>
        )}
        renderMobile={(items) => (
          <div className="space-y-3">
            {items.map((r) => (
              <div key={r.invoiceNumber} className="card-surface rounded-2xl p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs tabular-nums text-slate-400">#{r.seq}</span>
                    <p
                      className={`font-medium ${
                        r.isVoided
                          ? "text-slate-400 line-through"
                          : "text-slate-900 dark:text-white"
                      }`}
                    >
                      {r.invoiceNumber}
                    </p>
                    {r.isVoided && (
                      <Badge variant="destructive" size="sm">
                        ยกเลิก
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {formatThaiDateBE(r.date)} · {SALES_TAX_DOC_LABELS[r.docType]}
                  </p>
                </div>

                <div className={`mt-3 ${r.isVoided ? "text-slate-400 line-through" : ""}`}>
                  <p className="text-sm font-medium">{r.customerName}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    เลขผู้เสียภาษี {r.taxId || "—"}
                    {r.branch && ` · ${r.branch}`}
                  </p>
                  {r.note && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{r.note}</p>
                  )}
                </div>

                <dl
                  className={`mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-right dark:border-slate-800 ${
                    r.isVoided ? "text-slate-400 line-through" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <dt className="text-xs text-slate-500 dark:text-slate-400">ฐานภาษี</dt>
                    <dd className="mt-0.5 text-sm tabular-nums">{r.base.toFixed(2)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-slate-500 dark:text-slate-400">VAT</dt>
                    <dd className="mt-0.5 text-sm tabular-nums">{r.vat.toFixed(2)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-slate-500 dark:text-slate-400">รวม</dt>
                    <dd className="mt-0.5 text-sm font-medium tabular-nums">{r.total.toFixed(2)}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        )}
      />
    </PageShell>
  );
}
