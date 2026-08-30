export type ProtoStatus = "รอเคาะ" | "เคาะแล้ว" | "พับ" | "เก็บอ้างอิง";

export type ProtoEntry = {
  slug: string;
  title: string;
  /** คำถามที่ต้องเคาะ 1 ประโยค — อ่านแล้วรู้ทันทีว่าเปิดเข้าไปเพื่อตัดสินอะไร */
  question: string;
  date: string;
  status: ProtoStatus;
  /** เคาะแล้วเลือกอะไร + ลงของจริงหรือยัง (มีเฉพาะสถานะ "เคาะแล้ว") */
  verdict?: string;
};

export const PROTOS: ProtoEntry[] = [
  {
    slug: "work-board",
    title: "หน้าทำงานหลัก (ออเดอร์ + การผลิต)",
    question:
      "เปิดคอมมาแล้วควรเจออะไร — ตารางกรองแยกสองหน้าแบบเดิม / กองตามเวลา / กระดานตามช่วงงาน / รายการคู่แผงข้าง",
    date: "2026-08-30",
    status: "รอเคาะ",
  },
];
