/**
 * ข้อมูลตัวอย่างของหน้าลอง — **ปลอมทั้งหมด** แต่ปลอมให้ครบและยาวเท่าของจริง
 *
 * กติกาที่ยึด (สกิล /proto ข้อ "เอาของมาให้ครบ"):
 *  · ชื่อลูกค้า/บริษัท ยกมาจาก prisma/seed-demo.ts ชุดเดียวกับที่ทีมใช้ทดสอบอยู่แล้ว
 *  · ป้ายงานยาวเท่าของจริง (มีใบที่ยาวจนต้องตัดคำ) · จำนวนตัวถึงหลักพัน · ยอดเงินไม่กลม
 *  หมายเหตุ: ภาพถ่ายก่อนเอาระบบชื่องานออก (2026-08-30) ของจริงไม่มีชื่องานแล้ว
 *  · มีครบทุกสถานะขอบที่ของจริงเจอ: เลยกำหนด · ไม่กำหนดส่ง · ยังไม่มีม็อกอัพ ·
 *    ยังไม่ตีราคา · ติดปัญหาเสื้อไม่พอ · QC ไม่ผ่าน · blind ship · ค้างชำระ
 *
 * วันที่: ตรึงไว้ที่ **30 ส.ค. 2569** เป็น "วันนี้" แล้วเก็บระยะห่างเป็นตัวเลขตายตัว
 * (`dueInDays`) — ไม่เรียก Date.now() ตอนเรนเดอร์ เพราะ React 19 compiler ตีว่าไม่บริสุทธิ์
 * และ SSR/CSR จะได้คนละค่า
 */

export const PROTO_TODAY_LABEL = "30 ส.ค. 2569";

