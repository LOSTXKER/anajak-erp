// หน้าพิมพ์ใบเสนอราคา — server component อ่าน DB ตรง (HTML นิ่ง ไม่ต้องรอ JS)
// auth: middleware กัน session แล้ว (print อยู่นอก /api และ /approve)
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePrintPermission } from "@/lib/supabase-server";
import { COMPANY_PROFILE_KEY, parseCompanyProfile } from "@/lib/company-profile";
import {
  PrintPage,
  DocHeader,
  PartyBlock,
  ItemsTable,
  TotalsBlock,
  BahtTextBox,
  NotesBlock,
  SignatureRow,
  formatDocDate,
} from "@/components/print/print-document";
import { PrintActions } from "@/components/print/print-actions";

export default async function PrintQuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // B12: ใบเสนอราคา = เอกสารขาย (โชว์ราคา) — ทีมการเงิน+ขาย · ช่าง/กราฟิกไม่ต้องเปิด
  await requirePrintPermission("see_order_money");

  const [quotation, companySetting] = await Promise.all([
    prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.setting.findUnique({ where: { key: COMPANY_PROFILE_KEY } }),
  ]);
  if (!quotation) notFound();

  const company = parseCompanyProfile(companySetting?.value);
  const customer = quotation.customer;

  return (
    <div className="print-viewport">
      <PrintActions backHref={`/quotations/${quotation.id}`} />

      <PrintPage>
        <DocHeader
          company={company}
          title="ใบเสนอราคา"
          subtitle="QUOTATION"
          docNumber={quotation.quotationNumber}
          docDate={quotation.createdAt}
          refLines={[{ label: "ยืนราคาถึง", value: formatDocDate(quotation.validUntil) }]}
        />

        <PartyBlock
          label="เสนอต่อ"
          name={customer.name}
          company={customer.company}
          address={customer.billingAddress || customer.address}
          taxId={customer.taxId}
          branch={customer.branchNumber ? `สาขา ${customer.branchNumber}` : undefined}
          phone={customer.phone}
        />

        <p className="mt-3 font-semibold">{quotation.title}</p>
        {quotation.description && (
          <p className="text-[12px] text-slate-600">{quotation.description}</p>
        )}

        <ItemsTable
          rows={quotation.items.map((item) => ({
            description: item.description ? `${item.name}\n${item.description}` : item.name,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            amount: item.totalPrice,
          }))}
        />

        <TotalsBlock
          rows={[
            { label: "รวมเป็นเงิน", amount: quotation.subtotal },
            { label: "ส่วนลด", amount: quotation.discount, hidden: quotation.discount === 0 },
            { label: "ภาษีมูลค่าเพิ่ม", amount: quotation.tax, hidden: quotation.tax === 0 },
          ]}
          grandLabel="จำนวนเงินรวมทั้งสิ้น"
          grandAmount={quotation.totalAmount}
        />
        <BahtTextBox amount={quotation.totalAmount} />

        {quotation.terms && <NotesBlock title="เงื่อนไข">{quotation.terms}</NotesBlock>}
        {quotation.notes && <NotesBlock title="หมายเหตุ">{quotation.notes}</NotesBlock>}

        <SignatureRow labels={["ผู้เสนอราคา", "ผู้อนุมัติสั่งซื้อ"]} />
      </PrintPage>
    </div>
  );
}
