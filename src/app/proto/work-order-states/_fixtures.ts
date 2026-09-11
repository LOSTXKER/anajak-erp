/**
 * หน้าลอง "ใบผลิตทุกสถานะ" — ข้อมูลปลอมรูปเดียวกับ production.getById ต่อสถานะ (เบสสั่ง 2026-09-09)
 * ตัวหน้าใช้ WorkOrderView ของจริง — ที่นี่มีแค่ "ใบผลิตหน้าตาไหนในสถานะนั้น" ไม่มี UI
 * pure data — ไม่มี DOM · ตรึงนาฬิกาตัวอย่างให้ server/browser แสดงวันเวลาเดียวกัน
 */
import type { ProductionDetail, ProductionStep } from "@/components/production/types";
import { stationProblemNotes } from "@/lib/production-problem";
import { workOrderStandards } from "@/lib/work-order-standards";
import { CASE_4 } from "../work-order-form/_data";

const DAY_MS = 24 * 60 * 60 * 1_000;
export const FIXTURE_NOW = Date.parse("2026-09-11T09:00:00+07:00");
const fromNow = (days: number, hours = 0) => new Date(FIXTURE_NOW + days * DAY_MS + hours * 60 * 60 * 1_000);

export const ART =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><rect width="640" height="480" fill="#f4f4f5"/><circle cx="320" cy="210" r="112" fill="#2563eb"/><path d="M252 218h136v32H252z" fill="white"/><text x="320" y="390" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#18181b">ANAJAK DEMO</text></svg>',
  );

export const USERS = {
  boss: { id: "u-boss", name: "พี่ก้อย" },
  staff: { id: "u-staff", name: "บาส" },
  other: { id: "u-other", name: "เนส" },
} as const;

export type Role = "boss" | "staff";

const VARIANTS = [
  { id: "v-s", size: "S", quantity: 15 },
  { id: "v-m", size: "M", quantity: 24 },
  { id: "v-l", size: "L", quantity: 21 },
] as const;
export const QUANTITY = 60;

export function makeOrder(input: { internalStatus?: "PRODUCING" | "QUALITY_CHECK"; printType?: "DTF" | "EMBROIDERY"; approvedVersion?: number; deadlineInDays?: number; priority?: "NORMAL" | "HIGH" | "URGENT" }) {
  const printType = input.printType ?? "DTF";
  return {
    id: "proto-order",
    orderNumber: "ORD-2609-0031",
    internalStatus: input.internalStatus ?? "PRODUCING",
    priority: input.priority ?? "NORMAL",
    deadline: fromNow(input.deadlineInDays ?? 5, 10),
    customer: { id: "c1", name: "บริษัท นอร์ทสตาร์ รีเทล จำกัด" },
    notes: null,
    designs: [{ id: "d2", versionNumber: input.approvedVersion ?? 2, fileUrl: ART, thumbnailUrl: ART, approvedAt: fromNow(-3) }],
    items: [
      {
        id: "it1",
        totalQuantity: QUANTITY,
        prints: [{ id: "p1", position: printType === "EMBROIDERY" ? "SLEEVE_L" : "FRONT", printType, printSize: "A4", width: 20, height: 25, colorCount: 4, designNote: null, designImageUrl: ART, artwork: null }],
        products: [
          {
            id: "pr1",
            productType: "T_SHIRT",
            description: "เสื้อยืด Cotton 100% สีขาว",
            itemSource: "CUSTOMER_PROVIDED",
            fabricColor: "ขาว",
            totalQuantity: QUANTITY,
            variants: VARIANTS.map((v) => ({ id: v.id, size: v.size, color: "ขาว", quantity: v.quantity })),
          },
        ],
      },
    ],
  } as unknown as ProductionDetail["order"];
}

type StepInput = Partial<Omit<ProductionStep, "stepType">> & { stepType: ProductionStep["stepType"]; key: string };

export function makeStep(input: StepInput): ProductionStep {
  const { key, ...rest } = input;
  return {
    id: `s-${key}`,
    productionId: "proto-prod",
    customStepName: null,
    status: "PENDING",
    sortOrder: 10,
    qtyDone: 0,
    qtyTotal: QUANTITY,
    startedAt: null,
    completedAt: null,
    qcPassed: null,
    qcNotes: null,
    notes: null,
    pairWithPrevious: false,
    checks: [],
    quantities: [],
    assignedTo: null,
    outsourceOrders: [],
    printRunItems: [],
    ...rest,
  } as unknown as ProductionStep;
}

