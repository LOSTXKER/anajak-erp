/* ข้อมูลตัวอย่างของหน้าลอง "ใบสั่งผลิตรกไป"
   ─────────────────────────────────────────────────────────────
   ชุดเล็ก = ยกมาจากใบจริงในฐานทดลองที่เบสเปิดดูแล้วบอกว่ารก
   (MO-2609-0008 · /production/demo-production-blocked-stock) — ตัวเลข ชื่อ สถานะ
   จำนวนแถว ตรงกับของจริงทุกช่อง รวมทั้งของที่ดู "ซ้ำ" อย่างจำนวน ครีม S/M/L
   ที่ถูกทำซ้ำครบทั้ง 5 ขั้น และประวัติที่เป็น "สร้างใบสั่งผลิต" 5 บรรทัดเหมือนกัน

   ชุดใหญ่ = ใบที่มีงานร้านนอกด้วย (โครงเดียวกับ MO-2609-0001 ที่ใช้ใน
   /proto/work-order-control) — ไว้กดสลับดูว่าแต่ละแบบพังหรือไม่ตอนของเยอะจริง

   ⚠️ ข้อมูลตายตัวในไฟล์ ไม่ต่อฐานข้อมูล (กติกาหน้าลอง) */

export type DensityState =
  | "PLANNED"
  | "READY"
  | "RUNNING"
  | "BLOCKED"
  | "COMPLETED";

export type DensityOperation = {
  id: string;
  code: string;
  name: string;
  state: DensityState;
  /** ลำดับคิวที่หัวหน้ากำหนด — ของจริงโชว์เป็นตัวเลขในวงกลม */
  queue: number;
  outsourced: boolean;
  workCenter: string;
  assignee: string | null;
  /** ชื่อขั้นที่ต้องเสร็จก่อน (ของจริงเขียนว่า "รับงานต่อจาก: …") */
  waitsFor: string[];
  /** ปัญหาที่บล็อกขั้นนี้อยู่ — ของจริงขึ้นเป็นบรรทัดแดงใต้ชื่อขั้น */
  blockers: string[];
  /** บรรทัดเวลาใต้ยอดจำนวน (ของจริง: จบ… / เริ่ม… / วางไว้… / ยังไม่กำหนดเวลา) */
  timing: string;
  /** คำสั่งที่ server อนุญาต — แผงลงมือสร้างปุ่มจากรายการนี้เท่านั้น */
  commands: string[];
};

export type DensityQuantityLine = {
  id: string;
  stepId: string;
  description: string;
  color: string;
  size: string;
  printPosition: string;
  planned: number;
  good: number;
  scrap: number;
  rework: number;
};

export type DensityException = {
  id: string;
  severity: { label: string; tone: "danger" | "warning" | "neutral" };
  status: { label: string; tone: "danger" | "warning" | "success" | "neutral" };
  title: string;
  description: string;
  createdAt: string;
  stepName: string;
  owner: string;
  disposition: string | null;
  resolution: string | null;
};

export type DensityEvent = {
  id: string;
  label: string;
  at: string;
  stepName: string | null;
  good: number;
  scrap: number;
  rework: number;
};

export type DensityWorkOrder = {
  workOrderNumber: string;
  orderNumber: string;
  customerName: string;
  contactName: string;
  deadline: string;
  priorityLabel: string;
  stateLabel: string;
  releasedAt: string;
  revision: number;
  reference: { label: string; present: boolean }[];
  operations: DensityOperation[];
  quantityLines: DensityQuantityLine[];
  exceptions: DensityException[];
  events: DensityEvent[];
};

/* ───────────────────────────────── ชุดเล็ก = ใบที่เบสเปิดดูจริง */

