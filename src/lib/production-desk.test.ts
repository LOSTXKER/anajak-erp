import { describe, expect, it } from "vitest";
import { buildProductionBoard, type BoardOrderLike } from "./production-board";
import {
  buildDeskRows,
  daysFromNow,
  deskSummary,
  filterDeskRows,
  jobOutsource,
  jobResponsible,
  type DeskStepLike,
} from "./production-desk";
import { resolveDeskSort, sortDeskRows } from "./production-desk-sort";

const NOW = new Date("2026-09-02T09:00:00+07:00");

type Step = DeskStepLike;
type Order = BoardOrderLike<Step>;

function step(partial: Partial<Step> & { id: string; stepType: string }): Step {
  return { status: "PENDING", sortOrder: 1, ...partial };
}

function order(partial: Partial<Order> & { id: string; orderNumber: string }): Order {
  return {
    deadline: "2026-09-05T00:00:00+07:00",
    internalStatus: "PRODUCING",
    priority: "NORMAL",
    customerName: "ลูกค้าทดสอบ",
    totalQuantity: 100,
    productions: [],
    ...partial,
  };
}

const orders: Order[] = [
  order({
    id: "o-failed",
    orderNumber: "ORD-0001",
    deadline: "2026-08-30T00:00:00+07:00",
    productions: [
      {
        id: "p1",
        steps: [
          step({ id: "s1", stepType: "GARMENT_PICK", status: "FAILED", notes: "เสื้อไม่พอ", assignedTo: { id: "u1", name: "เบส" } }),
          step({ id: "s2", stepType: "DTF_PRINT", sortOrder: 2 }),
        ],
      },
    ],
  }),
  order({
    id: "o-outsource",
    orderNumber: "ORD-0002",
    productions: [
      {
        id: "p2",
        steps: [
          step({ id: "s3", stepType: "GARMENT_PICK", status: "COMPLETED" }),
          step({
            id: "s4",
            stepType: "EMBROIDERY",
            status: "IN_PROGRESS",
            sortOrder: 2,
            outsourceOrders: [
              {
                status: "SENT",
                expectedBackAt: "2026-09-01T00:00:00+07:00",
                description: "ปักอกซ้าย 320 ตัว",
                vendor: { name: "ร้านปักพี่หน่อย" },
              },
            ],
          }),
        ],
      },
    ],
  }),
  order({
    id: "o-doing",
    orderNumber: "ORD-0003",
    productions: [
      {
        id: "p3",
        steps: [
          step({ id: "s5", stepType: "GARMENT_PICK", status: "COMPLETED" }),
          step({ id: "s6", stepType: "DTF_PRINT", status: "IN_PROGRESS", sortOrder: 2, assignedTo: { id: "u2", name: "บาส" } }),
        ],
      },
    ],
  }),
  order({ id: "o-ready", orderNumber: "ORD-0004", internalStatus: "READY_TO_SHIP", productions: [] }),
  order({ id: "o-queue", orderNumber: "ORD-0005", internalStatus: "PRODUCTION_QUEUE", productions: [] }),
];

const board = buildProductionBoard<Step, Order>(orders, { now: NOW, showBlocked: true });
const rows = buildDeskRows(board, NOW);
const byOrder = (id: string) => rows.find((row) => row.job.order.id === id)!;

