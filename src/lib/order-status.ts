import type { OrderType, CustomerStatus, InternalStatus } from "@prisma/client";

// ============================================================
// STATUS LABELS (Thai)
// ============================================================

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  ORDER_RECEIVED: "รับออเดอร์",
  PREPARING: "กำลังเตรียม",
  IN_PRODUCTION: "กำลังผลิต",
  READY_TO_SHIP: "พร้อมส่ง",
  SHIPPED: "จัดส่งแล้ว",
  COMPLETED: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
};

export const INTERNAL_STATUS_LABELS: Record<InternalStatus, string> = {
  INQUIRY: "สอบถาม",
  QUOTATION: "ใบเสนอราคา",
  CONFIRMED: "ยืนยันออเดอร์",
  DESIGN_PENDING: "รอออกแบบ",
  DESIGNING: "กำลังออกแบบ",
  AWAITING_APPROVAL: "รอลูกค้าอนุมัติแบบ",
  DESIGN_APPROVED: "อนุมัติแบบแล้ว",
  PRODUCTION_QUEUE: "รอคิวผลิต",
  PRODUCING: "กำลังผลิต",
  QUALITY_CHECK: "ตรวจสอบคุณภาพ",
  PACKING: "กำลังแพ็ค",
  READY_TO_SHIP: "พร้อมจัดส่ง",
  SHIPPED: "จัดส่งแล้ว",
  COMPLETED: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
};

// ============================================================
// CUSTOMER STATUS COLORS (for badges)
// ============================================================

export const CUSTOMER_STATUS_COLORS: Record<
  CustomerStatus,
  { bg: string; text: string; dot: string }
