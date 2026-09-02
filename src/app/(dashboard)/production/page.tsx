import { ProductionDeskPage } from "@/components/production/production-desk-page";

/**
 * /production — โต๊ะงานหัวหน้า แบบ A (เบสเคาะ 2026-09-02 จากหน้าลอง /proto/production-module)
 * ใช้ production.kanban ชุดเดียวทั้ง legacy และ V2 (ใบผลิต V2 ยังมี steps/order เดิมให้ board อ่านได้)
 * — ทางเข้าลึกของ V2 (ควบคุม/ตั้งค่า) อยู่ที่ใบผลิต /production/[id] เหมือนเดิม
 */
export default function ProductionPage() {
  return <ProductionDeskPage />;
}
