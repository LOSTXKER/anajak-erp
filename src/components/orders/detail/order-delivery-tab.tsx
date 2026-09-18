"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Eye,
  EyeOff,
  Hash,
  PackageCheck,
  PenLine,
  Plus,
  Printer,
  Send,
  StickyNote,
  Trash2,
  Truck,
  Undo2,
} from "lucide-react";
import type { RouterOutput } from "@/lib/trpc";
import { trpc } from "@/lib/trpc";
import { permAllows } from "@/lib/permissions";
import type { DeliveryStatus } from "@/lib/delivery-status";
import { canCreateDelivery, deliveryActionAvailability } from "@/lib/delivery-ui";
import { differenceInBangkokDays } from "@/lib/date-utils";
import { isAttentionStatus } from "@/lib/order-progress";
import { sizeRank } from "@/lib/size-matrix";
import { DELIVERY_STATUS_LABELS } from "@/lib/status-config";
import { SHIPPING_METHOD_LABELS } from "@/lib/shipping-methods";
import { formatBaht, formatDateShort } from "@/lib/utils";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { BlindShipDialog } from "@/components/orders/delivery/blind-ship-dialog";
import { CreateDeliveryDialog, sizeColorLabel } from "@/components/orders/delivery/create-delivery-dialog";
import { DeliveryStatusDialog } from "@/components/orders/delivery/delivery-status-dialog";
import { customerDisplayName } from "@/lib/customer-name";
import { c, Callout, CardHead, DueTag, Empty, Prop, Rw, StateBox, SubHead, timeText } from "@/components/kit/kit";

/* ============================================================
   แท็บ "จัดส่ง" — ต้นแบบ tabDelivery() ทีละชิ้น (รื้อ 2026-09-15)

   ผู้รับและที่อยู่ซ้าย, ใบส่งของขวา, แท็บอยู่เสมอแม้ยังไม่ถึงเฟส (ซ่อนตามสถานะ = ชุดแท็บเปลี่ยนใต้มือ)
   ของจริงที่ต้นแบบไม่มีแต่ต้องคงจาก order-delivery-section เดิม:
   สร้างใบส่ง (นับยืนยันต่อไซส์), เดินสถานะ/ใส่เลขพัสดุ, ใบแนบกล่อง, ลบใบที่สร้างผิด, ตั้งค่า blind ship
   แถวใบส่ง = กดเลือก → กล่องคำสั่งของรอบนั้นใต้รายการ (รอบเดียวเปิดให้เลย)
   สิทธิ์ทุกปุ่มชุดเดียวกับ server: ship_orders / supervise_operations / create_sales_docs
   ============================================================ */

type OrderDetail = RouterOutput["order"]["getById"];
type Delivery = RouterOutput["delivery"]["getByOrderId"][number];

const DELIVERY_TONE: Record<string, "good" | "warn" | "bad" | "gray"> = {
  PENDING: "warn",
  PREPARING: "warn",
  SHIPPED: "good",
  DELIVERED: "good",
  RETURNED: "bad",
};

// ป้ายวันส่งของ DueTag วาดวันซ้ำเองเมื่องานจบแล้ว — ต้นแบบโชว์ป้ายเฉพาะงานที่ยังเดิน (ACTIVE)
const CLOSED_FOR_DUE = new Set(["SHIPPED", "COMPLETED", "CANCELLED", "DRAFT"]);

const methodLabel = (method: string | null | undefined) =>
  method ? (SHIPPING_METHOD_LABELS[method] ?? method) : null;

