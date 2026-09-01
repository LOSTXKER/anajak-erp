/**
 * หน้าที่อยู่ "ข้างใน" ปุ่มเปิดเต็มจอ / เปิดขนาดจอทัช — วาดใบสั่งผลิตแบบเดียวเต็มหน้า
 * (ความยาวจริงของแต่ละแบบวัดได้จากหน้านี้เท่านั้น เพราะในหน้าเทียบมีกรอบครอบอยู่)
 */

import { WorkOrderDensityPreview } from "../_preview";
import type { WorkOrderDensityVariant } from "../_variants";

const VARIANTS: WorkOrderDensityVariant[] = ["current", "tabs", "context", "split"];

export default async function WorkOrderDensityProtoView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.v;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const variant = VARIANTS.find((item) => item === value) ?? "current";
  const bigRaw = params.big;
  const big = (Array.isArray(bigRaw) ? bigRaw[0] : bigRaw) === "1";

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-8">
      <WorkOrderDensityPreview variant={variant} big={big} />
    </div>
  );
}
