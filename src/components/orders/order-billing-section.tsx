"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Ban,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileText,
  Hourglass,
  Landmark,
  Paperclip,
  Plus,
  Printer,
  Receipt,
  Undo2,
  Wallet,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { RouterOutput } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { differenceInBangkokDays } from "@/lib/date-utils";
import { INVOICE_TYPE_LABELS } from "@/lib/invoice-labels";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-methods";
import { PAYMENT_STATUS_LABELS } from "@/lib/status-config";
import {
  billingActionAvailability,
  billingOverview,
  canCreateInvoiceForOrder,
  canIssueReceiptForPayment,
  invoiceBalance,
} from "@/lib/billing-ui";
import { formatBaht, formatDateShort } from "@/lib/utils";
import { QueryError } from "@/components/ui/query-error";
import { Spinner } from "@/components/ui/spinner";
import { c, Callout, CardHead, Rw, StateBox, SubHead, timeText } from "@/components/orders/orders-ui";
import { VoidInvoiceDialog } from "./billing/void-invoice-dialog";
import { RecordRefundDialog } from "./billing/record-refund-dialog";
import { RecordPaymentDialog } from "./billing/record-payment-dialog";
import { CreateInvoiceDialog } from "./billing/create-invoice-dialog";

/* ============================================================
   การ์ด "บิล/การชำระเงิน" ของแท็บเงิน & บิล — ต้นแบบ tabMoney() ส่วน left (รื้อ 2026-09-15)

   สรุป 4 ช่อง → ใบที่รอชำระถัดไป → ตารางใบเรียกเก็บ → ใบเสร็จรับเงิน (งวดรับเงิน)
   ตัวเลข/กติกาปุ่มทั้งหมดจาก lib/billing-ui ชุดเดิม (ตรงกับ guard ฝั่ง billing router) — ไฟล์นี้วาดอย่างเดียว
   แถวในตาราง/รายการ = กดเลือก → กล่องคำสั่งของใบนั้นใต้รายการ (พิมพ์, บันทึกชำระ, คืนเงิน, ยกเลิกบิล, ออกใบเสร็จ)
   ใบเสร็จที่ผูกงวดรับเงินแล้วแสดงในส่วนใบเสร็จ ไม่ซ้ำในตาราง (ใบที่ถูกยกเลิกยังอยู่ในตารางให้เปิดดูได้)
   ============================================================ */

type Invoice = RouterOutput["billing"]["listByOrder"][number];
type Payment = Invoice["payments"][number];

interface OrderBillingSectionProps {
  orderId: string;
  customerId: string;
  totalAmount: number;
  internalStatus: string;
}

const labelOf = (labels: Record<string, string>, key: string) => labels[key] ?? key;

