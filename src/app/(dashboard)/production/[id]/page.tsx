import { redirect } from "next/navigation";
import { WorkOrderKitPage } from "@/components/production/work-order-kit";
import { floorJobHref, isFloorWorker } from "@/lib/production-surface";
import { getServerUserAccess } from "@/lib/supabase-server";

/**
 * /production/[id] — ใบผลิตบนชุดหน้าตากลาง (ต้นแบบ mockup-production-calm-2026-09-15 · เบสสั่งลงจริง 2026-09-16)
 * หัวหน้าทำได้ครบในหน้านี้ (ดู · วางแผน · ลงมือ · แก้ให้) · ช่างเปิดใบเดียวกันจะเห็นหน้าลงมือของโหมดหน้างานแทน
 * ใช้ production.getById ชุดเดิม (ใบ V2 ก็อ่านได้ผ่าน steps/order เดิม) · ทางลึกของ V2 ค่อยต่อทีหลัง
 */
export default async function ProductionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await getServerUserAccess();
  if (access && isFloorWorker(access.role, access.permissionOverrides)) redirect(floorJobHref(id));
  return <WorkOrderKitPage id={id} />;
}
