/**
 * ข้อมูลของหน้าลอง "จอสถานี + หัวหน้าจัดการต่อสถานี" — **ปลอมทั้งหมด ไม่ต่อฐานข้อมูล** แต่ครบเท่าที่หน้างานเจอ
 *
 * สถานี = work center ในหน้าตั้งค่า (seed จริง: PREP · DTF_PRINT · HEAT_PRESS · RETURN_QC · FINAL_QC · FINAL_PACK · OUTSOURCE)
 *   → เพิ่มสถานีใหม่ = เพิ่มแถวในหน้าตั้งค่า ไม่ต้องแก้โค้ด (RETURN_QC คือตัวอย่างจริงที่เพิ่ม 1 ก.ย.)
 * คน = ทีม 5 คน (ช่าง 4 + เบสเป็นหัวหน้า) · แต่ละคนประจำ 1-2 สถานี
 * ใบงาน = 15 ใบกระจายทุกสถานี มีครบทุกสถานะ: กำลังทำ · พร้อมทำ · ติดปัญหา · รอของกลับ · เลยกำหนด · ด่วน
 * วันที่ตรึง "วันนี้ = 30 ส.ค. 2569 14:20" เหมือนหน้าลองอื่น (ไม่เรียก Date.now())
 */

export const PROTO_TODAY = "30 ส.ค. 2569";
export const PROTO_CLOCK = "14:20";

/* ───────────────────────────── สถานี ───────────────────────────── */

export const STATION_KEYS = ["prep", "dtf", "press", "return-qc", "qc", "pack", "outsource"] as const;
export type StationKey = (typeof STATION_KEYS)[number];

export type Station = {
  key: StationKey;
  /** รหัส work center ในหน้าตั้งค่า (ของจริง) */
  code: string;
  label: string;
  short: string;
  /** ปุ่มหลักปุ่มเดียวของสถานี — ข้างในปุ่มคือ dialog เฉพาะทางของขั้นนั้น */
  action: string;
  hint: string;
  /** สถานีที่เพิ่มทีหลังจากหน้าตั้งค่า — โชว์ว่าต่อเติมได้โดยไม่แก้โค้ด */
  addedNote?: string;
};

export const STATIONS: readonly Station[] = [
  { key: "prep", code: "PREP", label: "เตรียมเสื้อ", short: "เตรียม", action: "บันทึกเบิกเสื้อ", hint: "เบิกจากสต๊อก หรือตรวจรับเสื้อลูกค้า" },
  { key: "dtf", code: "DTF_PRINT", label: "พิมพ์ DTF", short: "พิมพ์", action: "เปิดรอบพิมพ์", hint: "รวมคิวเข้ารอบ พิมพ์ ตัดแยก" },
  { key: "press", code: "HEAT_PRESS", label: "รีดร้อน", short: "รีด", action: "บันทึกยอดรีด", hint: "รีดฟิล์มลงเสื้อตามค่าของลาย" },
  {
    key: "return-qc",
    code: "RETURN_QC",
    label: "ตรวจของกลับจากร้าน",
    short: "ตรวจรับ",
    action: "บันทึกผลตรวจรับ",
    hint: "นับและตรวจงานที่ร้านนอกส่งกลับ",
    addedNote: "เพิ่มจากหน้าตั้งค่าเมื่อ 1 ก.ย. — ไม่ได้แก้โค้ด",
  },
  { key: "qc", code: "FINAL_QC", label: "ตรวจคุณภาพ", short: "QC", action: "บันทึกผลตรวจ", hint: "นับของดี / ของเสีย ถ่ายรูปของเสีย" },
  { key: "pack", code: "FINAL_PACK", label: "แพ็กสุดท้าย", short: "แพ็ก", action: "แพ็กและปิดใบ", hint: "พับ ถุงรายตัว ลัง ใบแพ็ก" },
  { key: "outsource", code: "OUTSOURCE", label: "ร้านนอก", short: "ร้านนอก", action: "รับของกลับ", hint: "ส่งงาน ตามของ รับของกลับ" },
];

