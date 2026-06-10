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
  DRAFT: "ร่าง",
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
  ON_HOLD: "พักงาน",
};

// ============================================================
// CUSTOMER STATUS COLORS (for badges)
// ============================================================

// Simplified palette: neutral / accent / semantic only.
const NEUTRAL = {
  bg: "bg-slate-100 dark:bg-slate-800",
  text: "text-slate-700 dark:text-slate-300",
  dot: "bg-slate-400",
};
const ACCENT = {
  bg: "bg-blue-50 dark:bg-blue-950/40",
  text: "text-blue-700 dark:text-blue-300",
  dot: "bg-blue-500",
};
const WARNING = {
  bg: "bg-amber-50 dark:bg-amber-950/40",
  text: "text-amber-700 dark:text-amber-300",
  dot: "bg-amber-500",
};
const SUCCESS = {
  bg: "bg-green-50 dark:bg-green-950/40",
  text: "text-green-700 dark:text-green-300",
  dot: "bg-green-500",
};
const DANGER = {
  bg: "bg-red-50 dark:bg-red-950/40",
  text: "text-red-700 dark:text-red-300",
  dot: "bg-red-500",
};

export const CUSTOMER_STATUS_COLORS: Record<
  CustomerStatus,
  { bg: string; text: string; dot: string }
> = {
  ORDER_RECEIVED: ACCENT,
  PREPARING: ACCENT,
  IN_PRODUCTION: WARNING,
  READY_TO_SHIP: WARNING,
  SHIPPED: ACCENT,
  COMPLETED: SUCCESS,
  CANCELLED: DANGER,
};

export const INTERNAL_STATUS_COLORS: Record<
  InternalStatus,
  { bg: string; text: string }
> = {
  DRAFT: NEUTRAL,
  INQUIRY: NEUTRAL,
  QUOTATION: ACCENT,
  CONFIRMED: ACCENT,
  DESIGN_PENDING: ACCENT,
  DESIGNING: ACCENT,
  AWAITING_APPROVAL: ACCENT,
  DESIGN_APPROVED: ACCENT,
  PRODUCTION_QUEUE: WARNING,
  PRODUCING: WARNING,
  QUALITY_CHECK: WARNING,
  PACKING: WARNING,
  READY_TO_SHIP: WARNING,
  SHIPPED: ACCENT,
  COMPLETED: SUCCESS,
  CANCELLED: DANGER,
  ON_HOLD: WARNING,
};

// ============================================================
// INTERNAL -> CUSTOMER STATUS MAPPING
// ============================================================

const STATUS_MAP: Record<InternalStatus, CustomerStatus> = {
  DRAFT: "ORDER_RECEIVED",
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
  ON_HOLD: "PREPARING",
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

  // ON_HOLD can return to any status it was held from (stored separately);
  // for simplicity, allow returning to key statuses
  if (currentStatus === "ON_HOLD") {
    return ["CONFIRMED", "DESIGN_PENDING", "PRODUCTION_QUEUE", "CANCELLED"];
  }

  // DRAFT can transition to the first real status for its type
  if (currentStatus === "DRAFT") {
    return [FLOW_BY_TYPE[orderType][0], "CANCELLED"];
  }

  const flow = FLOW_BY_TYPE[orderType];
  const currentIndex = flow.indexOf(currentStatus);

  const next: InternalStatus[] = [];

  // Normal forward transition
  if (currentIndex >= 0 && currentIndex < flow.length - 1) {
    next.push(flow[currentIndex + 1]);
  }

  // ลูกค้าอนุมัติแบบผ่าน token ได้ตั้งแต่ตอน DESIGNING (อัปโหลดแบบ = มีลิงก์อนุมัติทันที
  // โดยไม่ต้องกดส่งเข้า AWAITING_APPROVAL ก่อน) — เส้นทางจริงของ design.approveByToken
  if (currentStatus === "DESIGNING") {
    next.push("DESIGN_APPROVED");
  }

  // Special backward transitions
  if (currentStatus === "AWAITING_APPROVAL") {
    next.push("DESIGNING");
  }
  if (currentStatus === "QUALITY_CHECK") {
    next.push("PRODUCING");
  }
  if (currentStatus === "PACKING") {
    next.push("QUALITY_CHECK");
  }
  if (currentStatus === "PRODUCING") {
    next.push("PRODUCTION_QUEUE");
  }

  // Allow INQUIRY -> CONFIRMED directly (skip QUOTATION)
  if (currentStatus === "INQUIRY" && orderType === "CUSTOM") {
    next.push("CONFIRMED");
  }

  // งาน CUSTOM ที่ลูกค้ามีไฟล์พร้อมพิมพ์มาเอง — ข้ามขั้นออกแบบเข้าคิวผลิตได้เลย
  if (currentStatus === "CONFIRMED" && orderType === "CUSTOM") {
    next.push("PRODUCTION_QUEUE");
  }

  // ON_HOLD available from most active statuses
  const holdableStatuses: InternalStatus[] = [
    "CONFIRMED", "DESIGN_PENDING", "DESIGNING", "AWAITING_APPROVAL",
    "DESIGN_APPROVED", "PRODUCTION_QUEUE", "PRODUCING", "QUALITY_CHECK", "PACKING",
  ];
  if (holdableStatuses.includes(currentStatus)) {
    next.push("ON_HOLD");
  }

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
  // DRAFT transitions are handled by getNextStatuses
  const validNext = getNextStatuses(orderType, fromStatus);
  return validNext.includes(toStatus);
}

// ============================================================
// PRIORITY LABELS & COLORS
// ============================================================

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: "ต่ำ",
  NORMAL: "ปกติ",
  HIGH: "สูง",
  URGENT: "เร่งด่วน",
};

export const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  LOW: NEUTRAL,
  NORMAL: ACCENT,
  HIGH: WARNING,
  URGENT: DANGER,
};

// PAYMENT_TERMS_LABELS ย้ายไป src/lib/payment-terms.ts (รวมค่า+ป้าย+ความหมายที่เดียว)

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

// All channels share the same neutral chip — channel is just metadata.
export const CHANNEL_COLORS: Record<string, { bg: string; text: string }> = {
  SHOPEE: NEUTRAL,
  LAZADA: NEUTRAL,
  TIKTOK: NEUTRAL,
  LINE: NEUTRAL,
  WALK_IN: NEUTRAL,
  PHONE: NEUTRAL,
  WEBSITE: NEUTRAL,
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
