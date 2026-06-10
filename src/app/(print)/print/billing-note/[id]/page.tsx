// หน้าพิมพ์ใบวางบิล — รวมใบแจ้งหนี้ค้างชำระของลูกค้าเพื่อเรียกเก็บตามรอบ
// ไม่ใช่เอกสารภาษี (ใบเดียวพอ ไม่ต้องต้นฉบับ+สำเนา) · ใบ voided พิมพ์ได้พร้อมลายน้ำ "ยกเลิก"
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
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
  VoidWatermark,
  formatDocDate,
} from "@/components/print/print-document";
import { PrintActions } from "@/components/print/print-actions";

const INVOICE_TYPE_SHORT: Record<string, string> = {
  DEPOSIT_INVOICE: "ใบแจ้งหนี้ (มัดจำ)",
  FINAL_INVOICE: "ใบแจ้งหนี้",
  DEBIT_NOTE: "ใบเพิ่มหนี้",
};

export default async function PrintBillingNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [note, companySetting] = await Promise.all([
    prisma.billingNote.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            invoice: {
              select: {
                invoiceNumber: true,
                type: true,
                createdAt: true,
                dueDate: true,
                totalAmount: true,
                order: { select: { orderNumber: true } },
              },
            },
          },
        },
      },
    }),
    prisma.setting.findUnique({ where: { key: COMPANY_PROFILE_KEY } }),
  ]);
  if (!note) notFound();

  const company = parseCompanyProfile(companySetting?.value);

  return (
    <div className="print-viewport">
      <PrintActions backHref="/billing/notes" />

      <PrintPage>
        {note.isVoided && <VoidWatermark />}

        <DocHeader
          company={company}
          title="ใบวางบิล"
          subtitle="BILLING NOTE"
          docNumber={note.billingNoteNumber}
          docDate={note.billingDate}
          refLines={
            note.dueDate
              ? [{ label: "นัดรับชำระ", value: formatDocDate(note.dueDate) }]
              : []
          }
        />

        <PartyBlock
          label="วางบิลถึง"
          name={note.customer.name}
          company={note.customer.company}
          address={note.customer.billingAddress || note.customer.address}
          taxId={note.customer.taxId}
          branch={
            note.customer.branchNumber
              ? note.customer.branchNumber === "00000"
                ? "สำนักงานใหญ่"
                : `สาขา ${note.customer.branchNumber}`
              : undefined
          }
          phone={note.customer.phone}
        />

        <ItemsTable
          rows={note.items.map((item) => ({
            description: `${INVOICE_TYPE_SHORT[item.invoice.type] ?? item.invoice.type} ${item.invoice.invoiceNumber} — อ้างอิงออเดอร์ ${item.invoice.order.orderNumber}\nลงวันที่ ${formatDocDate(item.invoice.createdAt)}${item.invoice.dueDate ? ` · ครบกำหนด ${formatDocDate(item.invoice.dueDate)}` : ""}`,
            amount: item.amount,
          }))}
        />

        <TotalsBlock
          rows={[]}
          grandLabel="ยอดเรียกเก็บรวม"
          grandAmount={note.totalAmount}
        />
        <BahtTextBox amount={note.totalAmount} />
        <p className="mt-1 text-right text-[11px] text-slate-500">
          ยอดในเอกสารเป็นยอดคงเหลือ ณ วันที่วางบิล ({formatDocDate(note.billingDate)})
        </p>

        {note.notes && <NotesBlock title="หมายเหตุ">{note.notes}</NotesBlock>}
        {note.isVoided && note.voidedReason && (
          <NotesBlock title="เหตุผลที่ยกเลิก">{note.voidedReason}</NotesBlock>
        )}

        <SignatureRow labels={["ผู้วางบิล", "ผู้รับวางบิล"]} />
      </PrintPage>
    </div>
  );
}
