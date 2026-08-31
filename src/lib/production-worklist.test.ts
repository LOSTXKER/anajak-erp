import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRODUCTION_WORKLIST_SORT,
  filterProductionWorklist,
  groupProductionWorklist,
  productionWorklistAction,
  productionWorklistProgress,
  productionWorklistCounts,
  productionWorklistHref,
  productionWorklistStatus,
  resolveProductionWorklistSort,
  sortProductionWorklist,
} from "./production-worklist";
import type {
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
  bucket = "none",
  waitingOn = [],
  stepStatus = null,
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
  bucket?: TestJob["bucket"];
  waitingOn?: string[];
  stepStatus?: string | null;
}): TestJob {
  const order: TestOrder = {
    id,
    orderNumber: `ORD-${id}`,
    deadline,
    priority,
    totalQuantity,
    internalStatus: status,
    productions: productionId
      ? [{ id: productionId, status: "COMPLETED", steps: [] }]
      : [],
  };
  return {
    key: id,
    order,
    bucket,
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
        step: stepStatus
          ? {
              id: `${id}-step`,
              stepType: "DTF_PRINT",
              status: stepStatus,
              sortOrder: 1,
            }
          : null,
        doneSteps: 0,
        totalSteps: 0,
        waitingOn,
        ready: waitingOn.length === 0,
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

  it("บอกเหตุที่ต้องทำและเจ้าของถัดไปโดยไม่โยนงานส่งช้ากลับฝ่ายผลิต", () => {
    const lateDelivery = job({
      id: "late-delivery",
      status: "READY_TO_SHIP",
      stationKey: "post:ship",
      overdue: true,
    });
    expect(productionWorklistAction(lateDelivery)).toEqual({
      reason: "ส่งงานที่เลยกำหนด",
      owner: "ฝ่ายจัดส่ง",
      attention: true,
      tone: "red",
    });

    const blocked = job({
      id: "blocked",
      status: "PRODUCING",
      stationKey: "รีดร้อน",
      productionId: "prod-blocked",
    });
    blocked.spots[0]!.waitingOn = ["ฟิล์ม DTF ชุด A"];
    blocked.spots[0]!.step = {
      id: "step-blocked",
      stepType: "HEAT_PRESS",
      status: "PENDING",
      sortOrder: 1,
      assignedTo: { id: "user-a", name: "แนน" },
    };
    expect(productionWorklistAction(blocked)).toEqual({
      reason: "รอ ฟิล์ม DTF ชุด A",
      owner: "แนน",
      attention: true,
      tone: "amber",
    });

    const failed = job({
      id: "failed",
      status: "PRODUCING",
      stationKey: "DTF",
      productionId: "prod-failed",
    });
    failed.spots[0]!.step = {
      id: "step-failed",
      stepType: "DTF_PRINT",
      status: "FAILED",
      sortOrder: 1,
      notes: "[แจ้งปัญหาจากสถานี] ฟิล์มยับ ต้องพิมพ์ใหม่",
    };
    expect(productionWorklistAction(failed)).toEqual({
      reason: "ฟิล์มยับ ต้องพิมพ์ใหม่",
      owner: "DTF",
      attention: true,
      tone: "red",
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

  it("เปิดรายการในบริบท Production และเปิด dialog จากคิวเมื่อมีสิทธิ์", () => {
    expect(productionWorklistHref(jobs[0]!, true)).toBe("/production/prod-normal");
    jobs[2]!.order.productions = [{ id: "prod-qc", status: "COMPLETED", steps: [] }];
    jobs[3]!.order.productions = [{ id: "prod-pack", status: "COMPLETED", steps: [] }];
    jobs[4]!.order.productions = [{ id: "prod-ready", status: "COMPLETED", steps: [] }];
    expect(productionWorklistHref(jobs[2]!, true)).toBe("/production/prod-qc");
    expect(productionWorklistHref(jobs[3]!, true)).toBe("/production/prod-pack");
    expect(productionWorklistHref(jobs[4]!, true)).toBe("/production/prod-ready");
    expect(productionWorklistHref(jobs[5]!, true)).toBe("/production?create=queue");
    expect(productionWorklistHref(jobs[5]!, false)).toBe("/production");

    const mixed = job({
      id: "mixed",
      status: "PRODUCING",
      stationKey: "lane:DTF",
      productionId: "prod-active",
    });
    mixed.order.productions = [
      { id: "prod-latest", status: "PENDING", steps: [] },
      { id: "prod-active", status: "IN_PROGRESS", steps: [] },
    ];
    expect(productionWorklistHref(mixed, true)).toBe("/production/prod-active");

    const legacyQc = job({ id: "legacy-qc", status: "QUALITY_CHECK", stationKey: "post:qc" });
    expect(productionWorklistHref(legacyQc, true)).toBe("/production");
  });
});

describe("สถานะของแถว (แทนคอลัมน์ \u201cต้องทำต่อ\u201d ตั้งแต่ 2026-08-31)", () => {
  it("ใช้ชื่อสถานะกลางของระบบ และบอกสายงานที่ยังค้างเป็นบรรทัดรอง", () => {
    expect(
      productionWorklistStatus(
        job({ id: "a", status: "PRODUCING", stationKey: "DTF", productionId: "p-a" }),
      ),
    ).toEqual({ label: "กำลังผลิต", tone: "accent", stations: ["DTF"] });
  });

  it("ขั้นงานพังมาก่อนทุกอย่าง แล้วรองลงมาคือรอของ", () => {
    const failed = job({
      id: "failed",
      status: "PRODUCING",
      stationKey: "DTF",
      productionId: "p-failed",
      stepStatus: "FAILED",
      waitingOn: ["รอเสื้อ"],
    });
    expect(productionWorklistStatus(failed).tone).toBe("danger");

    const waiting = job({
      id: "waiting",
      status: "PRODUCING",
      stationKey: "DTF",
      productionId: "p-waiting",
      waitingOn: ["รอเสื้อ — เตรียมเสื้อ/งานร้านนอกยังไม่จบ"],
    });
    expect(productionWorklistStatus(waiting).tone).toBe("warning");
  });

  it("แยกงานที่เดินอยู่ · พร้อมส่ง · ยังไม่เริ่ม ออกจากกันด้วยโทน", () => {
    const toneOf = (status: string, stationKey: string) =>
      productionWorklistStatus(job({ id: status, status, stationKey })).tone;
    expect(toneOf("QUALITY_CHECK", "post:qc")).toBe("accent");
    expect(toneOf("PACKING", "post:pack")).toBe("accent");
    expect(toneOf("READY_TO_SHIP", "post:ship")).toBe("success");
    expect(toneOf("PRODUCTION_QUEUE", "queue")).toBe("neutral");
  });

  it("เลยกำหนดไม่ทำให้โทนเปลี่ยน — เรื่องเวลาอยู่ที่คอลัมน์กำหนดส่ง", () => {
    const late = job({
      id: "late",
      status: "READY_TO_SHIP",
      stationKey: "post:ship",
      overdue: true,
    });
    expect(productionWorklistStatus(late).tone).toBe("success");
  });
});

describe("หัวข้อกลุ่มตามกำหนดส่ง", () => {
  it("เรียงกลุ่มตามความเร่ง ตัดกลุ่มว่างทิ้ง และคงลำดับเดิมภายในกลุ่ม", () => {
    const grouped = groupProductionWorklist([
      job({ id: "w1", status: "PRODUCING", stationKey: "DTF", bucket: "week" }),
      job({ id: "late", status: "PRODUCING", stationKey: "DTF", bucket: "late" }),
      job({ id: "w2", status: "PRODUCING", stationKey: "DTF", bucket: "week" }),
      job({ id: "none", status: "PRODUCING", stationKey: "DTF", bucket: "none" }),
    ]);
    expect(grouped.map((group) => group.key)).toEqual(["late", "week", "none"]);
    expect(grouped[1]!.label).toBe("ภายในสัปดาห์นี้");
    expect(grouped[1]!.jobs.map((item) => item.key)).toEqual(["w1", "w2"]);
  });

  it("รายการว่างคืนกลุ่มว่าง ไม่ใช่หัวข้อเปล่า", () => {
    expect(groupProductionWorklist([])).toEqual([]);
  });
});
