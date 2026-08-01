import {
  CUSTOMER_STATUS_LABELS,
  INTERNAL_STATUS_LABELS,
} from "@/lib/order-status";
import { StatusLabel, type StatusTone } from "@/components/ui/status-label";
import type { CustomerStatus, InternalStatus } from "@prisma/client";

interface OrderStatusBadgeProps {
  customerStatus?: CustomerStatus;
  internalStatus?: InternalStatus;
  /** When true, renders compactly (e.g. inside table cells). */
  compact?: boolean;
}

/** โทนของสถานะฝั่งลูกค้า — ปลายทาง (จบ/ยกเลิก) เท่านั้นที่ย้อมข้อความ */
const TONE: Record<CustomerStatus, StatusTone> = {
  ORDER_RECEIVED: "accent",
  PREPARING: "accent",
  IN_PRODUCTION: "warning",
  READY_TO_SHIP: "warning",
  SHIPPED: "accent",
  COMPLETED: "success",
  CANCELLED: "danger",
};

/**
 * สถานะออเดอร์ = จุดสี + ข้อความ (ไม่ใช่แคปซูลพื้นสี)
 * ตั้งแต่ 2026-08-01 ยืมร่างจาก <StatusLabel> ของกลาง เพื่อให้ทุกหน้าในเว็บ
 * พูดภาษาเดียวกัน — เดิมหน้านี้เป็นจุดสี แต่อีก 8 หน้าเป็นแคปซูล
 */
export function OrderStatusBadge({
  customerStatus,
  internalStatus,
  compact,
}: OrderStatusBadgeProps) {
  if (!customerStatus && !internalStatus) return null;

  const customerLabel = customerStatus
    ? (CUSTOMER_STATUS_LABELS[customerStatus] ?? customerStatus)
    : null;
  const internalLabel = internalStatus
    ? (INTERNAL_STATUS_LABELS[internalStatus] ?? internalStatus)
    : null;

  // ไม่มีสถานะลูกค้า = แสดงสถานะภายในเป็นบรรทัดหลักแทน
  if (!customerStatus || !customerLabel) {
    return (
      <StatusLabel
        label={internalLabel}
        tone="neutral"
        className={compact ? undefined : "gap-0.5"}
      />
    );
  }

  const tone = TONE[customerStatus] ?? "neutral";
  return (
    <StatusLabel
      label={customerLabel}
      // สถานะปลายทางต้องสะดุดตาตอนสแกน list · ระหว่างทางคงข้อความเทาเข้ม
      emphasize={customerStatus === "COMPLETED" || customerStatus === "CANCELLED"}
      tone={tone}
      // ซ่อนบรรทัดล่างเมื่อสะกดตรงกับบรรทัดบน (เช่น "กำลังผลิต / กำลังผลิต")
      // — เขียนซ้ำไม่ได้บอกอะไรเพิ่ม มีแต่ทำให้สงสัยว่าต่างกันตรงไหน
      sub={internalLabel}
      className={compact ? undefined : "gap-0.5"}
    />
  );
}
