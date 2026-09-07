/**
 * ข้อมูลของหน้าลอง "ใบผลิตแบบฟอร์ม" — **ปลอมทั้งหมด ไม่ต่อฐานข้อมูล** แต่ครบเท่าใบจริง
 *
 * ใบตัวอย่าง 2 ใบ (ปุ่มสลับสถานะขอบ):
 *   · ใบ 4 ขั้น = ORD-2609-0009 คุณแพรว 30 ตัว — ใบเดียวกับที่เบสเปิดดูในฐานทดลอง (ร้านปักเลยกำหนด 2 วัน)
 *   · ใบ 7 ขั้น = ORD-2608-0061 กรีนโลจิสติกส์ 240 ตัว — ทำเอง DTF + ร้านนอก 2 ขั้น เดินขนานกัน
 *     (ยกมาจากหน้าลองชุดเก่า /proto/work-order — ดู git ก่อน 4082e7a)
 *
 * วันที่ตรึง "วันนี้ = 8 ก.ย. 2569" — ไม่เรียก Date.now() ตอนเรนเดอร์
 */

export const PROTO_TODAY = "8 ก.ย. 2569";

export type StepState = "done" | "active" | "waiting" | "blocked" | "todo";
/** ชนิดขั้น → กำหนดว่าปุ่มหลักคืออะไร และจดในระบบหรือกระดาษ (กติกา lib/work-order-record-mode) */
export type StepKind = "receive" | "pick" | "dtf" | "inhouse" | "outsource" | "qc" | "pack";
/** สายของขั้น (กติกา lib/work-order-route): สายขนาน → จุดบรรจบ (รีดร้อน) → หางงาน (QC · แพ็ก) */
export type Lane = "shirt" | "film" | "out" | "merge" | "tail";
export type RecordMode = "screen" | "paper" | "auto";

export type WorkStep = {
  id: string;
  order: number;
  label: string;
  /** ป้ายสั้นบนราง (ไทยห้าม truncate — ต้องสั้นเอง) */
  short: string;
  kind: StepKind;
  lane: Lane;
  state: StepState;
  owner: string | null;
  qtyDone: number;
  qtyTotal: number;
  startedAt: string | null;
  completedAt: string | null;
  planEnd: string;
  checklist: { label: string; done: boolean }[];
  outsource?: { vendor: string; work: string; sentOn: string; backLabel: string; backInDays: number; status: string };
  problem?: { title: string; detail: string; since: string };
  note?: string;
};

export type WorkItem = {
  product: string;
  color: string;
  sizes: { size: string; qty: number }[];
  mockup: string | null;
  prints: { position: string; technique: string; size: string; note?: string }[];
};

export type WorkEvent = { at: string; who: string; what: string; tone: "neutral" | "success" | "warning" | "danger" };

export type WorkOrder = {
  orderNumber: string;
  customer: string;
  company: string | null;
  channel: string;
  qty: number;
  dueLabel: string;
  dueInDays: number;
  urgent: boolean;
  routingName: string;
  mockupVersion: string;
  note: string | null;
  items: WorkItem[];
  steps: WorkStep[];
  events: WorkEvent[];
};

export function recordModeOf(step: Pick<WorkStep, "kind">): RecordMode {
  switch (step.kind) {
    case "receive":
    case "pick":
    case "outsource":
      return "screen";
    case "dtf":
      return "auto";
    default:
      return "paper";
  }
}

export const STATE_LABEL: Record<StepState, string> = {
  done: "ผ่านแล้ว",
  active: "กำลังทำ",
  waiting: "อยู่ที่ร้าน",
  blocked: "ติดปัญหา",
  todo: "ยังไม่ถึง",
};

/* ───────────────────────── ใบ 4 ขั้น — ORD-2609-0009 (ฐานทดลอง) ───────────────────────── */

