import { describe, expect, it } from "vitest";
import {
  filterProductionWorklist,
  productionWorklistCounts,
  productionWorklistHref,
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
}: {
  id: string;
  status: string;
  stationKey: string;
  productionId?: string | null;
  overdue?: boolean;
}): TestJob {
  const order: TestOrder = {
    id,
    orderNumber: `ORD-${id}`,
    title: `งาน ${id}`,
    deadline: null,
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
    rail: [],
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

  it("ทั้งหมดเรียงงานที่ต้องจัดการขึ้นก่อน โดยรักษาลำดับของรายการอื่น", () => {
    expect(filterProductionWorklist(value, jobs, "all").map((item) => item.key)).toEqual([
      "problem",
      "pack",
      "normal",
      "qc",
      "ready",
      "queue",
    ]);
    expect(filterProductionWorklist(value, jobs, "qc").map((item) => item.key)).toEqual([
      "qc",
    ]);
    expect(filterProductionWorklist(value, jobs, "unknown")).toHaveLength(6);
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
