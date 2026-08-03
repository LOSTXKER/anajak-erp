"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { RouterOutput } from "@/lib/trpc";
import { nextDeliveryStatuses, type DeliveryStatus } from "@/lib/delivery-status";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogSubmitFooter } from "@/components/ui/dialog-submit-footer";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { DELIVERY_STATUS_LABELS } from "@/lib/status-config";
import { Check } from "lucide-react";

type Delivery = RouterOutput["delivery"]["getByOrderId"][number];

// dialog อัปเดตสถานะใบส่ง — แตกจาก order-delivery-section (เดิมถือ 3 dialog + reset มือ)
// conditional mount ตามกติกาใน ui/dialog.tsx: mount ใหม่ทุกครั้งที่เปิด state seed จาก props สดเสมอ
export function DeliveryStatusDialog({
  delivery,
  suggestedStatus,
  orderId,
  onClose,
}: {
  delivery: Delivery;
  /** สถานะถัดไปที่ปุ่มในการ์ดแนะนำ (deliveryActionAvailability.nextAction) — เป็นค่าเริ่มใน dropdown */
  suggestedStatus: DeliveryStatus;
  orderId: string;
  onClose: () => void;
}) {
  const [newStatus, setNewStatus] = useState<string>(suggestedStatus);
  const [statusTrackingNumber, setStatusTrackingNumber] = useState(
    delivery.trackingNumber || ""
  );
  // สถานะปัจจุบันของใบที่กำลังแก้ — ใช้กรอง dropdown ให้โชว์เฉพาะที่เดินไปได้ (B13 state machine)
  const statusFrom = delivery.status as DeliveryStatus;

  const utils = trpc.useUtils();
  const updateDeliveryStatus = trpc.delivery.updateStatus.useMutation({
    onError: (e) => toast.error(e.message),
    onSuccess: () => {
      utils.delivery.getByOrderId.invalidate({ orderId });
      utils.order.getById.invalidate({ id: orderId });
      onClose();
    },
  });

  function handleStatusUpdate() {
    if (!newStatus) return;
    updateDeliveryStatus.mutate({
      id: delivery.id,
      status: newStatus as "PENDING" | "PREPARING" | "SHIPPED" | "DELIVERED" | "RETURNED",
      trackingNumber: statusTrackingNumber || undefined,
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>อัปเดตสถานะจัดส่ง</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delivery-status">สถานะ</Label>
            <Select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} id="delivery-status">
                {/* เฉพาะสถานะปัจจุบัน + ที่เดินไปได้ (B13) — เลือกสถานะที่ server จะปฏิเสธไม่ได้ */}
                {nextDeliveryStatuses(statusFrom).map((s) => (
                  <option key={s} value={s}>
                    {DELIVERY_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
          </div>
          {(newStatus === "SHIPPED" || newStatus === "PREPARING") && (
            <Field label="เลขพัสดุ">
              <Input
                type="text"
                value={statusTrackingNumber}
                onChange={(e) => setStatusTrackingNumber(e.target.value)}
                className="font-mono"
                placeholder="เลขพัสดุ..."
              />
            </Field>
          )}
        </div>
        <DialogSubmitFooter
          pending={updateDeliveryStatus.isPending}
          disabled={!newStatus}
          submitLabel="บันทึก"
          submitIcon={<Check />}
          onCancel={onClose}
          onSubmit={handleStatusUpdate}
        />
      </DialogContent>
    </Dialog>
  );
}
