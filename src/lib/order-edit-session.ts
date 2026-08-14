/**
 * รักษา snapshot ตอนเปิดฟอร์มแก้ออเดอร์ไว้ตลอด session ของ orderId เดิม
 * เพื่อไม่ให้ background refetch เลื่อน optimistic token/baseline ไปข้างหน้า
 * ขณะที่ local form state ยังเป็นค่าชุดเดิม
 */
export function resolvePinnedOrderEditSession<T extends { orderId: string }>(
  pinned: T | null,
  requestedOrderId: string,
  candidate: T | null,
): T | null {
  if (pinned?.orderId === requestedOrderId) return pinned;
  if (candidate?.orderId === requestedOrderId) return candidate;
  return null;
}
