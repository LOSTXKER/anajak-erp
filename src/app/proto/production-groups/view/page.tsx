/**
 * หน้าที่อยู่ "ข้างใน" ปุ่มเปิดเต็มจอ / เปิดขนาดมือถือ — วาดหน้าควบคุมการผลิตแบบเดียว
 * เต็มหน้า ไม่มีของหน้าลองปน (เหตุผลเดียวกับหน้าลองอื่น: ของจริงตัดสินเลย์เอาต์
 * จากขนาดหน้าต่างเบราว์เซอร์ ไม่ใช่ขนาดกล่องที่มันอยู่)
 */

import {
  ProductionGroupsPreview,
  type ProductionGroupVariant,
  type ProductionSortControl,
} from "../_preview";

const VARIANTS: ProductionGroupVariant[] = ["current", "label", "rows", "fold"];
const SORTS: ProductionSortControl[] = ["select", "toggle", "none"];

export default async function ProductionGroupsProtoView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const pick = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const variant = VARIANTS.find((item) => item === pick("v")) ?? "current";
  const sortControl = SORTS.find((item) => item === pick("sort")) ?? "select";
  const busy = pick("busy") === "1";

  return (
    // กล่องเดียวกับ <main> ของเว็บจริง (mx-auto max-w-screen-2xl + ระยะขอบชุดเดียวกัน)
    <div className="mx-auto w-full max-w-screen-2xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-8">
      <ProductionGroupsPreview
        variant={variant}
        sortControl={sortControl}
        busy={busy}
      />
    </div>
  );
}