export const STATION_BY_KEY = Object.fromEntries(STATIONS.map((s) => [s.key, s])) as Record<StationKey, Station>;

export function stationOf(key: StationKey): Station {
  return STATION_BY_KEY[key];
}

/* ───────────────────────────── คน ───────────────────────────── */

export type Worker = {
  id: string;
  name: string;
  initials: string;
  role: "ช่าง" | "หัวหน้า";
  stations: StationKey[];
};

export const WORKERS: readonly Worker[] = [
  { id: "w-nes", name: "เนส", initials: "น", role: "ช่าง", stations: ["prep", "return-qc"] },
  { id: "w-bas", name: "บาส", initials: "บ", role: "ช่าง", stations: ["dtf", "press"] },
  { id: "w-koi", name: "พี่ก้อย", initials: "ก", role: "ช่าง", stations: ["outsource", "return-qc"] },
  { id: "w-ton", name: "ต้น", initials: "ต", role: "ช่าง", stations: ["qc", "pack"] },
  { id: "w-bes", name: "เบส", initials: "บ", role: "หัวหน้า", stations: [...STATION_KEYS] },
];

export const BOSS: Worker = WORKERS[4]!;

export function workersAt(station: StationKey): Worker[] {
  return WORKERS.filter((w) => w.role === "ช่าง" && w.stations.includes(station));
}

/** จำลองว่า "คนที่ล็อกอินอยู่ที่จอนี้" = ช่างคนแรกที่ประจำสถานี */
export function meAt(station: StationKey): Worker {
  return workersAt(station)[0] ?? WORKERS[0]!;
}

/* ───────────────────────────── ใบงานที่สถานี ───────────────────────────── */

export type JobState = "doing" | "ready" | "blocked" | "waiting";

export const STATE_META: Record<JobState, { label: string; tone: "info" | "neutral" | "error" | "warning"; strong: boolean }> = {
  doing: { label: "กำลังทำ", tone: "info", strong: true },
  ready: { label: "พร้อมทำ", tone: "neutral", strong: false },
  blocked: { label: "ติดปัญหา", tone: "error", strong: true },
  waiting: { label: "รอของกลับ", tone: "warning", strong: false },
};

export type StationJob = {
  id: string;
  orderNumber: string;
  company: string;
  title: string;
  mockup: string;
  color: string;
  qty: number;
  /** ระยะถึงกำหนดส่ง เป็นวัน · ติดลบ = เลยกำหนด */
  dueInDays: number;
  dueLabel: string;
  urgent: boolean;
  station: StationKey;
  /** ชื่อขั้นในสูตร (ของจริง: operationName) */
  stepLabel: string;
  stepIndex: number;
  stepTotal: number;
  state: JobState;
  owner: string | null;
  qtyDone: number;
  /** null = ขั้นแบบติ๊กเฉย ๆ ไม่นับตัว */
  qtyTotal: number | null;
  sizes: { size: string; qty: number }[];
  prints: { position: string; technique: string; size: string; note?: string }[];
  /** ข้อกำหนดมาตรฐานของขั้น (จากสูตรขั้นงาน) */
  checklist: string[];
  problem?: { title: string; detail: string; since: string; by: string };
  outsource?: { vendor: string; work: string; backLabel: string; backInDays: number };
  /** ข้อควรระวังจากใบงาน — พลาดแล้วงานเสีย */
  note?: string;
  /** สิ่งที่เพิ่งเกิดกับใบนี้ล่าสุด (ให้หัวหน้ารู้ว่าช่างกดอะไรไป) */
  lastAction?: { what: string; who: string; at: string };
};

