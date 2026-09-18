import { resolutionNeedsRework } from "@/lib/claim";

/* ============================================================
   คำที่ลูกค้าเห็นตอนงานเข้ารอบแก้ (ก้อน 1 · ต่อจากใบเคลม)

   ทำไมต้องมีไฟล์นี้: พอสั่งงานแก้ สถานะออเดอร์จะถอยจาก "จัดส่งแล้ว" กลับไป "กำลังผลิต"
   หน้าติดตามงานของลูกค้าจึงเดินถอยหลังเอง โดยไม่มีอะไรบอกว่าเกิดอะไรขึ้น — ลูกค้าที่เพิ่ง
   ทักมาว่าของมีปัญหา จะเห็นแค่แถบย้อนกลับกับป้ายแดง "ตีกลับ" ซึ่งอ่านเหมือนงานพัง

   กติกาของไฟล์นี้: แปลงใบเคลมเป็นคำที่ปลอดภัยพูดกับลูกค้า — ไม่มียอดเงิน ไม่มีคนผิด
   ไม่มีเลขใบเคลม และไม่มีคำว่า "เคลม" · เป็นฟังก์ชันล้วนที่ทำงานฝั่ง server เสมอ
   หน้า public จึงได้รับมาแต่ข้อความสำเร็จรูป ไม่เคยเห็นตัวใบเคลมจริง (กันรั่วที่ต้นทาง)
   ============================================================ */

/** ขั้นของรอบแก้ที่ลูกค้าเห็น — คนละชุดกับสถานะออเดอร์ เพราะเล่าคนละเรื่อง */
export type CustomerReworkStage = "RECEIVED" | "FIXING" | "SENDING_BACK" | "SETTLING";

export interface CustomerReworkStep {
  label: string;
  state: "done" | "current" | "todo";
}

export interface CustomerReworkView {
  /** โชว์เฉพาะรอบที่ 2 ขึ้นไป — "รอบที่ 1" ไม่มีความหมายกับลูกค้า */
  round: number;
  stage: CustomerReworkStage;
  headline: string;
  note: string;
  /** แถบสามขั้นของรอบแก้ · ว่าง = เรื่องนี้ไม่ได้จบด้วยการแก้ของ */
  steps: CustomerReworkStep[];
}

export interface CustomerReworkInput {
  round: number;
  state: string;
  resolution: string | null;
  /** ข้อความที่ร้านเขียนเองให้ลูกค้าอ่าน — มีเมื่อไรใช้แทนคำปริยาย */
  customerMessage: string | null;
  /** ขั้นงานแก้ที่ผูกใบนี้ทั้งหมด และที่ยังไม่ปิด (นิยามเดียวกับฝั่งทีม) */
  reworkSteps: number;
  openReworkSteps: number;
}

const REWORK_RAIL = ["รับเรื่อง", "กำลังแก้งาน", "ส่งกลับให้ใหม่"] as const;

const STAGE_TEXT: Record<CustomerReworkStage, { headline: string; note: string }> = {
  RECEIVED: {
    headline: "รับเรื่องแล้ว",
    note: "ทีมงานได้รับเรื่องแล้ว กำลังดูให้ว่าจะแก้ให้อย่างไร แล้วจะติดต่อกลับ",
  },
  FIXING: {
    headline: "กำลังแก้งานให้",
    note: "งานรอบแก้อยู่กับทีมผลิต จะแจ้งอีกครั้งเมื่อพร้อมส่งกลับ",
  },
  SENDING_BACK: {
    headline: "แก้เสร็จแล้ว กำลังเตรียมส่งกลับ",
    note: "ของรอบแก้เสร็จแล้ว อีกไม่นานจะมีเลขพัสดุรอบใหม่ขึ้นที่หน้านี้",
  },
  SETTLING: {
    headline: "กำลังสรุปเรื่องกับคุณ",
    note: "ทีมงานจะติดต่อกลับเพื่อสรุปรายละเอียดกับคุณโดยตรง",
  },
};

function pickStage(claim: CustomerReworkInput): CustomerReworkStage {
  if (claim.state === "OPEN") return "RECEIVED";
  // ตัดสินเป็นทางที่ไม่ได้แตะของ (ลดราคา/คืนเงิน/ไม่รับเคลม) — แถบ "ส่งกลับให้ใหม่" จะโกหก
  if (!resolutionNeedsRework(claim.resolution)) return "SETTLING";
  if (claim.reworkSteps > 0 && claim.openReworkSteps === 0) return "SENDING_BACK";
  return "FIXING";
}

/**
 * แปลงใบเคลมที่ยังไม่จบเป็นสิ่งที่ลูกค้าเห็น — คืน null เมื่อไม่มีเรื่องค้าง
 * (ใบที่ปิด/ยกเลิกแล้วต้องหายจากหน้าลูกค้าทันที ไม่ค้างเป็นป้ายถาวร)
 */
export function describeReworkForCustomer(
  claim: CustomerReworkInput | null | undefined,
): CustomerReworkView | null {
  if (!claim) return null;
  if (claim.state !== "OPEN" && claim.state !== "DECIDED") return null;

  const stage = pickStage(claim);
  const text = STAGE_TEXT[stage];
  const currentIndex = stage === "RECEIVED" ? 0 : stage === "FIXING" ? 1 : 2;

  return {
    round: claim.round,
    stage,
    headline: text.headline,
    note: claim.customerMessage?.trim() || text.note,
    steps:
      stage === "SETTLING"
        ? []
        : REWORK_RAIL.map((label, index) => ({
            label,
            state: index < currentIndex ? "done" : index === currentIndex ? "current" : "todo",
          })),
  };
}
