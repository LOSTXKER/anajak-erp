/**
 * ข้อมูลของหน้าลอง "ใบผลิตใหม่" — **ปลอมทั้งหมด ไม่ต่อฐานข้อมูล** แต่ครบเท่าที่ใบจริงใบหนึ่งมี
 *
 * ใบตัวอย่าง: ORD-2608-0061 บริษัท กรีนโลจิสติกส์ — โปโลพนักงาน 240 ตัว 3 สี 5 ไซซ์
 * DTF หน้าอก (ทำเอง) + ปักโลโก้แขน (ร้านนอก เดินขนานกับ DTF · เบสเคาะ 2026-09-01) + ป้ายคอ (ร้านนอก)
 * มีครบเคสขอบ: ขั้นที่ผ่านแล้ว · กำลังทำ · รอของกลับ · ติดปัญหา (เสื้อขาดไซซ์) · QC ยังไม่ถึง · ของร้านนอกเลยนัดรับ
 * วันที่ตรึง "วันนี้ = 30 ส.ค. 2569" เหมือนหน้าลองอื่น
 */

export const PROTO_TODAY = "30 ส.ค. 2569";

export type StepState = "done" | "active" | "blocked" | "waiting" | "todo";
export type StepKind = "inhouse" | "outsource" | "qc" | "pack";

export type WorkStep = {
  id: string;
  order: number;
  label: string;
  kind: StepKind;
  state: StepState;
  /** ปุ่มหลักของขั้น (มาตรฐานเดียวกันทุกขั้น: เริ่ม → บันทึกผล → ปิดขั้น) */
  action: string;
  owner: string | null;
  qtyDone: number;
  qtyTotal: number;
  /** เวลาที่เกิดจริง (ขั้นที่ผ่านแล้ว/กำลังทำ) */
  startedAt: string | null;
  completedAt: string | null;
  /** วันที่ควรเสร็จตามแผน (ถอยจากกำหนดส่ง) */
  planEnd: string;
  /** ข้อกำหนดมาตรฐานของขั้น (มาจากสูตรขั้นงาน) — ช่างต้องติ๊กครบก่อนปิดขั้น */
  checklist: { label: string; done: boolean }[];
  outsource?: {
    vendor: string;
    work: string;
    sentOn: string;
    backLabel: string;
    backInDays: number;
    status: string;
  };
  problem?: { title: string; detail: string; since: string };
  note?: string;
};

export type WorkItem = {
  id: string;
  product: string;
  color: string;
  sizes: { size: string; qty: number }[];
  mockup: string;
  prints: { position: string; technique: string; size: string; note?: string }[];
};

export type WorkEvent = {
  at: string;
  who: string;
  what: string;
  tone: "neutral" | "success" | "warning" | "danger";
};

export const WORK_ORDER = {
  id: "wo-0061",
  orderNumber: "ORD-2608-0061",
  orderId: "order-0061",
  company: "บริษัท กรีนโลจิสติกส์ จำกัด (มหาชน)",
  contact: "คุณปุ๊ก",
  channel: "LINE",
  qty: 240,
  dueLabel: "3 ก.ย.",
  dueInDays: 4,
  priority: "HIGH",
  status: "กำลังผลิต",
  blindShip: false,
  routingName: "โปโล DTF + ปักแขน + ป้ายคอ (สูตรมาตรฐาน v3)",
  garment: {
    source: "เบิกจากสต๊อก Anajak",
    needed: 240,
    issued: 180,
    missing: 60,
    missingDetail: "ไซซ์ L สีกรมท่า ขาด 60 ตัว — สต๊อกจองไม่ครบ",
  },
  approvedMockup: { version: "v3", approvedOn: "21 ส.ค.", by: "คุณปุ๊ก" },
  note: "ลูกค้าย้ำ: โลโก้แขนห้ามเอียง · เช็คสีกรมท่าให้ตรงล็อตเดิม (ออเดอร์ ORD-2607-0018)",
};

export const ITEMS: WorkItem[] = [
  {
    id: "it-1",
    product: "โปโล Dry-Tech คอปก",
    color: "กรมท่า",
    sizes: [
      { size: "S", qty: 20 },
      { size: "M", qty: 40 },
      { size: "L", qty: 60 },
      { size: "XL", qty: 30 },
      { size: "2XL", qty: 10 },
    ],
    mockup: "/demo-mockups/polo-front.svg",
    prints: [
      { position: "อกซ้าย", technique: "DTF", size: "8 × 8 ซม.", note: "โลโก้สีเต็ม" },
      { position: "แขนซ้าย", technique: "ปัก", size: "5 × 5 ซม.", note: "ด้ายขาว ห้ามเอียง" },
    ],
  },
  {
    id: "it-2",
    product: "โปโล Dry-Tech คอปก",
    color: "ขาว",
    sizes: [
      { size: "M", qty: 20 },
      { size: "L", qty: 30 },
      { size: "XL", qty: 10 },
    ],
    mockup: "/demo-mockups/polo-back.svg",
    prints: [
      { position: "อกซ้าย", technique: "DTF", size: "8 × 8 ซม." },
      { position: "แขนซ้าย", technique: "ปัก", size: "5 × 5 ซม." },
    ],
  },
  {
    id: "it-3",
    product: "โปโล Dry-Tech คอปก",
    color: "เทา",
    sizes: [
      { size: "M", qty: 10 },
      { size: "L", qty: 10 },
    ],
    mockup: "/demo-mockups/polo-sleeve.svg",
    prints: [{ position: "อกซ้าย", technique: "DTF", size: "8 × 8 ซม." }],
  },
];

