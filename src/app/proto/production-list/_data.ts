/**
 * ข้อมูลตัวอย่างของหน้าลอง "ควบคุมการผลิต" — **ปลอมทั้งหมด ไม่ต่อฐานข้อมูล**
 *
 * กติกาที่ยึด (สกิล /proto ข้อ "เอาของมาให้ครบ"):
 *  · ไม่ประดิษฐ์ view model ใหม่ — ป้อนออเดอร์ปลอมเข้า `buildProductionBoard()` **ตัวจริง**
 *    แล้วให้ทุกแบบอ่านจาก board ก้อนเดียวกัน · ตัวเลขบนการ์ดกรอง ป้ายสายงาน เหตุผล
 *    "ต้องทำต่อ" และลำดับการเรียง จึงเดินผ่านสูตรเดียวกับหน้าจริงทุกบรรทัด
 *  · ชื่อลูกค้า/บริษัท/จำนวน ยกมาจากชุดเดียวกับ `_kit/demo-jobs.ts` (ซึ่งยกมาจาก seed อีกที)
 *  · มีครบทุกสถานะขอบที่หน้าจริงเจอ: เลยกำหนด · ส่งวันนี้ · ไม่กำหนดส่ง · ด่วน ·
 *    ขั้นงานพัง (FAILED) · รีดร้อนติดรอของ · คิวติดด่านมัดจำ · งานผสมหลายสาย ·
 *    ชื่อบริษัทยาวจนต้องตัดคำ · ยังไม่มีม็อกอัพ
 *
 * วันที่: ตรึง "วันนี้" ไว้ที่ **30 ส.ค. 2569 09:30 น. (เวลาไทย)** ชุดเดียวกับหน้าลองอื่น
 * — ไม่เรียก Date.now() ตอนเรนเดอร์ เพราะ React 19 compiler ตีว่าไม่บริสุทธิ์ และ
 * SSR/CSR จะได้คนละค่า
 */

import {
  buildProductionBoard,
  type BoardOrderLike,
  type BoardStepLike,
} from "@/lib/production-board";

export const PROTO_TODAY_LABEL = "30 ส.ค. 2569";

/** เวลาอ้างอิงของทั้งหน้า — ทุกอย่างที่พูดว่า "วันนี้/เลยกำหนด" วัดจากค่านี้ */
export const PROTO_NOW = new Date("2026-08-30T09:30:00+07:00");

type Step = BoardStepLike;
type Order = BoardOrderLike<Step>;

const FRONT = "/demo-mockups/front.svg";
const BACK = "/demo-mockups/back.svg";
const POLO = "/demo-mockups/polo-front.svg";

/** ม็อกอัพของออเดอร์ — เดินผ่านสูตรจริง `orderMockupCover()` เหมือนหน้าจริง */
function cover(url: string | null) {
  return url ? { items: [{ prints: [{ designImageUrl: url }] }] } : {};
}

let stepSeq = 0;
function step(
  stepType: string,
  status: Step["status"],
  extra: Partial<Step> = {},
): Step {
  stepSeq += 1;
  return {
    id: `s-${stepSeq}`,
    stepType,
    status,
    sortOrder: stepSeq,
    ...extra,
  };
}

const NAT = { id: "u-nat", name: "นัท" };
const BAS = { id: "u-bas", name: "บาส" };
const MIN = { id: "u-min", name: "มิ้น" };

/* ------------------------------------------------------------------ 12 ใบ
   ปริมาณงานสัปดาห์ปกติของทีม 5 คน — เรียงตามที่ของจริงเรียง (board เรียงเอง) */

