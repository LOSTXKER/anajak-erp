import { redirect } from "next/navigation";
import { WorkOrderPage } from "@/components/production/work-order-page";
import { floorJobHref, isFloorWorker } from "@/lib/production-surface";
import { getServerUserAccess } from "@/lib/supabase-server";

/**
 * /production/[id] — ใบผลิตแบบ D "แท็บ + 2 คอลัมน์" (เบสเคาะ 2026-09-03 จากหน้าลอง /proto/work-order)
 * หัวหน้าทำได้ครบในหน้านี้ (ดู · วางแผน · ลงมือ · แก้ให้) · ช่างเปิดใบเดียวกันจะเห็นหน้าลงมือของโหมดหน้างานแทน
 * ใช้ production.getById ชุดเดิม (ใบ V2 ก็อ่านได้ผ่าน steps/order เดิม) · ทางลึกของ V2 ค่อยต่อทีหลัง
 */
export default async function ProductionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await getServerUserAccess();
  if (access && isFloorWorker(access.role, access.permissionOverrides)) redirect(floorJobHref(id));
  return <WorkOrderPage id={id} />;
}
