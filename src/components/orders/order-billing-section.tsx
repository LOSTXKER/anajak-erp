"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FileUpload } from "@/components/ui/file-upload";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { QueryError } from "@/components/ui/query-error";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_VARIANTS } from "@/lib/status-config";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, DEFAULT_PAYMENT_METHOD } from "@/lib/payment-methods";
import { PAYMENT_TERMS_LABELS } from "@/lib/payment-terms";
import { permAllows } from "@/lib/permissions";
import { customerProfileGaps } from "@/lib/customer-gaps";
import { INVOICE_TYPE_LABELS } from "@/lib/invoice-labels";
import {
  billingActionAvailability,
  billingOverview,
  canCreateInvoiceForOrder,
  canIssueReceiptForPayment,
  cashAmountForRemaining,
  invoiceBalance,
  paymentSettlementPreview,
  receiptAmounts,
  suggestedWht,
} from "@/lib/billing-ui";
import {
  Receipt,
  Plus,
  CreditCard,
  Loader2,
  ChevronDown,
  ChevronUp,
  Ban,
  Printer,
  DollarSign,
  Paperclip,
  Undo2,
  X,
} from "lucide-react";
import type { InvoiceType } from "@prisma/client";
import type { RouterOutput } from "@/lib/trpc";

type Invoice = RouterOutput["billing"]["listByOrder"][number];
type Payment = Invoice["payments"][number];
// ชนิดบิลที่เปิดจากหน้านี้ได้ — QUOTATION มีระบบใบเสนอราคาแยก ไม่รับใน billing.create
type BillableInvoiceType = Exclude<InvoiceType, "QUOTATION">;

interface OrderBillingSectionProps {
  orderId: string;
  customerId: string;
  totalAmount: number;
  internalStatus: string;
}