describe("production-desk", () => {
  const rowForSteps = (steps: Step[], extra: Partial<Order> = {}) => buildDeskRows(buildProductionBoard([
    order({ id: "parallel", orderNumber: "ORD-parallel", productions: [{ id: "p-parallel", steps }], ...extra }),
  ], { now: NOW, showBlocked: true }), NOW)[0]!;

  it("งานเลยกำหนดแต่ยังทำได้ไม่ถูกนับเป็นติดปัญหา", () => {
    const row = rowForSteps([step({ id: "print", stepType: "DTF_PRINT", status: "IN_PROGRESS" })], { deadline: "2026-09-01" });
    expect(row.job.overdue).toBe(true);
    expect(row.blocked).toBe(false);
    expect(deskSummary([row])).toMatchObject({ late: 1, blocked: 0 });
  });

  it("ขึ้นงานที่ส่งร้านต่อได้ก่อนรีดและ QC ที่ยังรอ โดยไม่แจ้งติดปัญหา", () => {
    const row = rowForSteps([
      step({ id: "pick", stepType: "GARMENT_PICK", status: "COMPLETED" }),
      step({ id: "tag", stepType: "TAGGING", sortOrder: 2 }),
      step({ id: "film", stepType: "DTF_PRINT", status: "COMPLETED", sortOrder: 3 }),
      step({ id: "press", stepType: "HEAT_PRESS", sortOrder: 4 }),
      step({ id: "qc", stepType: "CUSTOM", customStepName: "ตรวจคุณภาพ", sortOrder: 5 }),
    ]);
    expect(row.blocked).toBe(false);
    expect(row.current[0]).toMatchObject({ state: "active", label: expect.stringContaining("รอส่งร้าน") });
    expect(row.current.filter((c) => c.state === "waiting")).toHaveLength(2);
  });

  it("รอรับร้านปกติแยกจากตรวจรับไม่ผ่านและการพักงาน", () => {
    const tag = step({ id: "tag", stepType: "TAGGING", outsourceOrders: [{ status: "SENT", expectedBackAt: null, vendor: { name: "ร้านป้าย" } }] });
    expect(rowForSteps([tag])).toMatchObject({ blocked: false, current: [{ state: "external" }] });
    expect(rowForSteps([{ ...tag, outsourceOrders: [{ ...tag.outsourceOrders![0]!, status: "QC_FAILED" }] }]).blocked).toBe(true);
    expect(rowForSteps([step({ id: "held", stepType: "HEAT_PRESS", status: "ON_HOLD" })]).blocked).toBe(true);
  });

  it("ใบส่งร้านร่างและรับกลับแล้วไม่ชวนให้รอรับอีก แต่ร้านทำเสร็จยังต้องตามรับ", () => {
    const rowForOutsource = (status: string) => rowForSteps([step({ id: "tag", stepType: "TAGGING", outsourceOrders: [{ status, expectedBackAt: "2026-09-01", vendor: { name: "ร้านป้าย" } }] })]);
    const draft = rowForOutsource("DRAFT");
    expect(draft.current[0]!.label).toContain("รอส่งร้าน");
    expect(draft.outsourceDue).toBe(false);
    const received = rowForOutsource("RECEIVED_BACK");
    expect(received.current[0]!.label).toContain("รอตรวจรับ");
    expect(received.outsourceDue).toBe(false);
    expect(rowForOutsource("COMPLETED")).toMatchObject({ outsourceDue: true, current: [{ state: "external" }] });
  });

  it("รอเปิดใบแต่ไม่ผ่านด่านพร้อมผลิตยังอยู่ในตัวกรองติดปัญหา", () => {
    expect(rowForSteps([], { internalStatus: "PRODUCTION_QUEUE", readiness: { ready: false, checks: [{ label: "แบบ", ok: false, waitingOn: "ลูกค้า" }] } }).blocked).toBe(true);
  });
  it("นับวันจากวันนี้โดยตัดเวลา และคืน null เมื่อไม่มีวันที่", () => {
    expect(daysFromNow("2026-09-05T23:00:00+07:00", NOW)).toBe(3);
    expect(daysFromNow("2026-08-30T01:00:00+07:00", NOW)).toBe(-3);
    expect(daysFromNow(null, NOW)).toBeNull();
  });

  it("ขั้นที่พังลงกองติดปัญหา และเห็นเหตุจาก note ของขั้น", () => {
    const row = byOrder("o-failed");
    expect(row.pile).toBe("blocked");
    expect(row.current.some((c) => c.state === "failed" && c.reason === "เสื้อไม่พอ")).toBe(true);
    expect(row.job.overdue).toBe(true);
  });

  it("ร้านนอกที่เลยนัดรับ ลงกองของร้านนอกครบกำหนด พร้อมชื่อร้าน/งาน/วันกลับ", () => {
    const row = byOrder("o-outsource");
    expect(row.pile).toBe("outsource-due");
    expect(row.outsource).toMatchObject({ vendor: "ร้านปักพี่หน่อย", work: "ปักอกซ้าย 320 ตัว", backInDays: -1 });
    expect(jobOutsource(row.job, NOW)?.statusLabel).toBeTruthy();
  });

  it("งานที่กำลังเดินในโรงงานลงกองลงมือได้ และบอกผู้รับผิดชอบจากขั้นปัจจุบัน", () => {
    const row = byOrder("o-doing");
    expect(row.pile).toBe("doing");
    expect(jobResponsible(row.job)).toEqual(["บาส"]);
  });

  it("พร้อมส่งกับรอเปิดใบผลิตแยกกองของตัวเอง", () => {
    expect(byOrder("o-ready").pile).toBe("ready");
    expect(byOrder("o-queue").pile).toBe("queue");
  });

  it("ตัวเลข 4 ช่องกับตัวกรองนับจากชุดเดียวกัน", () => {
    const summary = deskSummary(rows);
    expect(summary).toEqual({ late: 1, blocked: 1, outsource: 1, ready: 1 });
    expect(filterDeskRows(rows, "late").map((row) => row.job.order.id)).toEqual(["o-failed"]);
    expect(filterDeskRows(rows, "outsource").map((row) => row.job.order.id)).toEqual(["o-outsource"]);
    expect(filterDeskRows(rows, "all")).toHaveLength(rows.length);
  });

});

