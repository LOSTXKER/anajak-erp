import { describe, it, expect } from "vitest";
import {
  buildSalesTaxRows,
  summarizeSalesTax,
  branchLabel,
  taxPointDate,
  formatThaiDate,
  formatThaiDateBE,
  salesTaxReportCsv,
  peakImportCsv,
  type TaxInvoiceLike,
} from "./sales-tax-report";

const base = (over: Partial<TaxInvoiceLike>): TaxInvoiceLike => ({
  invoiceNumber: "REC-2607-0001",
  type: "RECEIPT",
  amount: 1000,
  discount: 0,
  tax: 70,
  totalAmount: 1070,
  isVoided: false,
  issueDate: "2026-07-10T00:00:00.000Z",
  createdAt: "2026-07-15T03:00:00.000Z",
  adjustmentReason: null,
  originalInvoiceNumber: null,
  orderNumber: "ORD-2607-0001",
  customerName: "บริษัท ทดสอบ จำกัด",
  customerTaxId: "0105561234567",
  customerBranchNumber: "00000",
  ...over,
});

describe("buildSalesTaxRows — แถวรายงานภาษีขาย", () => {
  it("เรียงตามวันที่เอกสาร (tax point) แล้วไล่เลขที่ · seq ต่อเนื่อง", () => {
    const rows = buildSalesTaxRows([
      base({ invoiceNumber: "REC-2607-0003", issueDate: "2026-07-20T00:00:00.000Z" }),
      base({ invoiceNumber: "REC-2607-0002", issueDate: "2026-07-05T00:00:00.000Z" }),
      base({ invoiceNumber: "REC-2607-0001", issueDate: "2026-07-05T00:00:00.000Z" }),
    ]);
    expect(rows.map((r) => r.invoiceNumber)).toEqual([
      "REC-2607-0001",
      "REC-2607-0002",
      "REC-2607-0003",
    ]);
    expect(rows.map((r) => r.seq)).toEqual([1, 2, 3]);
  });

  it("ใบเสร็จ: ฐาน = amount − discount · VAT/รวมตามใบ · อัตรา 7%", () => {
    const [r] = buildSalesTaxRows([base({ amount: 1100, discount: 100, tax: 70, totalAmount: 1070 })]);
    expect(r.base).toBe(1000);
    expect(r.vat).toBe(70);
    expect(r.total).toBe(1070);
    expect(r.vatRateLabel).toBe("7%");
  });

  it("ใบลดหนี้ยอดติดลบ + หมายเหตุอ้างใบเดิม/เหตุผล · ใบเพิ่มหนี้ยอดบวก", () => {
    const [cn, dn] = buildSalesTaxRows([
      base({
        invoiceNumber: "CN-2607-0001",
        type: "CREDIT_NOTE",
        amount: 200,
        tax: 14,
        totalAmount: 214,
        originalInvoiceNumber: "INV-F-2607-0009",
        adjustmentReason: "คืนของชำรุด",
        issueDate: "2026-07-01T00:00:00.000Z",
      }),
      base({
        invoiceNumber: "DN-2607-0001",
        type: "DEBIT_NOTE",
        amount: 100,
        tax: 7,
        totalAmount: 107,
        originalInvoiceNumber: "INV-F-2607-0009",
        issueDate: "2026-07-02T00:00:00.000Z",
      }),
    ]);
    expect(cn.base).toBe(-200);
    expect(cn.vat).toBe(-14);
    expect(cn.total).toBe(-214);
    expect(cn.note).toContain("อ้างใบ INV-F-2607-0009");
    expect(cn.note).toContain("คืนของชำรุด");
    expect(dn.base).toBe(100);
    expect(dn.total).toBe(107);
  });

  it("ใบยกเลิก: ยอดเป็น 0 ทุกช่อง + หมายเหตุยอดเดิม (เลขที่คงอยู่ให้ไม่โดด)", () => {
    const [r] = buildSalesTaxRows([base({ isVoided: true })]);
    expect(r.base).toBe(0);
    expect(r.vat).toBe(0);
    expect(r.total).toBe(0);
    expect(r.isVoided).toBe(true);
    expect(r.note).toContain("ยกเลิก");
    expect(r.note).toContain("1070.00");
  });

  it("ใบเก่าไม่มี VAT → อัตรา 0%", () => {
    const [r] = buildSalesTaxRows([base({ tax: 0, totalAmount: 1000 })]);
    expect(r.vatRateLabel).toBe("0%");
    expect(r.vatNonStandard).toBe(false);
  });

  it("ใบแก้ tax มือไม่ตรง 7% → อัตรา 'อื่นๆ' + ธง vatNonStandard (เศษ ≤2 สตางค์ยังนับ 7%)", () => {
    const [odd] = buildSalesTaxRows([base({ tax: 75, totalAmount: 1075 })]);
    expect(odd.vatRateLabel).toBe("อื่นๆ");
    expect(odd.vatNonStandard).toBe(true);
    const [nearly] = buildSalesTaxRows([base({ tax: 70.01, totalAmount: 1070.01 })]);
    expect(nearly.vatRateLabel).toBe("7%");
    expect(nearly.vatNonStandard).toBe(false);
  });

  it("CN ที่ถูก void: หมายเหตุยอดเดิมติด sign ลบ (ตรงทิศแถว live)", () => {
    const [r] = buildSalesTaxRows([
      base({
        invoiceNumber: "CN-2607-0002",
        type: "CREDIT_NOTE",
        amount: 200,
        tax: 14,
        totalAmount: 214,
        isVoided: true,
        originalInvoiceNumber: "REC-2607-0001",
      }),
    ]);
    expect(r.note).toContain("-214.00");
  });

  it("CN/DN ใบเก่าไม่ผูกใบเดิม → หมายเหตุให้นักบัญชีตรวจ", () => {
    const [r] = buildSalesTaxRows([
      base({
        invoiceNumber: "CN-OLD-0001",
        type: "CREDIT_NOTE",
        amount: 100,
        tax: 7,
        totalAmount: 107,
        originalInvoiceNumber: null,
      }),
    ]);
    expect(r.note).toContain("ไม่ผูกใบเดิม");
  });
});