const FRONT = "/demo-mockups/front.svg";
const BACK = "/demo-mockups/back.svg";
const POLO = "/demo-mockups/polo-front.svg";
const SLEEVE = "/demo-mockups/polo-sleeve.svg";

const TEE_SIZES = [
  { size: "S", qty: 40 },
  { size: "M", qty: 120 },
  { size: "L", qty: 160 },
  { size: "XL", qty: 110 },
  { size: "2XL", qty: 50 },
];

function scaled(total: number) {
  const base = TEE_SIZES.reduce((s, x) => s + x.qty, 0);
  const out = TEE_SIZES.map((x) => ({ size: x.size, qty: Math.round((x.qty / base) * total) }));
  const diff = total - out.reduce((s, x) => s + x.qty, 0);
  out[2]!.qty += diff;
  return out;
}

const DTF_CHEST = { position: "อกซ้าย", technique: "DTF", size: "8 × 8 ซม." };
const DTF_BACK = { position: "หลัง", technique: "DTF", size: "28 × 35 ซม." };

const CHECK: Record<StationKey, string[]> = {
  prep: ["นับเสื้อตรงกับใบเบิก (สี/ไซซ์)", "ตรวจตำหนิผ้าก่อนพิมพ์", "แยกกองตามไซซ์ ติดป้ายกอง"],
  dtf: ["ไฟล์ตรงกับม็อกอัพที่ลูกค้าอนุมัติ", "ทดสอบพิมพ์ 1 ชิ้น เทียบสี", "นับฟิล์มครบ + เผื่อเสียตามสูตร"],
  press: ["ตั้งอุณหภูมิ / เวลา / แรงกด ตามค่าของลาย", "รีดตัวอย่าง 1 ตัว ตรวจตำแหน่งเทียบม็อกอัพ", "เช็คการลอกหลังเย็น 1 ตัวต่อ 50"],
  "return-qc": ["นับครบตามใบส่งร้าน (ต่อไซซ์)", "เทียบกับตัวอย่างที่ส่งไป", "ถ่ายรูปของที่ไม่ผ่าน"],
  qc: ["นับจำนวนต่อไซซ์ตรงใบสั่ง", "ตรวจตำแหน่ง / สี / รอยรีด ทุกตัว", "ถ่ายรูปของเสีย + ระบุสาเหตุ"],
  pack: ["พับ + ถุงรายตัว ติดสติกเกอร์ไซซ์", "แยกลังตามสี / ไซซ์", "ใบแพ็กติดข้างลัง"],
  outsource: ["ส่งไฟล์ + ตัวอย่างให้ร้าน", "ระบุจำนวนต่อไซซ์ในใบส่งร้าน", "นัดวันรับกลับและจดในระบบ"],
};

