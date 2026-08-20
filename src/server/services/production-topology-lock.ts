import type { PrismaTx } from "@/lib/prisma";

/**
 * กันสมาชิก Production/ProductionStep ของออเดอร์เปลี่ยนระหว่าง writer กำลังหา lock set.
 *
 * PostgreSQL advisory transaction lock นี้ไม่แทน row lock; มันเป็น mutex สั้น ๆ ที่ writer
 * ซึ่งเพิ่ม/เปลี่ยน topology ต้องถือก่อน snapshot แล้วค่อยเดิน global row-lock order เดิม
 * (steps → productions → order). ปลดอัตโนมัติเมื่อ transaction จบทุกทาง
 */
export async function lockProductionTopology(tx: PrismaTx, orderId: string): Promise<void> {
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtext('anajak:production-topology'),
      hashtext(${orderId})
    )
  `;
}