/** ผลติ๊ก n ข้อแรกของขั้นชนิดนั้น */
export function ticks(stepType: string, n: number, who: { id: string; name: string } = USERS.staff) {
  return workOrderStandards(stepType)
    .slice(0, n)
    .map((item, i) => ({ itemKey: item, checkedAt: fromNow(0, -3 + i), checkedBy: who }));
}

/** ยอดต่อแถวไซซ์ S/M/L ที่จดไว้ */
export function rows(done: [number, number, number], waste: [number, number, number] = [0, 0, 0]) {
  return VARIANTS.map((v, i) => ({ id: `q-${v.id}`, sourceOrderItemVariantId: v.id, qtyPlanned: v.quantity, qtyGood: done[i], qtyScrap: waste[i] }));
}

export function outsource(input: { status: "SENT" | "IN_PROGRESS" | "RECEIVED_BACK"; sentDaysAgo: number; backInDays: number | null }) {
  return [
    {
      id: "os-1",
      status: input.status,
      description: "ปักโลโก้แขนซ้าย 1 ตำแหน่ง",
      quantity: QUANTITY,
      sentAt: fromNow(-input.sentDaysAgo),
      expectedBackAt: input.backInDays === null ? null : fromNow(input.backInDays),
      receivedAt: input.status === "RECEIVED_BACK" ? fromNow(0, -1) : null,
      qcPassed: null,
      qcNotes: null,
      notes: null,
      createdAt: fromNow(-input.sentDaysAgo, -2),
      vendor: { id: "vd-1", name: "โรงปักศรีนครินทร์" },
    },
  ];
}

const QC = (sortOrder: number, status: ProductionStep["status"] = "PENDING") =>
  makeStep({ key: "qc", stepType: "CUSTOM", customStepName: "ตรวจคุณภาพขั้นสุดท้าย", sortOrder, status, qtyDone: status === "COMPLETED" ? QUANTITY : 0, completedAt: status === "COMPLETED" ? fromNow(0, -1) : null, assignedTo: status === "COMPLETED" ? USERS.boss : null });

export type StateFixture = {
  key: string;
  /** ชื่อที่โชว์ในแถบซ้าย */
  title: string;
  group: string;
  order: ProductionDetail["order"];
  steps: ProductionStep[];
  productionStatus?: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  /** ขอบ: ข้อมูลเก่า/หาไม่เจอ/กำลังโหลด/กระดาษเก่า */
  flags?: { stale?: boolean; notFound?: boolean; loading?: boolean; scannedMockup?: number };
};

const press = (over: Partial<StepInput> = {}) => makeStep({ key: "press", stepType: "HEAT_PRESS", sortOrder: 10, ...over });

