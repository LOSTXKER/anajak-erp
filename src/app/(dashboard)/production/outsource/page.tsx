import { OutsourcePage } from "@/components/outsource/outsource-page";

/**
 * /production/outsource — หน้า "ร้านนอก" (เบสสั่งลงจริง 2026-09-16)
 * ปุ่มต่อใบมาจาก availableCommands ของ outsource.listOrders (server ตัดสินสิทธิ์และสถานะ)
 */
export default function ProductionOutsourcePage() {
  return <OutsourcePage />;
}
