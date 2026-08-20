import type { PrismaTx } from "@/lib/prisma";

/**
 * กันสมาชิก Production/ProductionStep ของออเดอร์เปลี่ยนระหว่าง writer กำลังหา lock set.
 *
 * PostgreSQL advisory transaction lock นี้ไม่แทน row lock; มันเป็น mutex สั้น ๆ ที่ writer
 * ซึ่งเพิ่ม/เปลี่ยน topology ต้องถือก่อน snapshot แล้วค่อยเดิน global row-lock order เดิม
 * (steps → productions → order). ปลดอัตโนมัติเมื่อ transaction จบทุกทาง
 */
export async function lockProductionTopology(tx: PrismaTx, orderId: string): Promise<void> {
  // ฟังก์ชันคืน PostgreSQL void ซึ่ง Prisma deserialize ไม่ได้; cast ผลลัพธ์เท่านั้น
  // โดย side effect ของ transaction advisory lock และเวลาปลด lock ยังเหมือนเดิม
  await tx.$queryRaw<Array<{ lock_result: string }>>`
    SELECT pg_advisory_xact_lock(
      hashtext('anajak:production-topology'),
      hashtext(${orderId})
    )::text AS lock_result
  `;
}
