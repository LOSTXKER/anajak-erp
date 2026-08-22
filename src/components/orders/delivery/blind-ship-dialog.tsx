"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";

// dialog ตั้งค่า blind ship — ฝ่ายขายขึ้นไป (server กัน role อีกชั้น) · แตกจาก order-delivery-section
// conditional mount ตามกติกาใน ui/dialog.tsx: seed เปิด/ชื่อผู้ส่งจากค่าปัจจุบันตอน mount
// (เดิม seed มือใน openBlindShipDialog จาก packContext — query นั้นอยู่ที่ parent เหมือนเดิม)
export function BlindShipDialog({
  orderId,
  initialOn,
  initialSender,
  customerName,
  onClose,
}: {
  orderId: string;
  /** ค่า blindShip ปัจจุบันจาก packContext (parent เป็นคนถือ query) */
  initialOn: boolean;
  initialSender: string;
  /** ชื่อลูกค้า fallback ผู้ส่ง — parent resolve packContext.customerName || customerName มาแล้ว */
  customerName?: string;
  onClose: () => void;
}) {
  const [blindShipOn, setBlindShipOn] = useState(initialOn);
  const [blindShipSender, setBlindShipSender] = useState(initialSender);

  const utils = trpc.useUtils();
  const setBlindShipMutation = trpc.order.setBlindShip.useMutation({
    onError: (e) => toast.error(e.message),
    onSuccess: (res) => {
      toast.success(res.blindShip ? "เปิด blind ship แล้ว" : "ปิด blind ship แล้ว");
      utils.delivery.packContext.invalidate({ orderId });
      utils.order.getById.invalidate({ id: orderId });
      // ธงบนบอร์ดผลิต/คิวงานวันนี้ต้อง refresh ด้วย — การ์ดแพ็คโชว์ธงจาก cache เก่าไม่ได้
      utils.production.kanban.invalidate();
      utils.task.myToday.invalidate();
      onClose();
    },
  });

  function handleSaveBlindShip() {
    setBlindShipMutation.mutate({
      orderId,
      blindShip: blindShipOn,
      blindShipSenderName:
        blindShipOn && blindShipSender.trim() ? blindShipSender.trim() : undefined,
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>ตั้งค่า Blind Ship</DialogTitle>
          <DialogDescription>
            ส่งแบบไม่เปิดเผยว่า Anajak เป็นผู้ผลิต — ห้ามใส่เอกสาร/ชื่อโรงงานในกล่อง
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="delivery-blind-ship">
              เปิด blind ship ออเดอร์นี้
            </Label>
            <Switch
              id="delivery-blind-ship"
              checked={blindShipOn}
              onCheckedChange={setBlindShipOn}
            />
          </div>
          {blindShipOn && (
            <Field
              label="ชื่อผู้ส่งบนใบจ่าหน้า"
              help={`เว้นว่างเพื่อใช้ชื่อลูกค้า (${customerName || "-"})`}
            >
              <Input
                type="text"
                value={blindShipSender}
                onChange={(e) => setBlindShipSender(e.target.value)}
                maxLength={200}
                placeholder={customerName || "ชื่อลูกค้า/แบรนด์"}
              />
            </Field>
          )}
        </div>
        <DialogSubmitFooter
          pending={setBlindShipMutation.isPending}
          submitLabel="บันทึก"
          submitIcon={<Check />}
          onCancel={onClose}
          onSubmit={handleSaveBlindShip}
        />
      </DialogContent>
    </Dialog>
  );
}
