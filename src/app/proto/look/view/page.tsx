/**
 * หน้าที่อยู่ปลายปุ่ม "เปิดขนาดมือถือ" และ "เปิดเต็มหน้าจอ" — วาดสามบล็อกล้วน
 * ไม่มีของหน้าลองปน · เป็น server component ที่อ่าน searchParams ตรง ๆ เพื่อให้
 * ภาพแรกที่เห็นคือแบบที่กดมาดู ไม่ใช่ "ของจริงตอนนี้" แว้บหนึ่งก่อนแล้วค่อยสลับ
 */

import { LookPreview, type LookVariant } from "../_blocks";

const VALUES: LookVariant[] = ["current", "rank", "module", "alive"];

export default async function LookProtoView({
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
  const variant = (VALUES as string[]).includes(raw ?? "")
    ? (raw as LookVariant)
    : "current";

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-8">
      <LookPreview variant={variant} plain={pick("plain") === "1"} />
    </div>
  );
}