const CORE_ORDERS: Order[] = [
  {
    // เลยกำหนด 2 วัน + ขั้นเตรียมเสื้อพัง = ใบที่ต้องจัดการก่อนเพื่อน
    id: "o-0042",
    orderNumber: "ORD-2608-0042",
    customerName: "บริษัท นอร์ทสตาร์ รีเทล จำกัด",
    deadline: "2026-08-28T17:00:00+07:00",
    priority: "NORMAL",
    internalStatus: "PRODUCING",
    totalQuantity: 480,
    ...cover(POLO),
    productions: [
      {
        id: "p-0042",
        steps: [
          step("GARMENT_PICK", "FAILED", {
            assignedTo: NAT,
            qcNotes: "ขาดไซซ์ L อีก 60 ตัว — สต๊อกจองไม่ครบ",
          }),
          step("DTF_PRINT", "IN_PROGRESS", { assignedTo: BAS, qtyDone: 180, qtyTotal: 480 }),
          step("HEAT_PRESS", "PENDING"),
        ],
      },
    ],
  },
  {
    // ส่งวันนี้ + ด่วน + จำนวนหลักพัน = แถวที่ห้ามหลุดสายตา
    id: "o-0051",
    orderNumber: "ORD-2608-0051",
    customerName: "โครงการรักษ์ทะเลไทย",
    deadline: "2026-08-30T17:00:00+07:00",
    priority: "URGENT",
    internalStatus: "PRODUCING",
    totalQuantity: 1_200,
    ...cover(FRONT),
    productions: [
      {
        id: "p-0051",
        steps: [
          step("GARMENT_PICK", "COMPLETED", { assignedTo: NAT }),
          step("DTF_PRINT", "COMPLETED", { assignedTo: BAS }),
          step("HEAT_PRESS", "IN_PROGRESS", {
            assignedTo: MIN,
            qtyDone: 480,
            qtyTotal: 1_200,
          }),
        ],
      },
    ],
  },
  {
    // งานปักร้านนอกยังไม่กลับ → ประตูรีดร้อนปิดเอง = "รอเสื้อ" (เหลือง)
    id: "o-0048",
    orderNumber: "ORD-2608-0048",
    customerName: "Bangkok Run Club",
    deadline: "2026-08-31T17:00:00+07:00",
    priority: "NORMAL",
    internalStatus: "PRODUCING",
    totalQuantity: 350,
    ...cover(BACK),
    productions: [
      {
        id: "p-0048",
        steps: [
          step("GARMENT_PICK", "COMPLETED", { assignedTo: NAT }),
          step("EMBROIDERY", "IN_PROGRESS", {
            notes: "ส่งโรงปักศรีนครินทร์ 26 ส.ค. — นัดรับ 29 ส.ค.",
          }),
          step("DTF_PRINT", "COMPLETED", { assignedTo: BAS }),
          step("HEAT_PRESS", "PENDING", { assignedTo: MIN }),
        ],
      },
    ],
  },
  {
    // งานผสม 3 สายเดินพร้อมกัน → ป้ายสายงานล้นจนต้องขึ้น "+1"
    id: "o-0065",
    orderNumber: "ORD-2608-0065",
    customerName: "บริษัท ทีเอ็มเค อินดัสเทรียล ซัพพลาย (ประเทศไทย) จำกัด",
    deadline: "2026-09-04T17:00:00+07:00",
    priority: "HIGH",
    internalStatus: "PRODUCING",
    totalQuantity: 640,
    ...cover(POLO),
    productions: [
      {
        id: "p-0065",
        steps: [
          step("GARMENT_RECEIVE", "COMPLETED", { assignedTo: NAT }),
          step("EMBROIDERY", "IN_PROGRESS", { notes: "โรงปักบางนา" }),
          step("TAGGING", "PENDING"),
          step("DTF_PRINT", "IN_PROGRESS", { assignedTo: BAS, qtyDone: 90, qtyTotal: 640 }),
          step("HEAT_PRESS", "PENDING"),
        ],
      },
    ],
  },
  {
    // ไม่กำหนดส่ง + ยังไม่มีม็อกอัพ = ใบที่ตกสายตาได้ง่ายที่สุด
    id: "o-0064",
    orderNumber: "ORD-2608-0064",
    customerName: "ร้านกาแฟลานหน้าบ้าน (สาขาอารีย์)",
    deadline: null,
    priority: "LOW",
    internalStatus: "PRODUCING",
    totalQuantity: 75,
    ...cover(null),
    productions: [
      {
        id: "p-0064",
        steps: [
          step("GARMENT_PICK", "COMPLETED", { assignedTo: NAT }),
          step("DTF_PRINT", "PENDING", { assignedTo: BAS }),
          step("HEAT_PRESS", "PENDING"),
        ],
      },
    ],
  },
  {
    // QC ไม่ผ่าน + เลยกำหนด 1 วัน = ต้องมีคนตัดสินใจ ไม่ใช่แค่ทำต่อ
    id: "o-0039",
    orderNumber: "ORD-2608-0039",
    customerName: "ชมรมศิษย์เก่าคณะสถาปัตย์",
    deadline: "2026-08-29T17:00:00+07:00",
    priority: "NORMAL",
    internalStatus: "QUALITY_CHECK",
    totalQuantity: 300,
    ...cover(BACK),
    productions: [
      {
        id: "p-0039",
        steps: [
          step("GARMENT_PICK", "COMPLETED", { assignedTo: NAT }),
          step("DTF_PRINT", "COMPLETED", { assignedTo: BAS }),
          step("HEAT_PRESS", "COMPLETED", { assignedTo: MIN }),
        ],
      },
    ],
  },
  {
    id: "o-0053",
    orderNumber: "ORD-2608-0053",
    customerName: "Sunday Studio",
    deadline: "2026-09-02T17:00:00+07:00",
    priority: "NORMAL",
    internalStatus: "QUALITY_CHECK",
    blindShip: true,
    totalQuantity: 120,
    ...cover(FRONT),
    productions: [
      {
        id: "p-0053",
        steps: [
          step("GARMENT_PICK", "COMPLETED", { assignedTo: NAT }),
          step("DTF_PRINT", "COMPLETED", { assignedTo: BAS }),
          step("HEAT_PRESS", "COMPLETED", { assignedTo: MIN }),
        ],
      },
    ],
  },
  {
    id: "o-0062",
    orderNumber: "ORD-2608-0062",
    customerName: "โรงเรียนสาธิตบางแสน",
    deadline: "2026-08-31T17:00:00+07:00",
    priority: "NORMAL",
    internalStatus: "PACKING",
    totalQuantity: 260,
    ...cover(FRONT),
    productions: [
      {
        id: "p-0062",
        steps: [
          step("GARMENT_PICK", "COMPLETED", { assignedTo: NAT }),
          step("SCREEN_PRINTING", "COMPLETED"),
        ],
      },
    ],
  },
  {
    id: "o-0044",
    orderNumber: "ORD-2608-0044",
    customerName: "Bangkok Run Club",
    deadline: "2026-09-01T17:00:00+07:00",
    priority: "NORMAL",
    internalStatus: "READY_TO_SHIP",
    totalQuantity: 150,
    ...cover(BACK),
    productions: [
      {
        id: "p-0044",
        steps: [
          step("GARMENT_PICK", "COMPLETED", { assignedTo: NAT }),
          step("DTF_PRINT", "COMPLETED", { assignedTo: BAS }),
          step("HEAT_PRESS", "COMPLETED", { assignedTo: MIN }),
        ],
      },
    ],
  },
  {
    // คิวติดด่าน: อนุมัติแบบแล้วแต่ยังไม่ได้มัดจำ → เปิดใบผลิตไม่ได้
    id: "o-0055",
    orderNumber: "ORD-2608-0055",
    customerName: "ชมรมศิษย์เก่าคณะสถาปัตย์",
    deadline: "2026-09-04T17:00:00+07:00",
    priority: "NORMAL",
    internalStatus: "DESIGN_APPROVED",
    totalQuantity: 220,
    ...cover(FRONT),
    productions: [],
    readiness: {
      ready: false,
      checks: [
        { label: "ลูกค้าอนุมัติม็อกอัพแล้ว", ok: true },
        { label: "ยังไม่ได้รับมัดจำ", ok: false, waitingOn: "รอมัดจำจากลูกค้า" },
      ],
    },
  },
  {
    id: "o-0056",
    orderNumber: "ORD-2608-0056",
    customerName: "River Yard Cafe",
    deadline: "2026-09-05T17:00:00+07:00",
    priority: "NORMAL",
    internalStatus: "PRODUCTION_QUEUE",
    totalQuantity: 45,
    ...cover(FRONT),
    productions: [],
    readiness: { ready: true, checks: [{ label: "พร้อมเปิดใบผลิต", ok: true }] },
  },
  {
    id: "o-0059",
    orderNumber: "ORD-2608-0059",
    customerName: "Sunday Studio",
    deadline: "2026-09-09T17:00:00+07:00",
    priority: "NORMAL",
    internalStatus: "CONFIRMED",
    totalQuantity: 90,
    ...cover(null),
    productions: [],
    readiness: { ready: true, checks: [{ label: "พร้อมเปิดใบผลิต", ok: true }] },
  },
];