export const JOBS: readonly StationJob[] = [
  /* ── เตรียมเสื้อ ── */
  {
    id: "j-0042",
    orderNumber: "ORD-2608-0042",
    company: "บริษัท นอร์ทสตาร์ รีเทล จำกัด",
    title: "โปโล Dry-Tech พนักงานสาขา ปี 2569",
    mockup: POLO,
    color: "กรมท่า",
    qty: 480,
    dueInDays: -2,
    dueLabel: "28 ส.ค.",
    urgent: false,
    station: "prep",
    stepLabel: "เตรียมเสื้อ — เบิกจากสต๊อก",
    stepIndex: 1,
    stepTotal: 5,
    state: "blocked",
    owner: "เนส",
    qtyDone: 420,
    qtyTotal: 480,
    sizes: scaled(480),
    prints: [DTF_CHEST],
    checklist: CHECK.prep,
    problem: { title: "เสื้อไม่พอ", detail: "ไซซ์ L สีกรมท่า ขาด 60 ตัว — สต๊อกจองไม่ครบ ต้องสั่งเพิ่มหรือเปลี่ยนไซซ์", since: "28 ส.ค. 14:20", by: "เนส" },
    lastAction: { what: "แจ้งปัญหา “เสื้อไม่พอ”", who: "เนส", at: "28 ส.ค. 14:20" },
  },
  {
    id: "j-0066",
    orderNumber: "ORD-2608-0066",
    company: "โรงเรียนอนุบาลบ้านรัก",
    title: "เสื้อกีฬาสี 4 สี (เสื้อลูกค้าส่งมาเอง)",
    mockup: FRONT,
    color: "แดง / เขียว / ฟ้า / เหลือง",
    qty: 300,
    dueInDays: 3,
    dueLabel: "2 ก.ย.",
    urgent: false,
    station: "prep",
    stepLabel: "เตรียมเสื้อ — ตรวจรับเสื้อลูกค้า",
    stepIndex: 1,
    stepTotal: 5,
    state: "ready",
    owner: null,
    qtyDone: 0,
    qtyTotal: 300,
    sizes: scaled(300),
    prints: [DTF_BACK],
    checklist: CHECK.prep,
    note: "เสื้อของลูกค้า — ห้ามสลับกับสต๊อกเรา",
  },
  {
    id: "j-0070",
    orderNumber: "ORD-2608-0070",
    company: "คาเฟ่ Slow Bar เชียงใหม่",
    title: "เสื้อยืดพนักงาน + โลโก้หลัง",
    mockup: BACK,
    color: "ดำ",
    qty: 150,
    dueInDays: 6,
    dueLabel: "5 ก.ย.",
    urgent: false,
    station: "prep",
    stepLabel: "เตรียมเสื้อ — เบิกจากสต๊อก",
    stepIndex: 1,
    stepTotal: 5,
    state: "ready",
    owner: null,
    qtyDone: 0,
    qtyTotal: 150,
    sizes: scaled(150),
    prints: [DTF_CHEST, DTF_BACK],
    checklist: CHECK.prep,
  },
  /* ── พิมพ์ DTF ── */
  {
    id: "j-0051",
    orderNumber: "ORD-2608-0051",
    company: "โครงการรักษ์ทะเลไทย",
    title: "เสื้อยืดอาสาสมัครเก็บขยะชายหาด รุ่น 3",
    mockup: FRONT,
    color: "ขาว",
    qty: 1_200,
    dueInDays: 0,
    dueLabel: "วันนี้",
    urgent: true,
    station: "dtf",
    stepLabel: "พิมพ์ฟิล์ม DTF",
    stepIndex: 2,
    stepTotal: 5,
    state: "doing",
    owner: "บาส",
    qtyDone: 720,
    qtyTotal: 1_200,
    sizes: scaled(1_200),
    prints: [DTF_BACK, { ...DTF_CHEST, note: "โลโก้ผู้สนับสนุน 3 ราย" }],
    checklist: CHECK.dtf,
    lastAction: { what: "ปิดรอบพิมพ์ #R-118 (240 ฟิล์ม)", who: "บาส", at: "30 ส.ค. 13:05" },
  },
  {
    id: "j-0058",
    orderNumber: "ORD-2608-0058",
    company: "ทีมฟุตบอลสโมสรลาดกระบัง",
    title: "เสื้อซ้อม + เบอร์หลัง",
    mockup: BACK,
    color: "เขียว",
    qty: 200,
    dueInDays: 4,
    dueLabel: "3 ก.ย.",
    urgent: false,
    station: "dtf",
    stepLabel: "พิมพ์ฟิล์ม DTF",
    stepIndex: 2,
    stepTotal: 5,
    state: "ready",
    owner: null,
    qtyDone: 0,
    qtyTotal: 200,
    sizes: scaled(200),
    prints: [{ position: "หลัง", technique: "DTF", size: "เบอร์ 25 ซม.", note: "เบอร์ไม่ซ้ำ — เช็คไฟล์รายตัว" }],
    checklist: CHECK.dtf,
  },
  /* ── รีดร้อน ── */
  {
    id: "j-0061",
    orderNumber: "ORD-2608-0061",
    company: "บริษัท กรีนโลจิสติกส์ จำกัด (มหาชน)",
    title: "โปโลพนักงาน DTF อก + ปักแขน",
    mockup: SLEEVE,
    color: "กรมท่า / ขาว / เทา",
    qty: 240,
    dueInDays: 4,
    dueLabel: "3 ก.ย.",
    urgent: false,
    station: "press",
    stepLabel: "รีดร้อน",
    stepIndex: 4,
    stepTotal: 7,
    state: "doing",
    owner: "บาส",
    qtyDone: 96,
    qtyTotal: 240,
    sizes: scaled(240),
    prints: [DTF_CHEST, { position: "แขนซ้าย", technique: "ปัก (ร้านนอก)", size: "5 × 5 ซม.", note: "ห้ามเอียง" }],
    checklist: CHECK.press,
    note: "รีดได้เฉพาะ 180 ตัวที่เบิกแล้ว — ที่เหลือรอเสื้อไซซ์ L",
    lastAction: { what: "บันทึกยอดรีด 96/240", who: "บาส", at: "29 ส.ค. 16:30" },
  },
  {
    id: "j-0055",
    orderNumber: "ORD-2608-0055",
    company: "งานวิ่ง Bangkok Night Run",
    title: "เสื้อวิ่ง Finisher",
    mockup: FRONT,
    color: "ดำ",
    qty: 360,
    dueInDays: 0,
    dueLabel: "วันนี้",
    urgent: true,
    station: "press",
    stepLabel: "รีดร้อน",
    stepIndex: 3,
    stepTotal: 5,
    state: "ready",
    owner: null,
    qtyDone: 0,
    qtyTotal: 360,
    sizes: scaled(360),
    prints: [DTF_CHEST, DTF_BACK],
    checklist: CHECK.press,
    note: "ลูกค้ามารับเอง 17:00 วันนี้",
  },
  {
    id: "j-0049",
    orderNumber: "ORD-2608-0049",
    company: "ร้านกาแฟ Ban Din",
    title: "เอี๊ยมพนักงาน + โลโก้",
    mockup: FRONT,
    color: "น้ำตาล",
    qty: 90,
    dueInDays: 2,
    dueLabel: "1 ก.ย.",
    urgent: false,
    station: "press",
    stepLabel: "รีดร้อน",
    stepIndex: 3,
    stepTotal: 5,
    state: "ready",
    owner: null,
    qtyDone: 0,
    qtyTotal: 90,
    sizes: [{ size: "Free", qty: 90 }],
    prints: [{ ...DTF_CHEST, note: "ผ้าหนา — เพิ่มเวลารีด 3 วิ" }],
    checklist: CHECK.press,
  },
  /* ── ตรวจของกลับจากร้าน (สถานีที่เพิ่มจากหน้าตั้งค่า) ── */
  {
    id: "j-0048",
    orderNumber: "ORD-2608-0048",
    company: "บริษัท พีทีเอส เอ็นจิเนียริ่ง จำกัด",
    title: "โปโลช่าง ปักอกซ้าย",
    mockup: POLO,
    color: "เทาเข้ม",
    qty: 320,
    dueInDays: 1,
    dueLabel: "31 ส.ค.",
    urgent: false,
    station: "return-qc",
    stepLabel: "ตรวจของกลับจากร้านปัก",
    stepIndex: 3,
    stepTotal: 5,
    state: "ready",
    owner: null,
    qtyDone: 0,
    qtyTotal: 320,
    sizes: scaled(320),
    prints: [{ position: "อกซ้าย", technique: "ปัก (ร้านนอก)", size: "7 × 3 ซม." }],
    checklist: CHECK["return-qc"],
    outsource: { vendor: "ร้านปักพี่หน่อย (บางบอน)", work: "ปักอกซ้าย 320 ตัว", backLabel: "30 ส.ค.", backInDays: 0 },
    lastAction: { what: "รับของกลับจากร้าน 320 ตัว", who: "พี่ก้อย", at: "30 ส.ค. 11:40" },
  },
  /* ── ตรวจคุณภาพ ── */
  {
    id: "j-0039",
    orderNumber: "ORD-2608-0039",
    company: "มหาวิทยาลัยราชภัฏสวนดุสิต",
    title: "เสื้อรับน้อง คณะวิทย์",
    mockup: FRONT,
    color: "ม่วง",
    qty: 400,
    dueInDays: 1,
    dueLabel: "31 ส.ค.",
    urgent: false,
    station: "qc",
    stepLabel: "ตรวจคุณภาพ",
    stepIndex: 4,
    stepTotal: 5,
    state: "doing",
    owner: "ต้น",
    qtyDone: 260,
    qtyTotal: 400,
    sizes: scaled(400),
    prints: [DTF_CHEST, DTF_BACK],
    checklist: CHECK.qc,
    lastAction: { what: "บันทึกผลตรวจ ดี 256 / เสีย 4", who: "ต้น", at: "30 ส.ค. 14:02" },
  },
  {
    id: "j-0044",
    orderNumber: "ORD-2608-0044",
    company: "บริษัท ไทยรุ่งเรืองขนส่ง จำกัด",
    title: "เสื้อยืดพนักงานคลัง",
    mockup: BACK,
    color: "ส้มสะท้อนแสง",
    qty: 500,
    dueInDays: 2,
    dueLabel: "1 ก.ย.",
    urgent: false,
    station: "qc",
    stepLabel: "ตรวจคุณภาพ",
    stepIndex: 4,
    stepTotal: 5,
    state: "ready",
    owner: null,
    qtyDone: 0,
    qtyTotal: 500,
    sizes: scaled(500),
    prints: [DTF_BACK],
    checklist: CHECK.qc,
  },
  /* ── แพ็กสุดท้าย ── */
  {
    id: "j-0037",
    orderNumber: "ORD-2608-0037",
    company: "คลินิกทันตกรรมยิ้มสวย",
    title: "เสื้อยูนิฟอร์มพยาบาล",
    mockup: FRONT,
    color: "ฟ้าอ่อน",
    qty: 150,
    dueInDays: 1,
    dueLabel: "31 ส.ค.",
    urgent: false,
    station: "pack",
    stepLabel: "แพ็กสุดท้าย",
    stepIndex: 5,
    stepTotal: 5,
    state: "ready",
    owner: null,
    qtyDone: 0,
    qtyTotal: 150,
    sizes: scaled(150),
    prints: [DTF_CHEST],
    checklist: CHECK.pack,
    note: "ส่งแบบไม่ระบุผู้ส่ง (blind ship) — ห้ามใส่ใบส่งของเรา",
  },
  /* ── ร้านนอก ── */
  {
    id: "j-0072",
    orderNumber: "ORD-2608-0072",
    company: "แบรนด์ Kidsland Apparel",
    title: "เสื้อเด็ก + ป้ายคอทอ",
    mockup: FRONT,
    color: "ชมพู / ฟ้า",
    qty: 800,
    dueInDays: -1,
    dueLabel: "29 ส.ค.",
    urgent: true,
    station: "outsource",
    stepLabel: "ป้ายคอทอ — ร้านนอก",
    stepIndex: 3,
    stepTotal: 6,
    state: "blocked",
    owner: "พี่ก้อย",
    qtyDone: 0,
    qtyTotal: 800,
    sizes: scaled(800),
    prints: [{ position: "ป้ายคอ", technique: "ป้ายทอ (ร้านนอก)", size: "3 × 2 ซม." }],
    checklist: CHECK.outsource,
    outsource: { vendor: "Labelist ป้ายคอทอ", work: "ป้ายคอทอ 800 ชิ้น", backLabel: "27 ส.ค.", backInDays: -3 },
    problem: { title: "ร้านยังไม่ส่งของ", detail: "นัดรับ 27 ส.ค. ยังไม่ได้ของ — โทรตามแล้ว 2 ครั้ง ร้านบอกพรุ่งนี้", since: "29 ส.ค. 09:10", by: "พี่ก้อย" },
    lastAction: { what: "แจ้งปัญหา “ร้านยังไม่ส่งของ”", who: "พี่ก้อย", at: "29 ส.ค. 09:10" },
  },
  {
    id: "j-0062",
    orderNumber: "ORD-2608-0062",
    company: "บริษัท สยามพรีเมียมฟู้ดส์ จำกัด",
    title: "โปโลตัดเย็บพิเศษ 600 ตัว",
    mockup: POLO,
    color: "เขียวขวด",
    qty: 600,
    dueInDays: 9,
    dueLabel: "8 ก.ย.",
    urgent: false,
    station: "outsource",
    stepLabel: "ตัดเย็บ — ร้านนอก",
    stepIndex: 1,
    stepTotal: 6,
    state: "waiting",
    owner: "พี่ก้อย",
    qtyDone: 0,
    qtyTotal: 600,
    sizes: scaled(600),
    prints: [DTF_CHEST],
    checklist: CHECK.outsource,
    outsource: { vendor: "โรงงานตัดเย็บ SP การ์เมนท์", work: "ตัดเย็บโปโล 600 ตัว", backLabel: "4 ก.ย.", backInDays: 5 },
  },
  {
    id: "j-0064",
    orderNumber: "ORD-2608-0064",
    company: "คอนเสิร์ต Rock Mountain 2026",
    title: "เสื้อคอนเสิร์ต สกรีน 2 สี",
    mockup: BACK,
    color: "ดำ",
    qty: 1_500,
    dueInDays: 7,
    dueLabel: "6 ก.ย.",
    urgent: false,
    station: "outsource",
    stepLabel: "ซิลค์สกรีน — ร้านนอก",
    stepIndex: 2,
    stepTotal: 5,
    state: "waiting",
    owner: "พี่ก้อย",
    qtyDone: 0,
    qtyTotal: 1_500,
    sizes: scaled(1_500),
    prints: [{ position: "หลัง", technique: "ซิลค์สกรีน (ร้านนอก)", size: "30 × 40 ซม." }],
    checklist: CHECK.outsource,
    outsource: { vendor: "ร้านสกรีนบางแค", work: "ซิลค์สกรีน 2 สี 1,500 ตัว", backLabel: "2 ก.ย.", backInDays: 3 },
  },
];

