"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useConfirm } from "@/components/ui/confirm-dialog";
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
import { Switch } from "@/components/ui/switch";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
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
  Printer,
  Settings2,
} from "lucide-react";
import type { RouterOutput } from "@/lib/trpc";

type Delivery = RouterOutput["delivery"]["getByOrderId"][number];

// คีย์แถวนับต่อไซส์+สี — ต้อง normalize เหมือนฝั่ง server (delivery.ts packKey) ให้ map ตรงกัน
const lineKey = (size?: string | null, color?: string | null) =>
  `${(size ?? "").trim().toLowerCase()}|${(color ?? "").trim().toLowerCase()}`;

// ป้ายไซส์/สีสั้นๆ ไว้โชว์ในสรุปต่อกล่อง เช่น "M ดำ" — ไม่มีทั้งคู่ค่อยถอยไปใช้ description
const sizeColorLabel = (l: { size?: string | null; color?: string | null; description: string }) =>
  [l.size, l.color].filter(Boolean).join(" ") || l.description;

interface OrderDeliverySectionProps {
  orderId: string;
  internalStatus: string;
  customerName?: string;
  customerPhone?: string;
  // ลูกค้ามีที่อยู่ในโปรไฟล์แล้วหรือยัง — ถ้ายัง default ติ๊กบันทึกที่อยู่จัดส่งกลับโปรไฟล์
  customerHasAddress?: boolean;
}


