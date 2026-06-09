import superjson from "superjson";

// ตาข่ายนิรภัยชั้น wire: field เงินถูกแปลง Decimal→number แล้วใน src/lib/prisma.ts (result extension)
// แต่ aggregate/_sum ที่หลุดการแปลงจะยังเป็น Prisma Decimal — ถ้าปล่อยผ่าน superjson เดิม
// client จะได้ object โครงสร้างภายในของ decimal.js แทนตัวเลข · ตัวนี้ดักแปลงเป็น number ให้
// ตรวจแบบ structural (s/e/d คือ internal ของ decimal.js ทุกเวอร์ชัน) — ไม่ดึง decimal.js เข้า client bundle
type DecimalLike = { toNumber(): number };

function isDecimalLike(v: unknown): v is DecimalLike {
  if (v === null || typeof v !== "object") return false;
  const d = v as { toNumber?: unknown; d?: unknown; e?: unknown; s?: unknown };
  return (
    typeof d.toNumber === "function" &&
    Array.isArray(d.d) &&
    typeof d.e === "number" &&
    typeof d.s === "number"
  );
}

superjson.registerCustom<DecimalLike, number>(
  {
    isApplicable: isDecimalLike,
    serialize: (v) => v.toNumber(),
    // ฝั่งรับค่าที่ serialize แล้วเป็น number ใช้ได้เลย — ไม่สร้าง Decimal กลับ
    deserialize: (v) => v as unknown as DecimalLike,
  },
  "prisma.decimal"
);

export default superjson;
