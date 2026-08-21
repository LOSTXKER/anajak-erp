import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRODUCTION_WORKLIST_SORT,
  filterProductionWorklist,
  productionWorklistProgress,
  productionWorklistCounts,
  productionWorklistDaySummary,
  productionWorklistHref,
  resolveProductionWorklistSort,
  sortProductionWorklist,
} from "./production-worklist";import type {
  BoardJob,
  BoardOrderLike,
  BoardStepLike,
  ProductionBoard,
} from "./production-board";

type TestOrder = BoardOrderLike<BoardStepLike>;
type TestJob = BoardJob<TestOrder, BoardStepLike>;

function job({
  id,
  status,
  stationKey,
  productionId = null,
  overdue = false,
  deadline = null,
  priority = "NORMAL",
  totalQuantity = 0,
  rail = [],
}: {
  id: string;
  status: string;
  stationKey: string;
  productionId?: string | null;
  overdue?: boolean;
  deadline?: string | null;
  priority?: string;
  totalQuantity?: number;
  rail?: TestJob["rail"];
}): TestJob {
  const order: TestOrder = {
    id,
    orderNumber: `ORD-${id}`,
    title: `งาน ${id}`,
    deadline,
    priority,
    totalQuantity,
    internalStatus: status,
    productions: [],
  };
  return {
    key: id,
    order,
    bucket: "none",
    overdue,
    dueSoon: false,
    stationKeys: [stationKey],
    spots: [
      {
        key: `${id}:${stationKey}`,
        stationKey,
        stationLabel: stationKey,
        kind: stationKey === "queue" ? "queue" : stationKey.startsWith("post:") ? "post" : "lane",
        productionId,
        step: null,
        doneSteps: 0,
        totalSteps: 0,
        waitingOn: [],
        ready: true,
      },
    ],
    rail,
    searchText: id,
  };
}

function board(jobs: TestJob[]): ProductionBoard<TestOrder, BoardStepLike> {
  return {
    jobs,
    stations: [],
    exceptions: [
      {
        orderId: "problem",
        orderNumber: "ORD-problem",
        title: "งาน problem",
        customerName: null,
        deadline: null,
        priority: null,
        reasons: [{ label: "มีปัญหา", tone: "red" }],
        waitingOn: [],
        href: "/production/prod-problem",
        skippable: false,
      },
    ],
    myWork: [],
    totalJobs: jobs.length,
    totalSpots: jobs.length,
  };
}

