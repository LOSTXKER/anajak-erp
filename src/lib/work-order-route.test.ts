import { describe, expect, it } from "vitest";
import { routeGrid, routeParts, routePredecessors, routeWaitingOn } from "./work-order-route";

// ใบตัวอย่างชุดเดียวกับหน้าลอง: เตรียมเสื้อ · พิมพ์ฟิล์ม · ปักแขน (ร้านนอก) · รีดร้อน · ป้ายคอ (ร้านนอก) · QC · แพ็ก
const s = (id: string, stepType: string, status: string, sortOrder: number) => ({ id, stepType, status, sortOrder });
const FULL = [
  s("pick", "GARMENT_PICK", "FAILED", 1),
  s("film", "DTF_PRINT", "COMPLETED", 2),
  s("emb", "EMBROIDERY", "IN_PROGRESS", 3),
  s("press", "HEAT_PRESS", "IN_PROGRESS", 4),
  s("label", "TAGGING", "PENDING", 5),
  s("qc", "CUSTOM", "PENDING", 6),
  s("pack", "CUSTOM", "PENDING", 7),
];

describe("work-order-route — สายขนาน จุดบรรจบ หางงาน", () => {
  it("แยกสายตามเลน · รีดร้อนเป็นจุดบรรจบ · QC/แพ็ก (CUSTOM) เป็นหาง", () => {
    const parts = routeParts(FULL);
    expect(parts.lanes.map((l) => l.lane)).toEqual(["PREP", "DTF", "EMBROIDERY", "LABEL"]);
    expect(parts.lanes.map((l) => l.steps.map((x) => x.id))).toEqual([["pick"], ["film"], ["emb"], ["label"]]);
    expect(parts.merge?.id).toBe("press");
    expect(parts.tail.map((x) => x.id)).toEqual(["qc", "pack"]);
  });

  it("รีดร้อนรอทุกสายที่เดินขนาน (เงื่อนไขเดียวกับ evaluateHeatPressGate) — บอกเฉพาะที่ยังไม่ปิด", () => {
    const press = FULL[3]!;
    expect(routePredecessors(press, FULL).map((x) => x.id)).toEqual(["pick", "film", "emb", "label"]);
    expect(routeWaitingOn(press, FULL).map((x) => x.id)).toEqual(["pick", "emb", "label"]);
  });

  it("หางงานรอทุกอย่างก่อนหน้า รวมรีดร้อนและหางก่อนหน้า", () => {
    const pack = FULL[6]!;
    expect(routePredecessors(pack, FULL).map((x) => x.id)).toEqual(["pick", "film", "emb", "label", "press", "qc"]);
  });

  it("ขั้นในสายเดียวกันรอแค่ขั้นก่อนหน้าในสายตัวเอง", () => {
    const steps = [s("a", "DTG_PRETREAT", "COMPLETED", 1), s("b", "DTG_PRINT", "PENDING", 2), s("c", "CURING", "PENDING", 3), s("pick", "GARMENT_PICK", "PENDING", 0)];
    expect(routePredecessors(steps[2]!, steps).map((x) => x.id)).toEqual(["a", "b"]);
    expect(routeWaitingOn(steps[2]!, steps).map((x) => x.id)).toEqual(["b"]);
    expect(routePredecessors(steps[3]!, steps)).toEqual([]);
  });

  it("ผังตาราง: สายละแถว · ขั้นบรรจบกินทุกแถว · สายสั้นลากเส้นยาวไปชนจุดบรรจบ", () => {
    const grid = routeGrid(FULL);
    expect(grid.rows).toBe(4);
    const press = grid.cells.find((c) => c.step.id === "press")!;
    expect(press.col).toBe(3);
    expect([press.rowStart, press.rowEnd]).toEqual([1, 5]);
    // เส้นเข้ารีดร้อนมี 4 เส้น (สายละเส้น) ทุกเส้นจบที่คอลัมน์ 3
    const into = grid.links.filter((l) => l.key.startsWith("press-in"));
    expect(into).toHaveLength(4);
    expect(into.every((l) => l.colEnd === 3 && l.colStart === 2)).toBe(true);
    const qc = grid.cells.find((c) => c.step.id === "qc")!;
    expect(qc.col).toBe(5);
    expect(grid.columns).toBe(7);
  });

  it("ใบไม่มีรีดร้อนและไม่มีหาง (ทำเองสายเดียว) — แถวเดียว ไม่มีเส้นบรรจบ", () => {
    const steps = [s("a", "SCREEN_PRINTING", "PENDING", 1)];
    const grid = routeGrid(steps);
    expect(grid.rows).toBe(1);
    expect(grid.cells).toHaveLength(1);
    expect(grid.links).toHaveLength(0);
    expect(grid.columns).toBe(1);
  });

  it("ใบไม่มีรีดร้อน แต่มีหาง — หางแรกรับเส้นจากทุกสาย", () => {
    const steps = [s("pick", "GARMENT_PICK", "COMPLETED", 1), s("emb", "EMBROIDERY", "PENDING", 2), s("qc", "CUSTOM", "PENDING", 3)];
    const grid = routeGrid(steps);
    const qc = grid.cells.find((c) => c.step.id === "qc")!;
    expect(qc.col).toBe(3);
    expect(grid.links.filter((l) => l.key.startsWith("qc-in"))).toHaveLength(2);
  });

  it("ใบว่าง — ไม่พัง", () => {
    const grid = routeGrid([]);
    expect(grid.cells).toEqual([]);
    expect(grid.rows).toBe(1);
  });
});
