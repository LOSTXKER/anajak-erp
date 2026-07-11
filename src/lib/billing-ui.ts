const RECEIVABLE_TYPES = new Set(["DEPOSIT_INVOICE", "FINAL_INVOICE", "DEBIT_NOTE"]);

export interface BillingUiPayment {
  amount: number;
  whtAmount: number;
  receiptInvoice?: { isVoided: boolean } | null;
}

export interface BillingUiAdjustment {
  type: string;
  totalAmount: number;
  isVoided: boolean;
}

export interface BillingUiInvoice {
  type: string;
  totalAmount: number;
  amount: number;
  discount: number;
  tax: number;
  isVoided: boolean;
  paymentStatus: string;
  forPaymentId?: string | null;
  payments?: readonly BillingUiPayment[];
  adjustments?: readonly BillingUiAdjustment[];
}

export interface BillingOverview {
  totalInvoiced: number;
  totalPaid: number;
  pendingReceiptCount: number;
  unlinkedReceiptCount: number;
  hasLiveReceivable: boolean;
}

export interface InvoiceBalance {
  paid: number;
  credited: number;
  remaining: number;
  netCash: number;
}

export interface BillingActionAvailability {
  canRecordPayment: boolean;
  canRecordRefund: boolean;
  canVoid: boolean;
}

function isLiveReceivable(invoice: Pick<BillingUiInvoice, "type" | "isVoided">) {
  return !invoice.isVoided && RECEIVABLE_TYPES.has(invoice.type);
}

/**
 * สรุปตัวเลขและงานเอกสารที่ UI แสดงจากนิยามเดียวกัน
 * ยอดชำระรวม WHT และไม่นับบิลที่ void เหมือนกติกาฝั่ง server
 */
export function billingOverview(invoices: readonly BillingUiInvoice[]): BillingOverview {
  let totalInvoiced = 0;
  let totalPaid = 0;
  let pendingReceiptCount = 0;
  let unlinkedReceiptCount = 0;
  let hasLiveReceivable = false;

  for (const invoice of invoices) {
    if (invoice.isVoided) continue;

    totalInvoiced += invoice.totalAmount;
    hasLiveReceivable ||= isLiveReceivable(invoice);

    if (invoice.type === "RECEIPT" && !invoice.forPaymentId) {
      unlinkedReceiptCount += 1;
    }

    for (const payment of invoice.payments ?? []) {
      const settled = payment.amount + payment.whtAmount;
      totalPaid += settled;
      if (
        isLiveReceivable(invoice) &&
        settled > 0 &&
        (!payment.receiptInvoice || payment.receiptInvoice.isVoided)
      ) {
        pendingReceiptCount += 1;
      }
    }
  }

  return {
    totalInvoiced,
    totalPaid,
    pendingReceiptCount,
    unlinkedReceiptCount,
    hasLiveReceivable,
  };
}

/** ยอดค้างและเงินสดสุทธิของใบเดียว ใช้ทั้งป้ายและค่าเริ่มต้นใน dialog */
export function invoiceBalance(invoice: BillingUiInvoice): InvoiceBalance {
  const paid = (invoice.payments ?? []).reduce(
    (sum, payment) => sum + payment.amount + payment.whtAmount,
    0
  );
  const credited = (invoice.adjustments ?? [])
    .filter((adjustment) => !adjustment.isVoided && adjustment.type === "CREDIT_NOTE")
    .reduce((sum, adjustment) => sum + adjustment.totalAmount, 0);
  const netCash = (invoice.payments ?? []).reduce(
    (sum, payment) => sum + payment.amount,
    0
  );

  return {
    paid,
    credited,
    remaining: Math.max(0, invoice.totalAmount - paid - credited),
    netCash,
  };
}

/** กติกาปุ่มต่อใบให้ตรงกับ guard ฝั่ง billing router */
export function billingActionAvailability(params: {
  invoice: Pick<BillingUiInvoice, "type" | "isVoided" | "paymentStatus">;
  netCash: number;
  canRecordMoney: boolean;
  hasLiveReceivable: boolean;
}): BillingActionAvailability {
  const { invoice, netCash, canRecordMoney, hasLiveReceivable } = params;
  const isActive = !invoice.isVoided && invoice.paymentStatus !== "VOIDED";
  const isCreditNote = invoice.type === "CREDIT_NOTE";

  return {
    canRecordPayment:
      isActive &&
      invoice.paymentStatus !== "PAID" &&
      canRecordMoney &&
      !isCreditNote &&
      (invoice.type !== "RECEIPT" || !hasLiveReceivable),
    canRecordRefund: isActive && canRecordMoney && !isCreditNote && netCash > 0,
    canVoid: isActive && canRecordMoney,
  };
}

/** งวดรับเงินออกใบเสร็จ/ใบกำกับได้เมื่อเป็นเงินรับบนใบเรียกเก็บที่ยังใช้งานอยู่ */
export function canIssueReceiptForPayment(params: {
  invoice: Pick<BillingUiInvoice, "type" | "isVoided">;
  payment: BillingUiPayment;
  canBill: boolean;
}): boolean {
  const { invoice, payment, canBill } = params;
  return (
    canBill &&
    isLiveReceivable(invoice) &&
    payment.amount + payment.whtAmount > 0 &&
    (!payment.receiptInvoice || payment.receiptInvoice.isVoided)
  );
}

export function canCreateInvoiceForOrder(internalStatus: string): boolean {
  return !["INQUIRY", "CANCELLED", "COMPLETED"].includes(internalStatus);
}

/** แยกฐานและ VAT ของใบเสร็จตามสัดส่วนภาษีของใบต้นทาง */
export function receiptAmounts(params: {
  invoice: Pick<BillingUiInvoice, "amount" | "discount" | "tax">;
  payment: Pick<BillingUiPayment, "amount" | "whtAmount">;
}) {
  const gross = params.payment.amount + params.payment.whtAmount;
  const invoiceBase = params.invoice.amount - params.invoice.discount;
  const baseRatio =
    params.invoice.tax > 0 && invoiceBase > 0
      ? invoiceBase / (invoiceBase + params.invoice.tax)
      : 1;
  const amount = Math.round(gross * baseRatio * 100) / 100;
  const tax = Math.round((gross - amount) * 100) / 100;

  return { gross, amount, tax };
}

/** WHT มาตรฐาน 3% ของฐานก่อน VAT ปัดสองตำแหน่ง */
export function suggestedWht(invoice: Pick<BillingUiInvoice, "totalAmount" | "tax"> | null) {
  if (!invoice) return 0;
  return Math.max(0, Math.round((invoice.totalAmount - invoice.tax) * 3) / 100);
}

export function cashAmountForRemaining(remaining: number, wht: number): number {
  return Math.max(0, Math.round((remaining - wht) * 100) / 100);
}

export function paymentSettlementPreview(params: {
  cash: number;
  wht: number;
  whtEnabled: boolean;
  remaining: number;
}) {
  const settled = params.cash + (params.whtEnabled ? params.wht : 0);
  return {
    settled,
    // epsilon กัน floating point ฝั่ง clientเตือนปลอม; server ใช้ Decimal ตรวจซ้ำ
    exceedsRemaining: settled > params.remaining + 0.005,
  };
}