export function OrderBillingSection({
  orderId,
  customerId,
  totalAmount,
  internalStatus,
}: OrderBillingSectionProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState<string | null>(null);
  const [showVoidDialog, setShowVoidDialog] = useState<string | null>(null);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

  // Create invoice form state
  const [invoiceType, setInvoiceType] = useState("DEPOSIT_INVOICE");
  // null = ยังไม่เลือกเอง — ให้ server แนะนำชนิดบิลตามเงื่อนไขชำระของออเดอร์
  const [chosenType, setChosenType] = useState<string | null>(null);
  // field ที่ผู้ใช้แตะแล้ว — prefill จาก suggest ห้ามทับ (response มาช้าทับของที่พิมพ์ไม่ได้)
  const [userEdited, setUserEdited] = useState({ amount: false, tax: false, dueDate: false });
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDiscount, setInvoiceDiscount] = useState("0");
  const [invoiceTax, setInvoiceTax] = useState("0");
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
  } | null>(null);
  const [receiptIssueDate, setReceiptIssueDate] = useState("");

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState("");
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

  // Refund form state (คืนเงิน — server เก็บเป็น payment ยอดติดลบ · คู่กับใบลดหนี้)
  const [showRefundDialog, setShowRefundDialog] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState<string>(DEFAULT_PAYMENT_METHOD);
  const [refundReference, setRefundReference] = useState("");
  const [refundNotes, setRefundNotes] = useState("");

  // Void form state
  const [voidReason, setVoidReason] = useState("");

  const utils = trpc.useUtils();
  // สิทธิ์เปิดบิล — ตรงกับ billingStaff ฝั่ง server · ปิด query/ปุ่มสำหรับ role อื่น
  // (กันยิงไปโดน FORBIDDEN + retry ฟรี — pattern เดียวกับหน้า analytics)
  const me = trpc.user.me.useQuery();
  const canBill = permAllows(me.data?.permissions, "manage_billing_docs");
  // เห็นการ์ดบิล/ยอดรับชำระ — ตรงกับ gate ของ billing.listByOrder (Gate A2:
  // ช่าง/กราฟิกไม่เห็นเงินฝั่งขาย ทั้งการ์ดนี้และ order.getById)
  const canViewBilling = permAllows(me.data?.permissions, "see_order_money");
  // บันทึกรับเงิน/คืนเงิน/ยกเลิกบิล — ตรงกับ moneyRecorder ฝั่ง server (แคบกว่า canBill)
  const canRecordMoney = permAllows(me.data?.permissions, "record_payments");

  const invoices = trpc.billing.listByOrder.useQuery(
    { orderId },
    { enabled: canViewBilling }
  );

  // ด่านนุ่มเอกสารภาษี: ใบเสร็จ/ใบกำกับต้องมีชื่อ-ที่อยู่ลูกค้าจริง (ม.86/4)
  // — ลูกค้าแชทที่ยังไม่เติมโปรไฟล์จะได้เอกสารหัวโหว่ เตือนก่อนพิมพ์
  const billCustomer = trpc.customer.getById.useQuery(
    { id: customerId },
    { enabled: showCreateDialog && canBill }
  );

  // ยอดแนะนำตามเงื่อนไขชำระของออเดอร์ — ไม่ส่ง type = ให้ server เลือกชนิดบิลให้ด้วย
  const suggestion = trpc.billing.suggest.useQuery(
    {
      orderId,
      type: (chosenType ?? undefined) as BillableInvoiceType | undefined,
    },
    { enabled: showCreateDialog && canBill }
  );

  // prefill เมื่อคำแนะนำสดมาถึง (เปิด dialog / เปลี่ยนชนิดบิล) — ข้ามระหว่าง refetch
  // (กัน cache เก่า prefill ชั่วคราว) และไม่ทับ field ที่ผู้ใช้แตะแล้ว
  useEffect(() => {
    const s = suggestion.data;
    if (!showCreateDialog || !s || suggestion.isFetching) return;
    if (chosenType === null) setInvoiceType(s.type);
    if (!userEdited.amount) setInvoiceAmount(s.amount > 0 ? String(s.amount) : "");
    if (!userEdited.tax) setInvoiceTax(String(s.tax));
    if (!userEdited.dueDate) setInvoiceDueDate(s.dueDate ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion.data, suggestion.isFetching, showCreateDialog]);

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
    onSuccess: () => {
      setShowCreateDialog(false);
      resetCreateForm();
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "สร้างบิลไม่สำเร็จ");
    },
  });

  const recordPayment = useMutationWithInvalidation(trpc.billing.recordPayment, {
    invalidate: [utils.billing.listByOrder, utils.order.getById],
    onSuccess: () => {
      setShowPaymentDialog(null);
      resetPaymentForm();
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "บันทึกการชำระเงินไม่สำเร็จ");
    },
  });

  const voidInvoice = useMutationWithInvalidation(trpc.billing.voidInvoice, {
    invalidate: [utils.billing.listByOrder, utils.order.getById, utils.billing.suggest],
    onSuccess: () => {
      setShowVoidDialog(null);
      setVoidReason("");
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "ยกเลิกบิลไม่สำเร็จ");
    },
  });

  const recordRefund = useMutationWithInvalidation(trpc.billing.recordRefund, {
    invalidate: [utils.billing.listByOrder, utils.order.getById],
    onSuccess: () => {
      setShowRefundDialog(null);
      resetRefundForm();
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "บันทึกคืนเงินไม่สำเร็จ");
    },
  });

  function resetCreateForm() {
    setInvoiceType("DEPOSIT_INVOICE");
    setChosenType(null);
    setUserEdited({ amount: false, tax: false, dueDate: false });
    setInvoiceAmount("");
    setInvoiceDiscount("0");
    setInvoiceTax("0");
    setInvoiceDueDate("");
    setInvoiceNotes("");
    setOriginalInvoiceId("");
    setAdjustmentReason("");
    setReceiptForPayment(null);
    setReceiptIssueDate("");
  }

  // เปิด dialog ออกใบเสร็จ/ใบกำกับให้งวดรับเงิน — prefill ฐาน+VAT ด้วย "สัดส่วนภาษีของ
  // ใบที่ถูกชำระ" (ไม่ใช่ taxRate ปัจจุบันของออเดอร์ — ใบเก่า/ใบแก้ tax มืออาจไม่ตรงกัน)
  // server บังคับยอดรวมต้องเท่างวดเป๊ะอีกชั้น
  function openReceiptForPayment(p: Payment, inv: Invoice) {
    resetCreateForm();
    const amounts = receiptAmounts({ invoice: inv, payment: p });
    setInvoiceType("RECEIPT");
    setChosenType("RECEIPT");
    // กัน suggest ที่มาช้าทับค่างวด — ค่านี้มาจากเงินรับจริง ห้ามขยับ
    setUserEdited({ amount: true, tax: true, dueDate: true });
    setInvoiceAmount(amounts.amount.toFixed(2));
    setInvoiceTax(amounts.tax.toFixed(2));
    setReceiptForPayment({ id: p.id, gross: amounts.gross, date: p.createdAt });
    // วันที่เอกสาร default = วันบันทึกรับเงิน — แก้เป็นวันเงินเข้าจริงได้ (บันทึกข้ามวัน)
    setReceiptIssueDate(new Date(p.createdAt).toISOString().slice(0, 10));
    setShowCreateDialog(true);
  }

  function resetPaymentForm() {
    setPaymentAmount("");
    setPaymentMethod(DEFAULT_PAYMENT_METHOD);
    setPaymentReference("");
    setPaymentNotes("");
    setPaymentAmountEdited(false);
    setWhtEnabled(false);
    setWhtAmount("");
    setWhtCertNumber("");
    setWhtCertDate("");
    setEvidenceUrl("");
  }

  function resetRefundForm() {
    setRefundAmount("");
    setRefundMethod(DEFAULT_PAYMENT_METHOD);
    setRefundReference("");
    setRefundNotes("");
  }

  function handleRecordRefund() {
    if (!showRefundDialog) return;
    recordRefund.mutate({
      invoiceId: showRefundDialog,
      amount: parseFloat(refundAmount) || 0,
      method: refundMethod,
      reference: refundReference || undefined,
      notes: refundNotes || undefined,
    });
  }

  const isAdjustmentType = invoiceType === "CREDIT_NOTE" || invoiceType === "DEBIT_NOTE";
  // ใบต้นทางที่ CN/DN อ้างได้ — ใบกำกับ/ใบแจ้งหนี้ที่ยังใช้งานอยู่ (ห้ามอ้าง CN/DN ต่อกัน)
  const adjustableOriginals = (invoices.data || []).filter(
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

  function handleRecordPayment() {
    if (!showPaymentDialog) return;
    recordPayment.mutate({
      invoiceId: showPaymentDialog,
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

  function openCreateDialog() {
    // ยอด/ชนิดบิล/วันครบกำหนด prefill จาก billing.suggest ตามเงื่อนไขชำระของออเดอร์
    resetCreateForm();
    setShowCreateDialog(true);
  }

  const {
    totalInvoiced,
    totalPaid,
    totalOutstanding,
    pendingReceiptCount,
    unlinkedReceiptCount,
    hasLiveReceivable,
  } = billingOverview(invoices.data || []);
  const canCreateInvoice = canCreateInvoiceForOrder(internalStatus);

  // บิลที่ dialog บันทึกชำระเปิดอยู่ — ใช้คิด prefill หัก ณ ที่จ่าย + ยอดคงเหลือ
  const payingInvoice = (invoices.data || []).find((inv) => inv.id === showPaymentDialog);

  const payingRemaining = payingInvoice ? invoiceBalance(payingInvoice).remaining : 0;
  // มาตรฐานหัก 3% ของฐานก่อน VAT ของใบ (ค่าจ้างทำของ) — ปัด 2 ตำแหน่ง
  const whtSuggested = suggestedWht(payingInvoice ?? null);
  const settlement = paymentSettlementPreview({
    cash: parseFloat(paymentAmount) || 0,
    wht: parseFloat(whtAmount) || 0,
    whtEnabled,
    remaining: payingRemaining,
  });
  const settleAmount = settlement.settled;
  const settleExceeds = !!payingInvoice && settlement.exceedsRemaining;

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

  // ช่าง/กราฟิกไม่เห็นการ์ดบิลทั้งใบ (Gate A2 — server ก็ gate listByOrder ไว้แล้ว
  // การ์ดเปล่าๆ ที่ query โดน FORBIDDEN มีแต่สร้างความงง) · me ยังไม่มา = ยังไม่ render
  if (me.isError) {
    return <QueryError message="โหลดสิทธิ์ดูข้อมูลบิลไม่สำเร็จ" onRetry={() => void me.refetch()} />;
  }
  if (!canViewBilling) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4" />
              บิล/การชำระเงิน
            </CardTitle>
            {canCreateInvoice && canBill && (
              <Button
                size="sm"
                onClick={openCreateDialog}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                สร้างบิล
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary */}
          <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-4 dark:bg-slate-800/50">
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">ยอดรวม</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {formatCurrency(totalAmount)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">วางบิลแล้ว</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {formatCurrency(totalInvoiced)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">ชำระแล้ว</p>
              <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(totalPaid)}
              </p>
            </div>
            {/* เลขที่คนหน้างานถามบ่อยสุด "เหลือเก็บอีกเท่าไร" — แดงเมื่อยังค้าง (UX4) */}
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">ค้างชำระ</p>
              <p
                className={`text-sm font-semibold tabular-nums ${
                  totalOutstanding > 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-slate-900 dark:text-white"
                }`}
              >
                {formatCurrency(totalOutstanding)}
              </p>
            </div>
          </div>

          {/* เตือนเฉพาะคนที่ออกใบได้ (canBill) — role อื่นเห็นแต่ทำอะไรไม่ได้ ชวนงง */}
          {canBill && pendingReceiptCount > 0 && (
            <p className="mb-3 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
              มี {pendingReceiptCount} งวดรับเงินที่ยังไม่ออกใบเสร็จ/ใบกำกับภาษี —
              งานจ้างทำของต้องออกทุกงวดรับเงิน (กดปุ่มที่งวดนั้นเพื่อออกได้เลย)
              {unlinkedReceiptCount > 0 &&
                ` · ⚠ มีใบเสร็จที่ไม่ได้ผูกงวด ${unlinkedReceiptCount} ใบ — ตรวจก่อนว่าใบนั้นคือใบของงวดไหน กันออกซ้ำ`}
            </p>
          )}

          {/* Invoice list */}
          {invoices.isError && !invoices.data?.length ? (
            <QueryError
              message="โหลดข้อมูลบิลไม่สำเร็จ"
              onRetry={() => void invoices.refetch()}
            />
          ) : invoices.isPending ? (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              กำลังโหลดข้อมูลบิล
            </div>
          ) : !invoices.data || invoices.data.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              ยังไม่มีบิล
            </p>
          ) : (
            <div className="space-y-2">
              {invoices.data.map((inv) => {
                const isExpanded = expandedInvoice === inv.id;
                const balance = invoiceBalance(inv);
                const actions = billingActionAvailability({
                  invoice: inv,
                  netCash: balance.netCash,
                  canRecordMoney,
                  hasLiveReceivable,
                });

                return (
                  <div
                    key={inv.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex items-stretch gap-1 p-1">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={`invoice-details-${inv.id}`}
                        className="flex min-h-11 min-w-0 flex-1 touch-manipulation flex-col items-stretch justify-between gap-2 rounded-md px-2 py-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 sm:flex-row sm:items-center dark:hover:bg-slate-800/50"
                        onClick={() => setExpandedInvoice(isExpanded ? null : inv.id)}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                              {inv.invoiceNumber}
                            </span>
                            <Badge variant="secondary">
                              {INVOICE_TYPE_LABELS[inv.type] || inv.type}
                            </Badge>
                            <Badge
                              variant={
                                PAYMENT_STATUS_VARIANTS[
                                  inv.paymentStatus as keyof typeof PAYMENT_STATUS_VARIANTS
                                ] || "default"
                              }
                            >
                              {PAYMENT_STATUS_LABELS[
                                inv.paymentStatus as keyof typeof PAYMENT_STATUS_LABELS
                              ] || inv.paymentStatus}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500">
                            {/* วันที่เอกสารตามกฎหมาย (ใบผูกงวด = วันรับเงิน) — ตรงกับใบพิมพ์ */}
                            {inv.issueDate
                              ? formatDate(inv.issueDate)
                              : formatDateTime(inv.createdAt)}
                            {/* dueDate เก็บเป็น UTC midnight ของวันปฏิทินไทย — โชว์เวลาด้วยจะได้ 07:00 ปลอม */}
                            {inv.dueDate && ` | ครบกำหนด: ${formatDate(inv.dueDate)}`}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-2 sm:justify-end">
                          <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                            {formatCurrency(inv.totalAmount)}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          )}
                        </div>
                      </button>
                      <a
                        href={`/print/invoice/${inv.id}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`พิมพ์หรือเปิด PDF ${inv.invoiceNumber}`}
                        title="พิมพ์ / PDF"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 sm:h-9 sm:w-9 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </a>
                    </div>

                    {isExpanded && (
                      <div
                        id={`invoice-details-${inv.id}`}
                        className="border-t border-slate-100 p-3 dark:border-slate-700"
                      >
                        {/* Invoice details */}
                        <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-slate-500">ยอดเงิน</span>
                            <p className="font-medium">{formatCurrency(inv.amount)}</p>
                          </div>
                          {inv.discount > 0 && (
                            <div>
                              <span className="text-slate-500">ส่วนลด</span>
                              <p className="font-medium">-{formatCurrency(inv.discount)}</p>
                            </div>
                          )}
                          {inv.tax > 0 && (
                            <div>
                              <span className="text-slate-500">ภาษี</span>
                              <p className="font-medium">+{formatCurrency(inv.tax)}</p>
                            </div>
                          )}
                        </div>

                        {inv.notes && (
                          <p className="mb-3 text-xs text-slate-500">
                            {inv.notes}
                          </p>
                        )}

                        {/* Payments */}
                        {inv.payments && inv.payments.length > 0 && (
                          <div className="mb-3 space-y-1.5">
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                              การชำระเงิน
                            </p>
                            {inv.payments.map((p) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between rounded-md bg-green-50 px-2 py-1.5 text-xs dark:bg-green-950/30"
                              >
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <DollarSign className="h-3 w-3 text-green-600" />
                                  <span className="text-slate-700 dark:text-slate-300">
                                    {PAYMENT_METHOD_LABELS[p.method] || p.method}
                                  </span>
                                  {p.reference && (
                                    <span className="text-slate-400">
                                      #{p.reference}
                                    </span>
                                  )}
                                  {p.whtAmount > 0 && (
                                    <Badge variant="outline" size="sm">
                                      หัก ณ ที่จ่าย {formatCurrency(p.whtAmount)}
                                    </Badge>
                                  )}
                                  {p.evidenceUrl && (
                                    <a
                                      href={p.evidenceUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      aria-label={`ดูสลิปของรายการชำระ ${formatCurrency(p.amount)}`}
                                      className="flex h-11 w-11 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 sm:h-9 sm:w-9 dark:hover:bg-slate-900 dark:hover:text-blue-400"
                                      title="ดูสลิปโอน"
                                    >
                                      <Paperclip className="h-3 w-3" />
                                    </a>
                                  )}
                                  {/* tax point (Gate B3): งวดออกใบกำกับแล้ว = badge ·
                                      ยังไม่ออก (เฉพาะใบเรียกเก็บ) = ปุ่มออกทันที prefill ครบ */}
                                  {p.receiptInvoice && !p.receiptInvoice.isVoided ? (
                                    <Badge variant="outline" size="sm">
                                      ใบกำกับ {p.receiptInvoice.invoiceNumber}
                                    </Badge>
                                  ) : canIssueReceiptForPayment({
                                      invoice: inv,
                                      payment: p,
                                      canBill,
                                    }) ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-1 px-2 text-[11px]"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openReceiptForPayment(p, inv);
                                      }}
                                    >
                                      <Receipt className="h-3 w-3" />
                                      ออกใบเสร็จ/ใบกำกับ
                                    </Button>
                                  ) : null}
                                </div>
                                <span className="font-medium text-green-700 dark:text-green-400">
                                  +{formatCurrency(p.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2">
                          {actions.canRecordPayment && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                // ล้างฟอร์มก่อน — กันค่าหัก/สลิปค้างจากบิลก่อนหน้า แล้ว prefill = คงเหลือ
                                resetPaymentForm();
                                setPaymentAmount(balance.remaining.toString());
                                setShowPaymentDialog(inv.id);
                              }}
                            >
                              <CreditCard className="h-3 w-3" />
                              บันทึกชำระ
                            </Button>
                          )}
                          {actions.canRecordRefund && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-500"
                              onClick={(e) => {
                                e.stopPropagation();
                                resetRefundForm();
                                setRefundAmount(balance.netCash.toString());
                                setShowRefundDialog(inv.id);
                              }}
                            >
                              <Undo2 className="h-3 w-3" />
                              คืนเงิน
                            </Button>
                          )}
                          {actions.canVoid && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-xs text-red-500 hover:text-red-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowVoidDialog(inv.id);
                              }}
                            >
                              <Ban className="h-3 w-3" />
                              ยกเลิกบิล
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
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
              <Select
                value={invoiceType}
                onValueChange={(v) => {
                  setInvoiceType(v);
                  setChosenType(v); // เปลี่ยนชนิด → suggest คำนวณยอดใหม่ให้ตามชนิดนั้น
                  setUserEdited({ amount: false, tax: false, dueDate: false });
                  setReceiptForPayment(null); // เปลี่ยนชนิดเอง = เลิกผูกงวดรับเงิน
                }}
              >
                <SelectTrigger id="billing-invoice-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    [
                      "DEPOSIT_INVOICE",
                      "FINAL_INVOICE",
                      "RECEIPT",
                      "CREDIT_NOTE",
                      "DEBIT_NOTE",
                    ] as const
                  ).map((t) => (
                    <SelectItem key={t} value={t}>
                      {INVOICE_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
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
                    <Input
                      type="date"
                      value={receiptIssueDate}
                      onChange={(e) => setReceiptIssueDate(e.target.value)}
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
                    <Select value={originalInvoiceId} onValueChange={setOriginalInvoiceId}>
                      <SelectTrigger id="billing-original-invoice" aria-required="true">
                        <SelectValue placeholder="เลือกใบที่ต้องการลด/เพิ่มหนี้" />
                      </SelectTrigger>
                      <SelectContent>
                        {adjustableOriginals.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>
                            {inv.invoiceNumber} · {INVOICE_TYPE_LABELS[inv.type] ?? inv.type} ·{" "}
                            {formatCurrency(inv.totalAmount)}
                          </SelectItem>
                        ))}
                      </SelectContent>
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
                  <Input
                    type="date"
                    value={invoiceDueDate}
                    onChange={(e) => {
                      setUserEdited((prev) => ({ ...prev, dueDate: true }));
                      setInvoiceDueDate(e.target.value);
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
            <div className="rounded-lg bg-blue-50 p-3 text-sm dark:bg-blue-950/30">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleCreateInvoice}
              disabled={!invoiceAmount || adjustmentIncomplete || createInvoice.isPending}
              className="gap-1.5"
            >
              {createInvoice.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Receipt className="h-4 w-4" />
              )}
              สร้างบิล
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog
        open={showPaymentDialog !== null}
        onOpenChange={(open) => !open && setShowPaymentDialog(null)}
      >
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
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
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
                      <Input
                        type="date"
                        value={whtCertDate}
                        onChange={(e) => setWhtCertDate(e.target.value)}
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
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="billing-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
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
                    className="h-full w-full rounded-md border border-slate-200 object-cover dark:border-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => setEvidenceUrl("")}
                    aria-label="ลบรูปสลิปโอน"
                    className="absolute -right-4 -top-4 flex h-11 w-11 touch-manipulation items-center justify-center rounded-full bg-red-700 text-white shadow-sm hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 sm:h-9 sm:w-9 dark:bg-red-600 dark:hover:bg-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
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
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPaymentDialog(null)}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleRecordPayment}
              // หักล้วนเงินสด 0 ก็บันทึกได้ (server รับแล้ว — เคสโอน 97% ไปก่อน ใบ 50ทวิ
              // ตามมาทีหลัง เคลียร์ 3% ด้วยหักล้วน) · ห้ามเฉพาะรวมแล้วไม่มียอดเคลียร์เลย
              disabled={settleAmount <= 0 || recordPayment.isPending}
              className="gap-1.5"
            >
              {recordPayment.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Dialog — คืนเงินให้ลูกค้า (server เก็บเป็น payment ยอดติดลบ · ลด totalSpent) */}
      <Dialog
        open={showRefundDialog !== null}
        onOpenChange={(open) => !open && setShowRefundDialog(null)}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>คืนเงินให้ลูกค้า</DialogTitle>
            <DialogDescription>
              บันทึกการคืนเงิน — คู่กับใบลดหนี้ที่ออกให้ลูกค้า (คืนได้ไม่เกินเงินที่รับไว้)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="จำนวนเงินคืน (บาท)">
              <Input
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                min="0"
                step="0.01"
              />
            </Field>
            <div className="space-y-2">
              <Label htmlFor="billing-refund-method">วิธีคืนเงิน</Label>
              <Select value={refundMethod} onValueChange={setRefundMethod}>
                <SelectTrigger id="billing-refund-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="เลขอ้างอิง">
              <Input
                type="text"
                value={refundReference}
                onChange={(e) => setRefundReference(e.target.value)}
                placeholder="เลขอ้างอิงการโอนคืน (ถ้ามี)"
              />
            </Field>
            <Field label="หมายเหตุ">
              <Textarea
                value={refundNotes}
                onChange={(e) => setRefundNotes(e.target.value)}
                rows={2}
                placeholder="เหตุผลการคืนเงิน..."
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRefundDialog(null)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleRecordRefund}
              disabled={(parseFloat(refundAmount) || 0) <= 0 || recordRefund.isPending}
              className="gap-1.5"
            >
              {recordRefund.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Undo2 className="h-4 w-4" />
              )}
              ยืนยันคืนเงิน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Invoice Dialog */}
      <Dialog
        open={showVoidDialog !== null}
        onOpenChange={(open) => !open && setShowVoidDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ยกเลิกบิล</DialogTitle>
            <DialogDescription>
              การยกเลิกบิลจะทำให้ไม่สามารถใช้งานบิลนี้ได้อีก
            </DialogDescription>
          </DialogHeader>
          <Field label="เหตุผลที่ยกเลิก">
            <Textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              rows={3}
              placeholder="ระบุเหตุผล..."
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVoidDialog(null)}>
              ไม่ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (showVoidDialog) {
                  voidInvoice.mutate({
                    invoiceId: showVoidDialog,
                    reason: voidReason,
                  });
                }
              }}
              disabled={!voidReason || voidInvoice.isPending}
              className="gap-1.5"
            >
              {voidInvoice.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ban className="h-4 w-4" />
              )}
              ยืนยันยกเลิก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