/* --------------------------------------------------- อีก 12 ใบ (ปุ่ม "งานล้น")
   ช่วงเปิดเทอม/สิ้นปีของจริงขึ้นระดับนี้ — ใช้ทดสอบว่าแบบไหนยังอ่านออกตอนงานเยอะ */

const BUSY_NAMES: {
  suffix: string;
  customer: string;
  qty: number;
  deadline: string | null;
  status: string;
  urgent?: boolean;
  art: string | null;
}[] = [
  { suffix: "0066", customer: "บริษัท เอส.เค.การ์เมนท์ จำกัด", qty: 900, deadline: "2026-08-31T17:00:00+07:00", status: "PRODUCING", urgent: true, art: POLO },
  { suffix: "0067", customer: "ทีมฟุตบอลชุมชนคลองสาน", qty: 60, deadline: "2026-09-01T17:00:00+07:00", status: "PRODUCING", art: BACK },
  { suffix: "0068", customer: "บริษัท ไทยเทค โซลูชั่นส์ จำกัด", qty: 320, deadline: "2026-09-02T17:00:00+07:00", status: "PRODUCING", art: FRONT },
  { suffix: "0069", customer: "งานบวชคุณพีท", qty: 40, deadline: "2026-08-29T17:00:00+07:00", status: "PRODUCING", art: FRONT },
  { suffix: "0070", customer: "มหาวิทยาลัยราชภัฏบ้านสมเด็จเจ้าพระยา", qty: 1_500, deadline: "2026-09-05T17:00:00+07:00", status: "PRODUCING", art: POLO },
  { suffix: "0071", customer: "ร้านหมูกระทะเฮียตี๋", qty: 25, deadline: "2026-09-03T17:00:00+07:00", status: "QUALITY_CHECK", art: BACK },
  { suffix: "0072", customer: "บริษัท กรีนฟิลด์ ออร์แกนิค จำกัด", qty: 180, deadline: "2026-09-02T17:00:00+07:00", status: "QUALITY_CHECK", art: FRONT },
  { suffix: "0073", customer: "ชมรมจักรยานเมืองเก่า", qty: 110, deadline: "2026-08-31T17:00:00+07:00", status: "PACKING", art: BACK },
  { suffix: "0074", customer: "บริษัท พรีเมียร์ อีเวนต์ จำกัด", qty: 500, deadline: "2026-09-01T17:00:00+07:00", status: "READY_TO_SHIP", art: FRONT },
  { suffix: "0075", customer: "คณะแพทยศาสตร์ รุ่น 42", qty: 210, deadline: "2026-09-08T17:00:00+07:00", status: "PRODUCTION_QUEUE", art: POLO },
  { suffix: "0076", customer: "ร้านเบเกอรี่บ้านสวน", qty: 35, deadline: "2026-09-10T17:00:00+07:00", status: "CONFIRMED", art: null },
  { suffix: "0077", customer: "สโมสรนักศึกษาคณะวิศวกรรมศาสตร์", qty: 430, deadline: "2026-09-06T17:00:00+07:00", status: "DESIGN_APPROVED", art: FRONT },
];

