"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import { toast } from "sonner";
import { type DeliveryStatus } from "@/lib/delivery-status";
import { type OrderShippingSource } from "@/lib/address-fill";
import {
  canCreateDelivery,
  deliveryActionAvailability,
  shouldShowDeliverySection,
} from "@/lib/delivery-ui";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { QueryError } from "@/components/ui/query-error";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_VARIANTS } from "@/lib/status-config";
import { SHIPPING_METHOD_LABELS } from "@/lib/shipping-methods";
import {
  Truck,
  Plus,
  Check,
  Package,
  MapPin,
  Hash,
  Trash2,
  Printer,
  Settings2,
} from "lucide-react";
import type { RouterOutput } from "@/lib/trpc";
import { BlindShipDialog } from "@/components/orders/delivery/blind-ship-dialog";
import {
  CreateDeliveryDialog,
  sizeColorLabel,
} from "@/components/orders/delivery/create-delivery-dialog";
import { DeliveryStatusDialog } from "@/components/orders/delivery/delivery-status-dialog";
import { Spinner } from "@/components/ui/spinner";
import { CONTROL_MIN_H } from "@/components/ui/control-size";
import { CONTROL_H } from "@/components/ui/control-size";
import { RADIUS } from "@/components/ui/tokens";
import { Alert } from "@/components/ui/alert";

type Delivery = RouterOutput["delivery"]["getByOrderId"][number];

interface OrderDeliverySectionProps {
  orderId: string;
  internalStatus: string;
  customerName?: string;
  customerPhone?: string;
  // ลูกค้ามีที่อยู่ในโปรไฟล์แล้วหรือยัง — มีแล้วห้ามให้ใบส่งทับ (ปิดช่องเติมกลับ)
  customerHasAddress?: boolean;
  customerAddress?: string | null;
  /** ที่อยู่จัดส่งบนใบงาน — ใช้ตั้งต้นฟอร์มสร้างใบส่ง (เดิมคนแพ็คต้องพิมพ์ใหม่ทั้งชุด) */
  orderShipping?: OrderShippingSource | null;
}


