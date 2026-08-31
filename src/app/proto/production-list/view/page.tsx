/**
 * หน้าที่อยู่ "ข้างใน" ปุ่มเปิดเต็มจอ / เปิดขนาดมือถือ — วาดหน้าควบคุมการผลิตแบบเดียว
 * เต็มหน้า ไม่มีของหน้าลองปน
 *
 * ทำไมต้องเป็นหน้าต่างจริง ไม่ใช่กล่องกว้าง 390 ในหน้าเทียบ:
 * ของจริงตัดสินเลย์เอาต์จาก breakpoint ของ "หน้าต่างเบราว์เซอร์" ไม่ใช่ของกล่องที่มันอยู่
 * → ยัด div แคบในหน้าคอม ข้างในจะยังคิดว่าอยู่บนจอ 1440 แล้วโชว์ตารางในกรอบมือถือ
 *
 * เป็น **server component** ที่อ่าน searchParams ตรง ๆ — ไม่งั้นเปิดลิงก์ `?v=bar`
 * จะเห็นแบบ "ของจริงตอนนี้" แว้บหนึ่งก่อนแล้วค่อยสลับ
 */

import {
  ProductionListPreview,
  type ProductionListVariant,
} from "../_preview";

const VARIANTS: ProductionListVariant[] = ["current", "dense", "focus", "bar"];

export default async function ProductionListProtoView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const pick = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const raw = pick("v");
  const variant = VARIANTS.find((item) => item === raw) ?? "current";
  const busy = pick("busy") === "1";

  return (
    // กล่องเดียวกับ <main> ของเว็บจริง (mx-auto max-w-screen-2xl + ระยะขอบชุดเดียวกัน)
    <div className="mx-auto w-full max-w-screen-2xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-8">
      <ProductionListPreview variant={variant} busy={busy} />
    </div>
  );
}