/** ช่วงของสายงานจริง — ทำเองมีแค่ DTF ที่เหลือ outsource (เบสเคาะ 2026-06-12) */
export const STAGES = [
  { key: "intake", label: "รับงาน", sub: "ตีราคา · ยืนยัน · มัดจำ" },
  { key: "design", label: "ออกแบบ", sub: "ทำม็อกอัพ · รอลูกค้าอนุมัติ" },
  { key: "prep", label: "เตรียมเสื้อ", sub: "เบิกสต๊อก · ตรวจรับเสื้อลูกค้า" },
  { key: "dtf", label: "DTF ในโรงงาน", sub: "พิมพ์ฟิล์ม · รีดร้อน" },
  { key: "outsource", label: "ร้านนอก", sub: "ปัก · สกรีน · ตัดเย็บ · ป้ายคอ" },
  { key: "qc", label: "ตรวจ QC", sub: "นับ · ตรวจตำหนิ" },
  { key: "ship", label: "แพ็ค / ส่ง", sub: "แพ็ค · ใบส่งของ · เรียกรถ" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

export const STAGE_LABEL = Object.fromEntries(
  STAGES.map((s) => [s.key, s.label]),
) as Record<StageKey, string>;

/** โทนของ "งานถัดไป" — แดง = มีคนต้องแก้เดี๋ยวนี้ · เหลือง = รออยู่ · เทา = เดินตามปกติ */
export type ActionTone = "red" | "amber" | "normal";

export type ProtoJob = {
  id: string;
  orderNumber: string;
  /** ผู้ติดต่อ — ของจริงคือชื่อคนที่คุยด้วย ไม่ใช่ชื่อบริษัท */
  contact: string;
  company: string;
  title: string;
  /** null = ยังไม่มีม็อกอัพ (งานที่ยังไม่ผ่านออกแบบ) — ของจริงขึ้นกรอบประจุดว่าง */
  mockup: string | null;
  qty: number;
  /** ระยะถึงกำหนดส่ง เป็นวัน · ติดลบ = เลยกำหนด · null = ยังไม่กำหนดส่ง */
  dueInDays: number | null;
  dueLabel: string | null;
  urgent: boolean;
  stage: StageKey;
  statusLabel: string;
  next: { label: string; owner: string; tone: ActionTone };
  progress: { done: number; total: number };
  /** null = ยังไม่ตีราคา (ของจริงคือ 0 รายการ) — ห้ามแปลงเป็น 0 บาท */
  amount: number | null;
  payment: string | null;
  channel: string;
  orderType: "สั่งทำ" | "สำเร็จรูป";
  /** ปัญหาที่ค้างอยู่ — มีเมื่อไหร่คือใบที่ต้องจัดการก่อนเพื่อน */
  problem?: string;
  /** หมายเหตุที่พลาดแล้วงานเสีย (blind ship / ห้ามพับ) */
  note?: string;
};

const FRONT = "/demo-mockups/front.svg";
const BACK = "/demo-mockups/back.svg";

/** 12 ใบ = ปริมาณงานสัปดาห์ปกติของทีม 5 คน */
export const CORE_JOBS: ProtoJob[] = [
  {
    id: "j-0042",
    orderNumber: "ORD-2608-0042",
    contact: "คุณเมย์",
    company: "บริษัท นอร์ทสตาร์ รีเทล จำกัด",
    title: "เสื้อโปโล Dry-Tech พนักงานสาขา ปี 2569",
    mockup: FRONT,
    qty: 480,
    dueInDays: -2,
    dueLabel: "28 ส.ค.",
    urgent: false,
    stage: "prep",
    statusLabel: "กำลังผลิต",
    next: {
      label: "เสื้อไม่พอเริ่มงาน — สั่งเพิ่มหรือเปลี่ยนไซซ์",
      owner: "เบส (เจ้าของ)",
      tone: "red",
    },
    progress: { done: 1, total: 5 },
    amount: 138_240,
    payment: "มัดจำแล้ว 50%",
    channel: "LINE",
    orderType: "สั่งทำ",
    problem: "ขาดไซซ์ L อีก 60 ตัว — สต๊อกจองไม่ครบ",
  },
  {
    id: "j-0051",
    orderNumber: "ORD-2608-0051",
    contact: "คุณต้น",
    company: "โครงการรักษ์ทะเลไทย",
    title: "เสื้อยืดอาสาสมัครเก็บขยะชายหาด รุ่น 3",
    mockup: FRONT,
    qty: 1_200,
    dueInDays: 0,
    dueLabel: "วันนี้",
    urgent: true,
    stage: "dtf",
    statusLabel: "กำลังผลิต",
    next: { label: "รีดร้อน 480 / 1,200 ตัว", owner: "บาส · พิมพ์ DTF", tone: "normal" },
    progress: { done: 3, total: 5 },
    amount: 246_000,
    payment: "มัดจำแล้ว 50%",
    channel: "LINE",
    orderType: "สั่งทำ",
  },
  {
    id: "j-0048",
    orderNumber: "ORD-2608-0048",
    contact: "คุณนนท์",
    company: "Bangkok Run Club",
    title: "เสื้อวิ่งมินิมาราธอน ปักโลโก้อกซ้าย",
    mockup: BACK,
    qty: 350,
    dueInDays: 1,
    dueLabel: "31 ส.ค.",
    urgent: false,
    stage: "outsource",
    statusLabel: "กำลังผลิต",
    next: {
      label: "ตามงานปักจากโรงปักศรีนครินทร์ (เกินนัด 1 วัน)",
      owner: "พี่ก้อย · หัวหน้าผลิต",
      tone: "amber",
    },
    progress: { done: 3, total: 6 },
    amount: 87_500,
    payment: "มัดจำแล้ว 50%",
    channel: "LINE",
    orderType: "สั่งทำ",
  },
  {
    id: "j-0053",
    orderNumber: "ORD-2608-0053",
    contact: "คุณฟ้า",
    company: "Sunday Studio",
    title: "เสื้อคอลเลกชัน Autumn — ส่งตรงถึงลูกค้าปลายทาง",
    mockup: FRONT,
    qty: 120,
    dueInDays: 3,
    dueLabel: "2 ก.ย.",
    urgent: false,
    stage: "qc",
    statusLabel: "ตรวจสอบคุณภาพ",
    next: { label: "ตรวจ QC 120 ตัว", owner: "มิ้น · รีดร้อนและ QC", tone: "normal" },
    progress: { done: 4, total: 5 },
    amount: 54_600,
    payment: "เครดิต 15 วัน",
    channel: "LINE",
    orderType: "สั่งทำ",
    note: "Blind ship — ห้ามมีชื่อหรือเอกสาร Anajak ในกล่อง",
  },
  {
    id: "j-0039",
    orderNumber: "ORD-2608-0039",
    contact: "คุณแพรว",
    company: "ชมรมศิษย์เก่าคณะสถาปัตย์",
    title: "เสื้อกีฬาสีคณะ 4 สี",
    mockup: BACK,
    qty: 300,
    dueInDays: -1,
    dueLabel: "29 ส.ค.",
    urgent: false,
    stage: "qc",
    statusLabel: "ตรวจสอบคุณภาพ",
    next: {
      label: "QC ไม่ผ่าน 18 ตัว — ตัดสินว่าพิมพ์ซ้ำหรือส่งเท่าที่มี",
      owner: "เบส (เจ้าของ)",
      tone: "red",
    },
    progress: { done: 4, total: 5 },
    amount: 71_400,
    payment: "เครดิต 30 วัน",
    channel: "โทรศัพท์",
    orderType: "สั่งทำ",
    problem: "สีเพี้ยนจากล็อตฟิล์มเดิม 18 ตัว",
  },
  {
    id: "j-0055",
    orderNumber: "ORD-2608-0055",
    contact: "คุณแพรว",
    company: "ชมรมศิษย์เก่าคณะสถาปัตย์",
    title: "เสื้อรุ่นคืนสู่เหย้า ครบรอบ 40 ปี",
    mockup: FRONT,
    qty: 220,
    dueInDays: 5,
    dueLabel: "4 ก.ย.",
    urgent: false,
    stage: "design",
    statusLabel: "กำลังออกแบบ",
    next: {
      label: "รอลูกค้าอนุมัติม็อกอัพ (ส่งไป 2 วันแล้ว)",
      owner: "ลูกค้า — ตามได้",
      tone: "amber",
    },
    progress: { done: 1, total: 5 },
    amount: 52_800,
    payment: "รอมัดจำ",
    channel: "LINE",
    orderType: "สั่งทำ",
  },
  {
    id: "j-0056",
    orderNumber: "ORD-2608-0056",
    contact: "คุณออม",
    company: "River Yard Cafe",
    title: "เสื้อพนักงานร้าน — ลูกค้านำเสื้อมาเอง",
    mockup: FRONT,
    qty: 45,
    dueInDays: 6,
    dueLabel: "5 ก.ย.",
    urgent: false,
    stage: "prep",
    statusLabel: "รอคิวผลิต",
    next: { label: "ตรวจรับเสื้อลูกค้า 45 ตัว", owner: "นัท · เตรียมเสื้อ", tone: "normal" },
    progress: { done: 0, total: 4 },
    amount: 9_450,
    payment: "จ่ายครบแล้ว",
    channel: "หน้าร้าน",
    orderType: "สั่งทำ",
  },
  {
    id: "j-0044",
    orderNumber: "ORD-2608-0044",
    contact: "คุณนนท์",
    company: "Bangkok Run Club",
    title: "เสื้อซ้อมทีมวิ่ง (งานซ้ำจากรอบ ก.ค.)",
    mockup: BACK,
    qty: 150,
    dueInDays: 2,
    dueLabel: "1 ก.ย.",
    urgent: false,
    stage: "ship",
    statusLabel: "พร้อมจัดส่ง",
    next: { label: "พิมพ์ใบส่งของแล้วเรียกรถ", owner: "มิ้น · รีดร้อนและ QC", tone: "normal" },
    progress: { done: 5, total: 5 },
    amount: 33_750,
    payment: "เครดิต 30 วัน",
    channel: "LINE",
    orderType: "สั่งทำ",
  },
  {
    id: "j-0057",
    orderNumber: "ORD-2608-0057",
    contact: "คุณเมย์",
    company: "บริษัท นอร์ทสตาร์ รีเทล จำกัด",
    title: "เสื้อยืดแจกลูกค้า Grand Opening สาขาลาดพร้าว",
    mockup: null,
    qty: 600,
    dueInDays: 8,
    dueLabel: "7 ก.ย.",
    urgent: false,
    stage: "intake",
    statusLabel: "สอบถาม",
    next: { label: "รอลูกค้าตอบราคา แล้วกดยืนยันออเดอร์", owner: "เบส (เจ้าของ)", tone: "amber" },
    progress: { done: 0, total: 5 },
    amount: 111_000,
    payment: "รอมัดจำ",
    channel: "LINE",
    orderType: "สั่งทำ",
  },
  {
    id: "j-0059",
    orderNumber: "ORD-2608-0059",
    contact: "คุณฟ้า",
    company: "Sunday Studio",
    title:
      "เสื้อฮู้ดสกรีนหน้า-หลัง คอลแลบกับศิลปินอิสระ ล็อตพรีออเดอร์รอบเดือนกันยายน",
    mockup: FRONT,
    qty: 90,
    dueInDays: 10,
    dueLabel: "9 ก.ย.",
    urgent: false,
    stage: "design",
    statusLabel: "กำลังออกแบบ",
    next: { label: "ทำม็อกอัพรอบแก้ที่ 2", owner: "กราฟิก", tone: "normal" },
    progress: { done: 1, total: 6 },
    amount: 48_600,
    payment: "เครดิต 15 วัน",
    channel: "LINE",
    orderType: "สั่งทำ",
  },
  {
    id: "j-0060",
    orderNumber: "ORD-2608-0060",
    contact: "คุณออม",
    company: "River Yard Cafe",
    title: "เสื้อยืดโปรโมชันเปิดสาขา 2",
    mockup: null,
    qty: 60,
    dueInDays: 12,
    dueLabel: "11 ก.ย.",
    urgent: false,
    stage: "intake",
    statusLabel: "ยืนยันออเดอร์",
    next: { label: "เก็บมัดจำก่อนเริ่มงาน", owner: "การเงิน", tone: "amber" },
    progress: { done: 0, total: 4 },
    amount: 12_600,
    payment: "ค้างชำระ 2 ใบเก่า",
    channel: "หน้าร้าน",
    orderType: "สั่งทำ",
  },
  {
    id: "j-0058",
    orderNumber: "ORD-2608-0058",
    contact: "คุณต้น",
    company: "โครงการรักษ์ทะเลไทย",
    title: "เสื้อทีมงานอีเวนต์ (ยังไม่สรุปแบบ)",
    mockup: null,
    qty: 80,
    dueInDays: null,
    dueLabel: null,
    urgent: false,
    stage: "intake",
    statusLabel: "ร่าง",
    next: { label: "ใส่รายการสินค้าและตีราคา", owner: "เบส (เจ้าของ)", tone: "normal" },
    progress: { done: 0, total: 4 },
    amount: null,
    payment: null,
    channel: "LINE",
    orderType: "สั่งทำ",
  },
];

/** อีก 12 ใบสำหรับปุ่มสลับ "งานล้น" — ช่วงเปิดเทอม/สิ้นปีของจริงขึ้นระดับนี้ */
export const EXTRA_JOBS: ProtoJob[] = [
  {
    id: "j-0061",
    orderNumber: "ORD-2608-0061",
    contact: "คุณเมย์",
    company: "บริษัท นอร์ทสตาร์ รีเทล จำกัด",
    title: "เสื้อยูนิฟอร์มคลังสินค้า บางนา",
    mockup: FRONT,
    qty: 260,
    dueInDays: 0,
    dueLabel: "วันนี้",
    urgent: true,
    stage: "dtf",
    statusLabel: "กำลังผลิต",
    next: { label: "พิมพ์ฟิล์ม DTF ชุดที่ 2", owner: "บาส · พิมพ์ DTF", tone: "normal" },
    progress: { done: 2, total: 5 },
    amount: 62_400,
    payment: "เครดิต 30 วัน",
    channel: "LINE",
    orderType: "สั่งทำ",
  },
  {
    id: "j-0062",
    orderNumber: "ORD-2608-0062",
    contact: "คุณนนท์",
    company: "Bangkok Run Club",
    title: "เสื้อกล้ามซ้อมวิ่ง สีดำ",
    mockup: BACK,
    qty: 180,
    dueInDays: -3,
    dueLabel: "27 ส.ค.",
    urgent: false,
    stage: "outsource",
    statusLabel: "กำลังผลิต",
    next: { label: "ร้านตัดเย็บยังไม่ตอบรับใบสั่ง", owner: "พี่ก้อย · หัวหน้าผลิต", tone: "red" },
    progress: { done: 1, total: 6 },
    amount: 41_400,
    payment: "มัดจำแล้ว 50%",
    channel: "LINE",
    orderType: "สั่งทำ",
    problem: "ส่งใบสั่งไป 4 วัน ร้านยังไม่ยืนยัน",
  },
  {
    id: "j-0063",
    orderNumber: "ORD-2608-0063",
    contact: "คุณแพรว",
    company: "ชมรมศิษย์เก่าคณะสถาปัตย์",
    title: "เสื้อสตาฟงานรับปริญญา",
    mockup: FRONT,
    qty: 140,
    dueInDays: 1,
    dueLabel: "31 ส.ค.",
    urgent: false,
    stage: "dtf",
    statusLabel: "กำลังผลิต",
    next: { label: "รีดร้อน 0 / 140 ตัว", owner: "มิ้น · รีดร้อนและ QC", tone: "normal" },
    progress: { done: 3, total: 5 },
    amount: 32_200,
    payment: "เครดิต 30 วัน",
    channel: "โทรศัพท์",
    orderType: "สั่งทำ",
  },
  {
    id: "j-0064",
    orderNumber: "ORD-2608-0064",
    contact: "คุณฟ้า",
    company: "Sunday Studio",
    title: "เสื้อยืดลายพิมพ์ทั้งตัว (All-over)",
    mockup: FRONT,
    qty: 75,
    dueInDays: 4,
    dueLabel: "3 ก.ย.",
    urgent: false,
    stage: "outsource",
    statusLabel: "กำลังผลิต",
    next: { label: "รอ Sublimation จากร้านนอก", owner: "พี่ก้อย · หัวหน้าผลิต", tone: "normal" },
    progress: { done: 2, total: 6 },
    amount: 37_500,
    payment: "เครดิต 15 วัน",
    channel: "LINE",
    orderType: "สั่งทำ",
  },
  {
    id: "j-0065",
    orderNumber: "ORD-2608-0065",
    contact: "คุณออม",
    company: "River Yard Cafe",
    title: "ผ้ากันเปื้อนสกรีนโลโก้",
    mockup: null,
    qty: 30,
    dueInDays: 7,
    dueLabel: "6 ก.ย.",
    urgent: false,
    stage: "design",
    statusLabel: "กำลังออกแบบ",
    next: { label: "ทำม็อกอัพรอบแรก", owner: "กราฟิก", tone: "normal" },
    progress: { done: 0, total: 4 },
    amount: 8_700,
    payment: "จ่ายครบแล้ว",
    channel: "หน้าร้าน",
    orderType: "สั่งทำ",
  },
  {
    id: "j-0066",
    orderNumber: "ORD-2608-0066",
    contact: "คุณต้น",
    company: "โครงการรักษ์ทะเลไทย",
    title: "เสื้อโปโลผู้บริหารโครงการ",
    mockup: FRONT,
    qty: 40,
    dueInDays: 2,
    dueLabel: "1 ก.ย.",
    urgent: false,
    stage: "ship",
    statusLabel: "กำลังแพ็ค",
    next: { label: "แพ็ค 40 ตัว", owner: "นัท · เตรียมเสื้อ", tone: "normal" },
    progress: { done: 5, total: 5 },
    amount: 14_800,
    payment: "มัดจำแล้ว 50%",
    channel: "LINE",
    orderType: "สั่งทำ",
  },
  {
    id: "j-0067",
    orderNumber: "ORD-2608-0067",
    contact: "คุณเมย์",
    company: "บริษัท นอร์ทสตาร์ รีเทล จำกัด",
    title: "เสื้อยืดสต๊อกสำรอง ไซซ์รวม",
    mockup: null,
    qty: 500,
    dueInDays: 14,
    dueLabel: "13 ก.ย.",
    urgent: false,
    stage: "intake",
    statusLabel: "ยืนยันออเดอร์",
    next: { label: "เข้าคิวผลิต", owner: "พี่ก้อย · หัวหน้าผลิต", tone: "normal" },
    progress: { done: 0, total: 3 },
    amount: 75_000,
    payment: "เครดิต 30 วัน",
    channel: "LINE",
    orderType: "สำเร็จรูป",
  },
  {
    id: "j-0068",
    orderNumber: "ORD-2608-0068",
    contact: "คุณนนท์",
    company: "Bangkok Run Club",
    title: "เสื้อแขนยาวกันแดด",
    mockup: BACK,
    qty: 210,
    dueInDays: 9,
    dueLabel: "8 ก.ย.",
    urgent: false,
    stage: "prep",
    statusLabel: "รอคิวผลิต",
    next: { label: "เบิกเสื้อจากสต๊อก 210 ตัว", owner: "นัท · เตรียมเสื้อ", tone: "normal" },
    progress: { done: 0, total: 5 },
    amount: 63_000,
    payment: "มัดจำแล้ว 50%",
    channel: "LINE",
    orderType: "สั่งทำ",
  },
  {
    id: "j-0069",
    orderNumber: "ORD-2608-0069",
    contact: "คุณแพรว",
    company: "ชมรมศิษย์เก่าคณะสถาปัตย์",
    title: "เสื้อช็อปนักศึกษาปี 1",
    mockup: FRONT,
    qty: 420,
    dueInDays: 11,
    dueLabel: "10 ก.ย.",
    urgent: false,
    stage: "design",
    statusLabel: "อนุมัติแบบแล้ว",
    next: { label: "เข้าคิวผลิต", owner: "พี่ก้อย · หัวหน้าผลิต", tone: "normal" },
    progress: { done: 2, total: 5 },
    amount: 96_600,
    payment: "รอมัดจำ",
    channel: "โทรศัพท์",
    orderType: "สั่งทำ",
  },
  {
    id: "j-0070",
    orderNumber: "ORD-2608-0070",
    contact: "คุณฟ้า",
    company: "Sunday Studio",
    title: "หมวกปักโลโก้",
    mockup: null,
    qty: 100,
    dueInDays: null,
    dueLabel: null,
    urgent: false,
    stage: "intake",
    statusLabel: "ร่าง",
    next: { label: "ใส่รายการสินค้าและตีราคา", owner: "เบส (เจ้าของ)", tone: "normal" },
    progress: { done: 0, total: 3 },
    amount: null,
    payment: null,
    channel: "LINE",
    orderType: "สั่งทำ",
  },
  {
    id: "j-0071",
    orderNumber: "ORD-2608-0071",
    contact: "คุณออม",
    company: "River Yard Cafe",
    title: "เสื้อยืดของที่ระลึกครบรอบร้าน",
    mockup: FRONT,
    qty: 55,
    dueInDays: 3,
    dueLabel: "2 ก.ย.",
    urgent: false,
    stage: "qc",
    statusLabel: "ตรวจสอบคุณภาพ",
    next: { label: "ตรวจ QC 55 ตัว", owner: "มิ้น · รีดร้อนและ QC", tone: "normal" },
    progress: { done: 4, total: 5 },
    amount: 13_200,
    payment: "จ่ายครบแล้ว",
    channel: "หน้าร้าน",
    orderType: "สั่งทำ",
  },
  {
    id: "j-0072",
    orderNumber: "ORD-2608-0072",
    contact: "คุณต้น",
    company: "โครงการรักษ์ทะเลไทย",
    title: "เสื้อกันลมทีมสำรวจ",
    mockup: BACK,
    qty: 65,
    dueInDays: 6,
    dueLabel: "5 ก.ย.",
    urgent: false,
    stage: "outsource",
    statusLabel: "กำลังผลิต",
    next: { label: "รอตัดเย็บใหม่จากร้านนอก", owner: "พี่ก้อย · หัวหน้าผลิต", tone: "normal" },
    progress: { done: 1, total: 6 },
    amount: 45_500,
    payment: "มัดจำแล้ว 50%",
    channel: "LINE",
    orderType: "สั่งทำ",
  },
];

export function protoJobs(busy: boolean): ProtoJob[] {
  return busy ? [...CORE_JOBS, ...EXTRA_JOBS] : CORE_JOBS;
}

/* ───────────────────────── กลุ่มตามเวลา (ใช้ในทาง A) ───────────────────────── */

export const TIME_GROUPS = [
  { key: "late", label: "เลยกำหนดแล้ว", hint: "ลูกค้ารออยู่ — ต้องตอบวันนี้" },
  { key: "today", label: "ส่งวันนี้", hint: "" },
  { key: "tomorrow", label: "ส่งพรุ่งนี้", hint: "" },
  { key: "week", label: "ภายในสัปดาห์นี้", hint: "" },
  { key: "later", label: "ยังมีเวลา", hint: "" },
  { key: "none", label: "ยังไม่กำหนดส่ง", hint: "ตกหล่นง่ายที่สุด" },
] as const;

export type TimeGroupKey = (typeof TIME_GROUPS)[number]["key"];

export function timeGroupOf(job: ProtoJob): TimeGroupKey {
  if (job.dueInDays === null) return "none";
  if (job.dueInDays < 0) return "late";
  if (job.dueInDays === 0) return "today";
  if (job.dueInDays === 1) return "tomorrow";
  if (job.dueInDays <= 7) return "week";
  return "later";
}

/** เรียง "ต้องจัดการก่อน" — ปัญหาค้างมาก่อน แล้วค่อยเรียงตามกำหนดส่ง */
export function byUrgency(a: ProtoJob, b: ProtoJob) {
  const problem = Number(Boolean(b.problem)) - Number(Boolean(a.problem));
  if (problem !== 0) return problem;
  const urgent = Number(b.urgent) - Number(a.urgent);
  if (urgent !== 0) return urgent;
  const ad = a.dueInDays ?? 999;
  const bd = b.dueInDays ?? 999;
  return ad - bd;
}

export function formatQty(qty: number) {
  return qty.toLocaleString("th-TH");
}

export function formatAmount(amount: number | null) {
  return amount === null ? "ยังไม่ตีราคา" : `${amount.toLocaleString("th-TH")} บาท`;
}

export function dueText(job: ProtoJob) {
  if (job.dueInDays === null) return "ไม่กำหนดส่ง";
  if (job.dueInDays < 0) return `เลย ${Math.abs(job.dueInDays)} วัน · ${job.dueLabel}`;
  if (job.dueInDays === 0) return "ส่งวันนี้";
  if (job.dueInDays === 1) return `พรุ่งนี้ · ${job.dueLabel}`;
  return `อีก ${job.dueInDays} วัน · ${job.dueLabel}`;
}
