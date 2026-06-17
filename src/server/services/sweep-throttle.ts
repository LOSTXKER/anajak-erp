import type { ExtendedPrismaClient } from "@/lib/prisma";

// ชิงสิทธิ์ "กวาดรอบนี้" แบบ throttle + atomic — กันหลาย request/instance กวาดซ้อนกัน
// คืน true = ได้สิทธิ์กวาดรอบนี้ · false = ยังไม่ถึงเวลา หรือแพ้ race ให้คนอื่น
// ใช้ร่วม: sweep overdue invoices + auto-release จองสต๊อกค้าง (เก็บ timestamp ใน Setting ต่อ key)
export async function claimThrottleSlot(
  prisma: ExtendedPrismaClient,
  key: string,
  minIntervalMs: number,
  now: Date
): Promise<boolean> {
  const existing = await prisma.setting.findUnique({ where: { key } });
  const last = existing ? Date.parse(existing.value) : NaN;
  if (Number.isFinite(last) && now.getTime() - last < minIntervalMs) {
    return false;
  }

  // ชิงสิทธิ์แบบ atomic (เทียบค่าเดิมก่อนเขียนทับ) — แพ้แปลว่ามีคนอื่นกำลังกวาด
  if (existing) {
    const claimed = await prisma.setting.updateMany({
      where: { key, value: existing.value },
      data: { value: now.toISOString() },
    });
    return claimed.count > 0;
  }
  try {
    await prisma.setting.create({ data: { key, value: now.toISOString() } });
    return true;
  } catch {
    return false; // unique ชน — แพ้ race
  }
}