export const STEPS: WorkStep[] = [
  {
    id: "s1",
    order: 1,
    label: "เตรียมเสื้อ — เบิกจากสต๊อก",
    kind: "inhouse",
    state: "blocked",
    action: "เบิกที่เหลือ 60 ตัว",
    owner: "เนส",
    qtyDone: 180,
    qtyTotal: 240,
    startedAt: "27 ส.ค. 09:10",
    completedAt: null,
    planEnd: "27 ส.ค.",
    checklist: [
      { label: "นับเสื้อตรงกับใบเบิก (สี/ไซซ์)", done: true },
      { label: "ตรวจตำหนิผ้าก่อนพิมพ์", done: true },
      { label: "แยกกองตามไซซ์ ติดป้ายกอง", done: false },
    ],
    problem: { title: "เสื้อไม่พอ", detail: "ไซซ์ L สีกรมท่า ขาด 60 ตัว — สต๊อกจองไม่ครบ ต้องสั่งเพิ่มหรือเปลี่ยนไซซ์", since: "28 ส.ค. 14:20" },
  },
  {
    id: "s2",
    order: 2,
    label: "พิมพ์ฟิล์ม DTF",
    kind: "inhouse",
    state: "done",
    action: "เปิดรอบพิมพ์",
    owner: "บาส",
    qtyDone: 240,
    qtyTotal: 240,
    startedAt: "27 ส.ค. 13:00",
    completedAt: "28 ส.ค. 11:30",
    planEnd: "28 ส.ค.",
    checklist: [
      { label: "ไฟล์ตรงกับม็อกอัพอนุมัติ v3", done: true },
      { label: "ทดสอบพิมพ์ 1 ชิ้นเทียบสี", done: true },
      { label: "นับฟิล์มครบ 240 + เผื่อ 5%", done: true },
    ],
  },
  {
    id: "s3",
    order: 3,
    label: "ปักโลโก้แขน — ร้านนอก",
    kind: "outsource",
    state: "waiting",
    action: "รับของกลับ / ตรวจรับ",
    owner: "พี่ก้อย",
    qtyDone: 0,
    qtyTotal: 240,
    startedAt: "28 ส.ค. 15:00",
    completedAt: null,
    planEnd: "1 ก.ย.",
    checklist: [
      { label: "ส่งไฟล์ปัก + ตัวอย่างสีด้าย", done: true },
      { label: "ระบุจำนวนต่อไซซ์ในใบส่งของ", done: true },
      { label: "ตรวจรับ: นับครบ + ปักไม่เอียง", done: false },
    ],
    outsource: {
      vendor: "ร้านปักพี่หน่อย (บางบอน)",
      work: "ปักโลโก้แขน 240 ตัว",
      sentOn: "28 ส.ค.",
      backLabel: "1 ก.ย.",
      backInDays: 2,
      status: "กำลังทำ",
    },
  },
  {
    id: "s4",
    order: 4,
    label: "รีดร้อน",
    kind: "inhouse",
    state: "active",
    action: "บันทึกยอดรีด",
    owner: "บาส",
    qtyDone: 96,
    qtyTotal: 240,
    startedAt: "29 ส.ค. 09:00",
    completedAt: null,
    planEnd: "1 ก.ย.",
    checklist: [
      { label: "ตั้งอุณหภูมิ 160°C · 12 วินาที (ตามสูตร)", done: true },
      { label: "รีดตัวอย่าง 1 ตัว ตรวจตำแหน่งเทียบม็อกอัพ", done: true },
      { label: "เช็คการลอกหลังเย็น 1 ตัวต่อ 50", done: false },
    ],
    note: "รีดได้เฉพาะ 180 ตัวที่เบิกแล้ว — ที่เหลือรอเสื้อไซซ์ L",
  },
  {
    id: "s5",
    order: 5,
    label: "ป้ายคอทอ — ร้านนอก",
    kind: "outsource",
    state: "blocked",
    action: "ตามร้าน",
    owner: "พี่ก้อย",
    qtyDone: 0,
    qtyTotal: 240,
    startedAt: "25 ส.ค. 10:00",
    completedAt: null,
    planEnd: "29 ส.ค.",
    checklist: [
      { label: "ส่งไฟล์ป้าย + สเปกขนาด", done: true },
      { label: "ตรวจรับ: จำนวน + สีทอตรงตัวอย่าง", done: false },
    ],
    outsource: {
      vendor: "Labelist ป้ายคอทอ",
      work: "ป้ายคอทอ 240 ชิ้น",
      sentOn: "25 ส.ค.",
      backLabel: "29 ส.ค.",
      backInDays: -1,
      status: "เลยนัดรับ",
    },
    problem: { title: "ร้านยังไม่ส่งของ", detail: "นัดรับ 29 ส.ค. ยังไม่ได้ของ — โทรตามแล้ว 1 ครั้ง ร้านบอกพรุ่งนี้", since: "30 ส.ค. 08:40" },
  },
  {
    id: "s6",
    order: 6,
    label: "ตรวจ QC",
    kind: "qc",
    state: "todo",
    action: "บันทึกผลตรวจ",
    owner: null,
    qtyDone: 0,
    qtyTotal: 240,
    startedAt: null,
    completedAt: null,
    planEnd: "2 ก.ย.",
    checklist: [
      { label: "นับจำนวนต่อไซซ์ตรงใบสั่ง", done: false },
      { label: "ตรวจตำแหน่ง/สี/รอยรีด ทุกตัว", done: false },
      { label: "ถ่ายรูปของเสีย + ระบุสาเหตุ", done: false },
    ],
  },
  {
    id: "s7",
    order: 7,
    label: "แพ็กสุดท้าย",
    kind: "pack",
    state: "todo",
    action: "แพ็กและปิดใบ",
    owner: null,
    qtyDone: 0,
    qtyTotal: 240,
    startedAt: null,
    completedAt: null,
    planEnd: "3 ก.ย.",
    checklist: [
      { label: "พับ + ถุงรายตัว ติดสติกเกอร์ไซซ์", done: false },
      { label: "ลังละ 40 ตัว แยกสี · ใบแพ็กติดข้างลัง", done: false },
    ],
  },
];

