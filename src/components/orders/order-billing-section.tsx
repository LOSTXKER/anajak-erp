"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryError } from "@/components/ui/query-error";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_VARIANTS } from "@/lib/status-config";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-methods";
import { permAllows } from "@/lib/permissions";
import { INVOICE_TYPE_LABELS } from "@/lib/invoice-labels";
import {
  billingActionAvailability,
  billingOverview,
  canCreateInvoiceForOrder,
  canIssueReceiptForPayment,
  invoiceBalance,
} from "@/lib/billing-ui";
import { Receipt, Plus, CreditCard, Ban, Printer, DollarSign, Paperclip, Undo2 } from "lucide-react";
import type { RouterOutput } from "@/lib/trpc";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { VoidInvoiceDialog } from "./billing/void-invoice-dialog";
import { RecordRefundDialog } from "./billing/record-refund-dialog";
import { RecordPaymentDialog } from "./billing/record-payment-dialog";
import { CreateInvoiceDialog } from "./billing/create-invoice-dialog";

type Invoice = RouterOutput["billing"]["listByOrder"][number];
type Payment = Invoice["payments"][number];

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
  // dialog สร้างบิล — union เดียว 2 โหมด (dialog ตัวเดียวกัน seed ต่างกัน — แยกเป็น
  // 2 state จะเปิดพร้อมกันได้ ซึ่งผิด): "create" = สร้างบิลปกติ (prefill จาก billing.suggest)
  // · "receipt" = ออกใบเสร็จ/ใบกำกับให้งวดรับเงิน (Gate B3) — เก็บ payment+invoice ทั้ง
  // object เพราะ CreateInvoiceDialog ต้องคิด receiptAmounts จากใบที่ถูกชำระจริง
  const [createDialog, setCreateDialog] = useState<
    null | { mode: "create" } | { mode: "receipt"; payment: Payment; invoice: Invoice }
  >(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState<string | null>(null);
  const [showVoidDialog, setShowVoidDialog] = useState<string | null>(null);

  // dialog คืนเงิน — เก็บแค่ invoiceId เป้าหมาย ฟอร์ม+mutation อยู่ใน RecordRefundDialog
  const [showRefundDialog, setShowRefundDialog] = useState<string | null>(null);

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

  const {
    totalInvoiced,
    totalPaid,
    totalOutstanding,
    pendingReceiptCount,
    unlinkedReceiptCount,
    hasLiveReceivable,
  } = billingOverview(invoices.data || []);
  const canCreateInvoice = canCreateInvoiceForOrder(internalStatus);

  // บิลที่ dialog บันทึกชำระเปิดอยู่ — RecordPaymentDialog ใช้คิด prefill หัก ณ ที่จ่าย + ยอดคงเหลือ
  const payingInvoice = (invoices.data || []).find((inv) => inv.id === showPaymentDialog);

  // บิลที่ dialog คืนเงินเปิดอยู่ — ใช้ seed ยอดคืน default (netCash) ให้ RecordRefundDialog
  const refundingInvoice = (invoices.data || []).find((inv) => inv.id === showRefundDialog);

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
                // ยอด/ชนิดบิล/วันครบกำหนด prefill จาก billing.suggest ตามเงื่อนไขชำระของออเดอร์
                onClick={() => setCreateDialog({ mode: "create" })}
                className="gap-1.5"
              >
                <Plus />
                สร้างบิล
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary */}
          <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-4 dark:bg-slate-800/50">
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
            <p className="mb-3 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
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
              className="flex items-center justify-center gap-2 py-8 text-sm text-muted"
            >
              <Spinner size="md" />
              กำลังโหลดข้อมูลบิล
            </div>
          ) : !invoices.data || invoices.data.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              ยังไม่มีบิล
            </p>
          ) : (
            <div className="space-y-2">
              {invoices.data.map((inv) => {
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
                    <div className="flex items-stretch gap-1.5 p-1">
                      <div className="flex min-h-11 min-w-0 flex-1 flex-col items-stretch justify-between gap-2 rounded-lg px-2 py-2 text-left sm:flex-row sm:items-center">
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
                          <p className="text-xs text-muted">
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
                        </div>
                      </div>
                      <a
                        href={`/print/invoice/${inv.id}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`พิมพ์หรือเปิด PDF ${inv.invoiceNumber}`}
                        title="พิมพ์ / PDF"
                        className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-interactive-hover hover:text-blue-600", FOCUS_BUTTON, "sm:h-9 sm:w-9 dark:hover:text-blue-400")}
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </a>
                    </div>

                      <div
                        id={`invoice-details-${inv.id}`}
                        className="border-t border-slate-100 p-3 dark:border-slate-700"
                      >
                        {/* Invoice details */}
                        <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-muted">ยอดเงิน</span>
                            <p className="font-medium">{formatCurrency(inv.amount)}</p>
                          </div>
                          {inv.discount > 0 && (
                            <div>
                              <span className="text-muted">ส่วนลด</span>
                              <p className="font-medium">-{formatCurrency(inv.discount)}</p>
                            </div>
                          )}
                          {inv.tax > 0 && (
                            <div>
                              <span className="text-muted">ภาษี</span>
                              <p className="font-medium">+{formatCurrency(inv.tax)}</p>
                            </div>
                          )}
                        </div>

                        {inv.notes && (
                          <p className="mb-3 text-xs text-muted">
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
                                className="flex items-center justify-between rounded-lg bg-green-50 px-2 py-1.5 text-xs dark:bg-green-950/30"
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
                                      className={cn("flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-blue-600", FOCUS_BUTTON, "sm:h-9 sm:w-9 dark:hover:bg-slate-900 dark:hover:text-blue-400")}
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
                                    <Button variant="outline" size="sm" className="gap-1.5 text-2xs" onClick={(e) => {
                                        e.stopPropagation();
                                        setCreateDialog({ mode: "receipt", payment: p, invoice: inv });
                                      }}
                                    >
                                      <Receipt />
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
                              className="gap-1.5 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowPaymentDialog(inv.id);
                              }}
                            >
                              <CreditCard />
                              บันทึกชำระ
                            </Button>
                          )}
                          {actions.canRecordRefund && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-500"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowRefundDialog(inv.id);
                              }}
                            >
                              <Undo2 />
                              คืนเงิน
                            </Button>
                          )}
                          {actions.canVoid && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 text-xs text-red-500 hover:text-red-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowVoidDialog(inv.id);
                              }}
                            >
                              <Ban />
                              ยกเลิกบิล
                            </Button>
                          )}
                        </div>
                      </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* dialog สร้างบิล — conditional mount (กติกาใน ui/dialog.tsx) · โหมด receipt
          ส่ง payment+invoice ของงวดให้ dialog seed ฐาน+VAT เองจบในไฟล์ */}
      {createDialog && (
        <CreateInvoiceDialog
          orderId={orderId}
          customerId={customerId}
          canBill={canBill}
          invoices={invoices.data || []}
          receiptFor={
            createDialog.mode === "receipt"
              ? { payment: createDialog.payment, invoice: createDialog.invoice }
              : null
          }
          onClose={() => setCreateDialog(null)}
        />
      )}

      {/* dialog บันทึกรับเงิน — conditional mount (กติกาใน ui/dialog.tsx) · ส่ง invoice
          ทั้ง object ให้ dialog คิด prefill/หัก ณ ที่จ่ายเองจบในไฟล์ */}
      {payingInvoice && (
        <RecordPaymentDialog
          orderId={orderId}
          invoice={payingInvoice}
          onClose={() => setShowPaymentDialog(null)}
        />
      )}

      {/* dialog คืนเงิน — conditional mount (กติกาใน ui/dialog.tsx) */}
      {refundingInvoice && (
        <RecordRefundDialog
          invoiceId={refundingInvoice.id}
          initialAmount={invoiceBalance(refundingInvoice).netCash.toString()}
          onClose={() => setShowRefundDialog(null)}
        />
      )}

      {/* dialog ยกเลิกบิล — conditional mount (กติกาใน ui/dialog.tsx) */}
      {showVoidDialog && (
        <VoidInvoiceDialog
          invoiceId={showVoidDialog}
          onClose={() => setShowVoidDialog(null)}
        />
      )}
    </>
  );
}
