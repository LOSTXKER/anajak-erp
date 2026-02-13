"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
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
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  Receipt,
  Plus,
  CreditCard,
  Loader2,
  ChevronDown,
  ChevronUp,
  Ban,
  DollarSign,
} from "lucide-react";

interface OrderBillingSectionProps {
  orderId: string;
  customerId: string;
  totalAmount: number;
  internalStatus: string;
}

const INVOICE_TYPE_LABELS: Record<string, string> = {
  DEPOSIT_INVOICE: "ใบแจ้งหนี้มัดจำ",
  FINAL_INVOICE: "ใบแจ้งหนี้ส่วนที่เหลือ",
  RECEIPT: "ใบเสร็จรับเงิน",
  CREDIT_NOTE: "ใบลดหนี้",
  DEBIT_NOTE: "ใบเพิ่มหนี้",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: "ยังไม่ชำระ",
  PARTIALLY_PAID: "ชำระบางส่วน",
  PAID: "ชำระแล้ว",
  OVERDUE: "เกินกำหนด",
  VOIDED: "ยกเลิก",
};

const PAYMENT_STATUS_VARIANTS: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  UNPAID: "default",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "destructive",
  VOIDED: "secondary",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "เงินสด",
  TRANSFER: "โอนเงิน",
  CREDIT_CARD: "บัตรเครดิต",
  PROMPTPAY: "พร้อมเพย์",
};

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
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDiscount, setInvoiceDiscount] = useState("0");
  const [invoiceTax, setInvoiceTax] = useState("0");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("TRANSFER");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Void form state
  const [voidReason, setVoidReason] = useState("");

  const utils = trpc.useUtils();
  const invoices = trpc.billing.listByOrder.useQuery({ orderId });

  const createInvoice = trpc.billing.create.useMutation({
    onSuccess: () => {
      utils.billing.listByOrder.invalidate({ orderId });
      utils.order.getById.invalidate({ id: orderId });
      setShowCreateDialog(false);
      resetCreateForm();
    },
  });

  const recordPayment = trpc.billing.recordPayment.useMutation({
    onSuccess: () => {
      utils.billing.listByOrder.invalidate({ orderId });
      utils.order.getById.invalidate({ id: orderId });
      setShowPaymentDialog(null);
      resetPaymentForm();
    },
  });

  const voidInvoice = trpc.billing.voidInvoice.useMutation({
    onSuccess: () => {
      utils.billing.listByOrder.invalidate({ orderId });
      utils.order.getById.invalidate({ id: orderId });
      setShowVoidDialog(null);
      setVoidReason("");
    },
  });

  function resetCreateForm() {
    setInvoiceType("DEPOSIT_INVOICE");
    setInvoiceAmount("");
    setInvoiceDiscount("0");
    setInvoiceTax("0");
    setInvoiceDueDate("");
    setInvoiceNotes("");
  }

  function resetPaymentForm() {
    setPaymentAmount("");
    setPaymentMethod("TRANSFER");
    setPaymentReference("");
    setPaymentNotes("");
  }

  function handleCreateInvoice() {
    createInvoice.mutate({
      orderId,
      customerId,
      type: invoiceType as any,
      amount: parseFloat(invoiceAmount) || 0,
      discount: parseFloat(invoiceDiscount) || 0,
      tax: parseFloat(invoiceTax) || 0,
      dueDate: invoiceDueDate || undefined,
      notes: invoiceNotes || undefined,
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
    });
  }

  function openCreateDialog() {
    // Pre-fill amount suggestion
    const existingTotal = (invoices.data || [])
      .filter((inv: any) => !inv.isVoided)
      .reduce((sum: number, inv: any) => sum + inv.totalAmount, 0);
    const remaining = Math.max(0, totalAmount - existingTotal);

    if (invoiceType === "DEPOSIT_INVOICE") {
      setInvoiceAmount(Math.round(totalAmount * 0.5).toString());
    } else {
      setInvoiceAmount(remaining.toString());
    }
    setShowCreateDialog(true);
  }

  // Calculate how much is still outstanding
  const totalInvoiced = (invoices.data || [])
    .filter((inv: any) => !inv.isVoided)
    .reduce((sum: number, inv: any) => sum + inv.totalAmount, 0);
  const totalPaid = (invoices.data || [])
    .filter((inv: any) => !inv.isVoided)
    .flatMap((inv: any) => inv.payments || [])
    .reduce((sum: number, p: any) => sum + p.amount, 0);

  const canCreateInvoice = !["INQUIRY", "CANCELLED", "COMPLETED"].includes(internalStatus);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4" />
              บิล/การชำระเงิน
            </CardTitle>
            {canCreateInvoice && (
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
          <div className="mb-4 grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
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
          </div>

          {/* Invoice list */}
          {!invoices.data || invoices.data.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              ยังไม่มีบิล
            </p>
          ) : (
            <div className="space-y-2">
              {invoices.data.map((inv: any) => {
                const isExpanded = expandedInvoice === inv.id;
                const invPaid = (inv.payments || []).reduce(
                  (sum: number, p: any) => sum + p.amount,
                  0
                );
                const invRemaining = Math.max(0, inv.totalAmount - invPaid);

                return (
                  <div
                    key={inv.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    <div
                      className="flex cursor-pointer items-center justify-between p-3"
                      onClick={() =>
                        setExpandedInvoice(isExpanded ? null : inv.id)
                      }
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">
                            {inv.invoiceNumber}
                          </span>
                          <Badge variant="secondary">
                            {INVOICE_TYPE_LABELS[inv.type] || inv.type}
                          </Badge>
                          <Badge
                            variant={
                              PAYMENT_STATUS_VARIANTS[inv.paymentStatus] || "default"
                            }
                          >
                            {PAYMENT_STATUS_LABELS[inv.paymentStatus] || inv.paymentStatus}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500">
                          {formatDateTime(inv.createdAt)}
                          {inv.dueDate && ` | ครบกำหนด: ${formatDateTime(inv.dueDate)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                          {formatCurrency(inv.totalAmount)}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-100 p-3 dark:border-slate-700">
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
                            {inv.payments.map((p: any) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between rounded-md bg-green-50 px-2 py-1.5 text-xs dark:bg-green-950/30"
                              >
                                <div className="flex items-center gap-2">
                                  <DollarSign className="h-3 w-3 text-green-600" />
                                  <span className="text-slate-700 dark:text-slate-300">
                                    {PAYMENT_METHOD_LABELS[p.method] || p.method}
                                  </span>
                                  {p.reference && (
                                    <span className="text-slate-400">
                                      #{p.reference}
                                    </span>
                                  )}
                                </div>
                                <span className="font-medium text-green-700 dark:text-green-400">
                                  +{formatCurrency(p.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          {!inv.isVoided &&
                            inv.paymentStatus !== "PAID" &&
                            inv.paymentStatus !== "VOIDED" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPaymentAmount(invRemaining.toString());
                                  setShowPaymentDialog(inv.id);
                                }}
                              >
                                <CreditCard className="h-3 w-3" />
                                บันทึกชำระ
                              </Button>
                            )}
                          {!inv.isVoided && inv.paymentStatus !== "VOIDED" && (
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
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                ประเภทบิล
              </label>
              <Select value={invoiceType} onValueChange={setInvoiceType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEPOSIT_INVOICE">ใบแจ้งหนี้มัดจำ</SelectItem>
                  <SelectItem value="FINAL_INVOICE">ใบแจ้งหนี้ส่วนที่เหลือ</SelectItem>
                  <SelectItem value="RECEIPT">ใบเสร็จรับเงิน</SelectItem>
                  <SelectItem value="CREDIT_NOTE">ใบลดหนี้</SelectItem>
                  <SelectItem value="DEBIT_NOTE">ใบเพิ่มหนี้</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  จำนวนเงิน (บาท)
                </label>
                <input
                  type="number"
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  ส่วนลด
                </label>
                <input
                  type="number"
                  value={invoiceDiscount}
                  onChange={(e) => setInvoiceDiscount(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  ภาษี
                </label>
                <input
                  type="number"
                  value={invoiceTax}
                  onChange={(e) => setInvoiceTax(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  ครบกำหนด
                </label>
                <input
                  type="date"
                  value={invoiceDueDate}
                  onChange={(e) => setInvoiceDueDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                หมายเหตุ
              </label>
              <textarea
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                placeholder="หมายเหตุเพิ่มเติม..."
              />
            </div>
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
              disabled={!invoiceAmount || createInvoice.isPending}
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>บันทึกการชำระเงิน</DialogTitle>
            <DialogDescription>บันทึกยอดชำระเงินจากลูกค้า</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                จำนวนเงิน (บาท)
              </label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                วิธีชำระ
              </label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRANSFER">โอนเงิน</SelectItem>
                  <SelectItem value="CASH">เงินสด</SelectItem>
                  <SelectItem value="PROMPTPAY">พร้อมเพย์</SelectItem>
                  <SelectItem value="CREDIT_CARD">บัตรเครดิต</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                เลขอ้างอิง
              </label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                placeholder="เลขอ้างอิงหรือเลขที่ทำรายการ"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                หมายเหตุ
              </label>
              <textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                placeholder="หมายเหตุ..."
              />
            </div>
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
              disabled={!paymentAmount || recordPayment.isPending}
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
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              เหตุผลที่ยกเลิก
            </label>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              placeholder="ระบุเหตุผล..."
            />
          </div>
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