describe("production worklist", () => {
  const jobs = [
    job({ id: "normal", status: "PRODUCING", stationKey: "lane:DTF", productionId: "prod-normal" }),
    job({ id: "problem", status: "PRODUCING", stationKey: "lane:DTF", productionId: "prod-problem" }),
    job({ id: "qc", status: "QUALITY_CHECK", stationKey: "post:qc" }),
    job({ id: "pack", status: "PACKING", stationKey: "post:pack", overdue: true }),
    job({ id: "ready", status: "READY_TO_SHIP", stationKey: "post:ship" }),
    job({ id: "queue", status: "PRODUCTION_QUEUE", stationKey: "queue" }),
  ];
  const value = board(jobs);

  it("นับออเดอร์หนึ่งครั้งและแยกมุมงานตามเฟส", () => {
    expect(productionWorklistCounts(value)).toEqual({
      all: 6,
      attention: 2,
      production: 3,
      qc: 1,
      packing: 2,
    });
  });

  it("กรองมุมงานโดยรักษาลำดับขาเข้าไว้ให้ sort contract เป็นเจ้าของลำดับ", () => {
    expect(filterProductionWorklist(value, jobs, "all").map((item) => item.key)).toEqual([
      "normal",
      "problem",
      "qc",
      "pack",
      "ready",
      "queue",
    ]);
    expect(filterProductionWorklist(value, jobs, "qc").map((item) => item.key)).toEqual([
      "qc",
    ]);
    expect(filterProductionWorklist(value, jobs, "unknown")).toHaveLength(6);
  });

  it("default/invalid เรียงงานต้องจัดการก่อน แล้วค่อยกำหนดส่ง", () => {
    const sortable = [
      job({
        id: "normal",
        status: "PRODUCING",
        stationKey: "lane:DTF",
        deadline: "2026-09-01T03:00:00.000Z",
      }),
      job({
        id: "problem",
        status: "PRODUCING",
        stationKey: "lane:DTF",
        deadline: "2026-09-20T03:00:00.000Z",
      }),
      job({ id: "no-due", status: "PRODUCING", stationKey: "lane:DTF" }),
    ];
    const sortableBoard = board(sortable);

    expect(resolveProductionWorklistSort(null)).toBe(DEFAULT_PRODUCTION_WORKLIST_SORT);
    expect(resolveProductionWorklistSort("unknown:sideways")).toBe(
      DEFAULT_PRODUCTION_WORKLIST_SORT,
    );
    expect(
      sortProductionWorklist(sortableBoard, sortable, null).map((item) => item.key),
    ).toEqual(["problem", "normal", "no-due"]);

    const sameDue = [
      job({
        id: "0001",
        status: "PRODUCING",
        stationKey: "lane:DTF",
        deadline: "2026-09-01T03:00:00.000Z",
        priority: "URGENT",
        overdue: true,
      }),
      job({
        id: "9999",
        status: "PRODUCING",
        stationKey: "lane:DTF",
        deadline: "2026-09-01T03:00:00.000Z",
        priority: "NORMAL",
        overdue: true,
      }),
    ];
    expect(
      sortProductionWorklist(board(sameDue), sameDue, null).map((item) => item.key),
    ).toEqual(["0001", "9999"]);
  });

  it("explicit sort เรียงทั้งตารางจริงและกำหนดส่งว่างอยู่ท้ายทั้งสองทิศ", () => {
    const sortable = [
      job({
        id: "0002",
        status: "PRODUCING",
        stationKey: "lane:DTF",
        deadline: "2026-09-20T03:00:00.000Z",
        totalQuantity: 5,
        rail: [
          { key: "a", label: "A", state: "done" },
          { key: "b", label: "B", state: "wait" },
        ],
      }),
      job({
        id: "0003",
        status: "PRODUCING",
        stationKey: "lane:DTF",
        deadline: "2026-09-01T03:00:00.000Z",
        totalQuantity: 10,
        rail: [
          { key: "a", label: "A", state: "wait" },
          { key: "b", label: "B", state: "wait" },
        ],
      }),
      job({
        id: "0001",
        status: "PRODUCING",
        stationKey: "lane:DTF",
        overdue: true,
        totalQuantity: 1,
        rail: [
          { key: "a", label: "A", state: "done" },
          { key: "b", label: "B", state: "done" },
          { key: "na", label: "N/A", state: "na" },
        ],
      }),
    ];
    const sortableBoard = board(sortable);
    const keys = (sort: string) =>
      sortProductionWorklist(sortableBoard, sortable, sort).map((item) => item.key);

    expect(productionWorklistCounts(sortableBoard).attention).toBe(1);
    expect(keys("deadline:asc")).toEqual(["0003", "0002", "0001"]);
    expect(keys("deadline:desc")).toEqual(["0002", "0003", "0001"]);
    expect(keys("orderNumber:asc")).toEqual(["0001", "0002", "0003"]);
    expect(keys("orderNumber:desc")).toEqual(["0003", "0002", "0001"]);
    expect(keys("totalQuantity:asc")).toEqual(["0001", "0002", "0003"]);
    expect(keys("totalQuantity:desc")).toEqual(["0003", "0002", "0001"]);
    expect(keys("progress:asc")).toEqual(["0003", "0002", "0001"]);
    expect(keys("progress:desc")).toEqual(["0001", "0002", "0003"]);
    expect(sortable.map((item) => item.key)).toEqual(["0002", "0003", "0001"]);
  });

  it("ใช้สูตรความคืบหน้าเดียวกับค่าที่แสดงและรองรับงานที่ไม่มีช่วง", () => {
    expect(
      productionWorklistProgress([
        { key: "a", label: "A", state: "done" },
        { key: "b", label: "B", state: "wait" },
        { key: "na", label: "N/A", state: "na" },
      ]),
    ).toEqual({ completed: 1, total: 2, percent: 50 });
    expect(productionWorklistProgress([])).toEqual({ completed: 0, total: 0, percent: 0 });
  });

  it("normalize URL เก่าโดยไม่ปล่อยค่า blank เข้า Select", () => {
    expect(resolveProductionWorklistSort("due")).toBe("attention");
    expect(resolveProductionWorklistSort("newest")).toBe("orderNumber:desc");
    expect(resolveProductionWorklistSort("urgent")).toBe("urgent");
  });

  it("พาไปจอที่ลงมือได้จริง และเปิด dialog จากคิวเมื่อมีสิทธิ์", () => {
    expect(productionWorklistHref(jobs[0]!, true)).toBe("/production/prod-normal");
    expect(productionWorklistHref(jobs[2]!, true)).toBe("/orders/qc?tab=production");
    expect(productionWorklistHref(jobs[3]!, true)).toBe("/orders/pack?tab=delivery");
    expect(productionWorklistHref(jobs[4]!, true)).toBe("/orders/ready?tab=delivery");
    expect(productionWorklistHref(jobs[5]!, true)).toBe("/production?create=queue");
    expect(productionWorklistHref(jobs[5]!, false)).toBe(
      "/orders/queue?tab=production",
    );
  });
});

