"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PAYMENT_TERMS_LABELS } from "@/lib/payment-terms";
import { customerProfileGaps } from "@/lib/customer-gaps";
import { INVOICE_TYPE_LABELS } from "@/lib/invoice-labels";
import { receiptAmounts } from "@/lib/billing-ui";
import { Receipt } from "lucide-react";
import type { InvoiceType } from "@prisma/client";
import type { RouterOutput } from "@/lib/trpc";

type Invoice = RouterOutput["billing"]["listByOrder"][number];
type Payment = Invoice["payments"][number];
// ชนิดบิลที่เปิดจากหน้านี้ได้ — QUOTATION มีระบบใบเสนอราคาแยก ไม่รับใน billing.create
type BillableInvoiceType = Exclude<InvoiceType, "QUOTATION">;

// dialog สร้างบิล — แตกจาก order-billing-section · conditional mount ตามกติกาใน
// ui/dialog.tsx: ฟอร์ม seed จาก props ใน useState initializer ปิดแล้ว React ล้างให้เอง
// (เดิมต้องพึ่ง resetCreateForm มือ + openReceiptForPayment ตั้งค่าไขว้กันในไฟล์แม่)
//
// เปิดได้ 2 โหมด — parent เก็บเป็น discriminated union เดียว (mode: "create" | "receipt")
// เพราะเป็น dialog ตัวเดียวกันที่ seed ต่างกัน ไม่ใช่ 2 dialog:
// · "create" (receiptFor = null) = สร้างบิลปกติ ยอด/ชนิด/ครบกำหนด prefill จาก billing.suggest
// · "receipt" (receiptFor = งวดรับเงิน) = ออกใบเสร็จ/ใบกำกับให้งวด (Gate B3) — prefill
//   ฐาน+VAT ด้วย "สัดส่วนภาษีของใบที่ถูกชำระ" (ไม่ใช่ taxRate ปัจจุบันของออเดอร์ —
//   ใบเก่า/ใบแก้ tax มืออาจไม่ตรงกัน) · server บังคับยอดรวมต้องเท่างวดเป๊ะอีกชั้น
//   ต้องได้ payment+invoice ทั้ง object เพราะ receiptAmounts คิดจากใบที่ถูกชำระจริง
export function CreateInvoiceDialog({
  orderId,
  customerId,
  canBill,
  invoices,
  receiptFor,
  onClose,
}: {
  orderId: string;
  customerId: string;
  /** สิทธิ์ manage_billing_docs (parent มี me query อยู่แล้ว) — gate query ในไฟล์นี้ */
  canBill: boolean;
  /** บิลทั้งหมดของออเดอร์ (parent โหลดอยู่แล้ว) — ใช้เลือกใบต้นทางของ CN/DN */
  invoices: Invoice[];
  /** โหมดใบเสร็จของงวดรับเงิน — null = โหมดสร้างบิลปกติ */
  receiptFor: { payment: Payment; invoice: Invoice } | null;
  onClose: () => void;
}) {
  // seed ครั้งเดียวตอน mount (conditional mount = เปิดใหม่ได้ค่าสดเสมอ)
  const [seed] = useState(() => {
    if (!receiptFor) return null;
    const amounts = receiptAmounts({
      invoice: receiptFor.invoice,
      payment: receiptFor.payment,
    });
    return { payment: receiptFor.payment, amounts };
  });

  const [invoiceType, setInvoiceType] = useState(seed ? "RECEIPT" : "DEPOSIT_INVOICE");
  // null = ยังไม่เลือกเอง — ให้ server แนะนำชนิดบิลตามเงื่อนไขชำระของออเดอร์
  const [chosenType, setChosenType] = useState<string | null>(seed ? "RECEIPT" : null);
  // field ที่ผู้ใช้แตะแล้ว — prefill จาก suggest ห้ามทับ (response มาช้าทับของที่พิมพ์ไม่ได้)
  // โหมดใบเสร็จ: กัน suggest ที่มาช้าทับค่างวด — ค่านี้มาจากเงินรับจริง ห้ามขยับ
  const [userEdited, setUserEdited] = useState(
    seed
      ? { amount: true, tax: true, dueDate: true }
      : { amount: false, tax: false, dueDate: false }
  );
  const [invoiceAmount, setInvoiceAmount] = useState(
    seed ? seed.amounts.amount.toFixed(2) : ""
  );
  const [invoiceDiscount, setInvoiceDiscount] = useState("0");
  const [invoiceTax, setInvoiceTax] = useState(seed ? seed.amounts.tax.toFixed(2) : "0");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  // ใบลดหนี้/เพิ่มหนี้ต้องอ้างใบเดิม + เหตุผล (ม.86/10 — server บังคับ · Gate B1)
  const [originalInvoiceId, setOriginalInvoiceId] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  // ใบเสร็จของงวดรับเงิน (Gate B3) — วันที่เอกสารจะเป็นวันรับเงินจริง (server ตั้งให้)
  const [receiptForPayment, setReceiptForPayment] = useState<{
    id: string;
    gross: number;
    date: string | Date;
  } | null>(
    seed
      ? { id: seed.payment.id, gross: seed.amounts.gross, date: seed.payment.createdAt }
      : null
  );
  // วันที่เอกสาร default = วันบันทึกรับเงิน — แก้เป็นวันเงินเข้าจริงได้ (บันทึกข้ามวัน)
  const [receiptIssueDate, setReceiptIssueDate] = useState(
    seed ? new Date(seed.payment.createdAt).toISOString().slice(0, 10) : ""
  );

  const utils = trpc.useUtils();

  // ด่านนุ่มเอกสารภาษี: ใบเสร็จ/ใบกำกับต้องมีชื่อ-ที่อยู่ลูกค้าจริง (ม.86/4)
  // — ลูกค้าแชทที่ยังไม่เติมโปรไฟล์จะได้เอกสารหัวโหว่ เตือนก่อนพิมพ์
  // (mount = dialog เปิดอยู่เสมอ — เหลือ gate ด้วยสิทธิ์อย่างเดียว)
  const billCustomer = trpc.customer.getById.useQuery(
    { id: customerId },
    { enabled: canBill }
  );

  // ยอดแนะนำตามเงื่อนไขชำระของออเดอร์ — ไม่ส่ง type = ให้ server เลือกชนิดบิลให้ด้วย
  const suggestion = trpc.billing.suggest.useQuery(
    {
      orderId,
      type: (chosenType ?? undefined) as BillableInvoiceType | undefined,
    },
    { enabled: canBill }
  );

  // prefill เมื่อคำแนะนำสดมาถึง (เปิด dialog / เปลี่ยนชนิดบิล) — ข้ามระหว่าง refetch
  // (กัน cache เก่า prefill ชั่วคราว) และไม่ทับ field ที่ผู้ใช้แตะแล้ว
  useEffect(() => {
    const s = suggestion.data;
    if (!s || suggestion.isFetching) return;
    if (chosenType === null) setInvoiceType(s.type);
    if (!userEdited.amount) setInvoiceAmount(s.amount > 0 ? String(s.amount) : "");
    if (!userEdited.tax) setInvoiceTax(String(s.tax));
    if (!userEdited.dueDate) setInvoiceDueDate(s.dueDate ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion.data, suggestion.isFetching]);

  // ภาษีตามฐานใหม่เมื่อผู้ใช้แก้ยอด/ส่วนลด — ใบกำกับใช้ amount-discount เป็นฐานและ tax เป็น
  // VAT ตรงๆ ถ้าไม่คิดใหม่ VAT จะค้างของยอดเดิม · หยุดเมื่อผู้ใช้แก้ช่องภาษีเองแล้ว
  function recomputeTax(amountStr: string, discountStr: string, taxEdited: boolean) {
    if (taxEdited) return;
    const rate = suggestion.data?.taxRate ?? 0;
    const base = (parseFloat(amountStr) || 0) - (parseFloat(discountStr) || 0);
    setInvoiceTax(rate > 0 && base > 0 ? (Math.round(base * rate) / 100).toFixed(2) : "0");
  }

  const createInvoice = useMutationWithInvalidation(trpc.billing.create, {
    invalidate: [utils.billing.listByOrder, utils.order.getById, utils.billing.suggest],
    onSuccess: onClose,
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "สร้างบิลไม่สำเร็จ");
    },
  });

  const isAdjustmentType = invoiceType === "CREDIT_NOTE" || invoiceType === "DEBIT_NOTE";
  // ใบต้นทางที่ CN/DN อ้างได้ — ใบกำกับ/ใบแจ้งหนี้ที่ยังใช้งานอยู่ (ห้ามอ้าง CN/DN ต่อกัน)
  const adjustableOriginals = invoices.filter(
    (inv) =>
      !inv.isVoided && ["DEPOSIT_INVOICE", "FINAL_INVOICE", "RECEIPT"].includes(inv.type)
  );
  const adjustmentIncomplete =
    isAdjustmentType && (!originalInvoiceId || !adjustmentReason.trim());

  function handleCreateInvoice() {
    createInvoice.mutate({
      orderId,
      customerId,
      type: invoiceType as BillableInvoiceType,
      amount: parseFloat(invoiceAmount) || 0,
      discount: parseFloat(invoiceDiscount) || 0,
      tax: parseFloat(invoiceTax) || 0,
      dueDate: invoiceDueDate || undefined,
      notes: invoiceNotes || undefined,
      originalInvoiceId: isAdjustmentType ? originalInvoiceId : undefined,
      adjustmentReason: isAdjustmentType ? adjustmentReason.trim() : undefined,
      forPaymentId:
        invoiceType === "RECEIPT" && receiptForPayment ? receiptForPayment.id : undefined,
      issueDate:
        invoiceType === "RECEIPT" && receiptForPayment && receiptIssueDate
          ? receiptIssueDate
          : undefined,
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>สร้างบิลใหม่</DialogTitle>
          <DialogDescription>
            สร้างใบแจ้งหนี้สำหรับออเดอร์นี้
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="billing-invoice-type">ประเภทบิล</Label>
            <Select value={invoiceType}
              onChange={(e) => {
                setInvoiceType(e.target.value);
                setChosenType(e.target.value); // เปลี่ยนชนิด → suggest คำนวณยอดใหม่ให้ตามชนิดนั้น
                setUserEdited({ amount: false, tax: false, dueDate: false });
                setReceiptForPayment(null); // เปลี่ยนชนิดเอง = เลิกผูกงวดรับเงิน
              }} id="billing-invoice-type">
                {(
                  [
                    "DEPOSIT_INVOICE",
                    "FINAL_INVOICE",
                    "RECEIPT",
                    "CREDIT_NOTE",
                    "DEBIT_NOTE",
                  ] as const
                ).map((t) => (
                  <option key={t} value={t}>
                    {INVOICE_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            {invoiceType === "RECEIPT" && receiptForPayment && (
              <div className="mt-1.5 space-y-2">
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  ออกเป็นใบกำกับของงวดรับเงินวันที่ {formatDate(receiptForPayment.date)} ยอด{" "}
                  {formatCurrency(receiptForPayment.gross)} — ยอดใบต้องเท่างวดเป๊ะ
                  (server ตรวจอีกชั้น)
                </p>
                <Field
                  label="วันที่เอกสาร (tax point)"
                  description="ตามกฎหมาย = วันรับเงินจริง — แก้ได้เคสบันทึกย้อนหลัง (เงินเข้าแบงก์คนละวันกับวันบันทึก)"
                >
                  <DatePicker
                    value={receiptIssueDate}
                    onChange={(v) => setReceiptIssueDate(v)}
                  />
                </Field>
              </div>
            )}
            {suggestion.data &&
              (suggestion.data.paymentTerms || suggestion.data.remaining !== null) && (
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                {suggestion.data.paymentTerms && (
                  <>
                    เงื่อนไขชำระ:{" "}
                    {PAYMENT_TERMS_LABELS[suggestion.data.paymentTerms] ??
                      suggestion.data.paymentTerms}
                    {" · "}
                  </>
                )}
                {suggestion.data.remaining !== null &&
                  `คงเหลือวางบิลได้ ${formatCurrency(suggestion.data.remaining)}`}
              </p>
            )}
            {suggestion.data && suggestion.data.creditNoteTotal > 0 && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                มีใบลดหนี้ที่ยังไม่ผูกใบเดิมรวม{" "}
                {formatCurrency(suggestion.data.creditNoteTotal)} — ระบบหักให้อัตโนมัติไม่ได้
                ตรวจยอดก่อนสร้างบิล (ใบลดหนี้ที่ผูกใบเดิมถูกหักจากยอดค้างแล้ว)
              </p>
            )}
            {isAdjustmentType && (
              <div className="mt-3 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="billing-original-invoice">
                    อ้างอิงใบกำกับ/ใบแจ้งหนี้เดิม
                    <span aria-hidden="true" className="ml-1 text-red-700 dark:text-red-400">*</span>
                    <span className="sr-only"> (จำเป็น)</span>
                  </Label>
                  <Select value={originalInvoiceId} onChange={(e) => setOriginalInvoiceId(e.target.value)} id="billing-original-invoice" aria-required="true" placeholder="เลือกใบที่ต้องการลด/เพิ่มหนี้">
                      {adjustableOriginals.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoiceNumber} · {INVOICE_TYPE_LABELS[inv.type] ?? inv.type} ·{" "}
                          {formatCurrency(inv.totalAmount)}
                        </option>
                      ))}
                    </Select>
                  {adjustableOriginals.length === 0 ? (
                    <p className="mt-1 text-xs text-red-500">
                      ออเดอร์นี้ยังไม่มีใบกำกับ/ใบแจ้งหนี้ให้อ้างอิง — ออกใบลดหนี้/เพิ่มหนี้ไม่ได้
                    </p>
                  ) : (
                    invoiceType === "CREDIT_NOTE" && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        อ้างใบแจ้งหนี้ = หักยอดค้างของใบนั้นให้อัตโนมัติ · อ้างใบเสร็จ
                        (ลดหนี้หลังรับเงินแล้ว) = ใช้คู่กับ &quot;บันทึกคืนเงิน&quot;
                      </p>
                    )
                  )}
                </div>
                <Field
                  label={`เหตุผลการ${invoiceType === "CREDIT_NOTE" ? "ลดหนี้" : "เพิ่มหนี้"}`}
                  required
                  description="จะพิมพ์บนเอกสารตามข้อกำหนดใบลดหนี้/เพิ่มหนี้ (ม.86/10)"
                >
                  <Input
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    placeholder={
                      invoiceType === "CREDIT_NOTE"
                        ? "เช่น คืนสินค้าชำรุด 10 ตัว / ลดราคาตามตกลง"
                        : "เช่น ค่างานเพิ่มหลังยืนยันแบบ"
                    }
                  />
                </Field>
              </div>
            )}
            {["RECEIPT", "CREDIT_NOTE", "DEBIT_NOTE"].includes(invoiceType) &&
              billCustomer.data &&
              customerProfileGaps(billCustomer.data).some(
                (g) => g.key === "address" || g.key === "taxInfo"
              ) && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  เอกสารภาษีต้องมีชื่อ-ที่อยู่ลูกค้า — รายนี้ยัง{" "}
                  {customerProfileGaps(billCustomer.data)
                    .filter((g) => g.key === "address" || g.key === "taxInfo")
                    .map((g) => g.label)
                    .join(" · ")}{" "}
                  <a
                    href={`/customers/${customerId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium underline"
                  >
                    ไปเติมข้อมูล
                  </a>
                </p>
              )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="จำนวนเงิน (บาท)">
              <Input
                type="number"
                value={invoiceAmount}
                onChange={(e) => {
                  setUserEdited((prev) => ({ ...prev, amount: true }));
                  setInvoiceAmount(e.target.value);
                  recomputeTax(e.target.value, invoiceDiscount, userEdited.tax);
                }}
                min="0"
                step="0.01"
              />
            </Field>
            <Field label="ส่วนลด">
              <Input
                type="number"
                value={invoiceDiscount}
                onChange={(e) => {
                  setInvoiceDiscount(e.target.value);
                  recomputeTax(invoiceAmount, e.target.value, userEdited.tax);
                }}
                min="0"
                step="0.01"
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="ภาษี">
              <Input
                type="number"
                value={invoiceTax}
                onChange={(e) => {
                  setUserEdited((prev) => ({ ...prev, tax: true }));
                  setInvoiceTax(e.target.value);
                }}
                min="0"
                step="0.01"
              />
            </Field>
            {/* ครบกำหนดมีเฉพาะใบเรียกเก็บ — ใบเสร็จ/ใบลดหนี้ไม่มีสถานะค้างชำระ
                (server ทิ้งค่านี้อยู่แล้ว — ซ่อนช่องกันเข้าใจผิด) */}
            {!["RECEIPT", "CREDIT_NOTE"].includes(invoiceType) && (
              <Field label="ครบกำหนด">
                <DatePicker
                  value={invoiceDueDate}
                  onChange={(v) => {
                    setUserEdited((prev) => ({ ...prev, dueDate: true }));
                    setInvoiceDueDate(v);
                  }}
                />
              </Field>
            )}
          </div>
          <Field label="หมายเหตุ">
            <Textarea
              value={invoiceNotes}
              onChange={(e) => setInvoiceNotes(e.target.value)}
              rows={2}
              placeholder="หมายเหตุเพิ่มเติม..."
            />
          </Field>
          <div className="rounded-xl bg-blue-50 p-3 text-sm dark:bg-blue-950/30">
            <span className="text-slate-600 dark:text-slate-400">ยอดรวมบิล: </span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {formatCurrency(
                (parseFloat(invoiceAmount) || 0) -
                  (parseFloat(invoiceDiscount) || 0) +
                  (parseFloat(invoiceTax) || 0)
              )}
            </span>
          </div>
        </div>
        <DialogSubmitFooter
          pending={createInvoice.isPending}
          disabled={!invoiceAmount || adjustmentIncomplete}
          submitLabel="สร้างบิล"
          submitIcon={<Receipt />}
          onCancel={onClose}
          onSubmit={handleCreateInvoice}
        />
      </DialogContent>
    </Dialog>
  );
}