const SMALL_STEPS: DensityOperation[] = [
  {
    id: "s-prep",
    code: "PREP",
    name: "เตรียมงาน",
    state: "BLOCKED",
    queue: 10,
    outsourced: false,
    workCenter: "เตรียมงาน",
    assignee: "นัท · เตรียมเสื้อ",
    waitsFor: [],
    blockers: ["เสื้อไม่พอเริ่มงาน"],
    timing: "เริ่ม 30 ส.ค. 2569 15:50",
    commands: ["recordPrep", "raiseException"],
  },
  {
    id: "s-dtf",
    code: "DTF_PRINT",
    name: "พิมพ์ DTF",
    state: "READY",
    queue: 20,
    outsourced: false,
    workCenter: "พิมพ์ DTF",
    assignee: null,
    waitsFor: [],
    blockers: [],
    timing: "ยังไม่กำหนดเวลา",
    commands: ["manageDtfBatch", "raiseException"],
  },
  {
    id: "s-press",
    code: "HEAT_PRESS",
    name: "รีดร้อน",
    state: "PLANNED",
    queue: 30,
    outsourced: false,
    workCenter: "รีดร้อน",
    assignee: null,
    waitsFor: ["เตรียมงาน", "พิมพ์ DTF"],
    blockers: [],
    timing: "ยังไม่กำหนดเวลา",
    commands: [],
  },
  {
    id: "s-qc",
    code: "FINAL_QC",
    name: "ตรวจคุณภาพขั้นสุดท้าย",
    state: "PLANNED",
    queue: 40,
    outsourced: false,
    workCenter: "ตรวจคุณภาพขั้นสุดท้าย",
    assignee: null,
    waitsFor: ["รีดร้อน"],
    blockers: [],
    timing: "ยังไม่กำหนดเวลา",
    commands: [],
  },
  {
    id: "s-pack",
    code: "FINAL_PACK",
    name: "แพ็กขั้นสุดท้าย",
    state: "PLANNED",
    queue: 50,
    outsourced: false,
    workCenter: "แพ็กขั้นสุดท้าย",
    assignee: null,
    waitsFor: ["ตรวจคุณภาพขั้นสุดท้าย"],
    blockers: [],
    timing: "ยังไม่กำหนดเวลา",
    commands: [],
  },
];

/** ของจริง: 3 บรรทัด (ครีม S/M/L) ถูกทำซ้ำครบทุกขั้น = 15 แถวที่หน้าเดียวกัน */
const SMALL_SIZES: [size: string, planned: number][] = [
  ["S", 14],
  ["M", 13],
  ["L", 13],
];

const SMALL_LINES: DensityQuantityLine[] = SMALL_STEPS.flatMap((step) =>
  SMALL_SIZES.map(([size, planned]) => ({
    id: `${step.id}-${size}`,
    stepId: step.id,
    description: `ครีม / ${size}`,
    color: "ครีม",
    size,
    printPosition: "หน้าอก",
    planned,
    good: 0,
    scrap: 0,
    rework: 0,
  })),
);

export const SMALL_WORK_ORDER: DensityWorkOrder = {
  workOrderNumber: "MO-2609-0008",
  orderNumber: "ORD-2609-0008",
  customerName: "Bangkok Run Club",
  contactName: "คุณนนท์",
  deadline: "3 ก.ย. 2569",
  priorityLabel: "สูง",
  stateLabel: "กำลังผลิต",
  releasedAt: "24 ส.ค. 2569 17:50",
  revision: 1,
  reference: [
    { label: "เส้นทางและลำดับงาน", present: true },
    { label: "คำสั่งการผลิต", present: true },
    { label: "แบบที่อนุมัติ", present: true },
  ],
  operations: SMALL_STEPS,
  quantityLines: SMALL_LINES,
  exceptions: [
    {
      id: "x-stock",
      severity: { label: "วิกฤต", tone: "danger" },
      status: { label: "เปิดอยู่", tone: "danger" },
      title: "เสื้อไม่พอเริ่มงาน",
      description: "สต๊อกทดสอบไม่ครบตามสีและไซซ์",
      createdAt: "31 ส.ค. 2569 17:50",
      stepName: "เตรียมงาน",
      owner: "ยังไม่ได้มอบหมาย",
      disposition: "พักไว้ก่อน",
      resolution: null,
    },
  ],
  events: SMALL_STEPS.map((step) => ({
    id: `ev-${step.id}`,
    label: "สร้างใบสั่งผลิต",
    at: "24 ส.ค. 2569 17:50",
    stepName: step.name,
    good: 0,
    scrap: 0,
    rework: 0,
  })),
};

/* ───────────────────────── ชุดใหญ่ = ใบที่มีสายร้านนอกและของครบทุกกอง */

