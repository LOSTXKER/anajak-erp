"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  const [channel, setChannel] = useState("LINE");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");

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

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>บันทึกการคุย</DialogTitle>
          <DialogDescription>
            {customerName} — คุยอะไรไว้จดลงระบบ ทีมอื่นเห็นด้วย ไม่หายไปกับคนคุย
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">ช่องทาง</label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMM_CHANNELS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">หัวข้อ (ถ้ามี)</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="เช่น ตามงาน / ทวงมัดจำ"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              คุยอะไร <span className="text-red-500">*</span>
            </label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="สรุปที่คุยกับลูกค้า เช่น ลูกค้าขอเลื่อนส่งเป็นศุกร์หน้า / ตกลงราคาแล้วรอโอนมัดจำ"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            onClick={() =>
              add.mutate({
                customerId,
                channel,
                subject: subject.trim() || undefined,
                content: content.trim(),
              })
            }
            disabled={add.isPending || !content.trim()}
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
      </DialogContent>
    </Dialog>
  );
}