export function jobById(id: string): StationJob | undefined {
  return JOBS.find((j) => j.id === id);
}

function byUrgency(a: StationJob, b: StationJob) {
  if (a.dueInDays !== b.dueInDays) return a.dueInDays - b.dueInDays;
  if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
  return a.orderNumber.localeCompare(b.orderNumber);
}

export type Queue = { doing: StationJob[]; ready: StationJob[]; blocked: StationJob[] };

/** คิวของสถานี — กติกาเดิมของจอสถานี: กำลังทำ → พร้อมทำ → ติดปัญหา/รอ (แยกกลุ่ม ห้ามปนคิวพร้อมทำ) */
export function queueAt(station: StationKey, empty = false): Queue {
  if (empty) return { doing: [], ready: [], blocked: [] };
  const jobs = JOBS.filter((j) => j.station === station).sort(byUrgency);
  return {
    doing: jobs.filter((j) => j.state === "doing"),
    ready: jobs.filter((j) => j.state === "ready"),
    blocked: jobs.filter((j) => j.state === "blocked" || j.state === "waiting"),
  };
}

export function stationCounts(empty = false) {
  return STATIONS.map((station) => {
    const q = queueAt(station.key, empty);
    return { station, doing: q.doing.length, ready: q.ready.length, blocked: q.blocked.length, workers: workersAt(station.key) };
  });
}

