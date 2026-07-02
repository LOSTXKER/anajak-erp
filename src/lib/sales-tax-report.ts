// รายงานภาษีขายรายเดือน (Gate B5) — pure ทั้งไฟล์ให้ unit test ได้ + client ใช้สร้าง CSV
//
// ขอบเขตเอกสาร: ใบกำกับภาษีของระบบ = RECEIPT / CREDIT_NOTE / DEBIT_NOTE (ชุดเดียวกับ
// TAX_DOC_TYPES หน้าพิมพ์) · งวดภาษี = issueDate (tax point จาก Gate B3) ?? createdAt
// กติกาแถว: ใบลดหนี้ยอดติดลบ (หักจากยอดขายตามธรรมเนียมรายงานภาษีขาย) · ใบ void
// คงแถวไว้ให้เลขที่ไม่โดด (สรรพากรไล่เลขรัน) แต่ยอดเป็น 0 + หมายเหตุยอดเดิม

export const SALES_TAX_DOC_TYPES = ["RECEIPT", "CREDIT_NOTE", "DEBIT_NOTE"] as const;
export type SalesTaxDocType = (typeof SALES_TAX_DOC_TYPES)[number];

export const SALES_TAX_DOC_LABELS: Record<SalesTaxDocType, string> = {
  RECEIPT: "ใบเสร็จ/ใบกำกับภาษี",
  CREDIT_NOTE: "ใบลดหนี้",
  DEBIT_NOTE: "ใบเพิ่มหนี้",
};

// รูปใบกำกับที่ builder ต้องใช้ — service เป็นคน map จาก Prisma (Decimal → number แล้ว)
export interface TaxInvoiceLike {
  invoiceNumber: string;
  type: SalesTaxDocType;
  amount: number; // ฐานก่อนหักส่วนลด
  discount: number;
  tax: number; // ยอด VAT
  totalAmount: number;
  isVoided: boolean;
  issueDate: string | Date | null; // วันที่เอกสารตามกฎหมาย (null = ใช้ createdAt)
  createdAt: string | Date;
  adjustmentReason: string | null;
  originalInvoiceNumber: string | null; // เลขใบเดิมที่ CN/DN อ้าง
  orderNumber: string;
  customerName: string;
  customerTaxId: string | null;
  customerBranchNumber: string | null; // "00000" = สำนักงานใหญ่
}

export interface SalesTaxRow {
  seq: number;
  /** วันที่เอกสาร (tax point) — Date จริง ให้ผู้แสดงผล format เอง */
  date: Date;
  invoiceNumber: string;
  docType: SalesTaxDocType;
  customerName: string;
  taxId: string;
  branch: string;
  /** ฐานภาษี (amount − discount) · CN ติดลบ · ใบ void = 0 */
  base: number;
  /** ยอด VAT · CN ติดลบ · ใบ void = 0 */
  vat: number;
  /** ยอดรวม · CN ติดลบ · ใบ void = 0 */
  total: number;
  /** อัตราภาษีจากยอดจริง — "7%" / "0%" / "อื่นๆ" (ใบแก้ tax มือที่ไม่ตรง 7% เป๊ะ) */
  vatRateLabel: string;
  /** ยอด VAT ไม่ตรงฐาน×7% (และไม่ใช่ 0) — PEAK คำนวณจากอัตราไม่ได้ ต้องคีย์ยอดมือ */
  vatNonStandard: boolean;
  isVoided: boolean;
  note: string;
  orderNumber: string;
}

export interface SalesTaxSummary {
  docCount: number; // นับเฉพาะไม่ void
  voidedCount: number;
  totalBase: number;
  totalVat: number;
  totalAmount: number;
}