export const STATES: StateFixture[] = [
  // ── ขั้นทำเอง ──
  { key: "start", title: "รอเริ่มขั้นแรก", group: "ขั้นทำเอง", order: makeOrder({}), steps: [press(), QC(20)] },
  {
    key: "doing",
    title: "กำลังทำ — ติ๊ก 1/3 ยอด 20/60",
    group: "ขั้นทำเอง",
    order: makeOrder({}),
    steps: [press({ status: "IN_PROGRESS", startedAt: fromNow(0, -2), assignedTo: USERS.staff, qtyDone: 20, checks: ticks("HEAT_PRESS", 1), quantities: rows([15, 5, 0]) }), QC(20)],
  },
  {
    key: "ready-close",
    title: "ติ๊กครบ ยอดครบ — พร้อมปิดขั้น",
    group: "ขั้นทำเอง",
    order: makeOrder({ deadlineInDays: 2, priority: "HIGH" }),
    steps: [press({ status: "IN_PROGRESS", startedAt: fromNow(0, -5), assignedTo: USERS.staff, qtyDone: 60, checks: ticks("HEAT_PRESS", 3), quantities: rows([15, 24, 21], [0, 1, 0]) }), QC(20)],
  },
  {
    key: "qty-partial",
    title: "ติ๊กครบ — ยอดยังไม่ครบ",
    group: "ขั้นทำเอง",
    order: makeOrder({}),
    steps: [press({ status: "IN_PROGRESS", startedAt: fromNow(0, -4), assignedTo: USERS.staff, qtyDone: 39, checks: ticks("HEAT_PRESS", 3), quantities: rows([15, 24, 0]) }), QC(20)],
  },
  {
    key: "hold",
    title: "พักไว้",
    group: "ขั้นทำเอง",
    order: makeOrder({}),
    steps: [press({ status: "ON_HOLD", startedAt: fromNow(-1), assignedTo: USERS.staff, qtyDone: 10, checks: ticks("HEAT_PRESS", 1), quantities: rows([10, 0, 0]) }), QC(20)],
  },
  {
    key: "problem",
    title: "ติดปัญหา — รอหัวหน้า",
    group: "ขั้นทำเอง",
    order: makeOrder({ deadlineInDays: 1, priority: "URGENT" }),
    steps: [press({ status: "FAILED", startedAt: fromNow(-1), assignedTo: USERS.staff, qtyDone: 12, checks: ticks("HEAT_PRESS", 2), quantities: rows([12, 0, 0]), notes: stationProblemNotes(null, "ฟิล์มลอกหลังรีด 3 ตัว สงสัยอุณหภูมิเครื่องเพี้ยน") }), QC(20)],
  },
  {
    key: "reopen",
    title: "ปิดขั้นแรกแล้ว — ย้อนกลับได้",
    group: "ขั้นทำเอง",
    order: makeOrder({}),
    steps: [press({ status: "COMPLETED", startedAt: fromNow(-1), completedAt: fromNow(0, -2), assignedTo: USERS.staff, qtyDone: 60, checks: ticks("HEAT_PRESS", 3), quantities: rows([15, 24, 21]) }), makeStep({ key: "tag", stepType: "CUSTOM", customStepName: "ติดป้ายแขวน", sortOrder: 20 }), QC(30)],
  },
  {
    key: "other-owner",
    title: "งานของคนอื่น (มองเป็นช่าง)",
    group: "ขั้นทำเอง",
    order: makeOrder({}),
    steps: [press({ status: "IN_PROGRESS", startedAt: fromNow(0, -2), assignedTo: USERS.other, qtyDone: 8, checks: ticks("HEAT_PRESS", 1, USERS.other), quantities: rows([8, 0, 0]) }), QC(20)],
  },
  // ── เสื้อ / ฟิล์ม ──
  {
    key: "receive",
    title: "รับเสื้อลูกค้า (ใบตรวจรับ)",
    group: "เสื้อ · ฟิล์ม",
    order: makeOrder({}),
    steps: [makeStep({ key: "recv", stepType: "GARMENT_RECEIVE", sortOrder: 10 }), press({ sortOrder: 20 }), QC(30)],
  },
  {
    key: "dtf-run",
    title: "อยู่ในรอบพิมพ์ DTF",
    group: "เสื้อ · ฟิล์ม",
    order: makeOrder({}),
    steps: [
      makeStep({ key: "dtf", stepType: "DTF_PRINT", sortOrder: 10, status: "IN_PROGRESS", startedAt: fromNow(0, -3), assignedTo: USERS.staff, printRunItems: [{ printRun: { runNumber: "PR-2609-0007", status: "PRINTING" } }] as never }),
      press({ sortOrder: 20 }),
      QC(30),
    ],
  },
  // ── ร้านนอก ──
  {
    key: "outsource-send",
    title: "รอส่งร้านนอก",
    group: "ร้านนอก",
    order: makeOrder({ printType: "EMBROIDERY", deadlineInDays: 9 }),
    steps: [makeStep({ key: "emb", stepType: "EMBROIDERY", sortOrder: 10 }), QC(20)],
  },
  {
    key: "outsource-shop",
    title: "ของอยู่ร้าน — นัดรับอีก 3 วัน",
    group: "ร้านนอก",
    order: makeOrder({ printType: "EMBROIDERY", deadlineInDays: 9 }),
    steps: [makeStep({ key: "emb", stepType: "EMBROIDERY", sortOrder: 10, status: "IN_PROGRESS", startedAt: fromNow(-2), assignedTo: USERS.boss, outsourceOrders: outsource({ status: "SENT", sentDaysAgo: 2, backInDays: 3 }) as never }), QC(20)],
  },
  {
    key: "outsource-overdue",
    title: "ของอยู่ร้าน — เลยนัดรับ 2 วัน",
    group: "ร้านนอก",
    order: makeOrder({ printType: "EMBROIDERY", deadlineInDays: 1, priority: "URGENT" }),
    steps: [makeStep({ key: "emb", stepType: "EMBROIDERY", sortOrder: 10, status: "IN_PROGRESS", startedAt: fromNow(-6), assignedTo: USERS.boss, outsourceOrders: outsource({ status: "IN_PROGRESS", sentDaysAgo: 6, backInDays: -2 }) as never }), QC(20)],
  },
  {
    key: "pair",
    title: "ช่องคู่ — พับป้าย + ปักแขน",
    group: "ร้านนอก",
    order: makeOrder({ printType: "EMBROIDERY", deadlineInDays: 8 }),
    steps: [
      makeStep({ key: "prep", stepType: "CUSTOM", customStepName: "เตรียมเสื้อ", sortOrder: 10, status: "COMPLETED", startedAt: fromNow(-2), completedAt: fromNow(-1), assignedTo: USERS.staff, qtyDone: 60, checks: ticks("CUSTOM", 2) }),
      makeStep({ key: "fold", stepType: "CUSTOM", customStepName: "พับ + ติดป้ายไซซ์", sortOrder: 20, status: "IN_PROGRESS", startedAt: fromNow(0, -3), assignedTo: USERS.staff, qtyDone: 24, checks: ticks("CUSTOM", 1), quantities: rows([15, 9, 0]) }),
      makeStep({ key: "emb", stepType: "EMBROIDERY", sortOrder: 30, pairWithPrevious: true, status: "IN_PROGRESS", startedAt: fromNow(-1), assignedTo: USERS.boss, outsourceOrders: outsource({ status: "SENT", sentDaysAgo: 1, backInDays: 4 }) as never }),
      QC(40),
    ],
  },
  // ── ปลายทาง ──
  {
    key: "all-done",
    title: "ครบทุกขั้น — รอส่งเข้า QC",
    group: "ปลายทาง",
    order: makeOrder({ deadlineInDays: 2, priority: "HIGH" }),
    steps: [press({ status: "COMPLETED", startedAt: fromNow(-1), completedAt: fromNow(0, -4), assignedTo: USERS.staff, qtyDone: 60, checks: ticks("HEAT_PRESS", 3), quantities: rows([15, 24, 21]) }), QC(20, "COMPLETED")],
  },
  {
    key: "in-qc",
    title: "ส่งเข้า QC แล้ว (อ่านอย่างเดียว)",
    group: "ปลายทาง",
    order: makeOrder({ internalStatus: "QUALITY_CHECK", deadlineInDays: 1 }),
    productionStatus: "COMPLETED",
    steps: [press({ status: "COMPLETED", startedAt: fromNow(-2), completedAt: fromNow(-1), assignedTo: USERS.staff, qtyDone: 60, checks: ticks("HEAT_PRESS", 3), quantities: rows([15, 24, 21]) }), QC(20, "COMPLETED")],
  },
  // ── ขอบ ──
  {
    key: "old-paper",
    title: "สแกนใบสั่งงานฉบับเก่า",
    group: "กรณีขอบ",
    order: makeOrder({}),
    steps: [press({ status: "IN_PROGRESS", startedAt: fromNow(0, -2), assignedTo: USERS.staff, checks: ticks("HEAT_PRESS", 1) }), QC(20)],
    flags: { scannedMockup: 1 },
  },
  {
    key: "stale",
    title: "ข้อมูลล่าสุดโหลดไม่สำเร็จ",
    group: "กรณีขอบ",
    order: makeOrder({}),
    steps: [press({ status: "IN_PROGRESS", startedAt: fromNow(0, -2), assignedTo: USERS.staff }), QC(20)],
    flags: { stale: true },
  },
  { key: "empty", title: "ใบไม่มีขั้นตอน", group: "กรณีขอบ", order: makeOrder({}), steps: [] },
  { key: "loading", title: "กำลังโหลด", group: "กรณีขอบ", order: makeOrder({}), steps: [], flags: { loading: true } },
  { key: "not-found", title: "หาใบไม่เจอ", group: "กรณีขอบ", order: makeOrder({}), steps: [], flags: { notFound: true } },
];

export const STATE_KEYS = STATES.map((s) => s.key);
export const DEFAULT_STATE = "start";
export function stateOf(key: string) {
  return STATES.find((s) => s.key === key) ?? STATES[0]!;
}

/** รายการสินค้าสำหรับแท็บสินค้า — รูปเดียวกับ order.getById.items (ชุดจากหน้าลองรอบก่อน) */
export const ORDER_ITEMS = CASE_4.orderItems;
