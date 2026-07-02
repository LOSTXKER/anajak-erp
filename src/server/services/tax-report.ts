// รายงานภาษีขายรายเดือน (Gate B5) — query ใบกำกับของงวด + แปลงเป็นแถวรายงาน
// งวดภาษี = เดือนตามเขตเวลาไทย (UTC+7 ไม่มี DST) จาก issueDate (tax point B3) ?? createdAt
// หมายเหตุ Prisma กรอง OR สองฟิลด์: ใบที่ระบุ issueDate ใช้ issueDate เท่านั้น (บันทึกย้อน
// งวดต้องไปตามวันที่เอกสาร ไม่ใช่วันกดสร้าง) · ใบเก่าที่ไม่มีใช้ createdAt

import { badRequest } from "@/server/errors";
import {
  buildSalesTaxRows,
  summarizeSalesTax,
  SALES_TAX_DOC_TYPES,
  type SalesTaxDocType,
  type TaxInvoiceLike,
} from "@/lib/sales-tax-report";
import type { ExtendedPrismaClient } from "@/lib/prisma";

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** ขอบเดือนไทย [start, end) เป็นเวลา UTC — ใช้กรอง DateTime ใน DB */
export function bangkokMonthRange(year: number, month: number): { start: Date; end: Date } {
  // เที่ยงคืนวันที่ 1 เวลาไทย = 17:00 UTC ของวันก่อนหน้า
  const start = new Date(Date.UTC(year, month - 1, 1) - BANGKOK_OFFSET_MS);
  const end = new Date(Date.UTC(year, month, 1) - BANGKOK_OFFSET_MS);
  return { start, end };
}

export async function getSalesTaxReport(
  prisma: ExtendedPrismaClient,
  params: { year: number; month: number }
) {
  const { year, month } = params;
  if (month < 1 || month > 12) badRequest("เดือนต้องอยู่ระหว่าง 1-12");
  if (year < 2000 || year > 2100) badRequest("ปีไม่ถูกต้อง (ใช้ ค.ศ.)");
  const { start, end } = bangkokMonthRange(year, month);

  const invoices = await prisma.invoice.findMany({
    where: {
      type: { in: [...SALES_TAX_DOC_TYPES] },
      OR: [
        { issueDate: { gte: start, lt: end } },
        { issueDate: null, createdAt: { gte: start, lt: end } },
      ],
    },
    select: {
      invoiceNumber: true,
      type: true,
      amount: true,
      discount: true,
      tax: true,
      totalAmount: true,
      isVoided: true,
      issueDate: true,
      createdAt: true,
      adjustmentReason: true,
      originalInvoice: { select: { invoiceNumber: true, type: true } },
      order: { select: { orderNumber: true } },
      customer: { select: { name: true, taxId: true, branchNumber: true } },
    },
  });

  // CN/DN ที่อ้าง "ใบแจ้งหนี้" = ปรับยอดค้างภายใน ไม่ใช่เหตุการณ์ภาษี — tax point ระบบนี้
  // คือรับเงิน ใบเสร็จผูกงวดถูกบังคับยอด=เงินรับจริงจึงสะท้อนการลด/เพิ่มแล้ว นับ CN/DN
  // พวกนี้อีก = หัก/บวก VAT ซ้ำ ภ.พ.30 เพี้ยน (review B5 จับ BLOCKER) · เข้ารายงานเฉพาะ
  // CN/DN ที่อ้างใบกำกับ (RECEIPT) · ใบเก่าไม่ผูกใบเดิม (ก่อน B1) ตัดสินเองไม่ได้ —
  // คงไว้ให้นักบัญชีตรวจ (มี note กำกับใน builder)
  const taxEventInvoices = invoices.filter(
    (inv) =>
      inv.type === "RECEIPT" ||
      !inv.originalInvoice ||
      inv.originalInvoice.type === "RECEIPT"
  );

  const rows = buildSalesTaxRows(
    taxEventInvoices.map(
      (inv): TaxInvoiceLike => ({
        invoiceNumber: inv.invoiceNumber,
        type: inv.type as SalesTaxDocType,
        amount: Number(inv.amount),
        discount: Number(inv.discount),
        tax: Number(inv.tax),
        totalAmount: Number(inv.totalAmount),
        isVoided: inv.isVoided,
        issueDate: inv.issueDate,
        createdAt: inv.createdAt,
        adjustmentReason: inv.adjustmentReason,
        originalInvoiceNumber: inv.originalInvoice?.invoiceNumber ?? null,
        orderNumber: inv.order.orderNumber,
        customerName: inv.customer.name,
        customerTaxId: inv.customer.taxId,
        customerBranchNumber: inv.customer.branchNumber,
      })
    )
  );

  return { rows, summary: summarizeSalesTax(rows) };
}
