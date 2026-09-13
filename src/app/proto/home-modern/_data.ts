// ข้อมูลสมมติสำหรับตัดสินทิศทางหน้าแรกเท่านั้น ไม่มี ID หรือ mutation ของระบบจริง
export type PreviewOrder = {
  id: string;
  customer: string;
  project: string;
  technique: string;
  quantity: number;
  amount: number;
  day: number;
  status: "กำลังผลิต" | "รออนุมัติแบบ" | "พร้อมส่ง" | "รับออเดอร์";
  owner: string;
  color: string;
  mark: string;
  attention?: string;
};
export const ORDERS: PreviewOrder[] = [
  { id: "ORD-2609-0042", customer: "Northstar Studio", project: "เสื้อทีม Creative Club", technique: "DTF", quantity: 120, amount: 22800, day: 14, status: "กำลังผลิต", owner: "พิม", color: "navy", mark: "NORTH", attention: "กำหนดส่งวันนี้ · รอรีดร้อน" },
  { id: "ORD-2609-0041", customer: "Mellow Coffee", project: "ยูนิฟอร์มหน้าร้าน", technique: "ซิลค์สกรีน", quantity: 80, amount: 14400, day: 14, status: "พร้อมส่ง", owner: "แพร", color: "cream", mark: "mellow" },
  { id: "ORD-2609-0040", customer: "Run Together", project: "เสื้องานวิ่งประจำปี", technique: "DTF", quantity: 240, amount: 40800, day: 15, status: "รออนุมัติแบบ", owner: "พิม", color: "lime", mark: "RUN", attention: "รออนุมัติแบบ · ส่งพรุ่งนี้" },
  { id: "ORD-2609-0039", customer: "Sunday Market", project: "เสื้อทีมจัดงาน", technique: "ปัก", quantity: 60, amount: 13800, day: 16, status: "กำลังผลิต", owner: "นนท์", color: "pink", mark: "SUN.", attention: "ร้านนอกเลยกำหนดรับ 1 วัน" },
  { id: "ORD-2609-0038", customer: "Bluebird Hotel", project: "เสื้อพนักงานต้อนรับ", technique: "DTF", quantity: 150, amount: 28500, day: 17, status: "กำลังผลิต", owner: "แพร", color: "blue", mark: "bb." },
  { id: "ORD-2609-0037", customer: "Good Day Co.", project: "เสื้อเปิดตัวคอลเลกชัน", technique: "DTF", quantity: 100, amount: 19500, day: 18, status: "รับออเดอร์", owner: "นนท์", color: "white", mark: "GOOD" },
  { id: "ORD-2609-0036", customer: "Common Ground", project: "เสื้อทีมเวิร์กช็อป", technique: "ซิลค์สกรีน", quantity: 45, amount: 9000, day: 19, status: "พร้อมส่ง", owner: "พิม", color: "gray", mark: "common" },
];
export const ACTIVITIES = [
  { time: "10:42", person: "แพร", action: "แพ็กครบ พร้อมส่ง", orderId: "ORD-2609-0041", color: "green" },
  { time: "10:18", person: "พิม", action: "ส่งแบบให้ลูกค้าอนุมัติ", orderId: "ORD-2609-0040", color: "blue" },
  { time: "09:56", person: "นนท์", action: "เปิดออเดอร์ใหม่", orderId: "ORD-2609-0037", color: "gray" },
  { time: "09:30", person: "พิม", action: "รับเสื้อครบ 120 ตัว", orderId: "ORD-2609-0042", color: "blue" },
];
