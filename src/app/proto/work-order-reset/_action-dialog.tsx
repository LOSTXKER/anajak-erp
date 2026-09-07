"use client";

import { useId, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { Fact, FactList } from "@/components/ui/fact";
import { Field } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { COMPLEX, RECORD_MODE_LABEL, type LeanOrder, type LeanStep } from "../work-order-lean/_data";

export type ResetAction = "receive" | "problem" | "resolve" | "assign" | "record" | "print";

const TITLES: Record<ResetAction, string> = {
  receive: "รับของกลับและตรวจรับ",
  problem: "แจ้งปัญหา",
  resolve: "บันทึกการแก้ปัญหา",
  assign: "เปลี่ยนผู้รับผิดชอบ",
  record: "บันทึกผลงาน",
  print: "ตัวอย่างใบสั่งงาน",
};

type FormErrors = { quantity?: string; result?: string; notes?: string; owner?: string };

/** Conditional mount by the page. All input stays in this component; no queries or mutations. */
export function ActionDialog({
  action,
  step,
  order,
  boss,
  onClose,
}: {
  action: ResetAction;
  step: LeanStep | null;
  order: LeanOrder;
  boss: boolean;
  onClose: () => void;
}) {
  const formId = useId();
  const [quantity, setQuantity] = useState(() => action === "record" ? (step?.qtyDone ?? 0) : (step?.qtyTotal ?? 0));
  const [result, setResult] = useState("");
  const [notes, setNotes] = useState("");
  const [owner, setOwner] = useState(() => step?.owner?.split(" · ")[0] ?? "");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const denied = !boss && (action === "resolve" || action === "assign");
  const needsQuantity = action === "receive" || action === "record";
  const notesRequired = action === "problem" || action === "resolve" || (action === "receive" && result === "issue");
  const owners = [...new Set(
    [...order.steps, ...COMPLEX.steps]
      .map((item) => item.owner?.split(" · ")[0])
      .filter((value): value is string => Boolean(value)),
  )];
  const noteLabel = action === "problem"
    ? "ปัญหาที่พบ"
    : action === "resolve"
      ? "วิธีแก้ไข"
      : action === "receive" && result === "issue"
        ? "รายละเอียดปัญหา"
        : "หมายเหตุ";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (denied || !step || action === "print") return;
    const nextErrors: FormErrors = {};
    if (needsQuantity && (!Number.isInteger(quantity) || quantity < 0 || quantity > step.qtyTotal)) {
      nextErrors.quantity = `กรอกจำนวนเต็มตั้งแต่ 0 ถึง ${step.qtyTotal} ตัว`;
    }
    if (action === "receive" && result !== "pass" && result !== "issue") {
      nextErrors.result = "เลือกผลตรวจรับก่อนบันทึก";
    }
    if (notesRequired && !notes.trim()) nextErrors.notes = `กรอก${noteLabel}ก่อนบันทึก`;
    if (action === "assign" && !owners.includes(owner)) nextErrors.owner = "เลือกผู้รับผิดชอบก่อนบันทึก";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const firstField = Object.keys(nextErrors)[0];
      document.getElementById(`${formId}-${firstField}`)?.focus();
      return;
    }
    setSubmitted(true);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={action === "print" ? "sm:max-w-xl" : undefined}>
        <DialogHeader className="text-left">
          <DialogTitle>{TITLES[action]}</DialogTitle>
          <DialogDescription>หน้าลอง ไม่บันทึกข้อมูลจริง</DialogDescription>
        </DialogHeader>

        {denied || (!step && action !== "print") ? (
          <>
            <Alert variant="warning" title={denied ? "สำหรับหัวหน้าผลิต" : "ยังไม่ได้เลือกขั้นงาน"}>
              {denied ? "บทบาทนี้ทำรายการนี้ไม่ได้" : "ปิดหน้าต่างแล้วเลือกขั้นงานอีกครั้ง"}
            </Alert>
            <DialogFooter><Button className="w-full sm:w-auto" onClick={onClose}>ปิด</Button></DialogFooter>
          </>
        ) : action === "print" ? (
          <>
            <PaperPreview order={order} />
            <DialogFooter><Button className="w-full sm:w-auto" onClick={onClose}>ปิดตัวอย่าง</Button></DialogFooter>
          </>
        ) : submitted ? (
          <>
            <Alert variant="success" title="ทดลองบันทึกแล้ว" role="status">
              ข้อมูลจริงและสถานะงานไม่เปลี่ยน
            </Alert>
            <div className="space-y-4">
              <Fact label="ขั้นงาน" value={step?.label} />
              {(needsQuantity || action === "assign") && <FactList>
                {needsQuantity && <Fact label={action === "receive" ? "จำนวนรับกลับ" : "จำนวนทำได้รวม"} value={`${quantity} ตัว`} />}
                {action === "receive" && <Fact label="ผลตรวจรับ" value={result === "pass" ? "ผ่าน" : "พบปัญหา"} />}
                {action === "assign" && <Fact label="ผู้รับผิดชอบที่เลือก" value={owner} />}
              </FactList>}
              {notes.trim() && <Fact label={noteLabel} value={<span className="whitespace-pre-wrap break-words">{notes.trim()}</span>} />}
            </div>
            <DialogFooter><Button className="w-full sm:w-auto" onClick={onClose}>ปิด</Button></DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3 border-b border-divider pb-4">
              <p className="font-semibold text-strong">{step?.label}</p>
              <FactList>
                {action === "receive" && step?.outsource && <Fact label="ร้านนอก" value={step.outsource.vendor} />}
                <Fact label="ออเดอร์" value={order.orderNumber} />
                {needsQuantity && <Fact label="จำนวนทั้งขั้น" value={`${step?.qtyTotal} ตัว`} />}
                {action === "assign" && <Fact label="ผู้รับผิดชอบปัจจุบัน" value={step?.owner ?? "ยังไม่ระบุ"} />}
              </FactList>
            </div>
            {action === "resolve" && step?.problem && <Alert variant="warning" title={step.problem.title}>{step.problem.detail}</Alert>}
            <form id={formId} noValidate onSubmit={submit} className="space-y-4">
              {needsQuantity && (
                <Field label={action === "receive" ? "จำนวนรับกลับ (ตัว)" : "จำนวนทำได้รวม (ตัว)"} id={`${formId}-quantity`} required error={errors.quantity}>
                  <NumberInput
                    value={quantity}
                    onValueChange={(value) => { setQuantity(value); setErrors((current) => ({ ...current, quantity: undefined })); }}
                    integer
                    min={0}
                    max={step?.qtyTotal}
                    step={1}
                    placeholder="0"
                  />
                </Field>
              )}
              {action === "receive" && (
                <Field label="ผลตรวจรับ" id={`${formId}-result`} required error={errors.result}>
                  <Select value={result} onChange={(event) => { setResult(event.target.value); setErrors((current) => ({ ...current, result: undefined, notes: undefined })); }}>
                    <option value="">เลือกผลตรวจรับ</option>
                    <option value="pass">ผ่าน</option>
                    <option value="issue">พบปัญหา</option>
                  </Select>
                </Field>
              )}
              {action === "assign" && (
                <Field label="ผู้รับผิดชอบ" id={`${formId}-owner`} required error={errors.owner}>
                  <Select value={owner} onChange={(event) => { setOwner(event.target.value); setErrors((current) => ({ ...current, owner: undefined })); }}>
                    <option value="">เลือกผู้รับผิดชอบ</option>
                    {owners.map((name) => <option key={name} value={name}>{name}</option>)}
                  </Select>
                </Field>
              )}
              <Field label={noteLabel} id={`${formId}-notes`} required={notesRequired} error={errors.notes}>
                <Textarea
                  value={notes}
                  onChange={(event) => { setNotes(event.target.value); setErrors((current) => ({ ...current, notes: undefined })); }}
                  rows={3}
                  maxLength={1000}
                />
              </Field>
            </form>
            <DialogSubmitFooter form={formId} submitLabel="ทดลองบันทึก" onCancel={onClose} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PaperPreview({ order }: { order: LeanOrder }) {
  return (
    <div className="space-y-5">
      <div className="space-y-3 border-b border-divider pb-4">
        <p className="text-xl font-semibold text-strong">{order.orderNumber}</p>
        <FactList>
          <Fact label="ลูกค้า" value={order.customer} />
          <Fact label="กำหนดส่ง" value={order.dueLabel} />
          <Fact label="จำนวนรวม" value={`${order.qty} ตัว`} />
          <Fact label="แบบที่อนุมัติ" value={order.mockupVersion ? `ฉบับ ${order.mockupVersion}` : "ยังไม่มี"} />
        </FactList>
      </div>
      <div className="space-y-4">
        <h3 className="font-semibold text-strong">รายการผลิต</h3>
        {order.items.map((item, index) => (
          <div key={`${item.product}-${index}`} className="space-y-2">
            <div className="flex items-start justify-between gap-4 text-sm font-medium text-strong">
              <p>{item.product}</p><p className="shrink-0 tabular-nums">{item.qty} ตัว</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-secondary sm:grid-cols-3">
              {item.sizes.map((size) => <p key={size.size}>{size.size} <span className="font-medium tabular-nums">{size.qty}</span></p>)}
            </div>
            {item.prints.map((print, printIndex) => <p key={printIndex} className="text-sm text-secondary">{print.position}: {print.technique} ขนาด {print.size}</p>)}
          </div>
        ))}
      </div>
      <div className="space-y-3 border-t border-divider pt-4">
        <h3 className="font-semibold text-strong">ขั้นงาน</h3>
        <ol className="space-y-2">
          {order.steps.map((step) => (
            <li key={step.id} className="flex items-start justify-between gap-4 text-sm">
              <span className="text-strong">{step.order}. {step.label}</span>
              <span className="shrink-0 text-secondary">{RECORD_MODE_LABEL[step.mode]}</span>
            </li>
          ))}
        </ol>
      </div>
      {order.note && <Fact label="หมายเหตุงาน" value={order.note} />}
    </div>
  );
}
