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

const DOCUMENT_CODE: ReadonlyArray<[RegExp, string]> = [
  [/ใบเสนอราคา/, "QT"],
  [/ใบวางบิล/, "BN"],
  [/ใบแจ้งหนี้|ใบเสร็จ|ใบกำกับ|ใบลดหนี้|ใบเพิ่มหนี้/, "TX"],
  [/ใบรายการสินค้า/, "PL"],
  [/ใบสั่งงาน/, "JT"],
];

export function DocumentStamp({
  title,
  label = "เอกสารธุรกิจ",
  code,
}: {
  title: string;
  label?: string;
  code?: string;
}) {
  const resolvedCode = code ?? DOCUMENT_CODE.find(([pattern]) => pattern.test(title))?.[1] ?? "AP";
  return (
    <div className="flex items-center gap-2" data-document-stamp={resolvedCode}>
      {/* เดิมเป็นสี่เหลี่ยมดำทึบ (อ่านเป็นแถบหมึกหนักที่ไม่ได้บอกอะไร) แล้วรอบแรกของ
          UI-2026 ทำให้เบาเป็นกล่องขอบเทา — ซึ่งทำให้ทั้งใบไม่มีอะไรบอกว่าเป็นของใครเลย
          ใบเสนอราคา/ใบกำกับภาษีไปนั่งในแฟ้มลูกค้า B2B เป็นปี นี่คือที่ที่แบรนด์อยู่ได้นานที่สุด
          (เบสทัก 2026-08-26 "อย่าลืมสีฟ้าที่เป็น asset เรา") */}
      <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-600 text-[11px] font-bold text-white" aria-hidden="true">
        {resolvedCode}
      </span>
      <span className="text-[10px] text-slate-500">{label}</span>
    </div>
  );
}

/**
 * ลายน้ำ "ยกเลิก" บนใบกำกับภาษี/ใบวางบิลที่ถูกยกเลิก
 *
 * เดิมใช้ red-300 ที่ความทึบ 60% = คอนทราสต์ 1.4 ต่อ 1 บนกระดาษขาว — **จางจนดู
 * เหมือนใบที่ยังใช้ได้** ซึ่งเป็นความเสี่ยงเรื่องเงินจริง (ลูกค้าจ่ายตามใบที่ยกเลิก
 * ไปแล้ว · บัญชียื่นภาษีผิดใบ) · เจอจาก audit สี 2026-08-02
 *
 * red-700 ที่ความทึบเดิม 60% = 3.03 ต่อ 1 ผ่านเกณฑ์ตัวอักษรขนาดใหญ่พอดี
 * (ห้ามดันความทึบให้สูงกว่านี้ — ลายน้ำทับตัวเลขในใบอยู่ ไม่ได้อยู่ใต้)
 * + แถบทึบใต้ลายน้ำ เพราะเครื่องพิมพ์ขาวดำจะแปลงแดงเป็นเทา — ตัวขาวบนแถบเข้ม
 *   ยังอ่านออกเสมอไม่ว่าพิมพ์สีหรือขาวดำ
 */
