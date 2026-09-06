/**
 * ข้อมูลของหน้าลอง "ใบผลิตเบาลง" — **ปลอมทั้งหมด ไม่ต่อฐานข้อมูล**
 *
 * ใบหลัก = ORD-2609-0009 ในฐานทดลอง (ใบที่เบสเปิดดู 7 ก.ย. แล้วบอก "ยังดูเยอะไปอยู่") — ตัวเลข ชื่อ วันที่ ลอกจากจอจริง
 *   4 ขั้น 2 สาย: ตรวจรับเสื้อลูกค้า (ผ่านแล้ว) · ปักลาย ร้านนอก (ของอยู่ที่ร้าน เลยนัดรับ 3 วัน) → QC → แพ็ก · ส่งลูกค้าเลยกำหนด 1 วัน
 * ใบซับซ้อน = ORD-2608-0061 โปโล 7 ขั้น 4 สาย (ชุดเดียวกับ /proto/work-order-redesign ที่เคาะ E) — ไว้ดูว่าทางที่เบาลงยังรับ "ทางขนาน" ได้ไหม
 * วันนี้ = 7 ก.ย. 2569 (ใบหลัก) · 30 ส.ค. 2569 (ใบซับซ้อน — ตรึงไว้เหมือนหน้าลองเดิม)
 */

import { ITEMS as POLO_ITEMS, STEPS as POLO_STEPS, WORK_ORDER as POLO, type WorkStep } from "../work-order/_data";

export type Variant = "now" | "cut" | "one" | "head";

export const OPTIONS = [
  { value: "now", label: "ปัจจุบัน · E ที่ลงเมื่อวาน" },
  { value: "cut", label: "A · ตัดของซ้ำ" },
  { value: "one", label: "B · ใบเดียว แผนที่เป็นแท็บ" },
  { value: "head", label: "C · พาดหัวก่อน" },
] as const;

export const VALUES = OPTIONS.map((o) => o.value) as readonly Variant[];

/* ───────────────────────── โครงข้อมูล ───────────────────────── */

export type Lane = "shirt" | "film" | "out-emb" | "out-label" | "main";

/** ป้ายสายตามที่ของจริงใช้ (lib/production-steps LANE_LABELS) */
export const LANE_LABEL: Record<Lane, string> = {
  shirt: "เตรียมเสื้อ",
  film: "ฟิล์ม DTF",
  "out-emb": "ปัก",
  "out-label": "ป้ายคอ",
  main: "รวมกัน",
};
export const LANE_ORDER: Lane[] = ["shirt", "film", "out-emb", "out-label"];
export const OUTSOURCE_LANES = new Set<Lane>(["out-emb", "out-label"]);

export type RecordMode = "screen" | "paper" | "auto";
export const RECORD_MODE_LABEL: Record<RecordMode, string> = { screen: "จดในระบบ", paper: "จดบนกระดาษ", auto: "ผ่านเอง" };

export type LeanStep = WorkStep & {
  /** ชื่อสั้นสำหรับแผนที่/แถบ — ชื่อเต็มอยู่ในการ์ด */
  short: string;
  lane: Lane;
  /** ขั้นที่ต้องปิดก่อน (id) — ใช้วาดเส้นบรรจบและบรรทัด "รอ X + Y" */
  waits: string[];
  mode: RecordMode;
  /** ป้ายสถานีตามที่ของจริงคำนวณ — null = lane:OTHER ของจริงไม่โชว์ */
  station: string | null;
};

export type LeanItem = {
  product: string;
  qty: number;
  sizes: { size: string; qty: number }[];
  mockup: string | null;
  prints: { position: string; technique: string; size: string }[];
};

export type LeanOrder = {
  key: "simple" | "complex";
  today: string;
  orderNumber: string;
  customer: string;
  status: string;
  priority: "URGENT" | "HIGH" | null;
  qty: number;
  dueLabel: string;
  dueInDays: number;
  mockupVersion: number | null;
  mockupApprovedBy: string;
  productionStatus: string;
  /** ที่มาของเสื้อ — สิ่งที่ MaterialUsage ของจริงบอก (ลูกค้าส่งมา / เบิกสต๊อก กี่ตัว ขาดอะไร) */
  garment: string;
  routing: string;
  openedOn: string;
  note: string | null;
  /** ม็อกอัพทุกเวอร์ชัน — เคยอยู่ในกล่องพับ "ประวัติ" */
  mockups: { version: number; on: string; by: string; approved: boolean }[];
  items: LeanItem[];
  steps: LeanStep[];
};