const BIG_STEPS: DensityOperation[] = [
  {
    id: "b-pick",
    code: "PREP_PICK",
    name: "เบิกเสื้อจากสต๊อก",
    state: "RUNNING",
    queue: 10,
    outsourced: false,
    workCenter: "เตรียมงาน",
    assignee: "นัท",
    waitsFor: [],
    blockers: [],
    timing: "เริ่ม 1 ก.ย. 2569 09:12",
    commands: ["reportOutput", "pauseOperation", "raiseException"],
  },
  {
    id: "b-receive",
    code: "PREP_RECEIVE",
    name: "รับเสื้อจากลูกค้า",
    state: "READY",
    queue: 20,
    outsourced: false,
    workCenter: "เตรียมงาน",
    assignee: null,
    waitsFor: [],
    blockers: [],
    timing: "วางไว้ 2 ก.ย. 2569",
    commands: ["startOperation", "raiseException"],
  },
  {
    id: "b-cutsew",
    code: "CUTSEW",
    name: "สั่งตัดเย็บใหม่",
    state: "READY",
    queue: 30,
    outsourced: true,
    workCenter: "งานส่งผลิตภายนอก",
    assignee: null,
    waitsFor: [],
    blockers: [],
    timing: "วางไว้ 2 ก.ย. 2569",
    commands: ["manageOutsource", "raiseException"],
  },
  {
    id: "b-outsource",
    code: "OUTSOURCE_WORK",
    name: "งานร้านนอก (ปัก/สกรีน/ป้ายคอ)",
    state: "BLOCKED",
    queue: 40,
    outsourced: true,
    workCenter: "งานส่งผลิตภายนอก",
    assignee: null,
    waitsFor: ["เบิกเสื้อจากสต๊อก", "รับเสื้อจากลูกค้า", "สั่งตัดเย็บใหม่"],
    blockers: ["ร้านปักแจ้งเลื่อนส่งของ 1 วัน"],
    timing: "ยังไม่กำหนดเวลา",
    commands: ["manageOutsource", "raiseException"],
  },
  {
    id: "b-return",
    code: "RETURN_QC",
    name: "ตรวจของกลับจากร้าน",
    state: "PLANNED",
    queue: 50,
    outsourced: false,
    workCenter: "ตรวจของกลับจากร้าน",
    assignee: null,
    waitsFor: ["งานร้านนอก (ปัก/สกรีน/ป้ายคอ)"],
    blockers: [],
    timing: "ยังไม่กำหนดเวลา",
    commands: [],
  },
  {
    id: "b-dtf",
    code: "DTF_PRINT",
    name: "พิมพ์ฟิล์ม DTF",
    state: "READY",
    queue: 60,
    outsourced: false,
    workCenter: "พิมพ์ DTF",
    assignee: "บาส",
    waitsFor: [],
    blockers: [],
    timing: "วางไว้ 2 ก.ย. 2569",
    commands: ["manageDtfBatch", "raiseException"],
  },
  {
    id: "b-press",
    code: "HEAT_PRESS",
    name: "รีดร้อน",
    state: "PLANNED",
    queue: 70,
    outsourced: false,
    workCenter: "รีดร้อน",
    assignee: null,
    waitsFor: [
      "เบิกเสื้อจากสต๊อก",
      "รับเสื้อจากลูกค้า",
      "ตรวจของกลับจากร้าน",
      "พิมพ์ฟิล์ม DTF",
    ],
    blockers: [],
    timing: "ยังไม่กำหนดเวลา",
    commands: [],
  },
  {
    id: "b-qc",
    code: "FINAL_QC",
    name: "ตรวจคุณภาพขั้นสุดท้าย",
    state: "PLANNED",
    queue: 80,
    outsourced: false,
    workCenter: "ตรวจคุณภาพขั้นสุดท้าย",
    assignee: null,
    waitsFor: ["รีดร้อน"],
    blockers: [],
    timing: "ยังไม่กำหนดเวลา",
    commands: [],
  },
  {
    id: "b-pack",
    code: "FINAL_PACK",
    name: "แพ็กขั้นสุดท้าย",
    state: "PLANNED",
    queue: 90,
    outsourced: false,
    workCenter: "แพ็กขั้นสุดท้าย",
    assignee: null,
    waitsFor: ["ตรวจคุณภาพขั้นสุดท้าย"],
    blockers: [],
    timing: "ยังไม่กำหนดเวลา",
    commands: [],
  },
];

/** ขั้นที่นับชิ้นในใบใหญ่ — 3 สี × 3 ไซซ์ ทำซ้ำ 3 ขั้น = 27 แถว */
const BIG_COUNTED = ["b-pick", "b-dtf", "b-press"] as const;
const BIG_SPEC: [color: string, size: string, planned: number, good: number][] = [
  ["ดำ", "M", 60, 60],
  ["ดำ", "L", 40, 40],
  ["ขาว", "M", 50, 20],
  ["ขาว", "L", 30, 0],
  ["กรม", "XL", 60, 0],
];

