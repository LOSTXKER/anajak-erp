"use client";

import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { FileUpload } from "@/components/ui/file-upload";
import { ImageRemoveButton } from "@/components/ui/image-remove-button";
import { formatCurrency } from "@/lib/utils";
import { PAYMENT_METHODS, DEFAULT_PAYMENT_METHOD } from "@/lib/payment-methods";
import {
  cashAmountForRemaining,
  invoiceBalance,
  paymentSettlementPreview,
  suggestedWht,
} from "@/lib/billing-ui";
import { CreditCard } from "lucide-react";
import type { RouterOutput } from "@/lib/trpc";

type Invoice = RouterOutput["billing"]["listByOrder"][number];

// dialog บันทึกรับเงิน — แตกจาก order-billing-section · conditional mount ตามกติกา
// ใน ui/dialog.tsx: ฟอร์ม seed จาก props ตอน mount ปิดแล้ว React ล้างให้เอง
// (กันค่าหัก/สลิปค้างจากบิลก่อนหน้า — เดิมต้องพึ่ง resetPaymentForm มือ)
// รับ invoice ทั้ง object (parent หาให้จาก id) — ใช้คิด prefill หัก ณ ที่จ่าย + ยอดคงเหลือ
export function RecordPaymentDialog({
  orderId,
  invoice,
  onClose,
}: {
  orderId: string;
  invoice: Invoice;
  onClose: () => void;
}) {
  const payingRemaining = invoiceBalance(invoice).remaining;

  // prefill = คงเหลือของบิล
  const [paymentAmount, setPaymentAmount] = useState(payingRemaining.toString());
  const [paymentMethod, setPaymentMethod] = useState<string>(DEFAULT_PAYMENT_METHOD);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  // ผู้ใช้แตะช่องเงินสดเองแล้ว — prefill จากติ๊ก/แก้ยอดหักห้ามทับ (pattern userEdited ของ dialog สร้างบิล)
  const [paymentAmountEdited, setPaymentAmountEdited] = useState(false);
  // ลูกค้านิติบุคคลหัก ณ ที่จ่าย 3% ค่าจ้างทำของ — เงินสด 97% + เครดิตภาษี 3% เคลียร์บิลเต็ม
  const [whtEnabled, setWhtEnabled] = useState(false);
  const [whtAmount, setWhtAmount] = useState("");
  const [whtCertNumber, setWhtCertNumber] = useState("");
  const [whtCertDate, setWhtCertDate] = useState("");
  // สลิปโอนจากลูกค้า — อัปโหลดแล้วส่งเป็น evidenceUrl
  const [evidenceUrl, setEvidenceUrl] = useState("");

  const utils = trpc.useUtils();
  const recordPayment = useMutationWithInvalidation(trpc.billing.recordPayment, {
    invalidate: [utils.billing.listByOrder, utils.order.getById],
    onSuccess: onClose,
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "บันทึกการชำระเงินไม่สำเร็จ");
    },
  });

  function handleRecordPayment() {
    recordPayment.mutate({
      invoiceId: invoice.id,
      amount: parseFloat(paymentAmount) || 0,
      method: paymentMethod,
      reference: paymentReference || undefined,
      notes: paymentNotes || undefined,
      evidenceUrl: evidenceUrl || undefined,
      // ติ๊กหักเท่านั้นถึงส่ง — ปิด toggle แล้วค่าค้างในช่องต้องไม่หลุดไป server
      whtAmount: whtEnabled ? parseFloat(whtAmount) || 0 : 0,
      whtCertNumber: whtEnabled && whtCertNumber ? whtCertNumber : undefined,
      whtCertDate: whtEnabled && whtCertDate ? new Date(whtCertDate) : undefined,
    });
  }

  // มาตรฐานหัก 3% ของฐานก่อน VAT ของใบ (ค่าจ้างทำของ) — ปัด 2 ตำแหน่ง
  const whtSuggested = suggestedWht(invoice);
  const settlement = paymentSettlementPreview({
    cash: parseFloat(paymentAmount) || 0,
    wht: parseFloat(whtAmount) || 0,
    whtEnabled,
    remaining: payingRemaining,
  });
  const settleAmount = settlement.settled;
  const settleExceeds = settlement.exceedsRemaining;

  // เงินสดที่ลูกค้าโอน = คงเหลือ − ยอดหัก (ปัด 2 ตำแหน่ง กันเศษ float)
  const cashPrefill = (wht: number) =>
    cashAmountForRemaining(payingRemaining, wht).toString();

  // ติ๊กหัก ณ ที่จ่าย — prefill ยอดหัก 3% + ปรับช่องเงินสด = คงเหลือ−ยอดหัก (ถ้าผู้ใช้ยังไม่แก้เอง)
  function handleWhtToggle(checked: boolean) {
    setWhtEnabled(checked);
    if (checked) {
      setWhtAmount(whtSuggested > 0 ? whtSuggested.toFixed(2) : "");
      if (!paymentAmountEdited) setPaymentAmount(cashPrefill(whtSuggested));
    } else {
      setWhtAmount("");
      setWhtCertNumber("");
      setWhtCertDate("");
      if (!paymentAmountEdited) setPaymentAmount(cashPrefill(0));
    }
  }

  function handleWhtAmountChange(value: string) {
    setWhtAmount(value);
    if (!paymentAmountEdited) setPaymentAmount(cashPrefill(parseFloat(value) || 0));
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>บันทึกการชำระเงิน</DialogTitle>
          <DialogDescription>บันทึกยอดชำระเงินจากลูกค้า</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="จำนวนเงิน (บาท)">
            <Input
              type="number"
              value={paymentAmount}
              onChange={(e) => {
                setPaymentAmountEdited(true);
                setPaymentAmount(e.target.value);
              }}
              min="0"
              step="0.01"
            />
          </Field>
          {/* ลูกค้านิติบุคคลหักภาษี ณ ที่จ่าย 3% ค่าจ้างทำของ — โอนมา 97% + หนังสือรับรอง 3% */}
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="billing-wht-enabled">
                ลูกค้าหักภาษี ณ ที่จ่าย (นิติบุคคล)
              </Label>
              <Switch
                id="billing-wht-enabled"
                checked={whtEnabled}
                onCheckedChange={handleWhtToggle}
              />
            </div>
            {whtEnabled && (
              <div className="mt-3 space-y-3">
                <Field
                  label="ยอดที่หัก (บาท)"
                  description={`มาตรฐาน 3% ของฐานก่อน VAT = ${formatCurrency(whtSuggested)}`}
                >
                  <Input
                    type="number"
                    value={whtAmount}
                    onChange={(e) => handleWhtAmountChange(e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </Field>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="เลขที่หนังสือรับรอง">
                    <Input
                      type="text"
                      value={whtCertNumber}
                      onChange={(e) => setWhtCertNumber(e.target.value)}
                      placeholder="ถ้ามี"
                    />
                  </Field>
                  <Field label="วันที่ในใบ">
                    <DatePicker
                      value={whtCertDate}
                      onChange={(v) => setWhtCertDate(v)}
                    />
                  </Field>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ยังไม่ได้หนังสือรับรองก็เว้นว่างได้ — กรอกทีหลังได้ที่ทะเบียน 50ทวิ
                </p>
                <p
                  className={
                    settleExceeds
                      ? "text-xs font-medium text-red-600 dark:text-red-400"
                      : "text-xs text-slate-500 dark:text-slate-400"
                  }
                >
                  เงินสด {formatCurrency(parseFloat(paymentAmount) || 0)} + หัก ณ ที่จ่าย{" "}
                  {formatCurrency(parseFloat(whtAmount) || 0)} = เคลียร์บิล{" "}
                  {formatCurrency(settleAmount)} จากคงเหลือ {formatCurrency(payingRemaining)}
                  {settleExceeds && " — เกินยอดคงเหลือ บันทึกไม่ผ่าน"}
                </p>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing-payment-method">วิธีชำระ</Label>
            <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} id="billing-payment-method">
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
          </div>
          <Field label="เลขอ้างอิง">
            <Input
              type="text"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="เลขอ้างอิงหรือเลขที่ทำรายการ"
            />
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">
              สลิปโอน (ถ้ามี)
            </legend>
            {evidenceUrl ? (
              <div className="relative inline-block h-20 w-20">
                {/* <img> ธรรมดา — รูปเสิร์ฟผ่าน /api/files (เช็ค session)
                    next/image optimizer fetch ฝั่ง server ไม่มี cookie จะ 401 */}
                <img
                  src={evidenceUrl}
                  alt="สลิปโอน"
                  className="h-full w-full rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                />
                <ImageRemoveButton
                  onClick={() => setEvidenceUrl("")}
                  label="ลบรูปสลิปโอน"
                />
              </div>
            ) : (
              <FileUpload
                bucket="designs"
                pathPrefix={`payments/${orderId}`}
                accept="image/*"
                onUploaded={(url) => setEvidenceUrl(url)}
                onError={(msg) => toast.error(msg)}
              />
            )}
          </fieldset>
          <Field label="หมายเหตุ">
            <Textarea
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              rows={2}
              placeholder="หมายเหตุ..."
            />
          </Field>
        </div>
        <DialogSubmitFooter
          pending={recordPayment.isPending}
          // หักล้วนเงินสด 0 ก็บันทึกได้ (server รับแล้ว — เคสโอน 97% ไปก่อน ใบ 50ทวิ
          // ตามมาทีหลัง เคลียร์ 3% ด้วยหักล้วน) · ห้ามเฉพาะรวมแล้วไม่มียอดเคลียร์เลย
          disabled={settleAmount <= 0}
          submitLabel="บันทึก"
          submitIcon={<CreditCard />}
          onCancel={onClose}
          onSubmit={handleRecordPayment}
        />
      </DialogContent>
    </Dialog>
  );
}
