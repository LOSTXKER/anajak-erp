"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Check, CheckCircle2, ChevronRight, CircleDollarSign, FileText, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { Input } from "@/components/ui/input";
import { DEFAULT_PAYMENT_METHOD, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/payment-methods";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PREVIEW_ORDER, PREVIEW_ORDER_NUMBER, PREVIEW_PRICING } from "../ui-reset/_order-data";
import styles from "./_money.module.css";

type Invoice = { id: string; number: string; title: string; issuedAt: string; dueAt: string; amountCents: number };
type Payment = { id: string; invoiceId: string; receiptNumber: string; amountCents: number; paidAt: string; method: PaymentMethod; reference: string };
type PaymentDraft = Pick<Payment, "amountCents" | "paidAt" | "method" | "reference">;
type DocumentTarget = { kind: "invoice"; id: string } | { kind: "receipt"; id: string };

const ORDER_CENTS = Math.round(PREVIEW_PRICING.grandTotal * 100);
const INVOICES: Invoice[] = [
  { id: "sample-deposit", number: "INV-DEMO-01", title: "มัดจำ 50%", issuedAt: "2026-09-10", dueAt: "2026-09-10", amountCents: ORDER_CENTS / 2 },
  { id: "sample-balance", number: "INV-DEMO-02", title: "ส่วนที่เหลือ 50%", issuedAt: "2026-09-11", dueAt: "2026-09-25", amountCents: ORDER_CENTS / 2 },
];
const INITIAL_PAYMENTS: Payment[] = [
  { id: "sample-payment-1", invoiceId: "sample-deposit", receiptNumber: "REC-DEMO-01", amountCents: ORDER_CENTS / 2, paidAt: "2026-09-10", method: "BANK_TRANSFER", reference: "STUDIO-0910" },
];
const PAYMENT_OPTIONS: PaymentMethod[] = ["BANK_TRANSFER", "QR_CODE", "CASH"];
const money = (cents: number) => formatCurrency(cents / 100);
const date = (value: string) => formatDate(`${value}T12:00:00+07:00`);
const paidFor = (invoiceId: string, payments: Payment[]) => payments.reduce((sum, payment) => sum + (payment.invoiceId === invoiceId ? payment.amountCents : 0), 0);

export function WorkspaceMoney({ onOpenItems, poNumber }: { onOpenItems: () => void; poNumber: string }) {
  const [payments, setPayments] = useState<Payment[]>(INITIAL_PAYMENTS);
  const [receiving, setReceiving] = useState<Invoice | null>(null);
  const [document, setDocument] = useState<DocumentTarget | null>(null);
  const [notice, setNotice] = useState("");
  const invoicedCents = INVOICES.reduce((sum, invoice) => sum + invoice.amountCents, 0);
  const paidCents = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  const outstandingCents = INVOICES.reduce((sum, invoice) => sum + invoice.amountCents - paidFor(invoice.id, payments), 0);
  const nextInvoice = INVOICES.find(invoice => paidFor(invoice.id, payments) < invoice.amountCents);
  const latestPayment = payments[payments.length - 1];

  const recordPayment = (draft: PaymentDraft) => {
    if (!receiving) return;
    const payment: Payment = {
      ...draft,
      id: `sample-payment-${payments.length + 1}`,
      invoiceId: receiving.id,
      receiptNumber: `REC-DEMO-${String(payments.length + 1).padStart(2, "0")}`,
    };
    setPayments(current => [...current, payment]);
    setReceiving(null);
    setNotice(`บันทึกรับเงินตัวอย่าง ${money(payment.amountCents)} แล้ว`);
  };

  return (
    <section className={styles.workspace} aria-label="เงินและบิลตัวอย่าง">
      <header className={styles.heading}>
        <div><CircleDollarSign size={19} /><h2>เงิน &amp; บิล</h2><Badge size="sm">มัดจำ 50%</Badge></div>
        <button className={styles.orderValue} onClick={onOpenItems}>มูลค่าออเดอร์ <strong>{money(ORDER_CENTS)}</strong><ArrowRight size={15} /><span className="sr-only">ดูสรุปราคา</span></button>
      </header>

      <div className={styles.summary}>
        <div className={styles.balance}>
          <span className={styles.label}>ค้างตามใบเรียกเก็บ</span>
          <strong className={outstandingCents === 0 ? styles.settled : undefined}>{money(outstandingCents)}</strong>
          <Button size="sm" variant={nextInvoice ? "default" : "outline"} onClick={() => nextInvoice ? setReceiving(nextInvoice) : setDocument({ kind: "receipt", id: latestPayment.id })}>
            {nextInvoice ? <><CircleDollarSign />ลองรับเงิน</> : <><CheckCircle2 />ดูใบเสร็จล่าสุด</>}
          </Button>
        </div>
        <dl className={styles.summaryDetails}>
          <div><dt>รับเงินแล้ว</dt><dd className={styles.collected}>{money(paidCents)}<span>{payments.length} ครั้ง</span></dd></div>
          <div><dt>ออกใบเรียกเก็บแล้ว</dt><dd>{money(invoicedCents)}<span>{INVOICES.length} ใบ</span></dd></div>
        </dl>
        <div className={styles.paymentProgress} role="progressbar" aria-label="เงินที่รับแล้วจากใบเรียกเก็บ" aria-valuemin={0} aria-valuemax={invoicedCents / 100} aria-valuenow={paidCents / 100} aria-valuetext={`รับแล้ว ${money(paidCents)} จาก ${money(invoicedCents)}`}><span style={{ width: `${paidCents / invoicedCents * 100}%` }} /></div>
      </div>

      {notice && <div className={styles.feedback} role="status"><CheckCircle2 size={17} /><span>{notice}</span><button onClick={() => setDocument({ kind: "receipt", id: latestPayment.id })}>ดูใบเสร็จ<ArrowRight size={14} /></button></div>}

      <div className={styles.ledger}>
        <section className={styles.installments} aria-labelledby="sample-installments-heading">
          <div className={styles.sectionHeading}><h3 id="sample-installments-heading">งวดชำระ</h3><span>{INVOICES.filter(invoice => paidFor(invoice.id, payments) === invoice.amountCents).length} / {INVOICES.length} งวดครบแล้ว</span></div>
          <ol className={styles.schedule}>
            {INVOICES.map((invoice, index) => {
              const receivedCents = paidFor(invoice.id, payments);
              const remainingCents = invoice.amountCents - receivedCents;
              const paid = remainingCents === 0;
              return <li key={invoice.id}>
                <button className={styles.installment} aria-label={`ดูบิล ${invoice.title} ${invoice.number}`} onClick={() => setDocument({ kind: "invoice", id: invoice.id })}>
                  <span className={`${styles.step} ${paid ? styles.stepPaid : styles.stepPending}`}>{paid ? <Check size={17} /> : index + 1}</span>
                  <span className={styles.installmentInfo}><strong>{invoice.title}</strong><span>{invoice.number}</span><small>{paid ? `รับครบ ${date(payments.filter(payment => payment.invoiceId === invoice.id).at(-1)!.paidAt)}` : `กำหนด ${date(invoice.dueAt)}`}</small></span>
                  <span className={styles.installmentAmount}><strong>{money(invoice.amountCents)}</strong><Badge size="sm" variant={paid ? "success" : "warning"}>{paid ? "ชำระแล้ว" : receivedCents > 0 ? "รับบางส่วน" : "รอรับเงิน"}</Badge>{receivedCents > 0 && !paid && <small>ค้าง {money(remainingCents)}</small>}</span>
                  <ChevronRight className={styles.rowArrow} size={17} />
                </button>
              </li>;
            })}
          </ol>
          <dl className={styles.billingIdentity}><div><dt>ออกบิลในนาม</dt><dd>{PREVIEW_ORDER.customer?.company}</dd></div><div><dt>เลขผู้เสียภาษี</dt><dd>{PREVIEW_ORDER.customer?.taxId}<span>สำนักงานใหญ่</span></dd></div><div><dt>เลขที่ PO</dt><dd>{poNumber || "—"}</dd></div></dl>
        </section>

        <section className={styles.documents} aria-labelledby="sample-documents-heading">
          <div className={styles.sectionHeading}><h3 id="sample-documents-heading">เอกสาร</h3><span>{INVOICES.length + payments.length} ฉบับ</span></div>
          <h4>ใบเรียกเก็บ <span>{INVOICES.length}</span></h4>
          <ul className={styles.documentList}>{INVOICES.map(invoice => <li key={invoice.id}><button onClick={() => setDocument({ kind: "invoice", id: invoice.id })} aria-label={`ดูใบเรียกเก็บ ${invoice.number}`}><FileText size={19} /><span><strong>{invoice.number}</strong><small>{invoice.title}</small></span><ChevronRight size={15} /></button></li>)}</ul>
          <h4>ใบเสร็จรับเงิน <span>{payments.length}</span></h4>
          <ul className={styles.documentList}>{payments.map(payment => <li key={payment.id}><button onClick={() => setDocument({ kind: "receipt", id: payment.id })} aria-label={`ดูใบเสร็จ ${payment.receiptNumber}`}><ReceiptText size={19} /><span><strong>{payment.receiptNumber}</strong><small>{money(payment.amountCents)} · {date(payment.paidAt)}</small></span><ChevronRight size={15} /></button></li>)}</ul>
        </section>
      </div>

      {receiving && <ReceiveSampleDialog invoice={receiving} remainingCents={receiving.amountCents - paidFor(receiving.id, payments)} onClose={() => setReceiving(null)} onSave={recordPayment} />}
      {document && <SampleDocument target={document} payments={payments} onClose={() => setDocument(null)} />}
    </section>
  );
}

function ReceiveSampleDialog({ invoice, remainingCents, onClose, onSave }: { invoice: Invoice; remainingCents: number; onClose: () => void; onSave: (draft: PaymentDraft) => void }) {
  const [amount, setAmount] = useState((remainingCents / 100).toFixed(2));
  const [paidAt, setPaidAt] = useState("2026-09-25");
  const [method, setMethod] = useState<PaymentMethod>(DEFAULT_PAYMENT_METHOD);
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; paidAt?: string }>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const amountCents = /^\d+(\.\d{1,2})?$/.test(amount) ? Math.round(Number(amount) * 100) : 0;
    const nextErrors: typeof errors = {};
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) nextErrors.amount = "ระบุยอดมากกว่า 0 (ทศนิยมไม่เกิน 2 ตำแหน่ง)";
    else if (amountCents > remainingCents) nextErrors.amount = `รับได้ไม่เกินยอดค้าง ${money(remainingCents)}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAt) || Number.isNaN(Date.parse(paidAt))) nextErrors.paidAt = "เลือกวันที่รับเงิน";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSave({ amountCents, paidAt, method, reference: reference.trim() });
  };

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent><DialogTitle>ลองบันทึกรับเงิน</DialogTitle>
    <div className={styles.dialogContext}><span>{invoice.title} · {invoice.number}</span><Badge size="sm" variant="purple">ข้อมูลจำลอง</Badge></div>
    <form onSubmit={submit} noValidate className={styles.receiveForm}>
      <label className={styles.field} htmlFor="sample-payment-amount"><span>ยอดรับเงิน <small>ค้าง {money(remainingCents)}</small></span><Input id="sample-payment-amount" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} aria-invalid={!!errors.amount} aria-describedby={errors.amount ? "sample-payment-amount-error" : undefined} />{errors.amount && <span id="sample-payment-amount-error" role="alert" className={styles.error}>{errors.amount}</span>}</label>
      <div className={styles.formColumns}>
        <label className={styles.field} htmlFor="sample-payment-date">วันที่รับเงิน<Input id="sample-payment-date" type="date" value={paidAt} onChange={event => setPaidAt(event.target.value)} aria-invalid={!!errors.paidAt} aria-describedby={errors.paidAt ? "sample-payment-date-error" : undefined} />{errors.paidAt && <span id="sample-payment-date-error" role="alert" className={styles.error}>{errors.paidAt}</span>}</label>
        <label className={styles.field} htmlFor="sample-payment-method">ช่องทาง<select id="sample-payment-method" value={method} onChange={event => setMethod(event.target.value as PaymentMethod)}>{PAYMENT_OPTIONS.map(option => <option key={option} value={option}>{PAYMENT_METHOD_LABELS[option]}</option>)}</select></label>
      </div>
      <label className={styles.field} htmlFor="sample-payment-reference">เลขอ้างอิง <Input id="sample-payment-reference" value={reference} onChange={event => setReference(event.target.value)} placeholder="ถ้ามี" /></label>
      <DialogSubmitFooter onCancel={onClose} submitLabel="บันทึกตัวอย่าง" />
    </form>
  </DialogContent></Dialog>;
}

function SampleDocument({ target, payments, onClose }: { target: DocumentTarget; payments: Payment[]; onClose: () => void }) {
  const payment = target.kind === "receipt" ? payments.find(item => item.id === target.id) : null;
  const invoice = INVOICES.find(item => item.id === (target.kind === "invoice" ? target.id : payment?.invoiceId))!;
  const receivedCents = paidFor(invoice.id, payments);
  const remainingCents = invoice.amountCents - receivedCents;
  const invoicePayments = payments.filter(item => item.invoiceId === invoice.id);
  const isReceipt = target.kind === "receipt";

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className={styles.documentDialog}>
    <div className={styles.documentTitle}><DialogTitle>{isReceipt ? "ใบเสร็จรับเงิน" : "ใบเรียกเก็บ"}</DialogTitle><Badge size="sm" variant="purple">ตัวอย่าง</Badge></div>
    <div className={styles.documentNumber}>{isReceipt ? payment!.receiptNumber : invoice.number}<Badge size="sm" variant={isReceipt || remainingCents === 0 ? "success" : "warning"}>{isReceipt || remainingCents === 0 ? "ชำระแล้ว" : receivedCents > 0 ? "รับบางส่วน" : "รอรับเงิน"}</Badge></div>
    <p className={styles.documentCustomer}>{PREVIEW_ORDER.customer?.company}<span>{PREVIEW_ORDER_NUMBER} · {invoice.title}</span></p>
    <dl className={styles.documentDetails}>
      {isReceipt ? <>
        <div><dt>รับเงินวันที่</dt><dd>{date(payment!.paidAt)}</dd></div>
        <div><dt>ช่องทาง</dt><dd>{PAYMENT_METHOD_LABELS[payment!.method]}</dd></div>
        <div><dt>อ้างอิงใบเรียกเก็บ</dt><dd>{invoice.number}</dd></div>
        {payment!.reference && <div><dt>เลขอ้างอิงการชำระ</dt><dd>{payment!.reference}</dd></div>}
        <div className={styles.documentTotal}><dt>ยอดรับเงินครั้งนี้</dt><dd>{money(payment!.amountCents)}</dd></div>
      </> : <>
        <div><dt>วันที่ออก</dt><dd>{date(invoice.issuedAt)}</dd></div>
        <div><dt>กำหนดชำระ</dt><dd>{date(invoice.dueAt)}</dd></div>
        <div className={styles.documentTotal}><dt>ยอดเรียกเก็บ</dt><dd>{money(invoice.amountCents)}</dd></div>
        <div><dt>รับแล้ว</dt><dd>{money(receivedCents)}</dd></div>
        <div><dt>ค้างตามใบนี้</dt><dd>{money(remainingCents)}</dd></div>
      </>}
    </dl>
    {!isReceipt && invoicePayments.length > 0 && <div className={styles.linkedPayments}><h3>รับเงินจากใบนี้</h3>{invoicePayments.map(item => <div key={item.id}><CheckCircle2 size={16} /><span>{item.receiptNumber}<small>{date(item.paidAt)} · {PAYMENT_METHOD_LABELS[item.method]}</small></span><strong>{money(item.amountCents)}</strong></div>)}</div>}
    <p className={styles.documentFootnote}>ข้อมูลจำลองสำหรับดูรูปแบบหน้าจอ</p>
  </DialogContent></Dialog>;
}
