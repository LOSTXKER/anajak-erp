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
import { Textarea } from "@/components/ui/textarea";
import { Ban } from "lucide-react";

// dialog ยกเลิกบิล — แตกจาก order-billing-section (เดิม 1,212 บรรทัดถือ 4 dialog
// + reset มือ) · conditional mount ตามกติกาใน ui/dialog.tsx: ปิดแล้ว React ล้าง
// state ให้เอง ไม่ต้องมี resetVoidForm ในไฟล์แม่อีก
// ใบกำกับภาษี: ยกเลิก-ออกใหม่เท่านั้น ห้ามลบ — เหตุผลบังคับกรอก (ตรง server)
export function VoidInvoiceDialog({
  invoiceId,
  onClose,
}: {
  invoiceId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");

  const utils = trpc.useUtils();
  const voidInvoice = useMutationWithInvalidation(trpc.billing.voidInvoice, {
    invalidate: [utils.billing.listByOrder, utils.order.getById, utils.billing.suggest],
    onSuccess: onClose,
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? "ยกเลิกบิลไม่สำเร็จ");
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ยกเลิกบิล</DialogTitle>
          <DialogDescription>
            การยกเลิกบิลจะทำให้ไม่สามารถใช้งานบิลนี้ได้อีก
          </DialogDescription>
        </DialogHeader>
        <Field label="เหตุผลที่ยกเลิก">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="ระบุเหตุผล..."
          />
        </Field>
        <DialogSubmitFooter
          pending={voidInvoice.isPending}
          disabled={!reason}
          destructive
          submitLabel="ยืนยันยกเลิก"
          submitIcon={<Ban />}
          cancelLabel="ไม่ยกเลิก"
          onCancel={onClose}
          onSubmit={() => voidInvoice.mutate({ invoiceId, reason })}
        />
      </DialogContent>
    </Dialog>
  );
}
