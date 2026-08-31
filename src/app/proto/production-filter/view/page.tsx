/**
 * หน้าที่อยู่ "ข้างใน" ปุ่มเปิดเต็มจอ / เปิดขนาดมือถือ — วาดหน้าควบคุมการผลิตแบบเดียว
 * เต็มหน้า ไม่มีของหน้าลองปน (เหตุผลเดียวกับ /proto/production-list/view:
 * ของจริงตัดสินเลย์เอาต์จากขนาดหน้าต่างเบราว์เซอร์ ไม่ใช่ขนาดกล่องที่มันอยู่)
 */

import {
  ProductionFilterPreview,
  type ProductionFilterVariant,
} from "../_preview";

const VARIANTS: ProductionFilterVariant[] = ["current", "lane", "two", "none"];

export default async function ProductionFilterProtoView({
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
      <ProductionFilterPreview variant={variant} busy={busy} />
    </div>
  );
}
