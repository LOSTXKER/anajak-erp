import { describe, expect, it } from "vitest";
import { buildProductionBoard, type BoardOrderLike } from "./production-board";
import {
  buildDeskRows,
  daysFromNow,
  deskSummary,
  filterDeskRows,
  groupDeskRows,
  jobOutsource,
  jobResponsible,
  type DeskStepLike,
} from "./production-desk";

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

  it("กองเรียงตามความรีบ และกองว่างไม่โผล่", () => {
    const groups = groupDeskRows(rows);
    expect(groups.map((group) => group.key)).toEqual(["blocked", "outsource-due", "queue", "doing", "ready"]);
    expect(groups.every((group) => group.rows.length > 0)).toBe(true);
  });
});
