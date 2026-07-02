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
        // ใบลดหนี้/เพิ่มหนี้ต้องพิมพ์อ้างอิงใบเดิม + มูลค่าเดิม/ใหม่/ผลต่าง (ม.86/10)
        // — "มูลค่า" ตามกฎหมาย = ฐานภาษี (amount−discount) ไม่ใช่ยอดรวม VAT
        // และต้องหัก CN/รวม DN ใบก่อนหน้าของใบเดิม (adjustments) ไม่งั้นใบที่ 2 ขึ้นไปผิด
        originalInvoice: {
          select: {
            invoiceNumber: true,
            createdAt: true,
            issueDate: true,
            amount: true,
            discount: true,
            adjustments: {
              select: {
                id: true,
                type: true,
                amount: true,
                discount: true,
                isVoided: true,
                createdAt: true,
              },
            },
          },
        },
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

  // องค์ประกอบบังคับของใบลดหนี้/เพิ่มหนี้ (ม.86/10): อ้างใบเดิม + มูลค่าเดิม/ที่ถูกต้อง/ผลต่าง
  // — ทุกตัวเป็น "มูลค่า" (ฐานภาษี ก่อน VAT) · VAT ของผลต่างอยู่ในตารางยอดด้านบนแล้ว
  const isAdjustmentDoc = invoice.type === "CREDIT_NOTE" || invoice.type === "DEBIT_NOTE";
  const isAdjustment = isAdjustmentDoc && !!invoice.originalInvoice;
  const baseOf = (x: { amount: number; discount: number }) => x.amount - x.discount;
  // มูลค่าใบเดิม ณ ก่อนใบนี้ = ฐานใบเดิม − CN ก่อนหน้า + DN ก่อนหน้า (เฉพาะที่ไม่ถูกยกเลิก)
  const priorAdjustments = (invoice.originalInvoice?.adjustments ?? []).filter(
    (a) => !a.isVoided && a.id !== invoice.id && a.createdAt < invoice.createdAt
  );
  const priorNet = priorAdjustments.reduce(
    (sum, a) => sum + (a.type === "CREDIT_NOTE" ? -baseOf(a) : baseOf(a)),
    0
  );
  const originalBase = invoice.originalInvoice
    ? baseOf(invoice.originalInvoice) + priorNet
    : 0;
  const correctedBase =
    invoice.type === "CREDIT_NOTE" ? originalBase - taxBase : originalBase + taxBase;

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
            // วันที่เอกสารตามกฎหมาย = tax point (ใบเสร็จของงวดรับเงิน = วันรับเงินจริง)
            docDate={invoice.issueDate ?? invoice.createdAt}
            refLines={[
              { label: "อ้างอิงออเดอร์", value: invoice.order.orderNumber },
              ...(isAdjustment && invoice.originalInvoice
                ? [
                    {
                      label: "อ้างอิงใบกำกับ/ใบแจ้งหนี้เดิม",
                      value: `${invoice.originalInvoice.invoiceNumber} (${formatDocDate(invoice.originalInvoice.issueDate ?? invoice.originalInvoice.createdAt)})`,
                    },
                  ]
                : []),
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

          {isAdjustment && invoice.originalInvoice && (
            <NotesBlock
              title={`รายละเอียดการ${invoice.type === "CREDIT_NOTE" ? "ลดหนี้" : "เพิ่มหนี้"} (ม.86/10)`}
            >
              {[
                `มูลค่าตามใบกำกับ/ใบแจ้งหนี้เดิม (${invoice.originalInvoice.invoiceNumber}): ${formatMoney(originalBase)} บาท (ไม่รวมภาษีมูลค่าเพิ่ม)${priorAdjustments.length > 0 ? ` — ปรับด้วยใบลดหนี้/เพิ่มหนี้ก่อนหน้า ${priorAdjustments.length} ฉบับแล้ว` : ""}`,
                `มูลค่าที่ถูกต้อง: ${formatMoney(correctedBase)} บาท (ไม่รวมภาษีมูลค่าเพิ่ม)`,
                `ผลต่าง: ${formatMoney(taxBase)} บาท (ภาษีมูลค่าเพิ่มของผลต่างแสดงในตารางยอดด้านบน)`,
                ...(invoice.adjustmentReason ? [`เหตุผล: ${invoice.adjustmentReason}`] : []),
              ].join("\n")}
            </NotesBlock>
          )}

          {/* ใบเก่า/ผ่าน API เดิมที่ไม่ผูกใบเดิม — องค์ประกอบ ม.86/10 ไม่ครบ พิมพ์เตือนชัด
              (กติกา: ยกเลิก-ออกใหม่ ห้ามลบ) */}
          {isAdjustmentDoc && !invoice.originalInvoice && (
            <NotesBlock title="⚠ เอกสารไม่สมบูรณ์">
              {
                "ใบนี้ไม่มีการอ้างอิงใบกำกับ/ใบแจ้งหนี้เดิม — องค์ประกอบตาม ม.86/10 ไม่ครบ ควรยกเลิกแล้วออกใหม่โดยระบุใบที่อ้างอิง"
              }
            </NotesBlock>
          )}

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