/* ───────────────────────── ใบหลัก — ORD-2609-0009 (ลอกจากจอจริง 7 ก.ย.) ───────────────────────── */

const SIMPLE_STEPS: LeanStep[] = [
  {
    id: "o1",
    order: 1,
    label: "ตรวจรับเสื้อลูกค้า",
    short: "ตรวจรับเสื้อ",
    kind: "inhouse",
    lane: "shirt",
    state: "done",
    action: "บันทึกตรวจรับเสื้อลูกค้า",
    owner: "พี่ก้อย · หัวหน้าผลิต",
    qtyDone: 30,
    qtyTotal: 30,
    startedAt: "31 ส.ค. 2569 01:10",
    completedAt: "31 ส.ค. 2569 01:25",
    planEnd: "31 ส.ค.",
    waits: [],
    mode: "screen",
    station: "เตรียมเสื้อ",
    checklist: [
      { label: "นับจำนวนต่อไซซ์/สี ตรงกับที่ลูกค้าแจ้ง บันทึกส่วนต่างในใบตรวจรับ", done: true },
      { label: "ตรวจสภาพเสื้อ (คราบ · ตำหนิ · ป้ายแบรนด์) ถ่ายรูปถ้าผิดปกติ", done: true },
      { label: "แยกกองตามไซซ์ ติดป้ายกองพร้อมเลขออเดอร์", done: true },
    ],
  },
  {
    id: "o2",
    order: 2,
    label: "ปักลาย (ร้านนอก)",
    short: "ปักลาย",
    kind: "outsource",
    lane: "out-emb",
    state: "waiting",
    action: "รับของกลับ + ตรวจรับ",
    owner: "พี่ก้อย · หัวหน้าผลิต",
    qtyDone: 0,
    qtyTotal: 30,
    startedAt: "31 ส.ค. 2569 01:33",
    completedAt: null,
    planEnd: "4 ก.ย.",
    waits: [],
    mode: "screen",
    station: "ร้านนอก",
    checklist: [
      { label: "ส่งไฟล์ปัก + ตัวอย่างสีด้าย", done: true },
      { label: "ระบุจำนวนต่อไซซ์ในใบส่งร้าน", done: true },
      { label: "ตรวจรับ: นับครบ + ปักไม่เอียง ด้ายไม่หลุด", done: false },
    ],
    outsource: {
      vendor: "โรงปักศรีนครินทร์",
      work: "ปักโลโก้อกซ้าย 1 ตำแหน่ง",
      sentOn: "31 ส.ค. 2569",
      backLabel: "4 ก.ย. 2569",
      backInDays: -3,
      status: "กำลังทำ",
    },
    note: "ร้านแจ้งเครื่องปักเสีย กำลังเร่งส่งกลับ",
  },
  {
    id: "o3",
    order: 3,
    label: "ตรวจคุณภาพขั้นสุดท้าย",
    short: "ตรวจ QC",
    kind: "qc",
    lane: "main",
    state: "todo",
    action: "บันทึกผลตรวจ",
    owner: null,
    qtyDone: 0,
    qtyTotal: 30,
    startedAt: null,
    completedAt: null,
    planEnd: "5 ก.ย.",
    waits: ["o1", "o2"],
    mode: "paper",
    station: null,
    checklist: [
      { label: "นับจำนวนต่อไซซ์ตรงใบสั่ง", done: false },
      { label: "ตรวจตำแหน่ง/สี/รอยปัก ทุกตัว", done: false },
      { label: "ถ่ายรูปของเสีย + ระบุสาเหตุ", done: false },
    ],
  },
  {
    id: "o4",
    order: 4,
    label: "แพ็กขั้นสุดท้าย",
    short: "แพ็ก",
    kind: "pack",
    lane: "main",
    state: "todo",
    action: "แพ็กและปิดใบ",
    owner: null,
    qtyDone: 0,
    qtyTotal: 30,
    startedAt: null,
    completedAt: null,
    planEnd: "6 ก.ย.",
    waits: ["o2", "o3"],
    mode: "paper",
    station: null,
    checklist: [
      { label: "พับ + ถุงรายตัว ติดสติกเกอร์ไซซ์", done: false },
      { label: "แยกลังตามสี/ไซซ์ ใบแพ็กติดข้างลัง", done: false },
    ],
  },
];