export const EVENTS: WorkEvent[] = [
  { at: "30 ส.ค. 08:40", who: "พี่ก้อย", what: "แจ้งปัญหา: ป้ายคอ Labelist เลยนัดรับ — โทรตามแล้ว", tone: "danger" },
  { at: "29 ส.ค. 16:30", who: "บาส", what: "รีดร้อน บันทึกยอด 96/240", tone: "neutral" },
  { at: "29 ส.ค. 09:00", who: "บาส", what: "เริ่มรีดร้อน", tone: "neutral" },
  { at: "28 ส.ค. 15:00", who: "พี่ก้อย", what: "ส่งปักแขนให้ร้านปักพี่หน่อย 240 ตัว นัดรับ 1 ก.ย.", tone: "neutral" },
  { at: "28 ส.ค. 14:20", who: "เนส", what: "แจ้งปัญหา: เสื้อไซซ์ L กรมท่าขาด 60 ตัว", tone: "danger" },
  { at: "28 ส.ค. 11:30", who: "บาส", what: "ปิดขั้นพิมพ์ฟิล์ม DTF 240/240", tone: "success" },
  { at: "27 ส.ค. 09:10", who: "เนส", what: "เบิกเสื้อจากสต๊อก 180 ตัว", tone: "neutral" },
  { at: "26 ส.ค. 17:00", who: "เบส", what: "เปิดใบผลิตจากสูตรมาตรฐาน v3 · มอบหมายเนส/บาส/พี่ก้อย", tone: "success" },
];

export function currentStep(steps: WorkStep[]): WorkStep {
  return (
    steps.find((s) => s.state === "blocked") ??
    steps.find((s) => s.state === "active") ??
    steps.find((s) => s.state === "waiting") ??
    steps.find((s) => s.state === "todo") ??
    steps[steps.length - 1]!
  );
}

export function summarize(steps: WorkStep[]) {
  return {
    done: steps.filter((s) => s.state === "done").length,
    total: steps.length,
    problems: steps.filter((s) => s.problem).length,
    outsourceOut: steps.filter((s) => s.outsource && s.state !== "done").length,
  };
}

export const STEP_TONE: Record<StepState, { bar: string; label: string; chip: "neutral" | "info" | "warning" | "error" | "success" }> = {
  done: { bar: "bg-green-500/80 dark:bg-green-400/70", label: "ผ่านแล้ว", chip: "success" },
  active: { bar: "bg-amber-500", label: "กำลังทำ", chip: "info" },
  blocked: { bar: "bg-red-500", label: "ติดปัญหา", chip: "error" },
  waiting: { bar: "bg-slate-300 dark:bg-slate-600", label: "รอของกลับ", chip: "warning" },
  todo: { bar: "bg-slate-200 dark:bg-slate-700", label: "ยังไม่ถึง", chip: "neutral" },
};