export function OrderDeliverySection({
  orderId,
  internalStatus,
  customerName,
  customerPhone,
  customerHasAddress,
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
  // ลูกค้ายังไม่มีที่อยู่ในโปรไฟล์ → default บันทึกกลับให้เลย (ออเดอร์หน้า prefill อัตโนมัติ)
  const [saveAsCustomerAddress, setSaveAsCustomerAddress] = useState(!customerHasAddress);

  // แพ็คนับยืนยันต่อไซส์ (ก้อน 3) — จำนวนรอบนี้ต่อแถว key = ไซส์|สี (เก็บ string ให้พิมพ์แก้ได้)
  const [packQty, setPackQty] = useState<Record<string, string>>({});

  // Blind ship dialog state
  const [showBlindShipDialog, setShowBlindShipDialog] = useState(false);
  const [blindShipOn, setBlindShipOn] = useState(false);
  const [blindShipSender, setBlindShipSender] = useState("");

  // Status update form
  const [newStatus, setNewStatus] = useState("");
  const [statusTrackingNumber, setStatusTrackingNumber] = useState("");

  const utils = trpc.useUtils();
  const deliveries = trpc.delivery.getByOrderId.useQuery({ orderId });
  // บริบทแพ็ค: เหลือเท่าไหร่ต่อไซส์ + ธง blind ship — ใช้ทั้งแถบหัว section และตารางนับใน dialog
  const packContext = trpc.delivery.packContext.useQuery({ orderId });

  const createDelivery = trpc.delivery.create.useMutation({
    onError: (e) => toast.error(e.message),
    onSuccess: () => {
      utils.delivery.getByOrderId.invalidate({ orderId });
      utils.delivery.packContext.invalidate({ orderId });
      utils.order.getById.invalidate({ id: orderId });
      setShowCreateDialog(false);
      resetCreateForm();
    },
  });

  const setBlindShipMutation = trpc.order.setBlindShip.useMutation({
    onError: (e) => toast.error(e.message),
    onSuccess: (res) => {
      toast.success(res.blindShip ? "เปิด blind ship แล้ว" : "ปิด blind ship แล้ว");
      utils.delivery.packContext.invalidate({ orderId });
      utils.order.getById.invalidate({ id: orderId });
      setShowBlindShipDialog(false);
    },
  });

  const updateDelivery = trpc.delivery.update.useMutation({
    onError: (e) => toast.error(e.message),
    onSuccess: () => {
      utils.delivery.getByOrderId.invalidate({ orderId });
      utils.order.getById.invalidate({ id: orderId });
      setEditTrackingId(null);
      setEditTrackingValue("");
    },
  });

  const updateDeliveryStatus = trpc.delivery.updateStatus.useMutation({
    onError: (e) => toast.error(e.message),
    onSuccess: () => {
      utils.delivery.getByOrderId.invalidate({ orderId });
      utils.order.getById.invalidate({ id: orderId });
      setShowStatusDialog(null);
    },
  });

  const deleteDelivery = useMutationWithInvalidation(trpc.delivery.delete, {
    invalidate: [utils.delivery.getByOrderId, utils.order.getById],
  });
  // ลบใบส่ง = ผู้จัดการขึ้นไป (server: managerUp) — ซ่อนปุ่มให้ตรง + ถามก่อนลบ
  const confirm = useConfirm();
  const { data: me } = trpc.user.me.useQuery();
  const canDelete = !me || ["OWNER", "MANAGER"].includes(me.role);
  // ตั้งค่า blind ship = ฝ่ายขายขึ้นไป (server: order.setBlindShip) — role อื่นเห็นธงอย่างเดียว
  const canSetBlindShip = !me || ["OWNER", "MANAGER", "SALES"].includes(me.role);

  // แถวนับยืนยันใน dialog สร้างใบส่ง — ผูกค่าที่กรอกเข้ากับแถวจาก packContext
  const packLines = packContext.data?.lines ?? [];
  const totalRemaining = packContext.data?.totalRemaining ?? 0;
  const packRows = packLines.map((l) => {
    const key = lineKey(l.size, l.color);
    const raw = packQty[key] ?? "";
    const qty = raw.trim() === "" ? 0 : Number(raw);
    // ห้ามเกิน remaining / ติดลบ / ไม่ใช่จำนวนเต็ม — ขอบแดง + กันกดสร้าง (server กันอีกชั้น)
    const invalid = !Number.isInteger(qty) || qty < 0 || qty > l.remaining;
    return { ...l, key, raw, qty, invalid };
  });
  const packInvalid = packRows.some((r) => r.invalid);
  const packTotal = packRows.reduce((s, r) => s + (r.invalid ? 0 : r.qty), 0);

  function openBlindShipDialog() {
    setBlindShipOn(packContext.data?.blindShip ?? false);
    setBlindShipSender(packContext.data?.blindShipSenderName ?? "");
    setShowBlindShipDialog(true);
  }

  function handleSaveBlindShip() {
    setBlindShipMutation.mutate({
      orderId,
      blindShip: blindShipOn,
      blindShipSenderName:
        blindShipOn && blindShipSender.trim() ? blindShipSender.trim() : undefined,
    });
  }

  async function handleDelete(deliveryId: string) {
    const ok = await confirm({
      title: "ลบใบส่งนี้?",
      description: "ลบแล้วกู้คืนไม่ได้ — ใช้กับใบที่สร้างผิดเท่านั้น",
      confirmText: "ลบใบส่ง",
      destructive: true,
    });
    if (ok) deleteDelivery.mutate({ id: deliveryId });
  }

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
    // derive ใหม่ทุกครั้งที่เปิด dialog — หลังบันทึกที่อยู่รอบแรก รอบถัดไปต้องไม่ติ๊กค้าง
    // (ไม่งั้นส่งรอบสองไปที่อยู่อื่นจะทับที่อยู่หลักเงียบๆ)
    setSaveAsCustomerAddress(!customerHasAddress);
    // นับยืนยันรอบนี้ default = ที่เหลือทั้งหมดต่อแถว (เคสปกติ: ส่งครบในรอบเดียว แก้ลงได้)
    const init: Record<string, string> = {};
    for (const l of packContext.data?.lines ?? []) {
      init[lineKey(l.size, l.color)] = String(l.remaining);
    }
    setPackQty(init);
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
      saveAsCustomerAddress,
      // ส่งเฉพาะแถวที่นับจริง (qty > 0) — ออเดอร์ไม่มีรายการไซส์ = [] ทำงานแบบเดิม
      lines: packRows
        .filter((r) => !r.invalid && r.qty > 0)
        .map((r) => ({
          description: r.description,
          size: r.size ?? undefined,
          color: r.color ?? undefined,
          qty: r.qty,
        })),
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
      <Card id="order-section-delivery" className="scroll-mt-20">
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

          {/* ธง blind ship — ต้องเห็นก่อนหยิบของลงกล่อง ห้ามพลาด */}
          {packContext.data?.blindShip && (
            <div className="mt-2 rounded-lg border-2 border-red-500 bg-red-50 px-3 py-2 dark:border-red-600 dark:bg-red-950/40">
              <p className="text-sm font-bold text-red-700 dark:text-red-300">
                🚫 BLIND SHIP — ห้ามใส่เอกสาร/ชื่อ Anajak ในกล่อง
              </p>
              <p className="mt-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                ผู้ส่งบนใบ: {packContext.data.blindShipSenderName || packContext.data.customerName}
              </p>
            </div>
          )}
          {canSetBlindShip && packContext.data && (
            <button
              type="button"
              onClick={openBlindShipDialog}
              className="mt-1 flex w-fit items-center gap-1 text-xs text-slate-400 transition-colors hover:text-blue-500"
            >
              <Settings2 className="h-3 w-3" />
              {packContext.data.blindShip ? "ตั้งค่า blind ship" : "ตั้งค่า blind ship (ปิดอยู่)"}
            </button>
          )}
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

                      {/* รายการต่อกล่อง (ก้อน 3) — กล่องนี้มีอะไรบ้าง เช่น "10 ตัว (M ดำ ×6 · L ดำ ×4)" */}
                      {delivery.lines.length > 0 && (
                        <div className="flex items-start gap-1 text-xs text-slate-500 dark:text-slate-400">
                          <Package className="mt-0.5 h-3 w-3 shrink-0" />
                          <span>
                            {delivery.lines.reduce((s, l) => s + l.qty, 0)} ตัว (
                            {delivery.lines
                              .map((l) => `${sizeColorLabel(l)} ×${l.qty}`)
                              .join(" · ")}
                            )
                          </span>
                        </div>
                      )}

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
                      {delivery.lines.length > 0 && (
                        <a
                          href={`/print/packing-list/${delivery.id}`}
                          target="_blank"
                          rel="noreferrer"
                          title="ใบรายการแนบกล่อง"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </a>
                      )}
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
                      {delivery.status === "PENDING" && canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500"
                          onClick={() => handleDelete(delivery.id)}
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
            {/* รายการรอบนี้ (นับยืนยัน) — ออเดอร์ไม่มีรายการไซส์ → ซ่อน ทำงานแบบเดิม */}
            {packRows.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  รายการรอบนี้ (นับยืนยัน)
                </label>
                {totalRemaining === 0 ? (
                  <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                    ของครบทุกใบส่งแล้ว
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                    {packRows.map((r) => (
                      <div
                        key={r.key}
                        className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-slate-900 dark:text-white">
                            {r.description}
                            {(r.size || r.color) && (
                              <span className="text-slate-500 dark:text-slate-400">
                                {" — "}
                                {[r.size, r.color].filter(Boolean).join(" / ")}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400">
                            สั่ง {r.ordered} · ส่งแล้ว {r.packed}
                          </p>
                        </div>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={r.remaining}
                          value={r.raw}
                          disabled={r.remaining === 0}
                          onChange={(e) =>
                            setPackQty((prev) => ({ ...prev, [r.key]: e.target.value }))
                          }
                          className={cn(
                            "h-8 w-16 shrink-0 text-right",
                            r.invalid &&
                              "border-red-500 focus-visible:ring-red-500/40 dark:border-red-600"
                          )}
                        />
                      </div>
                    ))}
                    <div className="flex items-center justify-between bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        รวมรอบนี้ {packTotal} ตัว
                      </span>
                      <span className="text-xs text-slate-400">
                        เหลือทั้งหมด {totalRemaining} ตัว
                      </span>
                    </div>
                  </div>
                )}
                {packInvalid && (
                  <p className="mt-1 text-xs text-red-500">
                    จำนวนเกินที่เหลือ — แก้ช่องขอบแดงก่อนสร้างใบส่ง
                  </p>
                )}
              </div>
            )}
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
            <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={saveAsCustomerAddress}
                onChange={(e) => setSaveAsCustomerAddress(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-blue-600"
              />
              <span>
                บันทึกเป็นที่อยู่หลักของลูกค้า (เติมเบอร์นี้ให้โปรไฟล์ด้วยถ้ายังว่าง)
                {!customerHasAddress ? (
                  <span className="block text-xs text-amber-600 dark:text-amber-400">
                    ลูกค้ารายนี้ยังไม่มีที่อยู่ในระบบ — บันทึกไว้ ออเดอร์หน้าจะกรอกให้อัตโนมัติ
                  </span>
                ) : (
                  <span className="block text-xs text-slate-400">
                    ลูกค้ามีที่อยู่หลักอยู่แล้ว — ติ๊กเฉพาะถ้าต้องการแทนที่ด้วยที่อยู่นี้
                  </span>
                )}
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                !recipientName ||
                !phone ||
                !address ||
                packInvalid ||
                createDelivery.isPending
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

      {/* Blind Ship Settings Dialog — ฝ่ายขายขึ้นไป (server กัน role อีกชั้น) */}
      <Dialog open={showBlindShipDialog} onOpenChange={setShowBlindShipDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ตั้งค่า Blind Ship</DialogTitle>
            <DialogDescription>
              ส่งแบบไม่เปิดเผยว่า Anajak เป็นผู้ผลิต — ห้ามใส่เอกสาร/ชื่อโรงงานในกล่อง
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                เปิด blind ship ออเดอร์นี้
              </span>
              <Switch checked={blindShipOn} onCheckedChange={setBlindShipOn} />
            </div>
            {blindShipOn && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  ชื่อผู้ส่งบนใบจ่าหน้า
                </label>
                <Input
                  type="text"
                  value={blindShipSender}
                  onChange={(e) => setBlindShipSender(e.target.value)}
                  maxLength={200}
                  placeholder={
                    packContext.data?.customerName || customerName || "ชื่อลูกค้า/แบรนด์"
                  }
                />
                <p className="mt-1 text-xs text-slate-400">
                  เว้นว่าง = ใช้ชื่อลูกค้า ({packContext.data?.customerName || customerName || "-"})
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlindShipDialog(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleSaveBlindShip}
              disabled={setBlindShipMutation.isPending}
              className="gap-1.5"
            >
              {setBlindShipMutation.isPending ? (
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
