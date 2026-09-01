/**
 * หน้าที่อยู่ "ข้างใน" ปุ่มเปิดเต็มจอ / เปิดขนาดจอทัช — วาดใบสั่งผลิตแบบเดียวเต็มหน้า
 * (แถบลงมือของแบบ C เกาะขอบล่างจอจริง ต้องดูในหน้าต่างจริงถึงจะเห็นพฤติกรรมถูก)
 */

import { WorkOrderControlPreview } from "../_preview";
import type { WorkOrderControlVariant } from "../_variants";

const VARIANTS: WorkOrderControlVariant[] = ["current", "inline", "side", "bottom", "tabs"];

export default async function WorkOrderControlProtoView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.v;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const variant = VARIANTS.find((item) => item === value) ?? "current";

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-8">
      <WorkOrderControlPreview variant={variant} />
    </div>
  );
}
