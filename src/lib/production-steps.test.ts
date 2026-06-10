import { describe, it, expect } from "vitest";
import { suggestStepsFromPrintTypes, STEP_TYPE_LABELS, STEP_TYPE_OPTIONS } from "./production-steps";

describe("suggestStepsFromPrintTypes", () => {
  it("งาน DTF → พิมพ์ฟิล์ม + รีดร้อน + แพ็ค", () => {
    expect(suggestStepsFromPrintTypes(["DTF"])).toEqual(["DTF_PRINT", "HEAT_PRESS", "PACKAGING"]);
  });

  it("งาน DTG → พรีทรีต + พิมพ์ + อบ + แพ็ค", () => {
    expect(suggestStepsFromPrintTypes(["DTG"])).toEqual([
      "DTG_PRETREAT", "DTG_PRINT", "CURING", "PACKAGING",
    ]);
  });

  it("silkscreen (outsource) → ขั้นสกรีนเดียวรอผูกใบ outsource + แพ็ค", () => {
    expect(suggestStepsFromPrintTypes(["SILK_SCREEN"])).toEqual(["SCREEN_PRINTING", "PACKAGING"]);
  });

  it("งานผสม DTF+silkscreen → รวมขั้นของทั้งสองวิธี", () => {
    expect(suggestStepsFromPrintTypes(["DTF", "SILK_SCREEN"])).toEqual([
      "DTF_PRINT", "HEAT_PRESS", "SCREEN_PRINTING", "PACKAGING",
    ]);
  });

  it("ไม่รู้วิธีพิมพ์ → ชุด DTF (งานหลักโรงงาน)", () => {
    expect(suggestStepsFromPrintTypes([])).toEqual(["DTF_PRINT", "HEAT_PRESS", "PACKAGING"]);
  });

  it("ทุกค่าที่แนะนำ/ตัวเลือก ต้องมีป้ายไทยครบ", () => {
    for (const s of STEP_TYPE_OPTIONS) {
      expect(STEP_TYPE_LABELS[s], s).toBeTruthy();
    }
  });
});
