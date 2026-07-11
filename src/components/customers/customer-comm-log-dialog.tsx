"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
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
import { COMM_CHANNELS } from "@/lib/comm-channels";
import {
  buildCustomerCommunicationPayload,
  validateCustomerCommunicationForm,
  type CustomerCommunicationForm,
} from "@/lib/customer-form";
import { Loader2, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";

// บันทึกการคุยกับลูกค้า (Gate B7) — ต่อท่อ addCommunicationLog ที่มีอยู่แล้ว
// (เดิม dead mutation) · คุยอะไรกับลูกค้าต้องอยู่ในระบบ ไม่ใช่ความจำคนขาย

export function CustomerCommLogDialog({
  customerId,
  customerName,
  onClose,
}: {
  customerId: string;
  customerName: string;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CustomerCommunicationForm>({
    channel: "LINE",
    subject: "",
    content: "",
  });

  const utils = trpc.useUtils();
  const add = useMutationWithInvalidation(trpc.customer.addCommunicationLog, {
    invalidate: [utils.customer.getById],
    onSuccess: () => {
      toast.success("บันทึกการคุยแล้ว");
      onClose();
    },
    onError: (err: { message?: string }) => {
      toast.error("บันทึกไม่สำเร็จ", { description: err.message });
    },
  });
  const validationErrors = validateCustomerCommunicationForm(form);
  const isFormValid = Object.keys(validationErrors).length === 0;

  function set(patch: Partial<CustomerCommunicationForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isFormValid) return;
    add.mutate(buildCustomerCommunicationPayload(customerId, form));
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>บันทึกการคุย</DialogTitle>
          <DialogDescription>
            {customerName} — คุยอะไรไว้จดลงระบบ ทีมอื่นเห็นด้วย ไม่หายไปกับคนคุย
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select value={form.channel} onValueChange={(channel) => set({ channel })}>
              <Field label="ช่องทาง" id="communication-channel">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
              </Field>
                <SelectContent>
                  {COMM_CHANNELS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
            </Select>
            <Field label="หัวข้อ (ถ้ามี)">
              <Input
                value={form.subject}
                onChange={(e) => set({ subject: e.target.value })}
                placeholder="เช่น ตามงาน / ทวงมัดจำ"
              />
            </Field>
          </div>
          <Field
            label="คุยอะไร"
            required
            error={form.content.length > 0 ? validationErrors.content : undefined}
          >
            <Textarea
              value={form.content}
              onChange={(e) => set({ content: e.target.value })}
              rows={4}
              required
              placeholder="สรุปที่คุยกับลูกค้า เช่น ลูกค้าขอเลื่อนส่งเป็นศุกร์หน้า / ตกลงราคาแล้วรอโอนมัดจำ"
            />
          </Field>

          {add.error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
            >
              บันทึกไม่สำเร็จ: {add.error.message}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button
              type="submit"
              disabled={add.isPending || !isFormValid}
              className="gap-1.5"
            >
              {add.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquarePlus className="h-4 w-4" />
              )}
              บันทึก
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
