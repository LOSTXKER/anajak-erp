/* ข้อมูลตัวอย่างของหน้าลอง — ยกโครงจากใบจริง MO-2609-0001 ในฐานทดลอง
   (สูตรมาตรฐาน 9 ขั้น · เงื่อนไข "ต้องเสร็จก่อน" ชุดเดียวกับของจริง)
   ตัวเลข/ชื่อ ปลอมทั้งหมด แต่รูปร่างและสถานะเหมือนของจริงทุกจุด */

export type OperationState =
  | "PLANNED"
  | "READY"
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED";

export type ProtoQuantityLine = {
  id: string;
  color: string;
  size: string;
  planned: number;
  good: number;
};

export type ProtoOperation = {
  id: string;
  code: string;
  name: string;
  state: OperationState;
  /** ส่งร้านนอกหรือทำเอง — ค่าที่มาจากสูตร และสลับรายใบได้ */
  outsourced: boolean;
  workCenter: string;
  assignee: string | null;
  /** รหัสขั้นที่ต้องเสร็จก่อนขั้นนี้ */
  waitsFor: string[];
  quantities: ProtoQuantityLine[];
  /** ขั้นที่มีประตูเฉพาะ เช่น DTF ต้องเริ่มจากรอบพิมพ์ที่มีหลักฐาน */
  gate?: string;
  problem?: string;
};

export type ProtoWorkOrder = {
  workOrderNumber: string;
  orderNumber: string;
  customerName: string;
  deadline: string;
  priority: "URGENT" | "NORMAL";
  state: string;
  totalQuantity: number;
  mockupUrl: string | null;
  operations: ProtoOperation[];
};

function lines(
  prefix: string,
  spec: [color: string, size: string, planned: number, good: number][],
): ProtoQuantityLine[] {
  return spec.map(([color, size, planned, good], index) => ({
    id: `${prefix}-${index}`,
    color,
    size,
    planned,
    good,
  }));
}

/** ชุดจำนวนมาตรฐานของใบนี้ — 3 สี × 3 ไซซ์ = 240 ตัว (เท่ากันทุกขั้นที่นับชิ้น) */
const STANDARD_LINES: [string, string, number, number][] = [
  ["ดำ", "M", 60, 0],
  ["ดำ", "L", 40, 0],
  ["ขาว", "M", 50, 0],
  ["ขาว", "L", 30, 0],
  ["กรม", "XL", 60, 0],
];