export const CASE_4: WorkOrder = {
  orderNumber: "ORD-2609-0009",
  customer: "คุณแพรว",
  company: null,
  channel: "LINE",
  qty: 30,
  dueLabel: "6 ก.ย. 2569",
  dueInDays: -2,
  urgent: true,
  routingName: "เสื้อลูกค้า + ปักลาย (ร้านนอก)",
  mockupVersion: "v1",
  note: "ลูกค้าส่งเสื้อมาเอง 30 ตัว — ปักโลโก้อกซ้าย ด้ายทองตามตัวอย่าง",
  items: [
    {
      product: "เสื้อยืด Cotton 100% สีกรม (ลูกค้าส่งมา)",
      color: "กรม",
      sizes: [
        { size: "S", qty: 7 },
        { size: "M", qty: 12 },
        { size: "L", qty: 11 },
      ],
      mockup: "/demo-mockups/front.svg",
      prints: [{ position: "อกซ้าย", technique: "ปัก", size: "7 × 7 ซม.", note: "ด้ายทอง · ห้ามเอียง" }],
    },
  ],
  steps: [
    {
      id: "s1",
      order: 1,
      label: "ตรวจรับเสื้อลูกค้า",
      short: "รับเสื้อ",
      kind: "receive",
      lane: "shirt",
      state: "done",
      owner: "เนส",
      qtyDone: 30,
      qtyTotal: 30,
      startedAt: "1 ก.ย. 10:20",
      completedAt: "1 ก.ย. 10:45",
      planEnd: "1 ก.ย.",
      checklist: [
        { label: "นับครบ 30 ตัว ตรงกับที่ลูกค้าแจ้ง", done: true },
        { label: "ถ่ายรูปสภาพเสื้อก่อนทำ", done: true },
      ],
    },
    {
      id: "s2",
      order: 2,
      label: "ปักลาย (ร้านนอก)",
      short: "ปักลาย (ร้าน)",
      kind: "outsource",
      lane: "out",
      state: "waiting",
      owner: "พี่ก้อย",
      qtyDone: 0,
      qtyTotal: 30,
      startedAt: "2 ก.ย. 14:00",
      completedAt: null,
      planEnd: "6 ก.ย.",
      checklist: [
        { label: "ส่งไฟล์ปัก + ตัวอย่างสีด้าย", done: true },
        { label: "ระบุจำนวนต่อไซซ์ในใบส่งร้าน", done: true },
        { label: "ตรวจรับ: นับครบ + ปักไม่เอียง ด้ายไม่หลุด", done: false },
      ],
      outsource: {
        vendor: "ร้านปักพี่หน่อย (บางบอน)",
        work: "ปักโลโก้อกซ้าย 30 ตัว",
        sentOn: "2 ก.ย.",
        backLabel: "6 ก.ย.",
        backInDays: -2,
        status: "เลยนัดรับ 2 วัน",
      },
      note: "ร้านแจ้งเครื่องปักเสีย กำลังเร่งส่งกลับ",
    },
    {
      id: "s3",
      order: 3,
      label: "ตรวจคุณภาพขั้นสุดท้าย",
      short: "ตรวจ QC",
      kind: "qc",
      lane: "tail",
      state: "todo",
      owner: null,
      qtyDone: 0,
      qtyTotal: 30,
      startedAt: null,
      completedAt: null,
      planEnd: "7 ก.ย.",
      checklist: [
        { label: "นับจำนวนต่อไซซ์ตรงใบสั่ง", done: false },
        { label: "ตรวจตำแหน่ง/สีด้าย ทุกตัว", done: false },
      ],
    },
    {
      id: "s4",
      order: 4,
      label: "แพ็กขั้นสุดท้าย",
      short: "แพ็ก",
      kind: "pack",
      lane: "tail",
      state: "todo",
      owner: null,
      qtyDone: 0,
      qtyTotal: 30,
      startedAt: null,
      completedAt: null,
      planEnd: "7 ก.ย.",
      checklist: [{ label: "พับ + ถุงรายตัว แยกไซซ์", done: false }],
    },
  ],
  events: [
    { at: "8 ก.ย. 09:10", who: "พี่ก้อย", what: "ร้านปักแจ้งเครื่องเสีย — เลยนัดรับ 2 วัน", tone: "danger" },
    { at: "2 ก.ย. 14:00", who: "พี่ก้อย", what: "ส่งเสื้อ 30 ตัวให้ร้านปักพี่หน่อย นัดรับ 6 ก.ย.", tone: "neutral" },
    { at: "1 ก.ย. 10:45", who: "เนส", what: "ตรวจรับเสื้อลูกค้า 30/30 ถ่ายรูปแล้ว", tone: "success" },
    { at: "1 ก.ย. 09:30", who: "เบส", what: "เปิดใบผลิตจากสูตร “เสื้อลูกค้า + ปักลาย” · มอบหมายเนส/พี่ก้อย", tone: "neutral" },
  ],
};

/* ───────────────────────── ใบ 7 ขั้น — ORD-2608-0061 (ทำเอง DTF + ร้านนอก 2 ขั้น) ───────────────────────── */

