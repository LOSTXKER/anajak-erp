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
import { PAYMENT_METHODS, DEFAULT_PAYMENT_METHOD } from "@/lib/payment-methods";
import { Undo2 } from "lucide-react";

// dialog คืนเงินให้ลูกค้า — แตกจาก order-billing-section · conditional mount ตามกติกา
// ใน ui/dialog.tsx: state ฟอร์ม seed จาก props ตอน mount ปิดแล้ว React ล้างให้เอง
// (คืนเงิน — server เก็บเป็น payment ยอดติดลบ · ลด totalSpent · คู่กับใบลดหนี้)
export function RecordRefundDialog({
  invoiceId,
  initialAmount,
  onClose,
}: {
  invoiceId: string;
  /** ยอดคืน default = เงินสดสุทธิที่รับไว้ของบิล (netCash — คืนได้ไม่เกินนี้) */
  initialAmount: string;
  onClose: () => void;
}) {
  const [refundAmount, setRefundAmount] = useState(initialAmount);
  const [refundMethod, setRefundMethod] = useState<string>(DEFAULT_PAYMENT_METHOD);
  const [refundReference, setRefundReference] = useState("");
  const [refundNotes, setRefundNotes] = useState("");

  const utils = trpc.useUtils();
  const recordRefund = useMutationWithInvalidation(trpc.billing.recordRefund, {
    invalidate: [utils.billing.listByOrder, utils.order.getById],
    onSuccess: onClose,
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "บันทึกคืนเงินไม่สำเร็จ");
    },
  });

  function handleRecordRefund() {
    recordRefund.mutate({
      invoiceId,
      amount: parseFloat(refundAmount) || 0,
      method: refundMethod,
      reference: refundReference || undefined,
      notes: refundNotes || undefined,
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
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
            <Select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} id="billing-refund-method">
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
        <DialogSubmitFooter
          pending={recordRefund.isPending}
          disabled={(parseFloat(refundAmount) || 0) <= 0}
          submitLabel="ยืนยันคืนเงิน"
          submitIcon={<Undo2 />}
          onCancel={onClose}
          onSubmit={handleRecordRefund}
        />
      </DialogContent>
    </Dialog>
  );
}
