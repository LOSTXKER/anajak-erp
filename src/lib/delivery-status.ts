// State machine ใบส่ง (B13) — เลียน outsource: สถานะเดินตามเส้นทางจริง ห้ามกระโดดถอยไกล
// แหล่งเดียว: server (delivery.updateStatus validate) + UI (dropdown โชว์เฉพาะที่ไปได้) ใช้ร่วม

// ป้ายไทย/สีสถานะ อยู่ที่ status-config (แหล่งเดียว UI+server ใช้ร่วม) — ที่นี่ถือแค่ "เส้นทาง"
export const DELIVERY_STATUSES = [
  "PENDING",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "RETURNED",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

// เส้นทางที่ "เปลี่ยนสถานะ" ได้ (ไม่รวม self — self จัดการแยกให้แก้เลขพัสดุโดยไม่เปลี่ยนสถานะ)
// อนุญาต: เดินหน้าตามคิว · ส่งตรง/รับเอง (PENDING/PREPARING → DELIVERED) · ตีกลับได้ทุกจุด ·
//   แก้พลาดถอย "หนึ่งก้าว" (SHIPPED→PREPARING · DELIVERED→SHIPPED) · จัดการใหม่หลังตีกลับ
// บล็อก: ถอยไกลข้ามขั้น (SHIPPED→PENDING · DELIVERED→PENDING/PREPARING) — ถอยทีละก้าว
const DELIVERY_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  PENDING: ["PREPARING", "SHIPPED", "DELIVERED", "RETURNED"],
  PREPARING: ["PENDING", "SHIPPED", "DELIVERED", "RETURNED"],
  SHIPPED: ["PREPARING", "DELIVERED", "RETURNED"],
  DELIVERED: ["SHIPPED", "RETURNED"],
  RETURNED: ["PENDING", "PREPARING", "SHIPPED"],
};

// เปลี่ยนสถานะได้ไหม — self (from === to) = ได้เสมอ (อัปเดตเลขพัสดุ/field โดยไม่เปลี่ยนสถานะ)
export function isValidDeliveryTransition(from: DeliveryStatus, to: DeliveryStatus): boolean {
  if (from === to) return true;
  return (DELIVERY_TRANSITIONS[from] ?? []).includes(to);
}

// สถานะถัดไปที่กดได้จริงจากสถานะปัจจุบัน (สำหรับ dropdown UI) — รวม current เองไว้ให้เลือกค้าง
export function nextDeliveryStatuses(from: DeliveryStatus): DeliveryStatus[] {
  return [from, ...(DELIVERY_TRANSITIONS[from] ?? [])];
}