export const PROTO_WORK_ORDER: ProtoWorkOrder = {
  workOrderNumber: "MO-2609-0001",
  orderNumber: "ORD-2609-0002",
  customerName: "บริษัท นอร์ทสตาร์ รีเทล จำกัด",
  deadline: "5 ก.ย. 2569",
  priority: "URGENT",
  state: "กำลังผลิต",
  totalQuantity: 240,
  mockupUrl: "/demo-mockups/front.svg",
  operations: [
    {
      id: "op-prep-pick",
      code: "PREP_PICK",
      name: "เบิกเสื้อจากสต๊อก",
      state: "RUNNING",
      outsourced: false,
      workCenter: "เตรียมงาน",
      assignee: "นัท",
      waitsFor: [],
      quantities: lines("prep", [
        ["ดำ", "M", 60, 60],
        ["ดำ", "L", 40, 40],
        ["ขาว", "M", 50, 20],
        ["ขาว", "L", 30, 0],
        ["กรม", "XL", 60, 0],
      ]),
    },
    {
      id: "op-prep-receive",
      code: "PREP_RECEIVE",
      name: "รับเสื้อจากลูกค้า",
      state: "READY",
      outsourced: false,
      workCenter: "เตรียมงาน",
      assignee: null,
      waitsFor: [],
      quantities: [],
    },
    {
      id: "op-cutsew",
      code: "CUTSEW",
      name: "สั่งตัดเย็บใหม่",
      state: "READY",
      outsourced: true,
      workCenter: "งานส่งผลิตภายนอก",
      assignee: null,
      waitsFor: [],
      quantities: [],
    },
    {
      id: "op-outsource",
      code: "OUTSOURCE_WORK",
      name: "งานร้านนอก (ปัก/สกรีน/DTG/ป้ายคอ)",
      state: "PLANNED",
      outsourced: true,
      workCenter: "งานส่งผลิตภายนอก",
      assignee: null,
      waitsFor: ["PREP_PICK", "PREP_RECEIVE", "CUTSEW"],
      quantities: [],
      problem: "ร้านปักแจ้งเลื่อนส่งของ 1 วัน",
    },
    {
      id: "op-return-qc",
      code: "RETURN_QC",
      name: "ตรวจของกลับจากร้าน",
      state: "PLANNED",
      outsourced: false,
      workCenter: "ตรวจของกลับจากร้าน",
      assignee: null,
      waitsFor: ["OUTSOURCE_WORK"],
      quantities: [],
    },
    {
      id: "op-dtf",
      code: "DTF_PRINT",
      name: "พิมพ์ฟิล์ม DTF",
      state: "READY",
      outsourced: false,
      workCenter: "พิมพ์ DTF",
      assignee: "บาส",
      waitsFor: [],
      quantities: lines("dtf", STANDARD_LINES),
      gate: "ต้องเริ่มจากรอบพิมพ์ที่ผูกหลักฐานจริง",
    },
    {
      id: "op-press",
      code: "HEAT_PRESS",
      name: "รีดร้อน",
      state: "PLANNED",
      outsourced: false,
      workCenter: "รีดร้อน",
      assignee: null,
      waitsFor: ["PREP_PICK", "PREP_RECEIVE", "RETURN_QC", "DTF_PRINT"],
      quantities: lines("press", STANDARD_LINES),
    },
    {
      id: "op-final-qc",
      code: "FINAL_QC",
      name: "ตรวจคุณภาพขั้นสุดท้าย",
      state: "PLANNED",
      outsourced: false,
      workCenter: "ตรวจคุณภาพขั้นสุดท้าย",
      assignee: null,
      waitsFor: ["HEAT_PRESS"],
      quantities: [],
    },
    {
      id: "op-pack",
      code: "FINAL_PACK",
      name: "แพ็ก",
      state: "PLANNED",
      outsourced: false,
      workCenter: "แพ็กขั้นสุดท้าย",
      assignee: null,
      waitsFor: ["FINAL_QC"],
      quantities: lines("pack", STANDARD_LINES),
    },
  ],
};

export const STATE_LABELS: Record<OperationState, string> = {
  PLANNED: "ยังไม่ถึงคิว",
  READY: "พร้อมทำ",
  RUNNING: "กำลังทำ",
  PAUSED: "พักไว้",
  COMPLETED: "เสร็จแล้ว",
};

/** โทนของ StatusLabel ตามสถานะขั้น — ชุดเดียวกับที่เว็บใช้อยู่ */
export const STATE_TONES = {
  PLANNED: "neutral",
  READY: "accent",
  RUNNING: "warning",
  PAUSED: "warning",
  COMPLETED: "success",
} as const;

/** ปุ่มหลักของขั้นนั้น ตามสถานะ — สูตรเดียวกับจอสถานีของจริง */
export function primaryAction(operation: ProtoOperation): string | null {
  if (operation.state === "READY") return "เริ่มงาน";
  if (operation.state === "RUNNING") {
    const remaining = operation.quantities.reduce(
      (sum, line) => sum + (line.planned - line.good),
      0,
    );
    return remaining > 0 ? "บันทึกผลงาน" : "ปิดขั้นนี้";
  }
  if (operation.state === "PAUSED") return "ทำต่อ";
  return null;
}

export function progressOf(operations: readonly ProtoOperation[]) {
  const done = operations.filter((operation) => operation.state === "COMPLETED").length;
  return { done, total: operations.length };
}

export function quantityTotals(operation: ProtoOperation) {
  const planned = operation.quantities.reduce((sum, line) => sum + line.planned, 0);
  const good = operation.quantities.reduce((sum, line) => sum + line.good, 0);
  return { planned, good, remaining: planned - good };
}
