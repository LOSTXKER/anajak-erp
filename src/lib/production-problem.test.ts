import { describe, expect, it } from "vitest";

import {
  blockingProblemOf,
  openProblemsOf,
  stepHasOpenProblem,
  stepIsStopped,
  stationProblemNotes,
  type ProblemRowLike,
  type ProblemStepLike,
} from "./production-problem";

function row(overrides: Partial<ProblemRowLike> = {}): ProblemRowLike {
  return {
    id: "x1",
    title: "ฟิล์มลอกหลังรีด",
    description: null,
    blocksJob: true,
    state: "OPEN",
    source: "STATION",
    createdAt: new Date("2026-09-20T02:00:00.000Z"),
    acknowledgedAt: null,
    resolvedAt: null,
    resolution: null,
    raisedBy: { id: "u1", name: "บาส" },
    owner: null,
    lines: [],
    ...overrides,
  };
}

function step(overrides: Partial<ProblemStepLike> = {}): ProblemStepLike {
  return { id: "s1", status: "IN_PROGRESS", notes: null, qcNotes: null, exceptions: [], ...overrides };
}

describe("ตัวอ่านปัญหาชุดเดียวของระบบ", () => {
  it("ขั้นปกติไม่มีเรื่องค้าง", () => {
    expect(openProblemsOf(step())).toEqual([]);
    expect(stepHasOpenProblem(step())).toBe(false);
    expect(blockingProblemOf(step())).toBeNull();
  });

  it("อ่านแถวจริงเป็นเรื่องที่ยังไม่จบ และข้ามเรื่องที่ปิดแล้ว", () => {
    const current = step({
      status: "FAILED",
      exceptions: [row(), row({ id: "x0", state: "RESOLVED", title: "เรื่องเก่าที่ปิดแล้ว" })],
    });
    const open = openProblemsOf(current);
    expect(open).toHaveLength(1);
    expect(open[0]!.title).toBe("ฟิล์มลอกหลังรีด");
    expect(open[0]!.legacy).toBe(false);
    expect(blockingProblemOf(current)?.id).toBe("x1");
  });

  it("เรื่องที่ไม่หยุดขั้น: นับเป็นเรื่องค้าง แต่ไม่ใช่ตัวที่หยุดงาน", () => {
    const current = step({ exceptions: [row({ blocksJob: false })] });
    expect(stepHasOpenProblem(current)).toBe(true);
    expect(blockingProblemOf(current)).toBeNull();
    expect(stepIsStopped(current)).toBe(false);
    expect(openProblemsOf(current)[0]!.stopsWork).toBe(false);
  });

  // ใบที่ Manufacturing V2 เปิดไว้ตั้ง blocksJob ได้โดยที่สถานะขั้นฝั่ง legacy ยังเดินอยู่
  // จอต้องพูดตามความจริงที่ช่างเห็น (ขั้นยังทำต่อได้) ไม่ใช่ตามเจตนาในฐาน
  it("ตั้งใจให้หยุดแต่สถานะขั้นยังเดินอยู่ = ยังไม่หยุดจริง", () => {
    const current = step({ status: "IN_PROGRESS", exceptions: [row({ blocksJob: true })] });
    const [problem] = openProblemsOf(current);
    expect(problem?.blocksJob).toBe(true);
    expect(problem?.stopsWork).toBe(false);
    expect(blockingProblemOf(current)).toBeNull();
  });

  it("ใบเก่าที่มีแต่ marker ใน notes ยังเห็นเป็นเรื่องหนึ่งเรื่อง (ไม่หายไปจากจอ)", () => {
    const current = step({
      status: "FAILED",
      notes: stationProblemNotes("รีดตามค่ามาตรฐาน", "เครื่องเสีย"),
      assignedTo: { id: "u1", name: "บาส" },
    });
    const open = openProblemsOf(current);
    expect(open).toHaveLength(1);
    expect(open[0]!.legacy).toBe(true);
    expect(open[0]!.title).toBe("เครื่องเสีย");
    expect(open[0]!.raisedBy?.name).toBe("บาส");
    expect(blockingProblemOf(current)?.legacy).toBe(true);
  });

  it("ขั้นที่หยุดอยู่แล้วมีแถวที่หยุดงานอยู่ ต้องไม่ปั้นเรื่องซ้ำจาก notes", () => {
    const current = step({ status: "FAILED", notes: stationProblemNotes(null, "เครื่องเสีย"), exceptions: [row()] });
    expect(openProblemsOf(current)).toHaveLength(1);
    expect(openProblemsOf(current)[0]!.legacy).toBe(false);
  });

  it("ขั้นที่ถูกพักไว้ยังอ่านเป็นเรื่องค้าง และบอกว่าเป็นการพัก", () => {
    const current = step({ status: "ON_HOLD", notes: "รอของจากลูกค้า" });
    const [problem] = openProblemsOf(current);
    expect(problem?.held).toBe(true);
    expect(problem?.title).toBe("รอของจากลูกค้า");
  });

  it("เรื่องที่ไม่หยุดขั้นบนขั้นที่หยุดอยู่ ยังต้องได้เรื่องของ marker เพิ่มมาเป็นตัวหยุด", () => {
    const current = step({
      status: "FAILED",
      notes: stationProblemNotes(null, "เครื่องเสีย"),
      exceptions: [row({ blocksJob: false, title: "ลายเบี้ยว 2 ตัว" })],
    });
    const open = openProblemsOf(current);
    expect(open.map((problem) => problem.title)).toEqual(["เครื่องเสีย", "ลายเบี้ยว 2 ตัว"]);
    expect(blockingProblemOf(current)?.title).toBe("เครื่องเสีย");
  });
});
