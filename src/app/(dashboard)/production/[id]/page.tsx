import { WorkOrderPage } from "@/components/production/work-order-page";

/**
 * /production/[id] — ใบผลิตแบบ D "แท็บ + 2 คอลัมน์" (เบสเคาะ 2026-09-03 จากหน้าลอง /proto/work-order)
 * ใช้ production.getById ชุดเดิม (ใบ V2 ก็อ่านได้ผ่าน steps/order เดิม) · ทางลึกของ V2 ค่อยต่อทีหลัง
 */
export default async function ProductionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkOrderPage id={id} />;
}