const BIG_LINES: DensityQuantityLine[] = BIG_COUNTED.flatMap((stepId, stepIndex) =>
  BIG_SPEC.map(([color, size, planned, good]) => ({
    id: `${stepId}-${color}-${size}`,
    stepId,
    description: `เสื้อคอกลม ${color} / ${size}`,
    color,
    size,
    printPosition: stepIndex === 1 ? "หน้าอก + หลัง" : "หน้าอก",
    planned,
    good: stepIndex === 0 ? good : 0,
    scrap: stepIndex === 0 && color === "ขาว" && size === "M" ? 2 : 0,
    rework: 0,
  })),
);

export const BIG_WORK_ORDER: DensityWorkOrder = {
  workOrderNumber: "MO-2609-0001",
  orderNumber: "ORD-2609-0002",
  customerName: "บริษัท นอร์ทสตาร์ รีเทล จำกัด",
  contactName: "คุณฝน · ฝ่ายจัดซื้อ",
  deadline: "5 ก.ย. 2569",
  priorityLabel: "ด่วนมาก",
  stateLabel: "กำลังผลิต",
  releasedAt: "22 ส.ค. 2569 10:04",
  revision: 7,
  reference: [
    { label: "เส้นทางและลำดับงาน", present: true },
    { label: "คำสั่งการผลิต", present: true },
    { label: "แบบที่อนุมัติ", present: false },
  ],
  operations: BIG_STEPS,
  quantityLines: BIG_LINES,
  exceptions: [
    {
      id: "bx-1",
      severity: { label: "วิกฤต", tone: "danger" },
      status: { label: "เปิดอยู่", tone: "danger" },
      title: "ร้านปักแจ้งเลื่อนส่งของ 1 วัน",
      description: "ร้านแจ้งว่าเครื่องปักเสีย ขอเลื่อนส่งจาก 2 ก.ย. เป็น 3 ก.ย.",
      createdAt: "1 ก.ย. 2569 14:20",
      stepName: "งานร้านนอก (ปัก/สกรีน/ป้ายคอ)",
      owner: "มอบหมายแล้ว",
      disposition: null,
      resolution: null,
    },
    {
      id: "bx-2",
      severity: { label: "ปานกลาง", tone: "warning" },
      status: { label: "รับทราบแล้ว", tone: "warning" },
      title: "เสื้อขาว M มีตำหนิ 2 ตัว",
      description: "พบรอยเปื้อนตอนเบิกของ ยังไม่ได้ตัดสินว่าจะทิ้งหรือส่งแก้",
      createdAt: "1 ก.ย. 2569 11:02",
      stepName: "เบิกเสื้อจากสต๊อก",
      owner: "มอบหมายแล้ว",
      disposition: "ส่งแก้",
      resolution: null,
    },
    {
      id: "bx-3",
      severity: { label: "เล็กน้อย", tone: "neutral" },
      status: { label: "แก้แล้ว", tone: "success" },
      title: "ไฟล์ลายเวอร์ชันเก่าถูกส่งเข้าคิวพิมพ์",
      description: "หัวหน้าเปลี่ยนเป็นไฟล์ที่ลูกค้าอนุมัติแล้ว",
      createdAt: "31 ส.ค. 2569 16:40",
      stepName: "พิมพ์ฟิล์ม DTF",
      owner: "มอบหมายแล้ว",
      disposition: null,
      resolution: "เปลี่ยนไฟล์และพิมพ์ใหม่ 1 แผ่น",
    },
  ],
  events: [
    { id: "be-1", label: "บันทึกผลงาน", at: "1 ก.ย. 2569 15:40", stepName: "เบิกเสื้อจากสต๊อก", good: 20, scrap: 2, rework: 0 },
    { id: "be-2", label: "แจ้งปัญหา", at: "1 ก.ย. 2569 14:20", stepName: "งานร้านนอก (ปัก/สกรีน/ป้ายคอ)", good: 0, scrap: 0, rework: 0 },
    { id: "be-3", label: "บันทึกผลงาน", at: "1 ก.ย. 2569 11:30", stepName: "เบิกเสื้อจากสต๊อก", good: 40, scrap: 0, rework: 0 },
    { id: "be-4", label: "แจ้งปัญหา", at: "1 ก.ย. 2569 11:02", stepName: "เบิกเสื้อจากสต๊อก", good: 0, scrap: 0, rework: 0 },
    { id: "be-5", label: "บันทึกผลงาน", at: "1 ก.ย. 2569 10:15", stepName: "เบิกเสื้อจากสต๊อก", good: 60, scrap: 0, rework: 0 },
    { id: "be-6", label: "เริ่มงาน", at: "1 ก.ย. 2569 09:12", stepName: "เบิกเสื้อจากสต๊อก", good: 0, scrap: 0, rework: 0 },
    { id: "be-7", label: "แก้ปัญหาแล้ว", at: "31 ส.ค. 2569 17:05", stepName: "พิมพ์ฟิล์ม DTF", good: 0, scrap: 0, rework: 0 },
    { id: "be-8", label: "แจ้งปัญหา", at: "31 ส.ค. 2569 16:40", stepName: "พิมพ์ฟิล์ม DTF", good: 0, scrap: 0, rework: 0 },
    { id: "be-9", label: "จ่ายงานให้ศูนย์งาน", at: "31 ส.ค. 2569 09:00", stepName: "พิมพ์ฟิล์ม DTF", good: 0, scrap: 0, rework: 0 },
    { id: "be-10", label: "ปล่อยใบสั่งผลิต", at: "22 ส.ค. 2569 10:04", stepName: null, good: 0, scrap: 0, rework: 0 },
    ...BIG_STEPS.map((step, index) => ({
      id: `be-created-${index}`,
      label: "สร้างใบสั่งผลิต",
      at: "22 ส.ค. 2569 09:58",
      stepName: step.name,
      good: 0,
      scrap: 0,
      rework: 0,
    })),
  ],
};