/** งานที่หัวหน้าจ่ายให้คนนี้ (ทาง B) — กำลังทำก่อน แล้วค่อยพร้อมทำตามลำดับที่หัวหน้าจัด */
export function assignedTo(worker: Worker, empty = false): StationJob[] {
  if (empty) return [];
  return JOBS.filter((j) => worker.stations.includes(j.station) && (j.state === "doing" || j.state === "ready"))
    .sort((a, b) => (a.state === b.state ? byUrgency(a, b) : a.state === "doing" ? -1 : 1))
    .slice(0, 4);
}

/* ───────────────────────────── กดมั่ว / แจ้งปัญหา / หัวหน้าแก้ให้ ───────────────────────────── */

/** เหตุผลแจ้งปัญหาแบบกดเลือก — ช่างไม่ต้องพิมพ์ (ของจริง: ข้อความไปลง reportStationProblem.reason) */
export const PROBLEM_REASONS = [
  { key: "garment", label: "เสื้อไม่พอ / ไม่ตรง" },
  { key: "defect", label: "เสื้อมีตำหนิ" },
  { key: "file", label: "ฟิล์ม / ไฟล์ไม่ตรงม็อกอัพ" },
  { key: "machine", label: "เครื่องเสีย" },
  { key: "outsource", label: "ของร้านนอกยังไม่มา" },
  { key: "other", label: "อื่น ๆ (พิมพ์บอก)" },
] as const;