describe("productionWorklistDaySummary — สรุปวันนี้ (mockup v2)", () => {
  const step = (status: string): BoardStepLike => ({
    id: `step-${status}`,
    stepType: "DTF_PRINT",
    status,
    sortOrder: 1,
    qtyDone: 0,
    qtyTotal: 10,
  });

  function dayJob(id: string, overrides: Partial<TestJob>): TestJob {
    const base = job({ id, status: "PRODUCING", stationKey: "lane:DTF", productionId: `prod-${id}` });
    return { ...base, ...overrides };
  }

  it("นับเลยกำหนด/ส่งวันนี้จากทั้ง job และกำลังทำจากขั้น IN_PROGRESS จริง", () => {
    const summary = productionWorklistDaySummary([
      dayJob("late", { overdue: true }),
      dayJob("today", { bucket: "today" }),
      dayJob("today-late", { overdue: true, bucket: "today" }),
      dayJob("doing", {
        spots: [
          {
            ...job({ id: "doing", status: "PRODUCING", stationKey: "lane:DTF", productionId: "prod-doing" }).spots[0]!,
            step: step("IN_PROGRESS"),
          },
        ],
      }),
      dayJob("idle", {
        spots: [
          {
            ...job({ id: "idle", status: "PRODUCING", stationKey: "lane:DTF", productionId: "prod-idle" }).spots[0]!,
            step: step("PENDING"),
          },
        ],
      }),
    ]);
    // today-late ถูกนับทั้งเลยกำหนดและส่งวันนี้ — งานเดียวมีได้สองธง
    expect(summary).toEqual({ late: 2, today: 2, inProgress: 1 });
  });

  it("ไม่มีงานไฟลุกเลย = ศูนย์ทุกช่อง (UI ซ่อนแถบนี้)", () => {
    expect(
      productionWorklistDaySummary([
        dayJob("calm", {
          spots: [
            {
              ...job({ id: "calm", status: "PRODUCING", stationKey: "lane:DTF", productionId: "prod-calm" }).spots[0]!,
              step: step("PENDING"),
            },
          ],
        }),
      ]),
    ).toEqual({ late: 0, today: 0, inProgress: 0 });
  });
});
