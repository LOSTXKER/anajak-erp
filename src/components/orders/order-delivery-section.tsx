"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_VARIANTS, SHIPPING_METHOD_LABELS } from "@/lib/status-config";
import {
  Truck,
  Plus,
  Loader2,
  Check,
  Package,
  MapPin,
  Hash,
  Trash2,
} from "lucide-react";
import type { RouterOutput } from "@/lib/trpc";

type Delivery = RouterOutput["delivery"]["getByOrderId"][number];

interface OrderDeliverySectionProps {
  orderId: string;
  internalStatus: string;
  customerName?: string;
  customerPhone?: string;
}


export function OrderDeliverySection({
  orderId,
  internalStatus,
  customerName,
  customerPhone,
}: OrderDeliverySectionProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState<string | null>(null);
  const [editTrackingId, setEditTrackingId] = useState<string | null>(null);
  const [editTrackingValue, setEditTrackingValue] = useState("");

  // Create form state
  const [recipientName, setRecipientName] = useState(customerName || "");
  const [phone, setPhone] = useState(customerPhone || "");
  const [address, setAddress] = useState("");
  const [subDistrict, setSubDistrict] = useState("");
  const [district, setDistrict] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [shippingMethod, setShippingMethod] = useState("KERRY");
  const [shippingCost, setShippingCost] = useState("0");
  const [deliveryNotes, setDeliveryNotes] = useState("");

  // Status update form
  const [newStatus, setNewStatus] = useState("");
  const [statusTrackingNumber, setStatusTrackingNumber] = useState("");

  const utils = trpc.useUtils();
  const deliveries = trpc.delivery.getByOrderId.useQuery({ orderId });

  const createDelivery = trpc.delivery.create.useMutation({
    onSuccess: () => {
      utils.delivery.getByOrderId.invalidate({ orderId });
      utils.order.getById.invalidate({ id: orderId });
      setShowCreateDialog(false);
      resetCreateForm();
    },
  });

  const updateDelivery = trpc.delivery.update.useMutation({
    onSuccess: () => {
      utils.delivery.getByOrderId.invalidate({ orderId });
      utils.order.getById.invalidate({ id: orderId });
      setEditTrackingId(null);
      setEditTrackingValue("");
    },
  });

  const updateDeliveryStatus = trpc.delivery.updateStatus.useMutation({
    onSuccess: () => {
      utils.delivery.getByOrderId.invalidate({ orderId });
      utils.order.getById.invalidate({ id: orderId });
      setShowStatusDialog(null);
    },
  });

  const deleteDelivery = useMutationWithInvalidation(trpc.delivery.delete, {
    invalidate: [utils.delivery.getByOrderId, utils.order.getById],
  });

  function resetCreateForm() {
    setRecipientName(customerName || "");
    setPhone(customerPhone || "");
    setAddress("");
    setSubDistrict("");
    setDistrict("");
    setProvince("");
    setPostalCode("");
    setShippingMethod("KERRY");
    setShippingCost("0");
    setDeliveryNotes("");
  }

  function handleCreate() {
    createDelivery.mutate({
      orderId,
      recipientName,
      phone,
      address,
      subDistrict: subDistrict || undefined,
      district: district || undefined,
      province: province || undefined,
      postalCode: postalCode || undefined,
      shippingMethod,
      shippingCost: parseFloat(shippingCost) || 0,
      notes: deliveryNotes || undefined,
    });
  }

  function handleStatusUpdate() {
    if (!showStatusDialog || !newStatus) return;
    updateDeliveryStatus.mutate({
      id: showStatusDialog,
      status: newStatus as "PENDING" | "PREPARING" | "SHIPPED" | "DELIVERED" | "RETURNED",
      trackingNumber: statusTrackingNumber || undefined,
    });
  }

  function openStatusDialog(delivery: Delivery) {
    setShowStatusDialog(delivery.id);
    setNewStatus(delivery.status);
    setStatusTrackingNumber(delivery.trackingNumber || "");
  }

  const canCreate = [
    "PACKING",
    "READY_TO_SHIP",
    "SHIPPED",
  ].includes(internalStatus);

  const hasDeliveries = deliveries.data && deliveries.data.length > 0;

  if (
    !hasDeliveries &&
    !["PACKING", "READY_TO_SHIP", "SHIPPED", "COMPLETED"].includes(internalStatus)
  ) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="h-4 w-4" />
              การจัดส่ง
            </CardTitle>
            {canCreate && (
              <Button
                size="sm"
                onClick={() => {
                  resetCreateForm();
                  setShowCreateDialog(true);
                }}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                สร้างรายการจัดส่ง
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!hasDeliveries ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              ยังไม่มีข้อมูลจัดส่ง
            </p>
          ) : (
            <div className="space-y-3">
              {deliveries.data!.map((delivery) => (
                <div
                  key={delivery.id}
                  className="rounded-lg border border-slate-200 p-4 dark:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            DELIVERY_STATUS_VARIANTS[delivery.status as keyof typeof DELIVERY_STATUS_VARIANTS] || "default"
                          }
                        >
                          {DELIVERY_STATUS_LABELS[delivery.status as keyof typeof DELIVERY_STATUS_LABELS] || delivery.status}
                        </Badge>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {SHIPPING_METHOD_LABELS[delivery.shippingMethod] ||
                            delivery.shippingMethod}
                        </span>
                      </div>

                      {/* Tracking number */}
                      {editTrackingId === delivery.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            value={editTrackingValue}
                            onChange={(e) => setEditTrackingValue(e.target.value)}
                            placeholder="เลขพัสดุ..."
                            className="h-8 w-48 font-mono"
                            autoFocus
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              updateDelivery.mutate({
                                id: delivery.id,
                                trackingNumber: editTrackingValue,
                              });
                            }}
                            disabled={updateDelivery.isPending}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {delivery.trackingNumber ? (
                            <span className="font-mono text-sm text-blue-600 dark:text-blue-400">
                              <Hash className="mr-0.5 inline h-3 w-3" />
                              {delivery.trackingNumber}
                            </span>
                          ) : (
                            <button
                              className="text-xs text-slate-400 hover:text-blue-500"
                              onClick={() => {
                                setEditTrackingId(delivery.id);
                                setEditTrackingValue(delivery.trackingNumber || "");
                              }}
                            >
                              + เพิ่มเลขพัสดุ
                            </button>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="h-3 w-3" />
                        <span>{delivery.recipientName}</span>
                        {delivery.phone && <span>| {delivery.phone}</span>}
                      </div>

                      <div className="flex gap-3 text-xs text-slate-400">
                        {delivery.shippedAt && (
                          <span>ส่ง: {formatDateTime(delivery.shippedAt)}</span>
                        )}
                        {delivery.deliveredAt && (
                          <span>ถึง: {formatDateTime(delivery.deliveredAt)}</span>
                        )}
                        {delivery.shippingCost > 0 && (
                          <span>ค่าส่ง: {formatCurrency(delivery.shippingCost)}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 gap-1">
                      {delivery.status !== "DELIVERED" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => openStatusDialog(delivery)}
                        >
                          อัปเดต
                        </Button>
                      )}
                      {delivery.status === "PENDING" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500"
                          onClick={() => deleteDelivery.mutate({ id: delivery.id })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Delivery Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>สร้างรายการจัดส่ง</DialogTitle>
            <DialogDescription>กรอกข้อมูลผู้รับและวิธีจัดส่ง</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  ชื่อผู้รับ *
                </label>
                <Input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  เบอร์โทร *
                </label>
                <Input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                ที่อยู่ *
              </label>
              <Textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  ตำบล/แขวง
                </label>
                <Input
                  type="text"
                  value={subDistrict}
                  onChange={(e) => setSubDistrict(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  อำเภอ/เขต
                </label>
                <Input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  จังหวัด
                </label>
                <Input
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  รหัสไปรษณีย์
                </label>
                <Input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  วิธีจัดส่ง
                </label>
                <Select value={shippingMethod} onValueChange={setShippingMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KERRY">Kerry Express</SelectItem>
                    <SelectItem value="FLASH">Flash Express</SelectItem>
                    <SelectItem value="THAILAND_POST">ไปรษณีย์ไทย</SelectItem>
                    <SelectItem value="J_AND_T">J&T Express</SelectItem>
                    <SelectItem value="GRAB">Grab Express</SelectItem>
                    <SelectItem value="LALAMOVE">Lalamove</SelectItem>
                    <SelectItem value="PICKUP">รับเอง</SelectItem>
                    <SelectItem value="OTHER">อื่นๆ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  ค่าจัดส่ง (บาท)
                </label>
                <Input
                  type="number"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(e.target.value)}
                  min="0"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                หมายเหตุ
              </label>
              <Textarea
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                rows={2}
                placeholder="หมายเหตุ..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                !recipientName || !phone || !address || createDelivery.isPending
              }
              className="gap-1.5"
            >
              {createDelivery.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Truck className="h-4 w-4" />
              )}
              สร้างรายการจัดส่ง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog
        open={showStatusDialog !== null}
        onOpenChange={(open) => !open && setShowStatusDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>อัปเดตสถานะจัดส่ง</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                สถานะ
              </label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">รอดำเนินการ</SelectItem>
                  <SelectItem value="PREPARING">กำลังเตรียม</SelectItem>
                  <SelectItem value="SHIPPED">จัดส่งแล้ว</SelectItem>
                  <SelectItem value="DELIVERED">ส่งถึงแล้ว</SelectItem>
                  <SelectItem value="RETURNED">ตีกลับ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(newStatus === "SHIPPED" || newStatus === "PREPARING") && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  เลขพัสดุ
                </label>
                <Input
                  type="text"
                  value={statusTrackingNumber}
                  onChange={(e) => setStatusTrackingNumber(e.target.value)}
                  className="font-mono"
                  placeholder="เลขพัสดุ..."
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowStatusDialog(null)}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleStatusUpdate}
              disabled={!newStatus || updateDeliveryStatus.isPending}
              className="gap-1.5"
            >
              {updateDeliveryStatus.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