describe("summarizeSalesTax — สรุปงวด", () => {
  it("ไม่รวมใบยกเลิก · CN หักยอด · นับแยก", () => {
    const rows = buildSalesTaxRows([
      base({}),
      base({
        invoiceNumber: "CN-2607-0001",
        type: "CREDIT_NOTE",
        amount: 200,
        tax: 14,
        totalAmount: 214,
      }),
      base({ invoiceNumber: "REC-2607-0009", isVoided: true }),
    ]);
    const sum = summarizeSalesTax(rows);
    expect(sum.docCount).toBe(2);
    expect(sum.voidedCount).toBe(1);
    expect(sum.totalBase).toBe(800); // 1000 − 200
    expect(sum.totalVat).toBe(56); // 70 − 14
    expect(sum.totalAmount).toBe(856);
  });
});

describe("helpers", () => {
  it("branchLabel: null/สนญ./สาขา", () => {
    expect(branchLabel(null)).toBe("");
    expect(branchLabel("00000")).toBe("สำนักงานใหญ่");
    expect(branchLabel("00002")).toBe("สาขา 00002");
  });

  it("taxPointDate: issueDate มาก่อน createdAt", () => {
    expect(taxPointDate(base({})).toISOString()).toBe("2026-07-10T00:00:00.000Z");
    expect(taxPointDate(base({ issueDate: null })).toISOString()).toBe(
      "2026-07-15T03:00:00.000Z"
    );
  });

  it("formatThaiDate: ขอบวันตามเขตเวลาไทย (18:00Z = เช้าวันถัดไปที่ไทย)", () => {
    expect(formatThaiDate(new Date("2026-07-31T18:00:00.000Z"))).toBe("01/08/2026");
    expect(formatThaiDate(new Date("2026-07-10T00:00:00.000Z"))).toBe("10/07/2026");
  });

  it("formatThaiDateBE: พ.ศ. สำหรับฟอร์มสรรพากร", () => {
    expect(formatThaiDateBE(new Date("2026-07-10T00:00:00.000Z"))).toBe("10/07/2569");
  });
});

describe("CSV builders", () => {
  it("รายงานภาษีขาย: escape ชื่อมี comma + แถวรวมท้ายตรง summary", () => {
    const rows = buildSalesTaxRows([
      base({ customerName: "ห้าง ก, ข และเพื่อน" }),
      base({
        invoiceNumber: "CN-2607-0001",
        type: "CREDIT_NOTE",
        amount: 200,
        tax: 14,
        totalAmount: 214,
      }),
    ]);
    const csv = salesTaxReportCsv(rows, "กรกฎาคม 2569");
    expect(csv).toContain('"ห้าง ก, ข และเพื่อน"');
    const lines = csv.split("\n");
    expect(lines[0]).toContain("เลขที่ใบกำกับภาษี");
    // วันที่ พ.ศ. ทั้งไฟล์ (ศักราชเดียวกับ footer) + เลขภาษีห่อ ="..." กัน Excel ตัด 0
    expect(lines[1]).toContain("10/07/2569");
    expect(csv).toContain('"=""0105561234567"""');
    const footer = lines[lines.length - 1];
    expect(footer).toContain("800.00");
    expect(footer).toContain("56.00");
    expect(footer).toContain("856.00");
  });

  it("PEAK: ไม่มีใบยกเลิก · ใบลดหนี้เป็นยอดบวก + ประเภทกำกับ · มีเลขภาษี/สาขา/ยอด VAT จริง", () => {
    const rows = buildSalesTaxRows([
      base({}),
      base({
        invoiceNumber: "CN-2607-0001",
        type: "CREDIT_NOTE",
        amount: 200,
        tax: 14,
        totalAmount: 214,
        originalInvoiceNumber: "REC-2607-0001",
      }),
      base({ invoiceNumber: "REC-2607-0009", isVoided: true }),
    ]);
    const csv = peakImportCsv(rows);
    expect(csv).not.toContain("REC-2607-0009");
    expect(csv.split("\n")[0]).toContain("มูลค่าภาษี (บาท)");
    const cnLine = csv.split("\n").find((l) => l.includes("CN-2607-0001"))!;
    expect(cnLine).toContain("ใบลดหนี้");
    expect(cnLine).toContain("200.00"); // ยอดบวกฝั่ง PEAK
    expect(cnLine).not.toContain("-200.00");
    expect(cnLine).toContain("14.00"); // ยอด VAT จริง (ไม่ใช่แค่อัตรา)
    expect(cnLine).toContain("0105561234567");
    expect(cnLine).toContain("สำนักงานใหญ่");
  });

  it("PEAK: ใบอัตราไม่มาตรฐาน → คำอธิบายเตือนคีย์ยอดมือ", () => {
    const rows = buildSalesTaxRows([base({ tax: 75, totalAmount: 1075 })]);
    const csv = peakImportCsv(rows);
    expect(csv).toContain("อื่นๆ");
    expect(csv).toContain("คีย์ยอดมือ");
    expect(csv).toContain("75.00");
  });
});