export const SIMPLE: LeanOrder = {
  key: "simple",
  today: "7 ก.ย. 2569",
  orderNumber: "ORD-2609-0009",
  customer: "คุณแพรว",
  status: "กำลังผลิต",
  priority: "URGENT",
  qty: 30,
  dueLabel: "6 ก.ย. 2569",
  dueInDays: -1,
  mockupVersion: 1,
  mockupApprovedBy: "คุณแพรว",
  productionStatus: "IN_PROGRESS",
  garment: "ลูกค้าส่งเสื้อมาเอง 30 ตัว — ตรวจรับแล้ว 31 ส.ค. 2569",
  routing: "ปักลายร้านนอก (เสื้อลูกค้า)",
  openedOn: "31 ส.ค. 2569",
  note: null,
  mockups: [{ version: 1, on: "30 ส.ค. 2569", by: "คุณแพรว", approved: true }],
  items: [
    {
      product: "เสื้อยืด Cotton 100% สีกรม",
      qty: 30,
      sizes: [
        { size: "L กรม", qty: 11 },
        { size: "M กรม", qty: 12 },
        { size: "S กรม", qty: 7 },
      ],
      mockup: "/demo-mockups/front.svg",
      prints: [{ position: "อกซ้าย", technique: "ปัก", size: "โลโก้ 1 ตำแหน่ง" }],
    },
  ],
  steps: SIMPLE_STEPS,
};

/* ───────────────────────── ใบซับซ้อน — โปโล 7 ขั้น 4 สาย (ชุดเดิมของ E) ───────────────────────── */

const POLO_META: Record<string, Pick<LeanStep, "short" | "lane" | "waits" | "mode" | "station">> = {
  s1: { short: "เตรียมเสื้อ", lane: "shirt", waits: [], mode: "screen", station: "เตรียมเสื้อ" },
  s2: { short: "พิมพ์ฟิล์ม", lane: "film", waits: [], mode: "auto", station: "พิมพ์ DTF / รีดร้อน" },
  s3: { short: "ปักแขน", lane: "out-emb", waits: [], mode: "screen", station: "ร้านนอก" },
  s4: { short: "รีดร้อน", lane: "main", waits: ["s1", "s2"], mode: "paper", station: "พิมพ์ DTF / รีดร้อน" },
  s5: { short: "ป้ายคอ", lane: "out-label", waits: [], mode: "screen", station: "ร้านนอก" },
  s6: { short: "ตรวจ QC", lane: "main", waits: ["s4", "s3", "s5"], mode: "paper", station: null },
  s7: { short: "แพ็ก", lane: "main", waits: ["s6"], mode: "paper", station: null },
};