export function VoidWatermark() {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4">
      <span className="rotate-[-24deg] border-8 border-red-700 px-10 py-3 text-7xl font-bold tracking-widest text-red-700 opacity-60">
        ยกเลิก
      </span>
      <span className="rotate-[-24deg] rounded bg-red-700 px-4 py-1.5 text-sm font-semibold tracking-wide text-white">
        เอกสารนี้ถูกยกเลิก — ไม่มีผลทางบัญชี
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
  // เส้นคาดหัวใบเป็นดำตามชุดเอกสาร (ต้นแบบ .ptop = 2px #14181d) ทำให้ทั้ง 5 ใบเป็นชุดเดียวกัน
  // — สีแบรนด์ยังอยู่ที่ตราหัวใบ (DocumentStamp) ซึ่งเป็นการตัดสินใจที่บันทึกไว้ 2026-08-26
  return (
    <div className="flex items-start justify-between gap-5 border-b-2 border-slate-900 pb-4">
      <div className="min-w-0">
        <div className="mb-2"><DocumentStamp title={title} label="Anajak document" /></div>
        <p className="text-[15px] font-bold leading-snug">{company.name || "(ยังไม่ตั้งค่าข้อมูลกิจการ — Settings → ข้อมูลกิจการ)"}</p>
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
          <p className="mb-0.5 text-[10.5px] tracking-[0.06em] text-slate-500">{copyLabel}</p>
        )}
        {/* ชื่อเอกสารเคยเป็นแถบดำกลับสี — ตัวหนังสือใหญ่บนขาวอ่านง่ายกว่าและ
            ประหยัดหมึกกว่ามาก · ลำดับชั้นมาจากขนาดกับน้ำหนัก ไม่ใช่จากพื้นทึบ */}
        <p className="text-[17px] font-semibold leading-tight tracking-tight">{title}</p>
        {subtitle && <p className="text-[12px] text-slate-600">{subtitle}</p>}
        {/* ป้ายซ้าย-ค่าขวาเป็นตาราง (ต้นแบบเรียง span บรรทัดเดียว) — ตารางคือที่ทางของ
            refLines ที่ต้นแบบไม่มี · ป้ายเบาลงเป็น slate-500 ให้ค่าจริงเด่นกว่าป้าย */}
        <table className="mt-2 ml-auto text-[12.5px]">
          <tbody>
            <tr>
              <td className="pr-3 text-right text-slate-500">เลขที่</td>
              <td className="text-right font-semibold tabular-nums">{docNumber}</td>
            </tr>
            <tr>
              <td className="pr-3 text-right text-slate-500">วันที่</td>
              <td className="text-right tabular-nums">{formatDocDate(docDate)}</td>
            </tr>
            {refLines.map((line) => (
              <tr key={line.label}>
                <td className="pr-3 text-right text-slate-500">{line.label}</td>
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
  // ต้นแบบ .pto = ย่อหน้าเดียว padding 14px 0 มีเส้นใต้บาง — แยกบล็อกคู่สัญญาออกจาก
  // ตารางรายการโดยไม่ต้องตีกรอบ
  return (
    <div className="mt-3.5 border-b border-slate-200 pb-3.5">
      <p className="mb-0.5 text-[11px] text-slate-500">{label}</p>
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

/**
 * ตารางรายการของเอกสารเงิน
 *
 * `collapseEmptyColumns` = ซ่อนคอลัมน์ จำนวน/หน่วย/ราคาต่อหน่วย เฉพาะเมื่อ **ทุกแถว**
 * ไม่มีค่านั้นเลย (ใบวางบิลส่งมาแค่ description + amount เดิมจึงพิมพ์ "-" เป็นแถบยาว
 * ทั้งคอลัมน์) · คอลัมน์ "จำนวนเงิน" ไม่มีทางถูกซ่อน และเอกสารที่มีค่าจริงยังได้ครบ 6
 * คอลัมน์เหมือนเดิม — ราคาต่อหน่วยเป็นยอดบังคับบนใบกำกับ/ใบเสนอราคา ห้ามตัดทิ้ง
 */
export function ItemsTable({
  rows,
  collapseEmptyColumns = false,
}: {
  rows: PrintItemRow[];
  collapseEmptyColumns?: boolean;
}) {
  const showQuantity = !collapseEmptyColumns || rows.some((r) => r.quantity != null);
  const showUnit = !collapseEmptyColumns || rows.some((r) => r.unit != null && r.unit !== "");
  const showUnitPrice = !collapseEmptyColumns || rows.some((r) => r.unitPrice != null);
  return (
    <table className="mt-3.5 w-full border-collapse text-[12.5px]">
      <thead>
        {/* ต้นแบบ .ptbl th = เส้นใต้ดำ — หัวตารางของทั้ง 5 ใบใช้เส้นเดียวกัน */}
        <tr className="border-y border-slate-900 text-left">
          <th scope="col" className="w-8 py-1.5 pr-2 text-center font-semibold">#</th>
          <th scope="col" className="py-1.5 pr-2 font-semibold">รายการ</th>
          {showQuantity && (
            <th scope="col" className="w-16 py-1.5 pr-2 text-right font-semibold">จำนวน</th>
          )}
          {showUnit && (
            <th scope="col" className="w-14 py-1.5 pr-2 text-center font-semibold">หน่วย</th>
          )}
          {showUnitPrice && (
            <th scope="col" className="w-24 py-1.5 pr-2 text-right font-semibold">ราคา/หน่วย</th>
          )}
          <th scope="col" className="w-28 py-1.5 text-right font-semibold">จำนวนเงิน</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={idx} className="border-b border-slate-200 align-top">
            <td className="py-1.5 pr-2 text-center text-slate-500">{idx + 1}</td>
            <td className="whitespace-pre-line py-1.5 pr-2">{row.description}</td>
            {showQuantity && (
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {row.quantity != null ? new Intl.NumberFormat("th-TH").format(row.quantity) : "-"}
              </td>
            )}
            {showUnit && <td className="py-1.5 pr-2 text-center">{row.unit ?? "-"}</td>}
            {showUnitPrice && (
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {row.unitPrice != null ? formatMoney(row.unitPrice) : "-"}
              </td>
            )}
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
      {/* ต้นแบบ .ptot กว้าง 270px ชิดขวา · แถวยอดรวมมีเส้นบนดำ */}
      <table className="w-[270px] text-[12.5px]">
        <tbody>
          {rows
            .filter((r) => !r.hidden)
            .map((row) => (
              <tr key={row.label}>
                <td className="py-0.5 pr-4 text-right text-slate-600">{row.label}</td>
                <td className="py-0.5 text-right tabular-nums">{formatMoney(row.amount)}</td>
              </tr>
            ))}
          <tr className="border-t border-slate-900 text-[14px] font-semibold">
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
    <div className="mt-2 text-right text-[12.5px] text-slate-700">({bahtText(amount)})</div>
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
  // ต้นแบบ .psign = เว้นบน 44px ช่องห่าง 40px · บรรทัด "วันที่" เป็นของจริงที่ต้นแบบ
  // ไม่มี — เอกสารที่ลูกค้าเซ็นรับต้องลงวันที่ได้ จึงคงไว้
  return (
    <div className="mt-11 flex justify-between gap-10">
      {labels.map((label) => (
        <div key={label} className="flex-1 text-center text-[12px]">
          <div className="mx-auto mb-1.5 h-10 w-48 border-b border-slate-400" />
          <p className="text-slate-700">{label}</p>
          <p className="mt-1 text-slate-500">วันที่</p>
        </div>
      ))}
    </div>
  );
}
