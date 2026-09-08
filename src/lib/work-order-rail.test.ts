import { describe, expect, it } from "vitest";
import { currentRailNode, railNodesOf } from "./work-order-rail";

const s = (id: string, status: string, pair = false) => ({ id, status, pairWithPrevious: pair });

describe("รางใบผลิต — ช่องคู่", () => {
  it("ขั้นที่เดินคู่กับขั้นก่อนรวมเป็นช่องเดียว", () => {
    const nodes = railNodesOf([s("a", "COMPLETED"), s("b", "IN_PROGRESS"), s("c", "PENDING", true), s("d", "PENDING")]);
    expect(nodes.map((n) => n.map((x) => x.id))).toEqual([["a"], ["b", "c"], ["d"]]);
  });
  it("ขั้นแรกติด flag ก็ยังเปิดช่องของตัวเอง", () => {
    expect(railNodesOf([s("a", "PENDING", true), s("b", "PENDING")]).length).toBe(2);
  });
  it("ยืนที่ช่องแรกที่ยังมีขั้นไม่ปิด · ครบทุกช่อง = -1", () => {
    const nodes = railNodesOf([s("a", "COMPLETED"), s("b", "COMPLETED"), s("c", "PENDING", true), s("d", "PENDING")]);
    expect(currentRailNode(nodes)).toBe(1);
    expect(currentRailNode(railNodesOf([s("a", "COMPLETED")]))).toBe(-1);
  });
});