describe("ตารางผลิตเรียงต่อเนื่องโดยไม่แบ่งกลุ่มสถานะ", () => {
  const mixedOrders: Order[] = [
    order({
      id: "later",
      orderNumber: "ORD-10",
      deadline: "2026-09-05T00:00:00+07:00",
      totalQuantity: 30,
      productions: [{ id: "p-later", steps: [step({ id: "s-later", stepType: "HEAT_PRESS", status: "FAILED" })] }],
    }),
    order({ id: "earlier", orderNumber: "ORD-2", deadline: "2026-09-03T00:00:00+07:00", totalQuantity: 20, internalStatus: "READY_TO_SHIP" }),
    order({ id: "undated", orderNumber: "ORD-1", deadline: null, totalQuantity: 10, internalStatus: "PRODUCTION_QUEUE" }),
    order({ id: "same-day", orderNumber: "ORD-3", deadline: "2026-09-03T00:00:00+07:00", totalQuantity: 20, internalStatus: "PACKING" }),
  ];
  const mixedRows = buildDeskRows(buildProductionBoard(mixedOrders, { now: NOW, showBlocked: true }), NOW);
  const numbers = (sorted: typeof mixedRows) => sorted.map((row) => row.job.order.orderNumber);

  it("เรียงกำหนดส่งใกล้ก่อนข้ามสถานะ และงานไม่กำหนดส่งอยู่ท้าย", () => {
    const sorted = sortDeskRows(mixedRows, { key: "deadline", direction: "asc" });
    expect(numbers(sorted)).toEqual(["ORD-2", "ORD-3", "ORD-10", "ORD-1"]);
    expect(sorted.map((row) => row.pile)).toEqual(["ready", "doing", "blocked", "queue"]);
  });

  it("เรียงกำหนดส่งไกลก่อน งานไม่กำหนดส่งยังอยู่ท้าย และวันเดียวกันเรียงเลขใบ", () => {
    expect(numbers(sortDeskRows(mixedRows, { key: "deadline", direction: "desc" }))).toEqual(["ORD-10", "ORD-2", "ORD-3", "ORD-1"]);
  });

  it("เรียงเลขใบแบบตัวเลขจริงทั้งสองทิศ โดย ORD-2 มาก่อน ORD-10", () => {
    expect(numbers(sortDeskRows(mixedRows, { key: "order", direction: "asc" }))).toEqual(["ORD-1", "ORD-2", "ORD-3", "ORD-10"]);
    expect(numbers(sortDeskRows(mixedRows, { key: "order", direction: "desc" }))).toEqual(["ORD-10", "ORD-3", "ORD-2", "ORD-1"]);
  });

  it("เรียงจำนวนทั้งสองทิศ ยอดเท่ากันใช้เลขใบตัดสิน", () => {
    expect(numbers(sortDeskRows(mixedRows, { key: "quantity", direction: "asc" }))).toEqual(["ORD-1", "ORD-2", "ORD-3", "ORD-10"]);
    expect(numbers(sortDeskRows(mixedRows, { key: "quantity", direction: "desc" }))).toEqual(["ORD-10", "ORD-2", "ORD-3", "ORD-1"]);
  });

  it("ไม่เปลี่ยนลำดับข้อมูลต้นทางที่ตัวกรองและจำนวนสรุปใช้ร่วมกัน", () => {
    const before = numbers(mixedRows);
    expect(sortDeskRows(mixedRows, { key: "order", direction: "asc" })).not.toBe(mixedRows);
    expect(numbers(mixedRows)).toEqual(before);
  });

  it("ตัวเลือกใน URL ที่ไม่รู้จักกลับไปเรียงกำหนดส่งใกล้ก่อน", () => {
    expect(resolveDeskSort("unknown", "unknown")).toEqual({ key: "deadline", direction: "asc" });
    expect(resolveDeskSort("quantity", "desc")).toEqual({ key: "quantity", direction: "desc" });
  });
});
