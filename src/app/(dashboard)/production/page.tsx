import { redirect } from "next/navigation";
import { ProductionDeskPage } from "@/components/production/production-desk-page";
import { FLOOR_HREF, isFloorWorker } from "@/lib/production-surface";
import { getServerUserAccess } from "@/lib/supabase-server";

/**
 * /production — โต๊ะงานหัวหน้า แบบ A (เบสเคาะ 2026-09-02 จากหน้าลอง /proto/production-module)
 * โครง "หนึ่งโมดูล สองสายตา" (09-03): ช่างเปิดมาถูกพาไปโหมดหน้างาน /production/floor — ช่างรู้จักแค่ "งานของฉัน"
 * ใช้ production.kanban ชุดเดียวทั้ง legacy และ V2 (ใบผลิต V2 ยังมี steps/order เดิมให้ board อ่านได้)
 * — ทางเข้าลึกของ V2 (ควบคุม/ตั้งค่า) อยู่ที่ใบผลิต /production/[id] เหมือนเดิม
 */
export default async function ProductionPage() {
  const access = await getServerUserAccess();
  if (access && isFloorWorker(access.role, access.permissionOverrides)) redirect(FLOOR_HREF);
  return <ProductionDeskPage />;
}
