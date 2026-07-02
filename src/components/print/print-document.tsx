// ชิ้นส่วนมาตรฐานของเอกสารพิมพ์ A4 — server component ล้วน (HTML นิ่ง พิมพ์ได้ทันที)
// ผู้ใช้: /print/quotation/[id] · /print/invoice/[id] — เอกสารใหม่ทุกชนิดประกอบจากชุดนี้
import type { CompanyProfile } from "@/lib/company-profile";
import { bahtText } from "@/lib/baht-text";

export function formatDocDate(date: Date | string): string {
  // เอกสารทางการใช้ พ.ศ. เต็ม เช่น "10 มิถุนายน 2569" · pin เขตเวลาไทย — server
  // component รันบนเครื่อง UTC (Vercel) issueDate ช่วงเที่ยงคืน–7 โมงจะเหลื่อมวัน
  // แล้วกระดาษไม่ตรงรายงานภาษี (formatThaiDate ฝั่งรายงาน pin ไว้แล้ว)
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "long",
    timeZone: "Asia/Bangkok",
  }).format(new Date(date));
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function PrintPage({ children }: { children: React.ReactNode }) {
  return <div className="print-page font-sans">{children}</div>;
}

export function VoidWatermark() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="rotate-[-24deg] border-8 border-red-300 px-10 py-3 text-7xl font-bold tracking-widest text-red-300 opacity-60">
        ยกเลิก
      </span>
    </div>
  );
}

export function DocHeader({
  company,
  title,
  subtitle,
  copyLabel,
  docNumber,
  docDate,
  refLines = [],
}: {
  company: CompanyProfile;
  title: string;
  subtitle?: string;
  copyLabel?: string; // "ต้นฉบับ" / "สำเนา"
  docNumber: string;
  docDate: Date | string;
  refLines?: { label: string; value: string }[];
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-4">
      <div className="min-w-0">
        <p className="text-[17px] font-bold leading-snug">{company.name || "(ยังไม่ตั้งค่าข้อมูลกิจการ — Settings → ข้อมูลกิจการ)"}</p>
        <p className="whitespace-pre-line text-[12px] text-slate-700">{company.address}</p>
        <p className="text-[12px] text-slate-700">
          เลขประจำตัวผู้เสียภาษี {company.taxId || "-"} ({company.branch})
        </p>
        {(company.phone || company.email) && (
          <p className="text-[12px] text-slate-700">
            {[company.phone && `โทร. ${company.phone}`, company.email].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      <div className="shrink-0 text-right">
        {copyLabel && (
          <p className="mb-1 inline-block rounded border border-slate-400 px-2 py-0.5 text-[11px] text-slate-600">
            {copyLabel}
          </p>
        )}
        <p className="text-[19px] font-bold leading-tight">{title}</p>
        {subtitle && <p className="text-[12px] text-slate-600">{subtitle}</p>}
        <table className="mt-2 ml-auto text-[12.5px]">
          <tbody>
            <tr>
              <td className="pr-3 text-right text-slate-600">เลขที่</td>
              <td className="text-right font-semibold tabular-nums">{docNumber}</td>
            </tr>
            <tr>
              <td className="pr-3 text-right text-slate-600">วันที่</td>
              <td className="text-right tabular-nums">{formatDocDate(docDate)}</td>
            </tr>
            {refLines.map((line) => (
              <tr key={line.label}>
                <td className="pr-3 text-right text-slate-600">{line.label}</td>
                <td className="text-right tabular-nums">{line.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PartyBlock({
  label,
  name,
  company,
  address,
  taxId,
  branch,
  phone,
}: {
  label: string;
  name: string;
  company?: string | null;
  address?: string | null;
  taxId?: string | null;
  branch?: string | null;
  phone?: string | null;
}) {
  return (
    <div className="mt-4 rounded border border-slate-300 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="font-semibold">
        {company ? `${company} (${name})` : name}
      </p>
      {address && <p className="whitespace-pre-line text-[12px] text-slate-700">{address}</p>}
      <p className="text-[12px] text-slate-700">
        {[
          taxId && `เลขประจำตัวผู้เสียภาษี ${taxId}${branch ? ` (${branch})` : ""}`,
          phone && `โทร. ${phone}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </div>
  );
}

export interface PrintItemRow {
  description: string;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  amount: number;
}

export function ItemsTable({ rows }: { rows: PrintItemRow[] }) {
  return (
    <table className="mt-4 w-full border-collapse text-[12.5px]">
      <thead>
        <tr className="border-y border-slate-900 text-left">
          <th className="w-8 py-1.5 pr-2 text-center font-semibold">#</th>
          <th className="py-1.5 pr-2 font-semibold">รายการ</th>
          <th className="w-16 py-1.5 pr-2 text-right font-semibold">จำนวน</th>
          <th className="w-14 py-1.5 pr-2 text-center font-semibold">หน่วย</th>
          <th className="w-24 py-1.5 pr-2 text-right font-semibold">ราคา/หน่วย</th>
          <th className="w-28 py-1.5 text-right font-semibold">จำนวนเงิน</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={idx} className="border-b border-slate-200 align-top">
            <td className="py-1.5 pr-2 text-center text-slate-500">{idx + 1}</td>
            <td className="whitespace-pre-line py-1.5 pr-2">{row.description}</td>
            <td className="py-1.5 pr-2 text-right tabular-nums">
              {row.quantity != null ? new Intl.NumberFormat("th-TH").format(row.quantity) : "-"}
            </td>
            <td className="py-1.5 pr-2 text-center">{row.unit ?? "-"}</td>
            <td className="py-1.5 pr-2 text-right tabular-nums">
              {row.unitPrice != null ? formatMoney(row.unitPrice) : "-"}
            </td>
            <td className="py-1.5 text-right tabular-nums">{formatMoney(row.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TotalsBlock({
  rows,
  grandLabel,
  grandAmount,
}: {
  rows: { label: string; amount: number; hidden?: boolean }[];
  grandLabel: string;
  grandAmount: number;
}) {
  return (
    <div className="mt-3 flex justify-end">
      <table className="w-72 text-[12.5px]">
        <tbody>
          {rows
            .filter((r) => !r.hidden)
            .map((row) => (
              <tr key={row.label}>
                <td className="py-0.5 pr-4 text-right text-slate-600">{row.label}</td>
                <td className="py-0.5 text-right tabular-nums">{formatMoney(row.amount)}</td>
              </tr>
            ))}
          <tr className="border-t-2 border-slate-900 text-[14px] font-bold">
            <td className="py-1.5 pr-4 text-right">{grandLabel}</td>
            <td className="py-1.5 text-right tabular-nums">{formatMoney(grandAmount)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function BahtTextBox({ amount }: { amount: number }) {
  return (
    <div className="mt-2 rounded border border-slate-300 bg-slate-50 px-4 py-2 text-center text-[12.5px]">
      ({bahtText(amount)})
    </div>
  );
}

export function NotesBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 text-[12px]">
      <p className="font-semibold text-slate-700">{title}</p>
      <div className="whitespace-pre-line text-slate-600">{children}</div>
    </div>
  );
}

export function SignatureRow({ labels }: { labels: string[] }) {
  return (
    <div className="mt-12 flex justify-between gap-8">
      {labels.map((label) => (
        <div key={label} className="flex-1 text-center text-[12px]">
          <div className="mx-auto mb-1.5 h-10 w-48 border-b border-dotted border-slate-400" />
          <p className="text-slate-700">{label}</p>
          <p className="mt-1 text-slate-500">วันที่ ............................</p>
        </div>
      ))}
    </div>
  );
}