export const COMPLEX: LeanOrder = {
  key: "complex",
  today: "30 ส.ค. 2569",
  orderNumber: POLO.orderNumber,
  customer: `${POLO.company} · ${POLO.contact}`,
  status: POLO.status,
  priority: "HIGH",
  qty: POLO.qty,
  dueLabel: `${POLO.dueLabel} 2569`,
  dueInDays: POLO.dueInDays,
  mockupVersion: 3,
  mockupApprovedBy: POLO.approvedMockup.by,
  productionStatus: "IN_PROGRESS",
  garment: `เบิกจากสต๊อก Anajak ${POLO.garment.issued}/${POLO.garment.needed} ตัว — ${POLO.garment.missingDetail}`,
  routing: POLO.routingName,
  openedOn: "26 ส.ค. 2569",
  note: POLO.note,
  mockups: [
    { version: 1, on: "18 ส.ค.", by: POLO.approvedMockup.by, approved: false },
    { version: 2, on: "20 ส.ค.", by: POLO.approvedMockup.by, approved: false },
    { version: 3, on: POLO.approvedMockup.approvedOn, by: POLO.approvedMockup.by, approved: true },
  ],
  items: POLO_ITEMS.map((it) => ({
    product: `${it.product} สี${it.color}`,
    qty: it.sizes.reduce((s, v) => s + v.qty, 0),
    sizes: it.sizes,
    mockup: it.mockup,
    prints: it.prints.map((p) => ({ position: p.position, technique: p.technique, size: p.size })),
  })),
  steps: POLO_STEPS.map((s) => ({ ...s, ...(POLO_META[s.id] ?? { short: s.label, lane: "main" as Lane, waits: [], mode: "paper" as RecordMode, station: null }) })),
};

export function orderFor(complex: boolean): LeanOrder {
  return complex ? COMPLEX : SIMPLE;
}

/* ───────────────────────── กติกา "ตอนนี้" — วาดตามของจริง ไม่ได้คิดใหม่ ───────────────────────── */

export const isDone = (s: LeanStep) => s.state === "done";
export const problemSteps = (steps: LeanStep[]) => steps.filter((s) => s.state === "blocked");
/** ขั้นที่ลงมือได้ตอนนี้ — ของจริงนับขั้นที่ของอยู่ที่ร้านเป็น "ทำได้" ด้วย (ปุ่มหลักว่าง โน้ต "อยู่ที่ร้านนอก") */
export const doableSteps = (steps: LeanStep[]) => steps.filter((s) => s.state === "active" || s.state === "waiting");
export const upcomingSteps = (steps: LeanStep[]) => steps.filter((s) => s.state === "todo");
export const nowSteps = (steps: LeanStep[]) => [...problemSteps(steps), ...doableSteps(steps)];

export function byId(id: string, steps: LeanStep[]) {
  return steps.find((s) => s.id === id);
}

/** ขั้นก่อนหน้าที่ยังไม่ปิด — ของจริง routeWaitingOn */
export function pendingOf(step: LeanStep, steps: LeanStep[]): LeanStep[] {
  return step.waits.map((id) => byId(id, steps)).filter((s): s is LeanStep => !!s && !isDone(s));
}

function waitsThrough(z: LeanStep, x: LeanStep, steps: LeanStep[]): boolean {
  return z.waits.some((id) => id === x.id || (byId(id, steps) ? waitsThrough(byId(id, steps)!, x, steps) : false));
}

/** เส้นที่ต้องวาดเข้าขั้นนี้ — ตัดขั้นที่วิ่งผ่านขั้นอื่นอยู่แล้ว (แพ็กรอ QC ที่รอปักอยู่แล้ว ไม่ต้องลากเส้นจากปักซ้ำ) */
export function directWaits(step: LeanStep, steps: LeanStep[]): LeanStep[] {
  const all = step.waits.map((id) => byId(id, steps)).filter((s): s is LeanStep => !!s);
  return all.filter((x) => !all.some((z) => z.id !== x.id && waitsThrough(z, x, steps)));
}

export function defaultFocus(steps: LeanStep[]): LeanStep {
  return problemSteps(steps)[0] ?? doableSteps(steps)[0] ?? upcomingSteps(steps)[0] ?? steps[steps.length - 1]!;
}

/** รายชื่อที่รอ — ตัดที่ 2 ชื่อแล้วนับที่เหลือ (ของจริง shortWaitList) */
export function shortWaitList(names: string[]): string {
  if (names.length <= 2) return names.join(" + ");
  return `${names.slice(0, 2).join(" + ")} และอีก ${names.length - 2} ขั้น`;
}

/** ประโยคกำหนดส่ง — ภาษาคน ไม่ใช่ป้าย */
export function dueSentence(order: LeanOrder): string {
  if (order.dueInDays < 0) return `ส่งลูกค้าเลยกำหนดแล้ว ${-order.dueInDays} วัน (${order.dueLabel})`;
  if (order.dueInDays === 0) return "ต้องส่งลูกค้าวันนี้";
  if (order.dueInDays === 1) return `ส่งลูกค้าพรุ่งนี้ (${order.dueLabel})`;
  return `ส่งลูกค้า ${order.dueLabel} (อีก ${order.dueInDays} วัน)`;
}