export const CASE_7: WorkOrder = {
  orderNumber: "ORD-2608-0061",
  customer: "คุณปุ๊ก",
  company: "บริษัท กรีนโลจิสติกส์ จำกัด (มหาชน)",
  channel: "LINE",
  qty: 240,
  dueLabel: "11 ก.ย. 2569",
  dueInDays: 3,
  urgent: false,
  routingName: "โปโล DTF + ปักแขน + ป้ายคอ (สูตรมาตรฐาน v3)",
  mockupVersion: "v3",
  note: "ลูกค้าย้ำ: โลโก้แขนห้ามเอียง · เช็คสีกรมท่าให้ตรงล็อตเดิม (ORD-2607-0018)",
  items: [
    {
      product: "โปโล Dry-Tech คอปก",
      color: "กรมท่า",
      sizes: [
        { size: "S", qty: 20 },
        { size: "M", qty: 40 },
        { size: "L", qty: 60 },
        { size: "XL", qty: 30 },
        { size: "2XL", qty: 10 },
      ],
      mockup: "/demo-mockups/front.svg",
      prints: [
        { position: "อกซ้าย", technique: "DTF", size: "8 × 8 ซม.", note: "โลโก้สีเต็ม" },
        { position: "แขนซ้าย", technique: "ปัก", size: "5 × 5 ซม.", note: "ด้ายขาว ห้ามเอียง" },
      ],
    },
    {
      product: "โปโล Dry-Tech คอปก",
      color: "ขาว",
      sizes: [
        { size: "M", qty: 20 },
        { size: "L", qty: 30 },
        { size: "XL", qty: 10 },
      ],
      mockup: null,
      prints: [
        { position: "อกซ้าย", technique: "DTF", size: "8 × 8 ซม." },
        { position: "แขนซ้าย", technique: "ปัก", size: "5 × 5 ซม." },
      ],
    },
    {
      product: "โปโล Dry-Tech คอปก",
      color: "เทา",
      sizes: [
        { size: "M", qty: 10 },
        { size: "L", qty: 10 },
      ],
      mockup: null,
      prints: [{ position: "อกซ้าย", technique: "DTF", size: "8 × 8 ซม." }],
    },
  ],
  steps: [
    {
      id: "s1",
      order: 1,
      label: "เบิกเสื้อจากสต๊อค",
      short: "เบิกเสื้อ",
      kind: "pick",
      lane: "shirt",
      state: "done",
      owner: "เนส",
      qtyDone: 240,
      qtyTotal: 240,
      startedAt: "4 ก.ย. 09:10",
      completedAt: "4 ก.ย. 09:40",
      planEnd: "4 ก.ย.",
      checklist: [
        { label: "นับเสื้อตรงกับใบเบิก (สี/ไซซ์)", done: true },
        { label: "ตรวจตำหนิผ้าก่อนพิมพ์", done: true },
        { label: "แยกกองตามไซซ์ ติดป้ายกอง", done: true },
      ],
    },
    {
      id: "s2",
      order: 2,
      label: "พิมพ์ฟิล์ม DTF",
      short: "พิมพ์ฟิล์ม",
      kind: "dtf",
      lane: "film",
      state: "done",
      owner: "บาส",
      qtyDone: 240,
      qtyTotal: 240,
      startedAt: "4 ก.ย. 13:00",
      completedAt: "5 ก.ย. 11:30",
      planEnd: "5 ก.ย.",
      checklist: [
        { label: "ไฟล์ตรงกับม็อกอัพอนุมัติ v3", done: true },
        { label: "ทดสอบพิมพ์ 1 ชิ้นเทียบสี", done: true },
        { label: "นับฟิล์มครบ 240 + เผื่อ 5%", done: true },
      ],
      note: "ปิดจากรอบพิมพ์ R-0905-02 — ขั้นนี้ผ่านเอง ไม่ต้องกด",
    },
    {
      id: "s3",
      order: 3,
      label: "ปักโลโก้แขน (ร้านนอก)",
      short: "ปักแขน (ร้าน)",
      kind: "outsource",
      lane: "out",
      state: "waiting",
      owner: "พี่ก้อย",
      qtyDone: 0,
      qtyTotal: 240,
      startedAt: "5 ก.ย. 15:00",
      completedAt: null,
      planEnd: "9 ก.ย.",
      checklist: [
        { label: "ส่งไฟล์ปัก + ตัวอย่างสีด้าย", done: true },
        { label: "ระบุจำนวนต่อไซซ์ในใบส่งร้าน", done: true },
        { label: "ตรวจรับ: นับครบ + ปักไม่เอียง", done: false },
      ],
      outsource: {
        vendor: "ร้านปักพี่หน่อย (บางบอน)",
        work: "ปักโลโก้แขน 240 ตัว",
        sentOn: "5 ก.ย.",
        backLabel: "9 ก.ย.",
        backInDays: 1,
        status: "กำลังทำ",
      },
    },
    {
      id: "s4",
      order: 4,
      label: "รีดร้อน",
      short: "รีดร้อน",
      kind: "inhouse",
      lane: "merge",
      state: "active",
      owner: "บาส",
      qtyDone: 96,
      qtyTotal: 240,
      startedAt: "7 ก.ย. 09:00",
      completedAt: null,
      planEnd: "9 ก.ย.",
      checklist: [
        { label: "ตั้งอุณหภูมิ 160°C · 12 วินาที (ตามสูตร)", done: true },
        { label: "รีดตัวอย่าง 1 ตัว ตรวจตำแหน่งเทียบม็อกอัพ", done: true },
        { label: "เช็คการลอกหลังเย็น 1 ตัวต่อ 50", done: false },
      ],
      note: "รีดได้ทั้ง 240 เพราะเสื้อครบแล้ว — ยอดบนกระดาษ 96 ตัว (บาสจดเมื่อวาน)",
    },
    {
      id: "s5",
      order: 5,
      label: "ป้ายคอทอ (ร้านนอก)",
      short: "ป้ายคอ (ร้าน)",
      kind: "outsource",
      lane: "out",
      state: "blocked",
      owner: "พี่ก้อย",
      qtyDone: 0,
      qtyTotal: 240,
      startedAt: "2 ก.ย. 10:00",
      completedAt: null,
      planEnd: "6 ก.ย.",
      checklist: [
        { label: "ส่งไฟล์ป้าย + สเปกขนาด", done: true },
        { label: "ตรวจรับ: จำนวน + สีทอตรงตัวอย่าง", done: false },
      ],
      outsource: {
        vendor: "Labelist ป้ายคอทอ",
        work: "ป้ายคอทอ 240 ชิ้น",
        sentOn: "2 ก.ย.",
        backLabel: "6 ก.ย.",
        backInDays: -2,
        status: "เลยนัดรับ",
      },
      problem: { title: "ร้านยังไม่ส่งของ", detail: "นัดรับ 6 ก.ย. ยังไม่ได้ของ — โทรตามแล้ว 2 ครั้ง ร้านบอกพรุ่งนี้", since: "7 ก.ย. 08:40" },
    },
    {
      id: "s6",
      order: 6,
      label: "ตรวจ QC",
      short: "ตรวจ QC",
      kind: "qc",
      lane: "tail",
      state: "todo",
      owner: null,
      qtyDone: 0,
      qtyTotal: 240,
      startedAt: null,
      completedAt: null,
      planEnd: "10 ก.ย.",
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
      short: "แพ็ก",
      kind: "pack",
      lane: "tail",
      state: "todo",
      owner: null,
      qtyDone: 0,
      qtyTotal: 240,
      startedAt: null,
      completedAt: null,
      planEnd: "11 ก.ย.",
      checklist: [
        { label: "พับ + ถุงรายตัว ติดสติกเกอร์ไซซ์", done: false },
        { label: "ลังละ 40 ตัว แยกสี · ใบแพ็กติดข้างลัง", done: false },
      ],
    },
  ],
  events: [
    { at: "7 ก.ย. 08:40", who: "พี่ก้อย", what: "แจ้งปัญหา: ป้ายคอ Labelist เลยนัดรับ — โทรตามแล้ว", tone: "danger" },
    { at: "7 ก.ย. 16:30", who: "บาส", what: "รีดร้อน จดยอดบนกระดาษ 96/240", tone: "neutral" },
    { at: "7 ก.ย. 09:00", who: "บาส", what: "เริ่มรีดร้อน", tone: "neutral" },
    { at: "5 ก.ย. 15:00", who: "พี่ก้อย", what: "ส่งปักแขนให้ร้านปักพี่หน่อย 240 ตัว นัดรับ 9 ก.ย.", tone: "neutral" },
    { at: "5 ก.ย. 11:30", who: "ระบบ", what: "ปิดรอบพิมพ์ R-0905-02 → พิมพ์ฟิล์ม DTF ผ่านเอง 240/240", tone: "success" },
    { at: "4 ก.ย. 09:40", who: "เนส", what: "เบิกเสื้อจากสต๊อก 240 ตัว (ตัดยอด Anajak Stock แล้ว)", tone: "success" },
    { at: "3 ก.ย. 17:00", who: "เบส", what: "เปิดใบผลิตจากสูตรมาตรฐาน v3 · มอบหมายเนส/บาส/พี่ก้อย", tone: "neutral" },
  ],
};
