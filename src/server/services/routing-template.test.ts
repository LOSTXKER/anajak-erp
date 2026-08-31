import { describe, expect, it } from "vitest";
import {
  findDependencyCycle,
  validateRoutingDraft,
  type RoutingDraft,
  type RoutingOperationDraft,
} from "./routing-template";

function op(code: string, sequence: number): RoutingOperationDraft {
  return {
    code,
    name: `ขั้น ${code}`,
    sequence,
    phase: "MANUFACTURING",
    executionMode: "IN_HOUSE",
    workCenterId: null,
    standardMinutes: null,
  };
}

/** สูตรมาตรฐานย่อ — เสื้อพร้อม + ฟิล์มเสร็จ ค่อยรีด (ขนานกันได้) */
const validDraft: RoutingDraft = {
  operations: [op("PREP", 10), op("OUTSOURCE", 20), op("DTF", 30), op("PRESS", 40)],
  dependencies: [
    ["PREP", "OUTSOURCE"],
    ["OUTSOURCE", "PRESS"],
    ["DTF", "PRESS"],
  ],
};

describe("ตรวจร่างสูตรขั้นงาน", () => {
  it("สูตรที่ขั้นเดินขนานกันแล้วมาบรรจบ ผ่านได้", () => {
    expect(() => validateRoutingDraft(validDraft)).not.toThrow();
  });

  it("สูตรว่างไม่ผ่าน — ใบผลิตที่ไม่มีขั้นเลยจะหายจากทุกหน้า", () => {
    expect(() => validateRoutingDraft({ operations: [], dependencies: [] })).toThrow(
      /อย่างน้อยหนึ่งขั้น/,
    );
  });

  it("รหัสขั้นซ้ำไม่ผ่าน — เส้น “ต้องเสร็จก่อน” จะไม่รู้ว่าหมายถึงขั้นไหน", () => {
    expect(() =>
      validateRoutingDraft({
        operations: [op("DTF", 10), op("DTF", 20)],
        dependencies: [],
      }),
    ).toThrow(/ซ้ำ/);
  });

  it("ขั้นที่ไม่มีชื่อไม่ผ่าน", () => {
    const nameless = { ...op("DTF", 10), name: "  " };
    expect(() =>
      validateRoutingDraft({ operations: [nameless], dependencies: [] }),
    ).toThrow(/ยังไม่มีชื่อ/);
  });

  it("เส้นที่ชี้ไปขั้นที่ไม่มีในสูตรไม่ผ่าน", () => {
    expect(() =>
      validateRoutingDraft({
        operations: [op("DTF", 10)],
        dependencies: [["PREP", "DTF"]],
      }),
    ).toThrow(/ไม่มีในสูตร/);
  });

  it("ขั้นรอตัวเองไม่ได้", () => {
    expect(() =>
      validateRoutingDraft({
        operations: [op("DTF", 10)],
        dependencies: [["DTF", "DTF"]],
      }),
    ).toThrow(/รอตัวเอง/);
  });

  it("เส้นซ้ำไม่ผ่าน", () => {
    expect(() =>
      validateRoutingDraft({
        operations: [op("PREP", 10), op("DTF", 20)],
        dependencies: [
          ["PREP", "DTF"],
          ["PREP", "DTF"],
        ],
      }),
    ).toThrow(/ซ้ำ/);
  });

  it("วงวนไม่ผ่าน และบอกด้วยว่าวนตรงไหน — ไม่งั้นงานค้างตลอดกาล", () => {
    const looped: RoutingDraft = {
      operations: [op("A", 10), op("B", 20), op("C", 30)],
      dependencies: [
        ["A", "B"],
        ["B", "C"],
        ["C", "A"],
      ],
    };
    expect(() => validateRoutingDraft(looped)).toThrow(/วนกลับเป็นวงกลม/);
    expect(findDependencyCycle(looped)).toEqual(["A", "B", "C", "A"]);
  });

  it("สูตรที่ไม่มีวงวนคืน null", () => {
    expect(findDependencyCycle(validDraft)).toBeNull();
  });

  it("ขั้นที่ขนานกันไม่ถือว่าวน แม้จะมาบรรจบที่ขั้นเดียวกัน", () => {
    // เคสจริงของโรงงาน: งานร้านนอกกับ DTF เดินพร้อมกัน แล้วรีดร้อนรอทั้งสองทาง
    expect(
      findDependencyCycle({
        operations: [op("OUTSOURCE", 10), op("DTF", 20), op("PRESS", 30)],
        dependencies: [
          ["OUTSOURCE", "PRESS"],
          ["DTF", "PRESS"],
        ],
      }),
    ).toBeNull();
  });
});
