import { nextDeliveryStatuses, type DeliveryStatus } from "./delivery-status";

// COMPLETED อยู่ในชุดนี้ด้วย — server เปิดให้เปิดใบส่งรอบใหม่หลังปิดงานมาตั้งแต่แรก
// (delivery.ts: "เคสของตีกลับหลังปิดงาน ต้องเปิดใบส่งรอบใหม่ได้") แต่ฝั่งจอไม่ยอมโชว์ปุ่ม
// คนจึงต้องถอยสถานะออกจากปิดงานก่อนทั้งที่ไม่จำเป็น — ของที่ส่งชดเชยคือเคสเดียวกับที่ server รองรับ
const CREATE_DELIVERY_ORDER_STATUSES = new Set([
  "PACKING",
  "READY_TO_SHIP",
  "SHIPPED",
  "COMPLETED",
]);
const VISIBLE_DELIVERY_ORDER_STATUSES = new Set([
  "PACKING",
  "READY_TO_SHIP",
  "SHIPPED",
  "COMPLETED",
]);

const NEXT_DELIVERY_ACTION: Record<
  DeliveryStatus,
  { status: DeliveryStatus; label: string }
> = {
  PENDING: { status: "PREPARING", label: "เริ่มเตรียมส่ง" },
  PREPARING: { status: "SHIPPED", label: "ยืนยันส่งแล้ว" },
  SHIPPED: { status: "DELIVERED", label: "ยืนยันถึงแล้ว" },
  DELIVERED: { status: "DELIVERED", label: "จัดการสถานะ" },
  RETURNED: { status: "PREPARING", label: "เตรียมส่งใหม่" },
};

export function canCreateDelivery(internalStatus: string, canManageDelivery: boolean): boolean {
  return canManageDelivery && CREATE_DELIVERY_ORDER_STATUSES.has(internalStatus);
}

export function shouldShowDeliverySection(
  internalStatus: string,
  hasDeliveries: boolean
): boolean {
  return hasDeliveries || VISIBLE_DELIVERY_ORDER_STATUSES.has(internalStatus);
}

export function deliveryActionAvailability(params: {
  status: DeliveryStatus;
  canManageDelivery: boolean;
  canDeleteDelivery: boolean;
}) {
  const { status, canManageDelivery, canDeleteDelivery } = params;

  return {
    canEditTracking: canManageDelivery,
    canUpdateStatus: canManageDelivery && nextDeliveryStatuses(status).length > 1,
    canDelete: canDeleteDelivery && status === "PENDING",
    nextAction: NEXT_DELIVERY_ACTION[status],
  };
}
