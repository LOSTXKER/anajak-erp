import { StationScreen } from "@/components/station/station-screen";

/**
 * /production/floor — โหมดหน้างานของโมดูลผลิต (โครง "หนึ่งโมดูล สองสายตา" · เบสเคาะ 2026-09-03)
 *   ช่าง: เลือกสถานี → คิว → หน้าลงมือ (ปุ่มใหญ่ ไม่มีเงิน) — ล็อกอินแล้วตกที่นี่เลย
 *   หัวหน้าเดินโรงงาน: จอเดียวกันเป็นแผงสถานี + "แก้ให้" ทุกการ์ด (โต๊ะงานอยู่ /production)
 * เต็มจอ ไม่มีเมนูข้าง (layout ของโฟลเดอร์นี้) · ข้อมูล factory.stationQueue (ไม่มีเงินโดยโครงสร้าง)
 * เดิมคือ /station (09-03 เช้า) — route เก่ายัง redirect มาที่นี่
 */
export default function ProductionFloorPage() {
  return <StationScreen />;
}