const EXTRA_ORDERS: Order[] = BUSY_NAMES.map((item, index) => {
  const producing = item.status === "PRODUCING";
  const queue = ["CONFIRMED", "DESIGN_APPROVED", "PRODUCTION_QUEUE"].includes(item.status);
  return {
    id: `o-${item.suffix}`,
    orderNumber: `ORD-2608-${item.suffix}`,
    customerName: item.customer,
    deadline: item.deadline,
    priority: item.urgent ? "URGENT" : "NORMAL",
    internalStatus: item.status,
    totalQuantity: item.qty,
    ...cover(item.art),
    productions: producing
      ? [
          {
            id: `p-${item.suffix}`,
            steps: [
              step("GARMENT_PICK", "COMPLETED", { assignedTo: NAT }),
              step("DTF_PRINT", index % 3 === 0 ? "IN_PROGRESS" : "COMPLETED", {
                assignedTo: BAS,
              }),
              step("HEAT_PRESS", index % 3 === 0 ? "PENDING" : "IN_PROGRESS", {
                assignedTo: MIN,
              }),
            ],
          },
        ]
      : queue
        ? []
        : [
            {
              id: `p-${item.suffix}`,
              steps: [
                step("GARMENT_PICK", "COMPLETED", { assignedTo: NAT }),
                step("DTF_PRINT", "COMPLETED", { assignedTo: BAS }),
                step("HEAT_PRESS", "COMPLETED", { assignedTo: MIN }),
              ],
            },
          ],
    ...(queue
      ? { readiness: { ready: true, checks: [{ label: "พร้อมเปิดใบผลิต", ok: true }] } }
      : {}),
  } satisfies Order;
});

/** board ตัวจริงจากสูตรจริง — ทุกแบบในหน้าลองอ่านจากก้อนเดียวกัน */
export const PROTO_BOARD = buildProductionBoard<Step, Order>(CORE_ORDERS, {
  now: PROTO_NOW,
  viewerId: null,
  showBlocked: true,
});

export const PROTO_BOARD_BUSY = buildProductionBoard<Step, Order>(
  [...CORE_ORDERS, ...EXTRA_ORDERS],
  { now: PROTO_NOW, viewerId: null, showBlocked: true },
);

export type ProtoBoard = typeof PROTO_BOARD;
export type ProtoJobRow = ProtoBoard["jobs"][number];