export function OrderDeliveryTab({
  order,
  showDeliverySection,
  canEditShipping,
  onEditShipping,
}: {
  order: OrderDetail;
  /** shouldShowDeliverySection(...) — false = ยังไม่ถึงเฟสจัดส่ง */
  showDeliverySection: boolean;
  /** ฟอร์มแก้ทั้งใบมีราคา (canUseEditForm) */
  canEditShipping: boolean;
  /** เปิดหน้าแก้ไขโดยโฟกัสส่วนจัดส่ง */
  onEditShipping: () => void;
}) {
  const orderId = order.id;
  const [now] = useState(() => new Date());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  // ใบส่ง + สถานะแนะนำที่กำลังจะอัปเดต — conditional mount DeliveryStatusDialog (กติกา ui/dialog.tsx)
  const [statusTarget, setStatusTarget] = useState<{ delivery: Delivery; suggestedStatus: DeliveryStatus } | null>(null);
  const [editTrackingId, setEditTrackingId] = useState<string | null>(null);
  const [editTrackingValue, setEditTrackingValue] = useState("");
  const [showBlindShipDialog, setShowBlindShipDialog] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  // ยังไม่ถึงเฟส = ไม่ยิง query ใบส่ง (เดิม section ไม่ถูก mount เลย)
  const deliveries = trpc.delivery.getByOrderId.useQuery({ orderId }, { enabled: showDeliverySection });
  // บริบทแพ็ค: เหลือเท่าไหร่ต่อไซส์ + ธง blind ship — ต้องพร้อมก่อนเปิดสร้างใบส่ง
  const packContext = trpc.delivery.packContext.useQuery({ orderId }, { enabled: showDeliverySection });

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
  const confirm = useConfirm();
  const me = trpc.user.me.useQuery();
  // ลบใบส่ง = ผู้จัดการขึ้นไป (server: managerUp)
  const canDelete = permAllows(me.data?.permissions, "supervise_operations");
  // สร้าง/แก้เลขติดตาม/ยืนยันส่ง = ship_orders · พนักงานผลิตแพ็กได้ใน Station แต่ไม่มีปุ่มส่งของที่นี่
  const canShipOrders = permAllows(me.data?.permissions, "ship_orders");
  // ตั้งค่า blind ship = ฝ่ายขายขึ้นไป (server: order.setBlindShip)
  const canSetBlindShip = permAllows(me.data?.permissions, "create_sales_docs");

  async function handleDelete(delivery: Delivery) {
    const ok = await confirm({
      title: "ลบใบส่งนี้?",
      description: "ลบแล้วกู้คืนไม่ได้ — ใช้กับใบที่สร้างผิดเท่านั้น",
      confirmText: "ลบใบส่ง",
      destructive: true,
    });
    if (ok) deleteDelivery.mutate({ id: delivery.id });
  }

  const list = deliveries.data ?? [];
  const hasDeliveries = list.length > 0;
  const packContextUnavailable = packContext.isError && !packContext.data;
  // packContext ต้องพร้อมก่อนเปิดสร้าง ไม่เช่นนั้นผู้ใช้อาจยืนยันจำนวนโดยไม่มีข้อมูลที่เหลือ
  const canCreate =
    showDeliverySection &&
    canCreateDelivery(order.internalStatus, canShipOrders) &&
    Boolean(packContext.data) &&
    !packContext.isError;

  const actionsOf = (delivery: Delivery) =>
    deliveryActionAvailability({
      status: delivery.status as DeliveryStatus,
      canManageDelivery: canShipOrders,
      canDeleteDelivery: canDelete,
    });
  // รอบที่ถูกเลือก · ยังไม่เลือก = รอบแรกที่ยังเดินสถานะต่อได้ ไม่งั้นรอบล่าสุด
  const selected =
    list.find((delivery) => delivery.id === selectedId) ??
    list.find((delivery) => actionsOf(delivery).canUpdateStatus) ??
    list[0] ??
    null;
  // router เรียงใหม่ → เก่า · รอบที่ 1 = ใบแรกที่สร้าง
  const roundOf = (delivery: Delivery) => list.length - list.indexOf(delivery);

  /* ---------- ซ้าย: ผู้รับและที่อยู่ ---------- */
  const shippingArea = [order.shippingSubDistrict, order.shippingDistrict, order.shippingProvince, order.shippingPostalCode]
    .filter(Boolean)
    .join(" ");
  const hasAddress = Boolean(order.shippingRecipientName || order.shippingPhone || order.shippingAddress || shippingArea);
  const shippingMethod = methodLabel(list[0]?.shippingMethod ?? order.deliveries?.[0]?.shippingMethod);
  const dueInDays = differenceInBangkokDays(order.deadline, now);
  const dueActive = isAttentionStatus(order.internalStatus) && !CLOSED_FOR_DUE.has(order.internalStatus);
  const blindShip = packContext.data?.blindShip ?? order.blindShip;
  const senderName = packContext.data
    ? packContext.data.blindShipSenderName || packContext.data.customerName
    : order.blindShipSenderName || customerDisplayName(order.customer);

  const left = (
    <section className={c("card")} aria-labelledby="dv-h">
      <CardHead
        icon={Truck}
        tone="good"
        id="dv-h"
        title="ผู้รับและที่อยู่"
        right={
          canEditShipping ? (
            <button type="button" className={c("btn ghost sm")} aria-label="แก้ไขที่อยู่จัดส่ง" onClick={onEditShipping}>
              <PenLine aria-hidden="true" />
              แก้ไข
            </button>
          ) : undefined
        }
      />
      <div className={c("cb")}>
        {hasAddress ? (
          <address className={c("addr")}>
            {order.shippingRecipientName ? <b>{order.shippingRecipientName}</b> : null}
            {order.shippingAddress}
            {order.shippingAddress && shippingArea ? <br /> : null}
            {shippingArea}
            {order.shippingPhone ? (
              <>
                <br />
                <span className={c("muted")}>{order.shippingPhone}</span>
              </>
            ) : null}
          </address>
        ) : (
          <StateBox
            icon={Truck}
            action={
              canEditShipping ? (
                <button type="button" className={c("btn sm")} aria-label="เพิ่มที่อยู่จัดส่ง" onClick={onEditShipping}>
                  <Plus aria-hidden="true" />
                  ใส่ที่อยู่
                </button>
              ) : undefined
            }
          >
            ยังไม่ระบุที่อยู่จัดส่ง
          </StateBox>
        )}

        {/* ช่องข้อมูลแพ็กโชว์แม้ยังไม่มีที่อยู่ — ใบส่งตั้งต้นจากที่อยู่ลูกค้าได้ แต่ธง blind ship ต้องเห็นเสมอ */}
        <dl className={c("props top")}>
          <Prop icon={Truck} label="วิธีส่ง" none={!shippingMethod}>
            {shippingMethod ?? "เลือกตอนสร้างใบส่ง"}
          </Prop>
          <Prop icon={Calendar} label="กำหนดส่ง" none={!order.deadline}>
            {order.deadline ? (
              <>
                {formatDateShort(order.deadline)}{" "}
                {dueActive ? <DueTag status={order.internalStatus} deadline={order.deadline} dueInDays={dueInDays} /> : null}
              </>
            ) : (
              "ยังไม่กำหนด"
            )}
          </Prop>
          <Prop icon={Eye} label="ผู้ส่งบนกล่อง">
            {blindShip ? (
              <>
                {senderName}{" "}
                <span className={c("chip warn")}>ไม่ระบุ Anajak</span>
              </>
            ) : (
              "Anajak Print"
            )}
          </Prop>
          <Prop icon={StickyNote} label="หมายเหตุแพ็ก" none={!order.notes}>
            {order.notes || "—"}
          </Prop>
        </dl>

        {/* ไม่มีหน้าพิมพ์ใบปะหน้าพัสดุในระบบ — ปุ่มแถวนี้เหลือตั้งค่าผู้ส่ง (ฝ่ายขายขึ้นไป) */}
        {canSetBlindShip && packContext.data ? (
          <button
            type="button"
            className={c("btn sm")}
            style={{ marginTop: 14 }}
            onClick={() => setShowBlindShipDialog(true)}
          >
            <EyeOff aria-hidden="true" />
            ตั้งค่าผู้ส่งบนกล่อง
          </button>
        ) : null}
      </div>
    </section>
  );

  /* ---------- ขวา: ใบส่งของ ---------- */
  const sizeTotals = new Map<string, number>();
  for (const item of order.items ?? []) {
    for (const product of item.products ?? []) {
      for (const variant of product.variants ?? []) {
        sizeTotals.set(variant.size, (sizeTotals.get(variant.size) ?? 0) + variant.quantity);
      }
    }
  }
  const sizeRows = [...sizeTotals].filter(([, quantity]) => quantity > 0).sort((a, b) => sizeRank(a[0]) - sizeRank(b[0]));
  const totalQuantity = sizeRows.reduce((sum, [, quantity]) => sum + quantity, 0);

  const alerts = showDeliverySection ? (
    <>
      {packContextUnavailable ? (
        <Callout
          tone="danger"
          icon={AlertTriangle}
          role="alert"
          action={
            <button type="button" className={c("btn sm")} onClick={() => void packContext.refetch()}>
              ลองใหม่
            </button>
          }
        >
          โหลดข้อมูลสำหรับแพ็คสินค้าไม่สำเร็จ จึงยังสร้างใบส่งไม่ได้
        </Callout>
      ) : null}
      {/* ธง blind ship — ต้องเห็นก่อนหยิบของลงกล่อง ห้ามพลาด */}
      {blindShip ? (
        <Callout tone="danger" icon={EyeOff}>
          <b>ห้ามใส่เอกสาร/ชื่อ Anajak ในกล่อง</b> ผู้ส่งบนใบ: {senderName}
        </Callout>
      ) : null}
    </>
  ) : null;
  const hasAlerts = showDeliverySection && (packContextUnavailable || blindShip);

  function renderActionBox(delivery: Delivery) {
    const actions = actionsOf(delivery);
    const round = roundOf(delivery);
    const qty = delivery.lines.reduce((sum, line) => sum + line.qty, 0);
    const editing = editTrackingId === delivery.id && actions.canEditTracking;
    return (
      <div className={c("state on")} style={{ marginTop: 10 }}>
        <PackageCheck aria-hidden="true" />
        <span className={c("grow")}>
          <b>รอบที่ {round}</b>
          {` ส่งถึง ${delivery.recipientName}`}
          {delivery.phone ? ` ${delivery.phone}` : ""}
          {/* รายการต่อกล่อง — เช่น "10 ตัว (M ดำ ×6 · L ดำ ×4)" */}
          {qty > 0 ? (
            <>
              <br />
              {qty.toLocaleString("th-TH")} ตัว ({delivery.lines.map((line) => `${sizeColorLabel(line)} ×${line.qty}`).join(" · ")})
            </>
          ) : null}
          {delivery.deliveredAt ? (
            <>
              <br />
              ถึงแล้ว {formatDateShort(delivery.deliveredAt)} {timeText(delivery.deliveredAt)}
            </>
          ) : null}
          {delivery.shippingCost > 0 ? (
            <>
              <br />
              ค่าส่ง {formatBaht(delivery.shippingCost)}
            </>
          ) : null}
        </span>

        {editing ? (
          <>
            <Input
              size="sm"
              type="text"
              aria-label={`เลขพัสดุ ${delivery.recipientName}`}
              value={editTrackingValue}
              onChange={(e) => setEditTrackingValue(e.target.value)}
              placeholder="เลขพัสดุ"
              className="w-48 font-mono"
            />
            <button
              type="button"
              className={c("btn sm")}
              disabled={updateDelivery.isPending}
              onClick={() => updateDelivery.mutate({ id: delivery.id, trackingNumber: editTrackingValue })}
            >
              <CheckCircle2 aria-hidden="true" />
              บันทึกเลขพัสดุ
            </button>
            <button type="button" className={c("btn ghost sm")} onClick={() => setEditTrackingId(null)}>
              ยกเลิก
            </button>
          </>
        ) : !delivery.trackingNumber && actions.canEditTracking ? (
          <button
            type="button"
            className={c("btn sm")}
            onClick={() => {
              setEditTrackingId(delivery.id);
              setEditTrackingValue(delivery.trackingNumber || "");
            }}
          >
            <Hash aria-hidden="true" />
            ใส่เลขพัสดุ
          </button>
        ) : null}

        {/* โชว์เมื่อยังเดินสถานะต่อได้ (B13) — DELIVERED เดินต่อ RETURNED/SHIPPED ได้ */}
        {actions.canUpdateStatus ? (
          <button
            type="button"
            className={c("btn primary sm")}
            onClick={() => setStatusTarget({ delivery, suggestedStatus: actions.nextAction.status })}
          >
            <Send aria-hidden="true" />
            {actions.nextAction.label}
          </button>
        ) : null}
        {delivery.lines.length > 0 ? (
          <a
            href={`/print/packing-list/${delivery.id}`}
            target="_blank"
            rel="noreferrer"
            className={c("btn sm")}
            aria-label={`พิมพ์ใบรายการแนบกล่องสำหรับ ${delivery.recipientName}`}
          >
            <Printer aria-hidden="true" />
            ใบแนบกล่อง
          </a>
        ) : null}
        {actions.canDelete ? (
          <button
            type="button"
            className={c("btn ghost sm")}
            style={{ color: "var(--bad)" }}
            aria-label={`ลบใบส่งของ ${delivery.recipientName}`}
            onClick={() => void handleDelete(delivery)}
          >
            <Trash2 aria-hidden="true" />
            ลบ
          </button>
        ) : null}
      </div>
    );
  }

  const right = (
    <section className={c("card")} aria-labelledby="dl-h">
      <CardHead
        icon={PackageCheck}
        tone="blue"
        id="dl-h"
        title="ใบส่งของ"
        right={
          canCreate ? (
            <button
              type="button"
              className={c("btn primary sm")}
              aria-label="สร้างใบส่งของ"
              onClick={() => setShowCreateDialog(true)}
            >
              {hasDeliveries ? <Plus aria-hidden="true" /> : <Send aria-hidden="true" />}
              {hasDeliveries ? "เพิ่มรอบส่ง" : "ส่งของ"}
            </button>
          ) : undefined
        }
      />
      <div className={c("cb")}>
        {!showDeliverySection ? (
          <Empty icon={Truck} title="ยังไม่ถึงขั้นจัดส่ง" hint="ส่วนนี้จะเปิดเมื่อผลิตและตรวจนับเสร็จ" />
        ) : deliveries.isError && !hasDeliveries ? (
          <Callout
            tone="danger"
            icon={AlertTriangle}
            role="alert"
            action={
              <button type="button" className={c("btn sm")} onClick={() => void deliveries.refetch()}>
                ลองใหม่
              </button>
            }
          >
            โหลดข้อมูลจัดส่งไม่สำเร็จ
          </Callout>
        ) : deliveries.isPending ? (
          <div className={c("state")} role="status" aria-live="polite">
            <Spinner size="sm" />
            <span className={c("grow")}>กำลังโหลดใบส่งของ</span>
          </div>
        ) : (
          <>
            {hasAlerts ? (
              <div className={c("alerts")} style={{ marginBottom: 10 }}>
                {alerts}
              </div>
            ) : null}

            {hasDeliveries ? (
              <>
                <div className={c("rows")}>
                  {list.map((delivery) => {
                    const shipped =
                      delivery.status === "SHIPPED" || delivery.status === "DELIVERED" || Boolean(delivery.trackingNumber);
                    const returned = delivery.status === "RETURNED";
                    const qty = delivery.lines.reduce((sum, line) => sum + line.qty, 0);
                    return (
                      <Rw
                        key={delivery.id}
                        onClick={() => setSelectedId(delivery.id)}
                        icon={returned ? Undo2 : shipped ? CheckCircle2 : PackageCheck}
                        tone={returned ? "bad" : shipped ? "good" : "warn"}
                        title={
                          <>
                            รอบที่ {roundOf(delivery)}
                            {` · ${methodLabel(delivery.shippingMethod)}`}
                          </>
                        }
                        sub={
                          delivery.trackingNumber ? (
                            <>
                              เลขพัสดุ <span className={c("mono")}>{delivery.trackingNumber}</span>
                              {delivery.shippedAt
                                ? ` · ส่ง ${formatDateShort(delivery.shippedAt)} ${timeText(delivery.shippedAt)}`
                                : ""}
                            </>
                          ) : (
                            <>
                              {qty > 0 ? `${qty.toLocaleString("th-TH")} ตัว` : null}
                              {qty > 0 ? " · " : null}
                              ยังไม่มีเลขพัสดุ
                            </>
                          )
                        }
                        right={
                          <span className={c("chip", DELIVERY_TONE[delivery.status] ?? "gray")}>
                            {DELIVERY_STATUS_LABELS[delivery.status as keyof typeof DELIVERY_STATUS_LABELS] ?? delivery.status}
                          </span>
                        }
                      />
                    );
                  })}
                </div>
                {selected ? renderActionBox(selected) : null}
              </>
            ) : !packContextUnavailable ? (
              <StateBox icon={PackageCheck}>ยังไม่มีใบส่งของ</StateBox>
            ) : null}

            {sizeRows.length > 0 ? (
              <>
                <div className={c("hr")} />
                <SubHead
                  icon={PackageCheck}
                  tone="blue"
                  title="รายการในกล่อง"
                  right={<span className={c("chip gray")}>{totalQuantity.toLocaleString("th-TH")} ตัว</span>}
                />
                <div className={c("sizes")}>
                  {sizeRows.map(([size, quantity]) => (
                    <span key={size}>
                      {size}
                      <b>{quantity.toLocaleString("th-TH")}</b>
                    </span>
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </section>
  );

  return (
    <>
      <div className={c("two")}>
        {left}
        {right}
      </div>

      {/* สร้างใบส่ง — conditional mount: canCreate การันตี packContext.data พร้อมแล้ว */}
      {showCreateDialog && packContext.data ? (
        <CreateDeliveryDialog
          orderId={orderId}
          /* ชื่อผู้รับตั้งต้น — นิติบุคคลอาจไม่มีชื่อผู้ติดต่อ ใช้ชื่อบริษัทแทน (ชุดกลางเรียงบริษัทก่อน)
             ไม่มีทั้งคู่ = ไม่ส่งค่า ปล่อยให้กล่องใช้ช่องว่างของมันเอง ไม่ใช่คำว่า null */
          customerName={customerDisplayName(order.customer) || undefined}
          customerPhone={order.customer?.phone ?? undefined}
          customerHasAddress={!!order.customer?.address}
          customerAddress={order.customer?.address}
          orderShipping={order}
          packData={packContext.data}
          onClose={() => setShowCreateDialog(false)}
        />
      ) : null}

      {/* เดินสถานะใบส่ง (มีช่องเลขพัสดุ) — conditional mount: ปิดแล้ว React ล้าง state ให้เอง */}
      {statusTarget ? (
        <DeliveryStatusDialog
          delivery={statusTarget.delivery}
          suggestedStatus={statusTarget.suggestedStatus}
          orderId={orderId}
          onClose={() => setStatusTarget(null)}
        />
      ) : null}

      {/* ตั้งค่า blind ship — ฝ่ายขายขึ้นไป (server กัน role อีกชั้น) · seed ค่าปัจจุบันจาก packContext */}
      {showBlindShipDialog && packContext.data ? (
        <BlindShipDialog
          orderId={orderId}
          initialOn={packContext.data.blindShip ?? false}
          initialSender={packContext.data.blindShipSenderName ?? ""}
          customerName={packContext.data.customerName || customerDisplayName(order.customer) || undefined}
          onClose={() => setShowBlindShipDialog(false)}
        />
      ) : null}
    </>
  );
}
