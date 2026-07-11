import { nextDeliveryStatuses, type DeliveryStatus } from "./delivery-status";

const CREATE_DELIVERY_ORDER_STATUSES = new Set(["PACKING", "READY_TO_SHIP", "SHIPPED"]);
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
