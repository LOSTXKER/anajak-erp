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
  CONFIRMED: "ยืนยันออเดอร์",
  DESIGNING: "กำลังออกแบบ",
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
  CONFIRMED: ACCENT,
  DESIGNING: ACCENT,
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
  CONFIRMED: "ORDER_RECEIVED",
  DESIGNING: "PREPARING",
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
    "CONFIRMED",
    "DESIGNING",
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
 * (e.g., QUALITY_CHECK can go forward to PACKING or back to PRODUCING).
 * Also always includes CANCELLED as a valid transition (except from COMPLETED/CANCELLED).
 */
export function getNextStatuses(
  orderType: OrderType,
  currentStatus: InternalStatus
): InternalStatus[] {
  if (currentStatus === "CANCELLED") {
    return [];
  }

  // ปิดงานแล้วเปิดกลับได้ทางเดียว (→ SHIPPED) — สำหรับเคสปิดพลาด/ลูกค้าเคลมหลังปิด
  // server จำกัด OWNER/MANAGER + ต้องมีเหตุผล (audit 2026-06-11 ข้อ 25)
  if (currentStatus === "COMPLETED") {
    return ["SHIPPED"];
  }

  // ON_HOLD กลับเข้างานเฉพาะจุดที่อยู่ในเส้นทางของชนิดงานจริง — READY_MADE ไม่มีขั้นออกแบบ
  // เสนอ DESIGNING ให้ = พาเข้าซอยตัน (audit ข้อ 31)
  if (currentStatus === "ON_HOLD") {
    const resumable: InternalStatus[] = ["CONFIRMED", "DESIGNING", "PRODUCTION_QUEUE"];
    return [
      ...resumable.filter((s) => FLOW_BY_TYPE[orderType].includes(s)),
      "CANCELLED",
    ];
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

  // Special backward transitions
  if (currentStatus === "QUALITY_CHECK") {
    next.push("PRODUCING");
  }
  if (currentStatus === "PACKING") {
    next.push("QUALITY_CHECK");
  }
  if (currentStatus === "PRODUCING") {
    next.push("PRODUCTION_QUEUE");
  }
  // SHIPPED ถอยได้ 2 ทาง (server จำกัด OWNER/MANAGER + เหตุผล — audit ข้อ 22/24):
  // กดส่งพลาด → READY_TO_SHIP · ของตีกลับ/เคลม → QUALITY_CHECK กลับเข้าวงจรตรวจ-ซ่อม
  if (currentStatus === "SHIPPED") {
    next.push("READY_TO_SHIP", "QUALITY_CHECK");
  }
  // ลูกค้าเปลี่ยนใจหลังอนุมัติแบบ — กลับเข้าวงจรออกแบบได้ตรงๆ ไม่ต้องอ้อม ON_HOLD (audit ข้อ 14)
  if (currentStatus === "DESIGN_APPROVED") {
    next.push("DESIGNING");
  }

  // INQUIRY -> CONFIRMED ได้ทุกชนิด — จำเป็นกับเคส READY_MADE ที่ค้าง INQUIRY
  // (เปิดเบาเป็นสอบถาม แล้วเติมเสื้อเปล่าจน re-derive เป็นสำเร็จรูป — INQUIRY ไม่อยู่ในเส้นทาง
  // READY_MADE จึงไม่มี forward ให้ ต้องเปิดทางยืนยันเองไม่งั้นติดตัน)
  if (currentStatus === "INQUIRY" && !next.includes("CONFIRMED")) {
    next.push("CONFIRMED");
  }

  // งาน CUSTOM ที่ลูกค้ามีไฟล์พร้อมพิมพ์มาเอง — ข้ามขั้นออกแบบเข้าคิวผลิตได้เลย
  if (currentStatus === "CONFIRMED" && orderType === "CUSTOM") {
    next.push("PRODUCTION_QUEUE");
  }

  // ON_HOLD available from most active statuses
  const holdableStatuses: InternalStatus[] = [
    "CONFIRMED", "DESIGNING", "DESIGN_APPROVED",
    "PRODUCTION_QUEUE", "PRODUCING", "QUALITY_CHECK", "PACKING",
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
// ล็อกแก้ออเดอร์หลังอนุมัติ (ก้อน 6 ชิ้น 3 — ใบแก้ไขออเดอร์)
// เบสเคาะ 2026-06-14: เริ่มล็อกที่ DESIGN_APPROVED → แก้รายการ/ราคา/ค่าธรรมเนียมตรง
// ไม่ได้ ต้องออก "ใบแก้ไขออเดอร์" · แหล่งเดียว server (4 จุด guard) + UI ใช้ร่วม กัน drift
// ============================================================

// แก้ตรงได้เฉพาะก่อนอนุมัติแบบ · นอกนั้นล็อก (อนุมัติ/ผลิต/ส่ง/ปิด/ยกเลิก/พักงาน)
// ON_HOLD ถอดออก (B10): พักงานเข้าได้จากสถานะที่ล็อกแล้ว (DESIGN_APPROVED/PRODUCING/QC/
// PACKING) — ถ้าแก้ตรงได้ = ช่องเลี่ยงใบแก้ไข (พัก→แก้ยอด→ปลดพัก ไม่มี CO/เหตุผล/ประวัติ)
// · แก้งานพักต้อง "ปลดพักก่อน" แล้วเข้ากติกาตามสถานะที่กลับไป (next-step card ชี้ทางนี้อยู่)
const ORDER_EDITABLE_STATUSES: InternalStatus[] = [
  "DRAFT",
  "INQUIRY",
  "CONFIRMED",
  "DESIGNING",
];

/** ออเดอร์ "อนุมัติแล้ว/พักงาน" — แก้รายการ/ราคาตรงไม่ได้ ต้องผ่านใบแก้ไขออเดอร์ (หรือปลดพักก่อน) */
export function isOrderLocked(status: InternalStatus): boolean {
  return !ORDER_EDITABLE_STATUSES.includes(status);
}

/**
 * สถานะที่ "ออกใบแก้ไขได้" — อนุมัติแล้วแต่ยังไม่เริ่มผลิต (สต๊อกยังแค่จอง ยังไม่เบิก)
 * เริ่มผลิต/ส่ง/ปิด/ยกเลิก = แก้ไม่ได้ (ของลงมือไปแล้ว) ติดต่อหัวหน้า
 */
export function canIssueChangeOrder(status: InternalStatus): boolean {
  return status === "DESIGN_APPROVED" || status === "PRODUCTION_QUEUE";
}

// เหตุผลที่แก้ยอด/รายการ/ค่าธรรมเนียมตรงไม่ได้ — แหล่งเดียว 3 mutation (update/updateItems/
// updateFees) ใช้ร่วม กันข้อความ drift · ครอบ ON_HOLD ที่ B10 เพิ่งถอดจาก editable
// (เรียกเฉพาะเมื่อ isOrderLocked แล้ว — สถานะ editable ไม่ถึงตรงนี้)
export function orderEditLockedReason(
  status: InternalStatus,
  subject: "ข้อมูลการเงิน" | "รายการ" | "ค่าธรรมเนียม"
): string {
  if (status === "ON_HOLD") {
    return `ออเดอร์พักงานอยู่ — ปลดพัก (กลับเข้างาน) ก่อนจึงจะแก้${subject}ได้`;
  }
  if (canIssueChangeOrder(status)) {
    return `ออเดอร์อนุมัติแล้ว — แก้${subject}ผ่านใบแก้ไขออเดอร์`;
  }
  return `ออเดอร์ที่เริ่มผลิต/เสร็จ/ยกเลิกแล้ว แก้${subject}ไม่ได้`;
}

/**
 * ลำดับสถานะที่ต้อง "เดินไปข้างหน้า" จาก current จนถึง target ตามเส้นทางของชนิดงาน
 * (รวม target เป็นตัวสุดท้าย) — ใช้ให้เหตุการณ์ในโมดูล (ผลิตครบ/ส่งของ) ดันสถานะออเดอร์เอง
 * คืน [] เมื่อ: current/target ไม่อยู่ในเส้นทาง · target ไม่ได้อยู่ข้างหน้า current ·
 * หรือระบุ onlyFrom แล้ว current ไม่อยู่ในชุดนั้น (กันดันจากจุดที่ไม่ควร เช่น ยังผลิตไม่เสร็จ)
 * ไปข้างหน้าเท่านั้น — ไม่ดึงถอยหลัง ไม่ข้ามเลยเป้าหมาย
 */
export function forwardPath(
  orderType: OrderType,
  current: InternalStatus,
  target: InternalStatus,
  onlyFrom?: InternalStatus[]
): InternalStatus[] {
  if (onlyFrom && !onlyFrom.includes(current)) return [];
  const flow = FLOW_BY_TYPE[orderType];
  const curIdx = flow.indexOf(current);
  const tgtIdx = flow.indexOf(target);
  if (curIdx < 0 || tgtIdx < 0 || tgtIdx <= curIdx) return [];
  return flow.slice(curIdx + 1, tgtIdx + 1);
}

// ============================================================
// ROLE → STATUS TARGETS (single source — server validate + UI ซ่อนปุ่ม ใช้ชุดเดียวกัน
// กัน UX โกหก: ปุ่มโชว์แต่กดแล้วโดน FORBIDDEN · audit ข้อ 29)
// ============================================================

// PRODUCTION_STAFF เปลี่ยนได้เฉพาะสถานะฝั่งผลิต-จัดส่ง — ปิดงาน/ยกเลิก/ฝั่งขาย-ออกแบบไม่ได้
export const PRODUCTION_STAFF_STATUSES: InternalStatus[] = [
  "PRODUCING",
  "QUALITY_CHECK",
  "PACKING",
  "READY_TO_SHIP",
  "SHIPPED",
];
// DESIGNER: รับงานเข้าออกแบบเองเท่านั้น · ACCOUNTANT: ปิดงานหลังวางบิลครบเท่านั้น
export const DESIGNER_STATUSES: InternalStatus[] = ["DESIGNING"];
export const ACCOUNTANT_STATUSES: InternalStatus[] = ["COMPLETED"];

// ถอยจากจุดที่ประกาศกับลูกค้าแล้ว (ส่งแล้ว/ปิดแล้ว) = ผู้จัดการขึ้นไป + ต้องมีเหตุผล
export function isRollbackTransition(from: InternalStatus, to: InternalStatus): boolean {
  return (
    from === "COMPLETED" ||
    (from === "SHIPPED" && (["READY_TO_SHIP", "QUALITY_CHECK"] as InternalStatus[]).includes(to))
  );
}

// UI ใช้ซ่อนปุ่มให้ตรงกับ server — server ยังเป็นด่านจริงเสมอ
// PERM4: เช็คจากชุดสิทธิ์จริงของคน (user.me.permissions) — mirror ตรรกะ order.updateStatus
// เป๊ะ: กลุ่มเป้าหมาย 4 กลุ่ม + ถอยคิวเฉพาะจาก PRODUCING + rollback ต้องมีสิทธิ์งานหัวหน้า
export function canPermsSetStatus(
  perms: readonly string[] | null | undefined,
  from: InternalStatus,
  to: InternalStatus
): boolean {
  if (!perms) return true; // สิทธิ์ยังโหลดไม่เสร็จ — ไม่ flash ซ่อนปุ่ม
  const has = (p: string) => perms.includes(p);
  if (isRollbackTransition(from, to) && !has("supervise_operations")) return false;
  if (PRODUCTION_STAFF_STATUSES.includes(to)) return has("update_order_status_production");
  if (DESIGNER_STATUSES.includes(to)) return has("update_order_status_design");
  if (ACCOUNTANT_STATUSES.includes(to)) return has("close_orders");
  if (to === "PRODUCTION_QUEUE") {
    return (
      has("update_order_status_sales") ||
      (has("update_order_status_production") && from === "PRODUCING")
    );
  }
  return has("update_order_status_sales");
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