> = {
  ORDER_RECEIVED: {
    bg: "bg-blue-50 dark:bg-blue-950",
    text: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  PREPARING: {
    bg: "bg-purple-50 dark:bg-purple-950",
    text: "text-purple-700 dark:text-purple-300",
    dot: "bg-purple-500",
  },
  IN_PRODUCTION: {
    bg: "bg-amber-50 dark:bg-amber-950",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  READY_TO_SHIP: {
    bg: "bg-cyan-50 dark:bg-cyan-950",
    text: "text-cyan-700 dark:text-cyan-300",
    dot: "bg-cyan-500",
  },
  SHIPPED: {
    bg: "bg-indigo-50 dark:bg-indigo-950",
    text: "text-indigo-700 dark:text-indigo-300",
    dot: "bg-indigo-500",
  },
  COMPLETED: {
    bg: "bg-green-50 dark:bg-green-950",
    text: "text-green-700 dark:text-green-300",
    dot: "bg-green-500",
  },
  CANCELLED: {
    bg: "bg-red-50 dark:bg-red-950",
    text: "text-red-700 dark:text-red-300",
    dot: "bg-red-500",
  },
};

export const INTERNAL_STATUS_COLORS: Record<
  InternalStatus,
  { bg: string; text: string }
> = {
  INQUIRY: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" },
  QUOTATION: { bg: "bg-blue-100 dark:bg-blue-900", text: "text-blue-700 dark:text-blue-300" },
  CONFIRMED: { bg: "bg-blue-100 dark:bg-blue-900", text: "text-blue-700 dark:text-blue-300" },
  DESIGN_PENDING: { bg: "bg-purple-100 dark:bg-purple-900", text: "text-purple-700 dark:text-purple-300" },
  DESIGNING: { bg: "bg-purple-100 dark:bg-purple-900", text: "text-purple-700 dark:text-purple-300" },
  AWAITING_APPROVAL: { bg: "bg-purple-100 dark:bg-purple-900", text: "text-purple-700 dark:text-purple-300" },
  DESIGN_APPROVED: { bg: "bg-purple-100 dark:bg-purple-900", text: "text-purple-700 dark:text-purple-300" },
  PRODUCTION_QUEUE: { bg: "bg-amber-100 dark:bg-amber-900", text: "text-amber-700 dark:text-amber-300" },
  PRODUCING: { bg: "bg-amber-100 dark:bg-amber-900", text: "text-amber-700 dark:text-amber-300" },
  QUALITY_CHECK: { bg: "bg-amber-100 dark:bg-amber-900", text: "text-amber-700 dark:text-amber-300" },
  PACKING: { bg: "bg-amber-100 dark:bg-amber-900", text: "text-amber-700 dark:text-amber-300" },
  READY_TO_SHIP: { bg: "bg-cyan-100 dark:bg-cyan-900", text: "text-cyan-700 dark:text-cyan-300" },
  SHIPPED: { bg: "bg-indigo-100 dark:bg-indigo-900", text: "text-indigo-700 dark:text-indigo-300" },
  COMPLETED: { bg: "bg-green-100 dark:bg-green-900", text: "text-green-700 dark:text-green-300" },
  CANCELLED: { bg: "bg-red-100 dark:bg-red-900", text: "text-red-700 dark:text-red-300" },
};

// ============================================================
// INTERNAL -> CUSTOMER STATUS MAPPING
// ============================================================

const STATUS_MAP: Record<InternalStatus, CustomerStatus> = {
  INQUIRY: "ORDER_RECEIVED",
  QUOTATION: "ORDER_RECEIVED",
  CONFIRMED: "ORDER_RECEIVED",
  DESIGN_PENDING: "PREPARING",
  DESIGNING: "PREPARING",
  AWAITING_APPROVAL: "PREPARING",
  DESIGN_APPROVED: "PREPARING",
  PRODUCTION_QUEUE: "IN_PRODUCTION",
  PRODUCING: "IN_PRODUCTION",
  QUALITY_CHECK: "IN_PRODUCTION",
  PACKING: "IN_PRODUCTION",
  READY_TO_SHIP: "READY_TO_SHIP",
  SHIPPED: "SHIPPED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

export function getCustomerStatus(internalStatus: InternalStatus): CustomerStatus {
  return STATUS_MAP[internalStatus];
}

// ============================================================
// WORKFLOW FLOWS PER ORDER TYPE
// ============================================================

const FLOW_BY_TYPE: Record<OrderType, InternalStatus[]> = {
  READY_MADE: [
    "CONFIRMED",
    "PRODUCTION_QUEUE",
    "PRODUCING",
    "QUALITY_CHECK",
    "PACKING",
    "READY_TO_SHIP",
    "SHIPPED",
    "COMPLETED",
  ],
  CUSTOM: [
    "INQUIRY",
    "QUOTATION",
    "CONFIRMED",
    "DESIGN_PENDING",
    "DESIGNING",
    "AWAITING_APPROVAL",
    "DESIGN_APPROVED",
    "PRODUCTION_QUEUE",
    "PRODUCING",
    "QUALITY_CHECK",
    "PACKING",
    "READY_TO_SHIP",
    "SHIPPED",
    "COMPLETED",
  ],
};

/**
 * Get the initial internal status for an order type
 */
export function getInitialStatus(orderType: OrderType): InternalStatus {
  return FLOW_BY_TYPE[orderType][0];
}

/**
 * Get the allowed flow steps for an order type
 */
export function getFlowSteps(orderType: OrderType): InternalStatus[] {
  return FLOW_BY_TYPE[orderType];
}

/**
 * Get the next valid internal statuses from the current status.
 * Returns an array because some statuses allow multiple transitions
 * (e.g., AWAITING_APPROVAL can go to DESIGN_APPROVED or back to DESIGNING).
 * Also always includes CANCELLED as a valid transition (except from COMPLETED/CANCELLED).
 */
export function getNextStatuses(
  orderType: OrderType,
  currentStatus: InternalStatus
): InternalStatus[] {
  if (currentStatus === "COMPLETED" || currentStatus === "CANCELLED") {
    return [];
  }

  const flow = FLOW_BY_TYPE[orderType];
  const currentIndex = flow.indexOf(currentStatus);

  const next: InternalStatus[] = [];

  // Normal forward transition
  if (currentIndex >= 0 && currentIndex < flow.length - 1) {
    next.push(flow[currentIndex + 1]);
  }

  // Special backward transitions
  if (currentStatus === "AWAITING_APPROVAL") {
    next.push("DESIGNING"); // revision requested
  }
  if (currentStatus === "QUALITY_CHECK") {
    next.push("PRODUCING"); // QC fail
  }

  // Can always cancel (except from COMPLETED/CANCELLED which is handled above)
  next.push("CANCELLED");

  return next;
}

/**
 * Check if a status transition is valid for the given order type
 */
export function isValidTransition(
  orderType: OrderType,
  fromStatus: InternalStatus,
  toStatus: InternalStatus
): boolean {
  const validNext = getNextStatuses(orderType, fromStatus);
  return validNext.includes(toStatus);
}

// ============================================================
// CHANNEL LABELS & HELPERS
// ============================================================

export const CHANNEL_LABELS: Record<string, string> = {
  SHOPEE: "Shopee",
  LAZADA: "Lazada",
  TIKTOK: "TikTok Shop",
  LINE: "LINE",
  WALK_IN: "หน้าร้าน",
  PHONE: "โทรศัพท์",
  WEBSITE: "เว็บไซต์",
};

export const CHANNEL_COLORS: Record<string, { bg: string; text: string }> = {
  SHOPEE: { bg: "bg-orange-100 dark:bg-orange-900", text: "text-orange-700 dark:text-orange-300" },
  LAZADA: { bg: "bg-blue-100 dark:bg-blue-900", text: "text-blue-700 dark:text-blue-300" },
  TIKTOK: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" },
  LINE: { bg: "bg-green-100 dark:bg-green-900", text: "text-green-700 dark:text-green-300" },
  WALK_IN: { bg: "bg-amber-100 dark:bg-amber-900", text: "text-amber-700 dark:text-amber-300" },
  PHONE: { bg: "bg-cyan-100 dark:bg-cyan-900", text: "text-cyan-700 dark:text-cyan-300" },
  WEBSITE: { bg: "bg-indigo-100 dark:bg-indigo-900", text: "text-indigo-700 dark:text-indigo-300" },
};

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  READY_MADE: "สำเร็จรูป",
  CUSTOM: "Custom",
};

/**
 * Whether a channel is a marketplace (requires externalOrderId, platformFee)
 */
export function isMarketplaceChannel(channel: string): boolean {
  return ["SHOPEE", "LAZADA", "TIKTOK"].includes(channel);
}