/**
 * C · พาดหัว — ประโยคเดียวตอบ "งานอยู่ไหน ต้องทำอะไร" คิดจากลำดับ: ติดปัญหา → ของอยู่ที่ร้าน → กำลังทำ → ครบ
 * ถ้าจะลงจริงต้องเขียนกติกานี้ให้ครบทุกสถานะ (นี่คือข้อแลกของ C)
 */
export function headlineOf(order: LeanOrder): { title: string; sub: string; step: LeanStep | null } {
  const { steps } = order;
  const problems = problemSteps(steps);
  const doable = doableSteps(steps);
  const due = dueSentence(order);
  if (problems.length > 0) {
    const first = problems[0]!;
    const title =
      problems.length === 1 ? `ติดปัญหา — ${first.problem?.title ?? first.label}` : `ติดปัญหา ${problems.length} สาย — ${problems.map((p) => p.problem?.title ?? p.short).join(" · ")}`;
    return { title, sub: doable.length > 0 ? `${due} · อีก ${doable.length} สายยังเดินได้` : due, step: first };
  }
  if (doable.length > 0) {
    const s = doable[0]!;
    if (s.outsource) {
      const o = s.outsource;
      const title = o.backInDays < 0 ? `ของอยู่ที่${o.vendor} — เลยนัด ${-o.backInDays} วัน` : `ของอยู่ที่${o.vendor} — นัดรับ ${o.backLabel}`;
      return { title, sub: s.note ? `${due} · ${s.note}` : due, step: s };
    }
    return { title: `กำลัง${s.short} — ${s.owner ?? "ยังไม่มีคนรับ"} ทำแล้ว ${s.qtyDone}/${s.qtyTotal}`, sub: due, step: s };
  }
  if (steps.every(isDone)) return { title: "ครบทุกขั้นแล้ว — พร้อมส่ง", sub: due, step: null };
  return { title: "ยังไม่มีอะไรให้ทำตอนนี้ — ทุกสายกำลังรอกัน", sub: due, step: null };
}

/* ───────────────────────── ตัวเลขก่อนตัดสิน — นับจากโครง ไม่ใช่ความเห็น ───────────────────────── */

/**
 * boxes = กล่อง/การ์ดที่มีขอบของตัวเองที่เห็นทันที · duplicates = ข้อมูลเดิมที่โชว์ซ้ำเกิน 1 ที่ (นับจากใบหลัก)
 * jargon = ศัพท์ภายในที่เห็นทันที · clicks = กดกี่ครั้งถึงเห็นครบทั้งใบ (งานที่ทำได้ทุกสาย + ลาย + ข้อมูลใบ + ประวัติ)
 * เบส (09-07 ค่ำ) "ไม่ชอบการหุบพับ" → A/B/C ไม่มีกล่องพับ: ปัจจุบันต้องกด 3 ครั้งเปิดกล่องพับ · B ต้องกดสลับขั้นเพิ่มตามจำนวนสาย
 */
export function decisionNumbers(variant: Variant, order: LeanOrder) {
  const now = nowSteps(order.steps).length;
  const up = upcomingSteps(order.steps).length > 0 ? 1 : 0;
  const modes = new Set(doableSteps(order.steps).map((s) => s.mode)).size + new Set(problemSteps(order.steps).map((s) => s.mode)).size;
  if (variant === "now") return { boxes: 4 + 1 + 1 + now + up + 3, duplicates: 8, jargon: 1 + Math.max(1, modes), clicks: 3 };
  if (variant === "cut") return { boxes: 1 + now + 1, duplicates: 0, jargon: 0, clicks: 0 };
  if (variant === "one") return { boxes: 1, duplicates: 0, jargon: 0, clicks: Math.max(0, now - 1) };
  return { boxes: 2, duplicates: 0, jargon: 0, clicks: 0 };
}