export type FixAction = {
  key: string;
  label: string;
  desc: string;
  /** ของจริงเดินผ่านอะไร — บอกเบสว่ามีอยู่แล้วหรือต้องทำเพิ่ม */
  server: string;
  exists: boolean;
  danger?: boolean;
};

/** สิ่งที่หัวหน้าแก้ให้ได้ต่อใบ — เรียงจากที่เจอบ่อยสุด (ช่างกดปิดผิด · นับผิด) */
export const FIX_ACTIONS: readonly FixAction[] = [
  { key: "reopen", label: "ย้อนขั้นกลับ", desc: "ช่างกดปิดผิด — เปิดขั้นนี้กลับเป็นกำลังทำ ยอดที่นับไว้คงเดิม", server: "updateStep (สถานะ)", exists: true },
  { key: "qty", label: "แก้ยอดที่บันทึก", desc: "นับผิดหรือกดเลขผิด — ใส่ยอดที่ถูกแทน", server: "updateStep (ยอด)", exists: true },
  { key: "assign", label: "เปลี่ยนคนทำ", desc: "ย้ายให้คนอื่น หรือปลดชื่อคนที่กดรับงานผิด", server: "assignStep", exists: true },
  { key: "resolve", label: "ปลดปัญหา — แก้แล้ว", desc: "บอกวิธีที่แก้ แล้วให้ช่างทำต่อได้", server: "resolveStationProblem", exists: true },
  { key: "hold", label: "พักงานนี้ไว้ก่อน", desc: "เอาออกจากคิวชั่วคราว ช่างจะไม่เห็นในคิวพร้อมทำ", server: "updateStep (พักไว้)", exists: true },
  { key: "move", label: "ย้ายไปสถานีอื่น / ส่งร้านนอก", desc: "เช่น เครื่อง DTF เสีย → ส่งพิมพ์ร้านนอกแทน", server: "ต้องทำเพิ่ม (V2 assignOperation)", exists: false },
  { key: "skip", label: "ผ่านขั้นนี้แทนช่าง", desc: "ทำแล้วจริงแต่ไม่ได้กดในระบบ — ปิดขั้นให้ พร้อมจดชื่อหัวหน้า", server: "updateStep (เสร็จ)", exists: true, danger: true },
];