/* ───────────────────────────────────────────────── ตัวช่วยที่ทุกแบบใช้ */

export const STATE_META: Record<
  DensityState,
  { label: string; tone: "neutral" | "accent" | "success" | "warning" | "danger" }
> = {
  PLANNED: { label: "ยังไม่ถึงคิว", tone: "neutral" },
  READY: { label: "พร้อมทำ", tone: "accent" },
  RUNNING: { label: "กำลังทำ", tone: "warning" },
  BLOCKED: { label: "ติดปัญหา", tone: "danger" },
  COMPLETED: { label: "เสร็จแล้ว", tone: "success" },
};

/** ขั้นที่ต้องมีหลักฐาน — แผงลงมือไม่ทำปุ่มปลอม ส่งไปจอสถานีแทน (กติกาของจริง) */
export const SPECIALIZED_HINT: Record<string, string> = {
  recordPrep: "ขั้นเตรียมเสื้อต้องบันทึกการรับ/เบิกเสื้อที่จอสถานี",
  manageDtfBatch: "ขั้น DTF ต้องเริ่มจากรอบพิมพ์ที่ผูกหลักฐานจริง ทำที่จอสถานี",
  recordQuality: "ขั้นตรวจคุณภาพต้องบันทึกผลตรวจที่จอสถานี",
  manageOutsource: "ขั้นร้านนอกจัดการผ่านใบสั่งร้านนอก",
};

export function linesOf(workOrder: DensityWorkOrder, stepId: string) {
  return workOrder.quantityLines.filter((line) => line.stepId === stepId);
}

export function quantitySummary(lines: readonly DensityQuantityLine[]) {
  if (lines.length === 0) return "ไม่นับชิ้น";
  const planned = lines.reduce((sum, line) => sum + line.planned, 0);
  const good = lines.reduce((sum, line) => sum + line.good, 0);
  return `${good.toLocaleString("th-TH")}/${planned.toLocaleString("th-TH")} ตัว`;
}

export function totalQuantity(workOrder: DensityWorkOrder) {
  const first = workOrder.operations.find(
    (step) => linesOf(workOrder, step.id).length > 0,
  );
  if (!first) return 0;
  return linesOf(workOrder, first.id).reduce((sum, line) => sum + line.planned, 0);
}

export function openExceptionCount(workOrder: DensityWorkOrder) {
  return workOrder.exceptions.filter((item) => item.status.tone !== "success").length;
}

export function doneCount(workOrder: DensityWorkOrder) {
  return workOrder.operations.filter((step) => step.state === "COMPLETED").length;
}
