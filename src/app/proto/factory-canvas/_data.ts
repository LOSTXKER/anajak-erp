/**
 * ข้อมูลตัวอย่างของหน้าลอง "จอรวมการผลิตแบบ canvas" — **ปลอมทั้งหมด ไม่ต่อฐานข้อมูล**
 *
 * เดิมยกจาก board ตัวจริงผ่านหน้าลอง /proto/production-list แต่หน้ารายการผลิตกับ lib
 * production-board ถูกถอดออก 2026-09-02 (รอออกแบบใหม่) — จึงเหลือชุดตัวเลขนิ่ง ๆ เท่าที่
 * หน้านี้ใช้ (สถานี + ใบงานต่อสถานี) ให้หน้าลองยังเปิดดูเป็นวัตถุดิบของจอโรงงานได้
 */

export type ProtoStation = {
  key: string;
  label: string;
  count: number;
  overdue: number;
  isOutsource: boolean;
};

export type ProtoJob = {
  key: string;
  order: { orderNumber: string; customerName: string | null };
  overdue: boolean;
  stationKeys: string[];
};

const stations: ProtoStation[] = [
  { key: "prep", label: "เตรียมเสื้อ", count: 4, overdue: 1, isOutsource: false },
  { key: "dtf-print", label: "พิมพ์ DTF", count: 5, overdue: 2, isOutsource: false },
  { key: "heat-press", label: "รีดร้อน", count: 3, overdue: 0, isOutsource: false },
  { key: "qc", label: "ตรวจ QC", count: 2, overdue: 0, isOutsource: false },
  { key: "final-pack", label: "แพ็กสุดท้าย", count: 2, overdue: 1, isOutsource: false },
  { key: "outsource:embroidery", label: "ปัก (ร้านนอก)", count: 2, overdue: 1, isOutsource: true },
  { key: "outsource:sewing", label: "ตัดเย็บ (ร้านนอก)", count: 1, overdue: 0, isOutsource: true },
];

const jobs: ProtoJob[] = [
  { key: "j1", order: { orderNumber: "ORD-2608-0041", customerName: "บริษัท สยามเทค จำกัด" }, overdue: true, stationKeys: ["prep", "dtf-print"] },
  { key: "j2", order: { orderNumber: "ORD-2608-0042", customerName: "ร้านกาแฟบ้านสวน" }, overdue: false, stationKeys: ["dtf-print"] },
  { key: "j3", order: { orderNumber: "ORD-2608-0043", customerName: "โรงเรียนอนุบาลดาวเด่น" }, overdue: true, stationKeys: ["dtf-print", "outsource:embroidery"] },
  { key: "j4", order: { orderNumber: "ORD-2608-0044", customerName: null }, overdue: false, stationKeys: ["prep"] },
  { key: "j5", order: { orderNumber: "ORD-2608-0045", customerName: "ทีมวิ่ง Sunday Runners" }, overdue: false, stationKeys: ["heat-press"] },
  { key: "j6", order: { orderNumber: "ORD-2608-0046", customerName: "บริษัท กรีนโลจิสติกส์ จำกัด (มหาชน)" }, overdue: false, stationKeys: ["heat-press", "qc"] },
  { key: "j7", order: { orderNumber: "ORD-2608-0047", customerName: "คุณนภา" }, overdue: true, stationKeys: ["final-pack"] },
  { key: "j8", order: { orderNumber: "ORD-2608-0048", customerName: "งานวิ่งการกุศล 2569" }, overdue: false, stationKeys: ["prep", "dtf-print", "outsource:sewing"] },
  { key: "j9", order: { orderNumber: "ORD-2608-0049", customerName: "บริษัท เอเชียฟู้ดส์ จำกัด" }, overdue: false, stationKeys: ["qc"] },
  { key: "j10", order: { orderNumber: "ORD-2608-0050", customerName: "ชมรมแบดมินตัน มธ." }, overdue: false, stationKeys: ["final-pack", "prep"] },
  { key: "j11", order: { orderNumber: "ORD-2608-0051", customerName: "ร้านเสื้อยืดหน้าราม" }, overdue: true, stationKeys: ["dtf-print", "outsource:embroidery"] },
  { key: "j12", order: { orderNumber: "ORD-2608-0052", customerName: "บริษัท ทรัพย์ทวี จำกัด" }, overdue: false, stationKeys: ["heat-press"] },
];

export const PROTO_BOARD = { stations, jobs };