export function branchLabel(branchNumber: string | null): string {
  if (!branchNumber) return "";
  return branchNumber === "00000" ? "สำนักงานใหญ่" : `สาขา ${branchNumber}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// เผื่อเศษปัดสตางค์จากส่วนลด/หลายงวด 2 สตางค์ — เกินนั้นคือใบแก้ tax มือ ไม่ใช่ 7% จริง
function isStandardVat(base: number, vat: number): boolean {
  return Math.abs(vat - round2(base * 0.07)) <= 0.02;
}

function vatRateLabel(base: number, vat: number): string {
  if (vat === 0) return "0%";
  if (base > 0 && isStandardVat(base, vat)) return "7%";
  return "อื่นๆ";
}

export function taxPointDate(inv: Pick<TaxInvoiceLike, "issueDate" | "createdAt">): Date {
  return new Date(inv.issueDate ?? inv.createdAt);
}

/** แปลงใบกำกับของเดือน → แถวรายงาน (เรียงตามวันที่เอกสาร แล้วไล่เลขที่ใบ) */
export function buildSalesTaxRows(invoices: TaxInvoiceLike[]): SalesTaxRow[] {
  const sorted = [...invoices].sort((a, b) => {
    const da = taxPointDate(a).getTime();
    const db = taxPointDate(b).getTime();
    if (da !== db) return da - db;
    return a.invoiceNumber.localeCompare(b.invoiceNumber, "th");
  });

  return sorted.map((inv, i) => {
    const sign = inv.type === "CREDIT_NOTE" ? -1 : 1;
    const rawBase = round2(inv.amount - inv.discount);
    const base = inv.isVoided ? 0 : round2(sign * rawBase);
    const vat = inv.isVoided ? 0 : round2(sign * inv.tax);
    const total = inv.isVoided ? 0 : round2(sign * inv.totalAmount);

    const notes: string[] = [];
    if (inv.type !== "RECEIPT") {
      notes.push(SALES_TAX_DOC_LABELS[inv.type]);
      if (inv.originalInvoiceNumber) notes.push(`อ้างใบ ${inv.originalInvoiceNumber}`);
      // ใบเก่าก่อนกติกา B1 ไม่ผูกใบเดิม — ระบบตัดสินแทนไม่ได้ว่าอ้างใบกำกับหรือใบแจ้งหนี้
      else notes.push("ไม่ผูกใบเดิม — นักบัญชีตรวจก่อนยื่น");
      if (inv.adjustmentReason) notes.push(inv.adjustmentReason);
    }
    if (inv.isVoided) {
      // sign เดียวกับแถว live (CN ติดลบ) — reconcile ก่อน/หลัง void แล้วทิศไม่หลอก
      notes.push(`ยกเลิก (ยอดเดิม ${round2(sign * inv.totalAmount).toFixed(2)})`);
    }

    return {
      seq: i + 1,
      date: taxPointDate(inv),
      invoiceNumber: inv.invoiceNumber,
      docType: inv.type,
      customerName: inv.customerName,
      taxId: inv.customerTaxId ?? "",
      branch: branchLabel(inv.customerBranchNumber),
      base,
      vat,
      total,
      vatRateLabel: vatRateLabel(rawBase, inv.tax),
      vatNonStandard: inv.tax !== 0 && !isStandardVat(rawBase, inv.tax),
      isVoided: inv.isVoided,
      note: notes.join(" · "),
      orderNumber: inv.orderNumber,
    };
  });
}

export function summarizeSalesTax(rows: SalesTaxRow[]): SalesTaxSummary {
  const live = rows.filter((r) => !r.isVoided);
  return {
    docCount: live.length,
    voidedCount: rows.length - live.length,
    totalBase: round2(live.reduce((s, r) => s + r.base, 0)),
    totalVat: round2(live.reduce((s, r) => s + r.vat, 0)),
    totalAmount: round2(live.reduce((s, r) => s + r.total, 0)),
  };
}

// ────────────────────────────────────────────────────────────
// CSV builders — คืน "เนื้อ CSV ไม่รวม BOM" (คนดาวน์โหลดเติม \uFEFF เอง
// ตาม pattern exportWhtCsv) · escape ตามกติกา RFC4180
// ────────────────────────────────────────────────────────────

function csvEscape(v: string): string {
  // \r เดี่ยว (ข้อมูลจาก Windows/paste) ทำแถวแตกเหมือน \n — ต้อง quote ด้วย
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

// เลขผู้เสียภาษีขึ้นต้น 0 (นิติบุคคลไทยแทบทุกราย) — Excel เปิด CSV ตรงจะตัด 0/แปลง
// เป็น scientific notation · ="..." คือ trick มาตรฐานให้ Excel อ่านเป็น text เสมอ
function excelText(v: string): string {
  return v ? `="${v}"` : "";
}

function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

/** วันที่แบบไทย DD/MM/YYYY (ค.ศ.) เขตเวลาไทย — งวดภาษีไทยต้องไม่เพี้ยนตามเครื่อง */
export function formatThaiDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(d);
}

/** วันที่ พ.ศ. DD/MM/YYYY — ฟอร์มรายงานภาษีขายสรรพากรใช้ พ.ศ. ทั้งฉบับ */
export function formatThaiDateBE(d: Date): string {
  const ce = formatThaiDate(d);
  const [day, month, year] = ce.split("/");
  return `${day}/${month}/${Number(year) + 543}`;
}

/** CSV มาตรฐาน — คอลัมน์ตามฟอร์มรายงานภาษีขายสรรพากร + แถวรวมท้าย */
export function salesTaxReportCsv(rows: SalesTaxRow[], periodLabel: string): string {
  const header = [
    "ลำดับ",
    "วัน เดือน ปี",
    "เลขที่ใบกำกับภาษี",
    "ชื่อผู้ซื้อสินค้า/ผู้รับบริการ",
    "เลขประจำตัวผู้เสียภาษีของผู้ซื้อ",
    "สถานประกอบการ",
    "มูลค่าสินค้าหรือบริการ",
    "จำนวนเงินภาษีมูลค่าเพิ่ม",
    "ยอดรวม",
    "หมายเหตุ",
  ];
  const body = rows.map((r) => [
    String(r.seq),
    formatThaiDateBE(r.date), // ฟอร์มสรรพากรใช้ พ.ศ. ให้ตรงศักราชเดียวทั้งไฟล์
    r.invoiceNumber,
    r.customerName,
    excelText(r.taxId),
    r.branch,
    r.base.toFixed(2),
    r.vat.toFixed(2),
    r.total.toFixed(2),
    r.note,
  ]);
  const sum = summarizeSalesTax(rows);
  const footer = [
    "",
    "",
    "",
    `รวมงวด ${periodLabel} (${sum.docCount} ฉบับ${sum.voidedCount ? ` · ยกเลิก ${sum.voidedCount}` : ""})`,
    "",
    "",
    sum.totalBase.toFixed(2),
    sum.totalVat.toFixed(2),
    sum.totalAmount.toFixed(2),
    "",
  ];
  return toCsv([header, ...body, footer]);
}

/**
 * CSV สำหรับวางลง template import ของ PEAK — คอลัมน์เรียงตาม field ที่ PEAK ใช้
 * (วันที่เอกสาร · คู่ค้า ชื่อ/เลขภาษี/สาขา · รายการ · คำอธิบาย · จำนวน · ราคา · ภาษี)
 * ⚠️ template จริงต้องดาวน์โหลดจากบัญชี PEAK — คอลัมน์เป๊ะให้นักบัญชีเทียบตอนรีวิว B6
 * ใบ void ไม่ออกในไฟล์นี้ (PEAK ไม่ควรมีเอกสารยกเลิกเข้าไปเป็นรายรับ)
 */
export function peakImportCsv(rows: SalesTaxRow[]): string {
  const header = [
    "เลขที่เอกสารอ้างอิง",
    "วันที่เอกสาร",
    "ประเภทเอกสาร",
    "ชื่อคู่ค้า",
    "เลขประจำตัวผู้เสียภาษี",
    "สาขา",
    "สินค้า/บริการ",
    "คำอธิบายรายการ",
    "จำนวน",
    "ราคาต่อหน่วย (ก่อน VAT)",
    "อัตราภาษี",
    "มูลค่าภาษี (บาท)",
    "มูลค่ารวม",
  ];
  const body = rows
    .filter((r) => !r.isVoided)
    .map((r) => [
      r.invoiceNumber,
      formatThaiDate(r.date),
      SALES_TAX_DOC_LABELS[r.docType],
      r.customerName,
      excelText(r.taxId),
      r.branch,
      "ค่าจ้างผลิต/ค่าสินค้า",
      `${SALES_TAX_DOC_LABELS[r.docType]} ${r.invoiceNumber} (ออเดอร์ ${r.orderNumber})${r.note ? ` — ${r.note}` : ""}${r.vatNonStandard ? " ⚠️ ยอดภาษีไม่ตรง 7% — คีย์ยอดมือใน PEAK" : ""}`,
      "1",
      // PEAK คิดยอดจากจำนวน×ราคา — ใบลดหนี้นำเข้าเป็นเอกสารลดหนี้ฝั่ง PEAK ใช้ยอดบวก
      Math.abs(r.base).toFixed(2),
      r.vatRateLabel,
      // ยอด VAT จริงจากใบ — อัตรา "อื่นๆ" ให้ PEAK คำนวณเองไม่ได้ ต้องใช้ยอดนี้
      Math.abs(r.vat).toFixed(2),
      Math.abs(r.total).toFixed(2),
    ]);
  return toCsv([header, ...body]);
}
