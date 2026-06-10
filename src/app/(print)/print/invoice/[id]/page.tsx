// หน้าพิมพ์เอกสารการเงินทุกชนิดของบิล — ใบแจ้งหนี้ / ใบเสร็จรับเงิน+ใบกำกับภาษีเต็มรูป (ม.86/4) /
// ใบลดหนี้ / ใบเพิ่มหนี้ · เอกสารภาษี (เสร็จ/ลดหนี้/เพิ่มหนี้) พิมพ์ 2 หน้า: ต้นฉบับ (ลูกค้า) + สำเนา
// ใบที่ถูก void พิมพ์ได้แต่มีลายน้ำ "ยกเลิก" (กติกา: ยกเลิก-ออกใหม่เท่านั้น ห้ามลบ)
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { COMPANY_PROFILE_KEY, parseCompanyProfile } from "@/lib/company-profile";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-methods";
import type { InvoiceType } from "@prisma/client";
import {
  PrintPage,
  DocHeader,
  PartyBlock,
  ItemsTable,
  TotalsBlock,
  BahtTextBox,
  NotesBlock,
  SignatureRow,
  VoidWatermark,
  formatDocDate,
  formatMoney,
} from "@/components/print/print-document";
import { PrintActions } from "@/components/print/print-actions";

const DOC_TITLES: Record<InvoiceType, { title: string; subtitle: string }> = {
  QUOTATION: { title: "ใบเสนอราคา", subtitle: "QUOTATION" },
  DEPOSIT_INVOICE: { title: "ใบแจ้งหนี้ (มัดจำ)", subtitle: "DEPOSIT INVOICE" },
  FINAL_INVOICE: { title: "ใบแจ้งหนี้", subtitle: "INVOICE" },
  RECEIPT: { title: "ใบเสร็จรับเงิน / ใบกำกับภาษี", subtitle: "RECEIPT / TAX INVOICE" },
  CREDIT_NOTE: { title: "ใบลดหนี้", subtitle: "CREDIT NOTE" },
  DEBIT_NOTE: { title: "ใบเพิ่มหนี้", subtitle: "DEBIT NOTE" },
};

// เอกสารภาษีต้องมีต้นฉบับ+สำเนา · ใบแจ้งหนี้ใบเดียวพอ
const TAX_DOC_TYPES: InvoiceType[] = ["RECEIPT", "CREDIT_NOTE", "DEBIT_NOTE"];

const LINE_DESCRIPTIONS: Record<InvoiceType, string> = {
  QUOTATION: "ค่าสินค้า/บริการ",
  DEPOSIT_INVOICE: "เงินมัดจำค่าสินค้า/ค่าจ้างผลิต",
  FINAL_INVOICE: "ค่าสินค้า/ค่าจ้างผลิต",
  RECEIPT: "รับชำระค่าสินค้า/ค่าจ้างผลิต",
  CREDIT_NOTE: "ลดหนี้ค่าสินค้า/ค่าจ้างผลิต",
  DEBIT_NOTE: "เพิ่มหนี้ค่าสินค้า/ค่าจ้างผลิต",
};

export default async function PrintInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [invoice, companySetting] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        order: { select: { id: true, orderNumber: true, title: true } },
        payments: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.setting.findUnique({ where: { key: COMPANY_PROFILE_KEY } }),
  ]);
  if (!invoice) notFound();

  const company = parseCompanyProfile(companySetting?.value);
  const doc = DOC_TITLES[invoice.type];
  const copies = TAX_DOC_TYPES.includes(invoice.type)
    ? ["ต้นฉบับ (สำหรับลูกค้า)", "สำเนา (สำหรับผู้ขาย)"]
    : [undefined];

  // ฐานภาษี = amount - discount · VAT = tax (บันทึกแยกตอนเปิดบิล) · รวม = totalAmount
  const taxBase = invoice.amount - invoice.discount;
  const received = invoice.payments.filter((p) => p.amount > 0);

  return (
    <div className="print-viewport">
      <PrintActions backHref={`/orders/${invoice.order.id}`} />

      {copies.map((copyLabel) => (
        <PrintPage key={copyLabel ?? "single"}>
          {invoice.isVoided && <VoidWatermark />}

          <DocHeader
            company={company}
            title={doc.title}
            subtitle={doc.subtitle}
            copyLabel={copyLabel}
            docNumber={invoice.invoiceNumber}
            docDate={invoice.createdAt}
            refLines={[
              { label: "อ้างอิงออเดอร์", value: invoice.order.orderNumber },
              ...(invoice.dueDate
                ? [{ label: "ครบกำหนดชำระ", value: formatDocDate(invoice.dueDate) }]
                : []),
            ]}
          />

          <PartyBlock
            label={invoice.type === "RECEIPT" ? "ได้รับเงินจาก" : "ลูกค้า"}
            name={invoice.customer.name}
            company={invoice.customer.company}
            address={invoice.customer.billingAddress || invoice.customer.address}
            taxId={invoice.customer.taxId}
            branch={
              invoice.customer.branchNumber
                ? invoice.customer.branchNumber === "00000"
                  ? "สำนักงานใหญ่"
                  : `สาขา ${invoice.customer.branchNumber}`
                : undefined
            }
            phone={invoice.customer.phone}
          />

          <ItemsTable
            rows={[
              {
                description: `${LINE_DESCRIPTIONS[invoice.type]} — ${invoice.order.title} (${invoice.order.orderNumber})${invoice.notes ? `\n${invoice.notes}` : ""}`,
                quantity: 1,
                unit: "งาน",
                unitPrice: invoice.amount,
                amount: invoice.amount,
              },
            ]}
          />

          <TotalsBlock
            rows={[
              { label: "รวมเป็นเงิน", amount: invoice.amount },
              { label: "ส่วนลด", amount: invoice.discount, hidden: invoice.discount === 0 },
              {
                label: "มูลค่าก่อนภาษีมูลค่าเพิ่ม",
                amount: taxBase,
                hidden: invoice.tax === 0,
              },
              { label: "ภาษีมูลค่าเพิ่ม (VAT)", amount: invoice.tax, hidden: invoice.tax === 0 },
            ]}
            grandLabel="จำนวนเงินรวมทั้งสิ้น"
            grandAmount={invoice.totalAmount}
          />
          <BahtTextBox amount={invoice.totalAmount} />

          {invoice.type === "RECEIPT" && received.length > 0 && (
            <NotesBlock title="ชำระโดย">
              {received
                .map(
                  (p) =>
                    `${PAYMENT_METHOD_LABELS[p.method] ?? p.method} ${formatMoney(p.amount)} บาท (${formatDocDate(p.createdAt)})${p.reference ? ` อ้างอิง ${p.reference}` : ""}`
                )
                .join("\n")}
            </NotesBlock>
          )}

          {invoice.isVoided && invoice.voidedReason && (
            <NotesBlock title="เหตุผลที่ยกเลิก">{invoice.voidedReason}</NotesBlock>
          )}

          <SignatureRow
            labels={
              invoice.type === "RECEIPT"
                ? ["ผู้รับเงิน", "ผู้มีอำนาจลงนาม"]
                : ["ผู้ออกเอกสาร", "ผู้มีอำนาจลงนาม"]
            }
          />
        </PrintPage>
      ))}
    </div>
  );
}