export function OrderBillingSection({ orderId, customerId, totalAmount, internalStatus }: OrderBillingSectionProps) {
  // dialog สร้างบิล — union เดียว 2 โหมด (dialog ตัวเดียวกัน seed ต่างกัน — แยกเป็น 2 state จะเปิดพร้อมกันได้ ซึ่งผิด):
  // "create" = สร้างบิลปกติ (prefill จาก billing.suggest) · "receipt" = ออกใบเสร็จ/ใบกำกับให้งวดรับเงิน (Gate B3)
  const [createDialog, setCreateDialog] = useState<
    null | { mode: "create" } | { mode: "receipt"; payment: Payment; invoice: Invoice }
  >(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState<string | null>(null);
  const [showVoidDialog, setShowVoidDialog] = useState<string | null>(null);
  // dialog คืนเงิน — เก็บแค่ invoiceId เป้าหมาย ฟอร์ม+mutation อยู่ใน RecordRefundDialog
  const [showRefundDialog, setShowRefundDialog] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  // สิทธิ์เปิดบิล — ตรงกับ billingStaff ฝั่ง server
  const me = trpc.user.me.useQuery();
  const canBill = permAllows(me.data?.permissions, "manage_billing_docs");
  // เห็นการ์ดบิล/ยอดรับชำระ — ตรงกับ gate ของ billing.listByOrder (Gate A2)
  const canViewBilling = permAllows(me.data?.permissions, "see_order_money");
  // บันทึกรับเงิน/คืนเงิน/ยกเลิกบิล — ตรงกับ moneyRecorder ฝั่ง server (แคบกว่า canBill)
  const canRecordMoney = permAllows(me.data?.permissions, "record_payments");

  const invoices = trpc.billing.listByOrder.useQuery({ orderId }, { enabled: canViewBilling });
  const list = invoices.data ?? [];

  const { totalInvoiced, totalPaid, totalOutstanding, pendingReceiptCount, unlinkedReceiptCount, hasLiveReceivable } =
    billingOverview(list);
  const canCreateInvoice = canCreateInvoiceForOrder(internalStatus) && canBill;

  // บิลที่ dialog บันทึกชำระ/คืนเงินเปิดอยู่ — dialog ใช้คิด prefill หัก ณ ที่จ่าย + ยอดคงเหลือ
  const payingInvoice = list.find((inv) => inv.id === showPaymentDialog);
  const refundingInvoice = list.find((inv) => inv.id === showRefundDialog);

  if (me.isError) {
    return <QueryError message="โหลดสิทธิ์ดูข้อมูลบิลไม่สำเร็จ" onRetry={() => void me.refetch()} />;
  }
  // ช่าง/กราฟิกไม่เห็นการ์ดบิลทั้งใบ (Gate A2) · me ยังไม่มา = ยังไม่ render
  if (!canViewBilling) return null;

  const actionsOf = (inv: Invoice) =>
    billingActionAvailability({
      invoice: inv,
      netCash: invoiceBalance(inv).netCash,
      canRecordMoney,
      hasLiveReceivable,
    });
  // ยอดค้างของใบเดียวตามนิยามกลาง (นับเฉพาะใบเรียกเก็บที่ยังมีผล)
  const outstandingOf = (inv: Invoice) => billingOverview([inv]).totalOutstanding;
  const isOverdue = (inv: Invoice) =>
    inv.paymentStatus === "OVERDUE" ||
    (inv.dueDate != null && outstandingOf(inv) > 0 && (differenceInBangkokDays(inv.dueDate, now) ?? 0) < 0);
  const payTagOf = (inv: Invoice): [tone: string, label: string] => {
    if (inv.isVoided || inv.paymentStatus === "VOIDED") return ["none", labelOf(PAYMENT_STATUS_LABELS, "VOIDED")];
    if (isOverdue(inv)) return ["bad", labelOf(PAYMENT_STATUS_LABELS, "OVERDUE")];
    if (inv.paymentStatus === "PAID") return ["good", labelOf(PAYMENT_STATUS_LABELS, "PAID")];
    return ["warn", labelOf(PAYMENT_STATUS_LABELS, inv.paymentStatus)];
  };

  // ใบที่รอชำระถัดไป = ใบเรียกเก็บที่ยังค้าง ครบกำหนดก่อนมาก่อน
  const nextInvoice =
    list
      .filter((inv) => outstandingOf(inv) > 0)
      .sort((a, b) => {
        const due = (inv: Invoice) => (inv.dueDate ? new Date(inv.dueDate).getTime() : Number.POSITIVE_INFINITY);
        return due(a) - due(b) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      })[0] ?? null;
  const canReceiveNext = nextInvoice ? actionsOf(nextInvoice).canRecordPayment : false;

  const byId = new Map(list.map((inv) => [inv.id, inv]));
  // ใบเสร็จที่ผูกงวดแล้วอยู่ในส่วนใบเสร็จ — ตารางเหลือใบเรียกเก็บ/ลดหนี้/เพิ่มหนี้/ใบเสร็จที่ไม่ผูกงวด
  const tableInvoices = list.filter((inv) => !(inv.type === "RECEIPT" && inv.forPaymentId && !inv.isVoided));
  const paymentRows = list
    .flatMap((inv) => inv.payments.map((payment) => ({ payment, invoice: inv })))
    .sort((a, b) => new Date(b.payment.createdAt).getTime() - new Date(a.payment.createdAt).getTime());

  const selectedInvoice = tableInvoices.find((inv) => inv.id === selectedInvoiceId) ?? null;
  const selectedPayment = paymentRows.find((row) => row.payment.id === selectedPaymentId) ?? null;
  const toggleInvoice = (id: string) => setSelectedInvoiceId((current) => (current === id ? null : id));

  function docActions(inv: Invoice, voidLabel = "ยกเลิกบิล") {
    const actions = actionsOf(inv);
    return (
      <>
        <a
          href={`/print/invoice/${inv.id}`}
          target="_blank"
          rel="noreferrer"
          className={c("btn sm")}
          aria-label={`พิมพ์หรือเปิด PDF ${inv.invoiceNumber}`}
        >
          <Printer aria-hidden="true" />
          พิมพ์/PDF
        </a>
        {actions.canRecordPayment ? (
          <button type="button" className={c("btn primary sm")} onClick={() => setShowPaymentDialog(inv.id)}>
            <CreditCard aria-hidden="true" />
            บันทึกชำระ
          </button>
        ) : null}
        {actions.canRecordRefund ? (
          <button type="button" className={c("btn sm")} onClick={() => setShowRefundDialog(inv.id)}>
            <Undo2 aria-hidden="true" />
            คืนเงิน
          </button>
        ) : null}
        {actions.canVoid ? (
          <button
            type="button"
            className={c("btn ghost sm")}
            style={{ color: "var(--bad)" }}
            onClick={() => setShowVoidDialog(inv.id)}
          >
            <Ban aria-hidden="true" />
            {voidLabel}
          </button>
        ) : null}
      </>
    );
  }

  function invoiceBox(inv: Invoice) {
    const remaining = outstandingOf(inv);
    return (
      <div id="mb-inv-actions" className={c("state on")} style={{ marginTop: 10 }}>
        <FileText aria-hidden="true" />
        <span className={c("grow")}>
          <b>{inv.invoiceNumber}</b> {labelOf(INVOICE_TYPE_LABELS, inv.type)}
          <br />
          ยอดเงิน {formatBaht(inv.amount)}
          {inv.discount > 0 ? ` ส่วนลด -${formatBaht(inv.discount)}` : ""}
          {inv.tax > 0 ? ` ภาษี +${formatBaht(inv.tax)}` : ""}
          <br />
          {/* วันที่เอกสารตามกฎหมาย (ใบผูกงวด = วันรับเงิน) — ตรงกับใบพิมพ์ */}
          ออกเมื่อ{" "}
          {inv.issueDate ? formatDateShort(inv.issueDate) : `${formatDateShort(inv.createdAt)} ${timeText(inv.createdAt)}`}
          {remaining > 0 ? ` · ค้าง ${formatBaht(remaining)}` : ""}
          {inv.notes ? (
            <>
              <br />
              {inv.notes}
            </>
          ) : null}
        </span>
        {docActions(inv)}
      </div>
    );
  }

  function paymentBox({ payment, invoice }: { payment: Payment; invoice: Invoice }) {
    const linked = payment.receiptInvoice && !payment.receiptInvoice.isVoided ? byId.get(payment.receiptInvoice.id) ?? null : null;
    const canIssue = canIssueReceiptForPayment({ invoice, payment, canBill });
    return (
      <div id="mb-pay-actions" className={c("state on")} style={{ marginTop: 10 }}>
        <Banknote aria-hidden="true" />
        <span className={c("grow")}>
          <b>{formatBaht(payment.amount)}</b> {labelOf(PAYMENT_METHOD_LABELS, payment.method)}
          {payment.reference ? ` #${payment.reference}` : ""}
          {payment.whtAmount > 0 ? (
            <>
              <br />
              หัก ณ ที่จ่าย {formatBaht(payment.whtAmount)}
            </>
          ) : null}
          {/* tax point (Gate B3): งวดออกใบกำกับแล้ว = เลขใบ · ใบเดิมถูกยกเลิก = ต้องออกใหม่ */}
          {payment.receiptInvoice ? (
            <>
              <br />
              {payment.receiptInvoice.isVoided ? "ใบเสร็จเดิม " : "ใบเสร็จ/ใบกำกับ "}
              <span className={c("mono")}>{payment.receiptInvoice.invoiceNumber}</span>
              {payment.receiptInvoice.isVoided ? " ถูกยกเลิก" : ""}
            </>
          ) : null}
        </span>
        {payment.evidenceUrl ? (
          <a
            href={payment.evidenceUrl}
            target="_blank"
            rel="noreferrer"
            className={c("btn sm")}
            aria-label={`ดูสลิปของรายการชำระ ${formatBaht(payment.amount)}`}
          >
            <Paperclip aria-hidden="true" />
            ดูสลิป
          </a>
        ) : null}
        {canIssue ? (
          <button
            type="button"
            className={c("btn primary sm")}
            onClick={() => setCreateDialog({ mode: "receipt", payment, invoice })}
          >
            <Receipt aria-hidden="true" />
            ออกใบเสร็จ/ใบกำกับ
          </button>
        ) : null}
        {/* ใบเสร็จที่ผูกงวด (ไม่อยู่ในตาราง) — คำสั่งของใบนั้นอยู่ที่นี่ */}
        {linked ? docActions(linked, "ยกเลิกใบเสร็จ") : null}
      </div>
    );
  }

  return (
    <>
      <section className={c("card")} aria-labelledby="mb-h">
        <CardHead
          icon={Landmark}
          tone="good"
          id="mb-h"
          title="บิล/การชำระเงิน"
          right={
            canCreateInvoice || canReceiveNext ? (
              <>
                {canCreateInvoice ? (
                  // ยอด/ชนิดบิล/วันครบกำหนด prefill จาก billing.suggest ตามเงื่อนไขชำระของออเดอร์
                  <button
                    type="button"
                    className={c("btn", !canReceiveNext && "primary", "sm")}
                    onClick={() => setCreateDialog({ mode: "create" })}
                  >
                    <Plus aria-hidden="true" />
                    สร้างบิล
                  </button>
                ) : null}
                {canReceiveNext && nextInvoice ? (
                  <button type="button" className={c("btn primary sm")} onClick={() => setShowPaymentDialog(nextInvoice.id)}>
                    <Banknote aria-hidden="true" />
                    บันทึกรับเงิน
                  </button>
                ) : null}
              </>
            ) : undefined
          }
        />
        <div className={c("cb")}>
          {/* "เหลือเก็บอีกเท่าไร" คือเลขที่คนหน้างานถามบ่อยสุด — แดงเมื่อยังค้าง (UX4) */}
          <dl className={c("facts four")}>
            <div className={c("fact")}>
              <dt className={c("k")}>
                <Receipt aria-hidden="true" />
                ยอดรวม
              </dt>
              <dd className={c("v mono")}>{formatBaht(totalAmount)}</dd>
            </div>
            <div className={c("fact")}>
              <dt className={c("k")}>
                <FileText aria-hidden="true" />
                วางบิลแล้ว
              </dt>
              <dd className={c("v mono")}>{formatBaht(totalInvoiced)}</dd>
            </div>
            <div className={c("fact good")}>
              <dt className={c("k")}>
                <CheckCircle2 aria-hidden="true" />
                ชำระแล้ว
              </dt>
              <dd className={c("v mono")}>{formatBaht(totalPaid)}</dd>
            </div>
            <div className={c("fact", totalOutstanding > 0 && "bad")}>
              <dt className={c("k")}>
                <Hourglass aria-hidden="true" />
                ค้างชำระ
              </dt>
              <dd className={c("v mono")}>{formatBaht(totalOutstanding)}</dd>
            </div>
          </dl>

          {nextInvoice ? (
            <div style={{ marginTop: 12 }}>
              <Callout
                tone="info"
                icon={Wallet}
                action={
                  <a
                    href={`/print/invoice/${nextInvoice.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className={c("btn sm")}
                    aria-label={`พิมพ์หรือเปิด PDF ${nextInvoice.invoiceNumber}`}
                  >
                    <Printer aria-hidden="true" />
                    พิมพ์/PDF
                  </a>
                }
              >
                รอชำระ <b>{labelOf(INVOICE_TYPE_LABELS, nextInvoice.type)}</b>{" "}
                <span className={c("mono")}>{nextInvoice.invoiceNumber}</span>
                {` · ${formatBaht(outstandingOf(nextInvoice))}`}
                {/* dueDate เก็บเป็น UTC midnight ของวันปฏิทินไทย — โชว์แค่วัน ไม่มีเวลา */}
                {nextInvoice.dueDate ? ` · ครบกำหนด ${formatDateShort(nextInvoice.dueDate)}` : ""}
                {isOverdue(nextInvoice) ? (
                  <>
                    {" "}
                    <span className={c("chip bad")}>{labelOf(PAYMENT_STATUS_LABELS, "OVERDUE")}</span>
                  </>
                ) : null}
              </Callout>
            </div>
          ) : null}

          {/* เตือนเฉพาะคนที่ออกใบได้ (canBill) — role อื่นเห็นแต่ทำอะไรไม่ได้ ชวนงง */}
          {canBill && pendingReceiptCount > 0 ? (
            <div style={{ marginTop: 10 }}>
              <Callout icon={Receipt}>
                <b>{pendingReceiptCount} งวดรับเงินยังไม่ออกใบเสร็จ/ใบกำกับ</b> ต้องออกทุกงวด กดงวดนั้นด้านล่าง
                {unlinkedReceiptCount > 0 ? (
                  <>
                    <br />
                    มีใบเสร็จไม่ผูกงวด {unlinkedReceiptCount} ใบ ตรวจก่อนกันออกซ้ำ
                  </>
                ) : null}
              </Callout>
            </div>
          ) : null}

          <div style={{ marginTop: 14 }}>
            <SubHead
              icon={FileText}
              tone="good"
              title="ใบเรียกเก็บ"
              right={invoices.data ? <span className={c("chip gray")}>{tableInvoices.length} ฉบับ</span> : undefined}
            />
            {invoices.isError && !list.length ? (
              <Callout
                tone="danger"
                icon={AlertTriangle}
                role="alert"
                action={
                  <button type="button" className={c("btn sm")} onClick={() => void invoices.refetch()}>
                    ลองใหม่
                  </button>
                }
              >
                โหลดข้อมูลบิลไม่สำเร็จ
              </Callout>
            ) : invoices.isPending ? (
              <div className={c("state")} role="status" aria-live="polite">
                <Spinner size="sm" />
                <span className={c("grow")}>กำลังโหลดข้อมูลบิล</span>
              </div>
            ) : tableInvoices.length === 0 ? (
              <StateBox
                icon={FileText}
                action={
                  canCreateInvoice ? (
                    <button type="button" className={c("btn primary sm")} onClick={() => setCreateDialog({ mode: "create" })}>
                      <Plus aria-hidden="true" />
                      สร้างบิล
                    </button>
                  ) : undefined
                }
              >
                ยังไม่มีใบเรียกเก็บ
              </StateBox>
            ) : (
              <>
                <div className={c("tblw")}>
                  <table className={c("tbl")}>
                    <thead>
                      <tr>
                        <th>เลขที่</th>
                        <th>ประเภท</th>
                        <th className={c("num")}>ยอด</th>
                        <th>ครบกำหนด</th>
                        <th>สถานะ</th>
                        <th>
                          <span className={c("sr")}>จัดการ</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableInvoices.map((inv) => {
                        const [tone, label] = payTagOf(inv);
                        const open = selectedInvoice?.id === inv.id;
                        const Chevron = open ? ChevronDown : ChevronRight;
                        return (
                          <tr key={inv.id} className={c("link")} onClick={() => toggleInvoice(inv.id)}>
                            <td className={c("mono")}>
                              <button
                                type="button"
                                className={c("vbtn")}
                                aria-expanded={open}
                                aria-controls="mb-inv-actions"
                                aria-label={`จัดการ ${inv.invoiceNumber}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleInvoice(inv.id);
                                }}
                              >
                                {inv.invoiceNumber}
                              </button>
                            </td>
                            <td>{labelOf(INVOICE_TYPE_LABELS, inv.type)}</td>
                            <td className={c("num mono")}>{formatBaht(inv.totalAmount)}</td>
                            <td>{inv.dueDate ? formatDateShort(inv.dueDate) : "—"}</td>
                            <td>
                              <span className={c("pay", tone)}>
                                <span className={c("d")} aria-hidden="true" />
                                {label}
                              </span>
                            </td>
                            <td style={{ color: "var(--ink-4)" }}>
                              <Chevron aria-hidden="true" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {selectedInvoice ? invoiceBox(selectedInvoice) : null}
              </>
            )}
          </div>

          {invoices.data ? (
            <div style={{ marginTop: 14 }}>
              <SubHead
                icon={Banknote}
                tone="good"
                title="ใบเสร็จรับเงิน"
                right={<span className={c("chip gray")}>{paymentRows.length} รายการ</span>}
              />
              {paymentRows.length > 0 ? (
                <>
                  <div className={c("rows")}>
                    {paymentRows.map(({ payment, invoice }) => {
                      const receipt =
                        payment.receiptInvoice && !payment.receiptInvoice.isVoided
                          ? payment.receiptInvoice.invoiceNumber
                          : invoice.type === "RECEIPT"
                            ? invoice.invoiceNumber
                            : null;
                      // งวดที่ยังไม่มีใบเสร็จ (นิยามกลางเดียวกับคำเตือน Gate B3)
                      const missingReceipt = canIssueReceiptForPayment({ invoice, payment, canBill: true });
                      return (
                        <Rw
                          key={payment.id}
                          onClick={() => setSelectedPaymentId((current) => (current === payment.id ? null : payment.id))}
                          icon={Banknote}
                          tone={missingReceipt ? "warn" : "good"}
                          title={
                            <>
                              {receipt ? <span className={c("mono")}>{receipt}</span> : "ยังไม่ออกใบเสร็จ"}
                              {` · ${labelOf(PAYMENT_METHOD_LABELS, payment.method)}`}
                            </>
                          }
                          sub={
                            <>
                              {formatDateShort(payment.createdAt)} {timeText(payment.createdAt)}
                              {invoice.type !== "RECEIPT" ? (
                                <>
                                  {" · ตัดบิล "}
                                  <span className={c("mono")}>{invoice.invoiceNumber}</span>
                                </>
                              ) : null}
                            </>
                          }
                          right={
                            <span className={c("mono")} style={{ color: "var(--ink)", fontWeight: 500 }}>
                              {formatBaht(payment.amount)}
                            </span>
                          }
                        />
                      );
                    })}
                  </div>
                  {selectedPayment ? paymentBox(selectedPayment) : null}
                </>
              ) : (
                <StateBox icon={Banknote}>ยังไม่มีใบเสร็จ</StateBox>
              )}
            </div>
          ) : null}
        </div>
      </section>

      {/* dialog สร้างบิล — conditional mount (กติกาใน ui/dialog.tsx) · โหมด receipt ส่ง payment+invoice ของงวด */}
      {createDialog && (
        <CreateInvoiceDialog
          orderId={orderId}
          customerId={customerId}
          canBill={canBill}
          invoices={list}
          receiptFor={createDialog.mode === "receipt" ? { payment: createDialog.payment, invoice: createDialog.invoice } : null}
          onClose={() => setCreateDialog(null)}
        />
      )}

      {/* dialog บันทึกรับเงิน — ส่ง invoice ทั้ง object ให้ dialog คิด prefill/หัก ณ ที่จ่ายเอง */}
      {payingInvoice && (
        <RecordPaymentDialog orderId={orderId} invoice={payingInvoice} onClose={() => setShowPaymentDialog(null)} />
      )}

      {/* dialog คืนเงิน */}
      {refundingInvoice && (
        <RecordRefundDialog
          invoiceId={refundingInvoice.id}
          initialAmount={invoiceBalance(refundingInvoice).netCash.toString()}
          onClose={() => setShowRefundDialog(null)}
        />
      )}

      {/* dialog ยกเลิกบิล */}
      {showVoidDialog && <VoidInvoiceDialog invoiceId={showVoidDialog} onClose={() => setShowVoidDialog(null)} />}
    </>
  );
}