export function OrderDeliverySection({
  orderId,
  internalStatus,
  customerName,
  customerPhone,
  customerHasAddress,
  customerAddress,
  orderShipping,
}: OrderDeliverySectionProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  // ใบส่ง + สถานะแนะนำที่กำลังจะอัปเดต — conditional mount DeliveryStatusDialog (กติกา ui/dialog.tsx)
  const [statusTarget, setStatusTarget] = useState<{
    delivery: Delivery;
    suggestedStatus: DeliveryStatus;
  } | null>(null);
  const [editTrackingId, setEditTrackingId] = useState<string | null>(null);
  const [editTrackingValue, setEditTrackingValue] = useState("");

  // Blind ship dialog state
  const [showBlindShipDialog, setShowBlindShipDialog] = useState(false);

  const utils = trpc.useUtils();
  const deliveries = trpc.delivery.getByOrderId.useQuery({ orderId });
  // บริบทแพ็ค: เหลือเท่าไหร่ต่อไซส์ + ธง blind ship — ใช้ทั้งแถบหัว section และตารางนับใน dialog
  const packContext = trpc.delivery.packContext.useQuery({ orderId });

  const updateDelivery = trpc.delivery.update.useMutation({
    onError: (e) => toast.error(e.message),
    onSuccess: () => {
      utils.delivery.getByOrderId.invalidate({ orderId });
      utils.order.getById.invalidate({ id: orderId });
      setEditTrackingId(null);
      setEditTrackingValue("");
    },
  });

  const deleteDelivery = useMutationWithInvalidation(trpc.delivery.delete, {
    invalidate: [utils.delivery.getByOrderId, utils.order.getById],
  });
  // ลบใบส่ง = ผู้จัดการขึ้นไป (server: managerUp) — ซ่อนปุ่มให้ตรง + ถามก่อนลบ
  const confirm = useConfirm();
  const me = trpc.user.me.useQuery();
  const canDelete = permAllows(me.data?.permissions, "supervise_operations");
  // สร้าง/แก้เลขติดตาม/ยืนยันส่ง = ship_orders (server ใช้สิทธิ์ชุดเดียวกัน)
  // พนักงานผลิตแพ็กได้ใน Station แต่ไม่มีปุ่มส่งของในหน้าออเดอร์
  const canShipOrders = permAllows(me.data?.permissions, "ship_orders");
  // ตั้งค่า blind ship = ฝ่ายขายขึ้นไป (server: order.setBlindShip) — role อื่นเห็นธงอย่างเดียว
  const canSetBlindShip = permAllows(me.data?.permissions, "create_sales_docs");

  async function handleDelete(deliveryId: string) {
    const ok = await confirm({
      title: "ลบใบส่งนี้?",
      description: "ลบแล้วกู้คืนไม่ได้ — ใช้กับใบที่สร้างผิดเท่านั้น",
      confirmText: "ลบใบส่ง",
      destructive: true,
    });
    if (ok) deleteDelivery.mutate({ id: deliveryId });
  }

  // packContext ต้องพร้อมก่อนเปิดสร้าง ไม่เช่นนั้นผู้ใช้อาจยืนยันจำนวนโดยไม่มีข้อมูลที่เหลือ
  const canCreate =
    canCreateDelivery(internalStatus, canShipOrders) &&
    Boolean(packContext.data) &&
    !packContext.isError;
  const hasDeliveries = Boolean(deliveries.data?.length);
  const packContextUnavailable = packContext.isError && !packContext.data;

  if (
    !deliveries.isError &&
    !shouldShowDeliverySection(internalStatus, hasDeliveries)
  ) {
    return null;
  }

  return (
    <>
      {/* anchor id "order-section-delivery" อยู่ที่ wrapper ใน orders/[id]/page.tsx (กัน id ซ้ำ) */}
      <Card className="scroll-mt-20">
        <CardHeader>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="h-4 w-4" />
              การจัดส่ง
            </CardTitle>
            {canCreate && (
              <Button
                size="sm"
                onClick={() => setShowCreateDialog(true)}
                className="w-full gap-1.5 sm:w-auto"
              >
                <Plus />
                สร้างรายการจัดส่ง
              </Button>
            )}
          </div>

          {/* ธง blind ship — ต้องเห็นก่อนหยิบของลงกล่อง ห้ามพลาด */}
          {packContext.data?.blindShip && (
            <Alert variant="error" className="mt-2">
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                🚫 BLIND SHIP — ห้ามใส่เอกสาร/ชื่อ Anajak ในกล่อง
              </p>
              <p className="mt-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                ผู้ส่งบนใบ: {packContext.data.blindShipSenderName || packContext.data.customerName}
              </p>
            </Alert>
          )}
          {canSetBlindShip && packContext.data && (
            <button
              type="button"
              onClick={() => setShowBlindShipDialog(true)}
              className={cn(CONTROL_MIN_H, "mt-1 flex w-fit touch-manipulation items-center gap-1.5 text-xs text-muted transition-colors hover:text-strong dark:hover:text-strong")}
            >
              <Settings2 className="h-3 w-3" />
              {packContext.data.blindShip ? "ตั้งค่า blind ship" : "ตั้งค่า blind ship (ปิดอยู่)"}
            </button>
          )}
        </CardHeader>
        <CardContent>
          {deliveries.isError && !hasDeliveries ? (
            <QueryError
              message="โหลดข้อมูลจัดส่งไม่สำเร็จ"
              onRetry={() => void deliveries.refetch()}
            />
          ) : deliveries.isPending ? (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center justify-center gap-2 py-8 text-sm text-muted"
            >
              <Spinner size="md" />
              กำลังโหลดข้อมูลจัดส่ง
            </div>
          ) : (
            <>
              {packContextUnavailable && (
                <QueryError
                  message="โหลดข้อมูลสำหรับแพ็คสินค้าไม่สำเร็จ จึงยังสร้างใบส่งไม่ได้"
                  onRetry={() => void packContext.refetch()}
                />
              )}
              {!hasDeliveries ? (
                !packContextUnavailable && (
                  <p className="text-sm text-muted">
                    ยังไม่มีข้อมูลจัดส่ง
                  </p>
                )
              ) : (
                <div className="space-y-3">
                  {deliveries.data!.map((delivery) => {
                    const actions = deliveryActionAvailability({
                      status: delivery.status as DeliveryStatus,
                      canManageDelivery: canShipOrders,
                      canDeleteDelivery: canDelete,
                    });

                    return (
                      <div
                        key={delivery.id}
                        className="rounded-lg border border-border p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant={
                                  DELIVERY_STATUS_VARIANTS[
                                    delivery.status as keyof typeof DELIVERY_STATUS_VARIANTS
                                  ] || "default"
                                }
                              >
                                {DELIVERY_STATUS_LABELS[
                                  delivery.status as keyof typeof DELIVERY_STATUS_LABELS
                                ] || delivery.status}
                              </Badge>
                              <span className="text-sm font-medium text-strong">
                                {SHIPPING_METHOD_LABELS[delivery.shippingMethod] ||
                                  delivery.shippingMethod}
                              </span>
                            </div>

                            {/* Tracking number */}
                            {editTrackingId === delivery.id && actions.canEditTracking ? (
                              <div className="flex items-center gap-2">
                                <Input size="sm"
                                  type="text"
                                  aria-label={`เลขพัสดุ ${delivery.recipientName}`}
                                  value={editTrackingValue}
                                  onChange={(e) => setEditTrackingValue(e.target.value)}
                                  placeholder="เลขพัสดุ..."
                                  className="w-48 font-mono"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="บันทึกเลขพัสดุ"
                                  onClick={() => {
                                    updateDelivery.mutate({
                                      id: delivery.id,
                                      trackingNumber: editTrackingValue,
                                    });
                                  }}
                                  disabled={updateDelivery.isPending}
                                >
                                  <Check />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                {delivery.trackingNumber ? (
                                  <span className="font-mono text-sm text-blue-600 dark:text-blue-400">
                                    <Hash className="mr-0.5 inline h-3 w-3" />
                                    {delivery.trackingNumber}
                                  </span>
                                ) : actions.canEditTracking ? (
                                  <button
                                    type="button"
                                    className={cn(CONTROL_MIN_H, "touch-manipulation text-xs text-muted hover:text-strong dark:hover:text-strong")}
                                    onClick={() => {
                                      setEditTrackingId(delivery.id);
                                      setEditTrackingValue(delivery.trackingNumber || "");
                                    }}
                                  >
                                    + เพิ่มเลขพัสดุ
                                  </button>
                                ) : null}
                              </div>
                            )}

                            <div className="flex items-center gap-1.5 text-xs text-muted">
                              <MapPin className="h-3 w-3" />
                              <span>{delivery.recipientName}</span>
                              {delivery.phone && <span>| {delivery.phone}</span>}
                            </div>

                            {/* รายการต่อกล่อง (ก้อน 3) — กล่องนี้มีอะไรบ้าง เช่น "10 ตัว (M ดำ ×6 · L ดำ ×4)" */}
                            {delivery.lines.length > 0 && (
                              <div className="flex items-start gap-1.5 text-xs text-muted">
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

                            <div className="flex flex-wrap gap-3 text-xs text-muted">
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
                          <div className="flex w-full shrink-0 flex-wrap justify-end gap-1.5 sm:w-auto">
                            {delivery.lines.length > 0 && (
                              <a
                                href={`/print/packing-list/${delivery.id}`}
                                target="_blank"
                                rel="noreferrer"
                                title="ใบรายการแนบกล่อง"
                                aria-label={`พิมพ์ใบรายการแนบกล่องสำหรับ ${delivery.recipientName}`}
                                className={cn(CONTROL_H, RADIUS.item, "flex w-11 items-center justify-center text-muted transition-colors hover:bg-interactive-hover hover:text-strong sm:w-9 dark:hover:text-strong")}
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {/* โชว์ปุ่มเมื่อยังเดินสถานะต่อได้ (B13) — DELIVERED เดินต่อ RETURNED/SHIPPED
                                ได้ (ของส่งถึงแล้วลูกค้าตีกลับ) · เดิมซ่อนบน DELIVERED = transition ตาย */}
                            {actions.canUpdateStatus && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() =>
                                  setStatusTarget({
                                    delivery,
                                    suggestedStatus: actions.nextAction.status,
                                  })
                                }
                              >
                                {actions.nextAction.label}
                              </Button>
                            )}
                            {actions.canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500"
                                aria-label={`ลบใบส่งของ ${delivery.recipientName}`}
                                onClick={() => handleDelete(delivery.id)}
                              >
                                <Trash2 />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Delivery Dialog — conditional mount: canCreate การันตี packContext.data พร้อมแล้ว
          (ต้องพร้อมก่อนเปิด ไม่งั้นผู้ใช้อาจยืนยันจำนวนโดยไม่มีข้อมูลที่เหลือ) */}
      {showCreateDialog && packContext.data && (
        <CreateDeliveryDialog
          orderId={orderId}
          customerName={customerName}
          customerPhone={customerPhone}
          customerHasAddress={customerHasAddress}
          customerAddress={customerAddress}
          orderShipping={orderShipping}
          packData={packContext.data}
          onClose={() => setShowCreateDialog(false)}
        />
      )}

      {/* Update Status Dialog — conditional mount: ปิดแล้ว React ล้าง state ให้เอง */}
      {statusTarget && (
        <DeliveryStatusDialog
          delivery={statusTarget.delivery}
          suggestedStatus={statusTarget.suggestedStatus}
          orderId={orderId}
          onClose={() => setStatusTarget(null)}
        />
      )}

      {/* Blind Ship Settings Dialog — ฝ่ายขายขึ้นไป (server กัน role อีกชั้น) · conditional mount
          ปุ่มเปิดโชว์เมื่อ packContext.data มีแล้วเท่านั้น — seed ค่าปัจจุบันจาก data ตรงนี้ */}
      {showBlindShipDialog && packContext.data && (
        <BlindShipDialog
          orderId={orderId}
          initialOn={packContext.data.blindShip ?? false}
          initialSender={packContext.data.blindShipSenderName ?? ""}
          customerName={packContext.data.customerName || customerName}
          onClose={() => setShowBlindShipDialog(false)}
        />
      )}
    </>
  );
}
