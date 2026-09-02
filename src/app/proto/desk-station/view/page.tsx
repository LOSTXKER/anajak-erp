"use client";

/** มุมมองเต็มจอของหน้าลอง "ใบผลิตหลังแบ่งตามที่ยืน" — เปิดเป็นหน้าต่างมือถือ / เต็มจอ */

import { useProtoFlag, useProtoVariant } from "../../_kit/use-proto-variant";
import { DETAIL_VALUES, Preview, VALUES, type DetailMode, type Variant } from "../_preview";

export default function DeskStationViewPage() {
  const [variant] = useProtoVariant<Variant>("v", VALUES, "table");
  const [detail] = useProtoVariant<DetailMode>("d", DETAIL_VALUES, "row");
  const [boss] = useProtoFlag("boss", true);
  return (
    <main className="min-h-screen bg-bg px-4 py-5 text-strong sm:px-6 lg:px-8">
      <Preview variant={variant} boss={boss} detail={detail} />
    </main>
  );
}
