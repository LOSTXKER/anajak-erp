import { describe, it, expect } from "vitest";
import {
  suggestProductionPlan,
  laneOf,
  isOutsourceStep,
  STEP_TYPE_LABELS,
  STEP_TYPE_OPTIONS,
  STEP_LANE,
  LANE_LABELS,
  LANE_ORDER,
  evaluateHeatPressGate,
} from "./production-steps";

describe("suggestProductionPlan", () => {
  it("งาน DTF (ทำเอง) → พิมพ์ฟิล์ม + รีดร้อน + แพ็ค", () => {
    expect(suggestProductionPlan({ printTypes: ["DTF"] })).toEqual([
      "DTF_PRINT", "HEAT_PRESS", "PACKAGING",
    ]);
  });

  it("งาน DTG → ขั้น outsource ขั้นเดียว (เบสเคาะ: DTG ส่งร้านนอก ไม่ใช่พรีทรีต/อบเอง)", () => {
    expect(suggestProductionPlan({ printTypes: ["DTG"] })).toEqual([
      "DTG_PRINT", "PACKAGING",
    ]);
  });

  it("ปัก/สกรีน/sublimation → ขั้น outsource ของเทคนิคตัวเอง", () => {
    expect(
      suggestProductionPlan({ printTypes: ["SILK_SCREEN", "EMBROIDERY", "SUBLIMATION"] })
    ).toEqual(["SCREEN_PRINTING", "EMBROIDERY", "SUBLIMATION", "PACKAGING"]);
  });

  it("แหล่งเสื้อ → สายเตรียมเสื้อนำหน้าเสมอ: สต๊อค=เบิก · ตัดเย็บ=ร้านนอก · ลูกค้าส่ง=ตรวจรับ", () => {
    expect(
      suggestProductionPlan({
        printTypes: ["DTF"],
        itemSources: ["FROM_STOCK", "CUSTOM_MADE", "CUSTOMER_PROVIDED", null],
      })
    ).toEqual([
      "GARMENT_PICK", "SEWING", "GARMENT_RECEIVE",
      "DTF_PRINT", "HEAT_PRESS", "PACKAGING",
    ]);
  });

  it("add-on ป้ายเย็บติด (ป้ายคอ/ไซส์/care) → งอกขั้นเย็บป้ายให้เอง", () => {
    expect(
      suggestProductionPlan({ printTypes: ["DTF"], addonTypes: ["NECK_LABEL", "POLY_BAG"] })
    ).toEqual(["DTF_PRINT", "HEAT_PRESS", "TAGGING", "PACKAGING"]);
    // add-on ที่ไม่ต้องเย็บ (ถุง/กล่อง) ไม่งอกขั้น
    expect(
      suggestProductionPlan({ printTypes: ["DTF"], addonTypes: ["BOX"] })
    ).toEqual(["DTF_PRINT", "HEAT_PRESS", "PACKAGING"]);
    // addonType เป็น string อิสระ (แค็ตตาล็อกเพิ่มเอง) — อะไรที่ลงท้าย LABEL ต้องจับได้
    expect(
      suggestProductionPlan({ printTypes: ["DTF"], addonTypes: ["WOVEN_LABEL"] })
    ).toEqual(["DTF_PRINT", "HEAT_PRESS", "TAGGING", "PACKAGING"]);
  });

  it("มีลายแต่ไม่รู้วิธีพิมพ์ → ชุด DTF (งานหลักโรงงาน)", () => {
    expect(suggestProductionPlan({ printTypes: ["UNKNOWN_TYPE"] })).toEqual([
      "DTF_PRINT", "HEAT_PRESS", "PACKAGING",
    ]);
  });

  it("เสื้อเปล่าไม่มีลาย → ไม่งอกสายพิมพ์ เหลือเตรียมเสื้อ + แพ็ค", () => {
    expect(
      suggestProductionPlan({ printTypes: [], itemSources: ["FROM_STOCK"] })
    ).toEqual(["GARMENT_PICK", "PACKAGING"]);
  });

  it("ออเดอร์ครบเครื่อง: ตัดเย็บ + DTF + ปัก + ป้ายคอ → ทุกสายเรียงถูก", () => {
    expect(
      suggestProductionPlan({
        printTypes: ["DTF", "EMBROIDERY"],
        itemSources: ["CUSTOM_MADE"],
        addonTypes: ["NECK_LABEL"],
      })
    ).toEqual([
      "SEWING", "DTF_PRINT", "HEAT_PRESS", "EMBROIDERY", "TAGGING", "PACKAGING",
    ]);
  });
});

describe("เลนต่อเทคนิค", () => {
  it("ทุกชนิดขั้นตอนต้องมีเลน + ป้ายไทยครบ", () => {
    for (const s of STEP_TYPE_OPTIONS) {
      expect(STEP_TYPE_LABELS[s], s).toBeTruthy();
      expect(STEP_LANE[s], s).toBeTruthy();
      expect(LANE_LABELS[laneOf(s)], s).toBeTruthy();
    }
  });

  it("ชนิดที่ไม่รู้จัก → เลนอื่นๆ (ไม่พัง)", () => {
    expect(laneOf("SOMETHING_NEW")).toBe("OTHER");
  });

  it("ตัดเย็บแยกเป็นเลนของตัวเอง (เบสระบุ: module ขั้นตอนแยก) — ไม่ปนเลนเตรียมเสื้อ", () => {
    expect(laneOf("SEWING")).toBe("CUTSEW");
    expect(laneOf("PATTERN_MAKING")).toBe("CUTSEW");
    expect(laneOf("GARMENT_PICK")).toBe("PREP");
    expect(laneOf("GARMENT_RECEIVE")).toBe("PREP");
  });

  it("ขั้น outsource = เทคนิคที่ส่งร้านนอกเท่านั้น — DTF ทำเองห้ามติดป้ายร้านนอก", () => {
    expect(isOutsourceStep("DTG_PRINT")).toBe(true);
    expect(isOutsourceStep("SCREEN_PRINTING")).toBe(true);
    expect(isOutsourceStep("EMBROIDERY")).toBe(true);
    expect(isOutsourceStep("SUBLIMATION")).toBe(true);
    expect(isOutsourceStep("SEWING")).toBe(true);
    expect(isOutsourceStep("TAGGING")).toBe(true);
    expect(isOutsourceStep("DTF_PRINT")).toBe(false);
    expect(isOutsourceStep("HEAT_PRESS")).toBe(false);
    expect(isOutsourceStep("GARMENT_PICK")).toBe(false);
    expect(isOutsourceStep("PACKAGING")).toBe(false);
  });

  it("ลำดับเลนครอบทุกเลนที่ map ไว้", () => {
    for (const lane of Object.values(STEP_LANE)) {
      expect(LANE_ORDER).toContain(lane);
    }
  });
});

describe("evaluateHeatPressGate — คิวรีด gate ฟิล์ม∧เสื้อ", () => {
  const S = (stepType: string, status: string) => ({ stepType, status });

  it("ฟิล์มเสร็จ + เสื้อพร้อม → ลงมือได้", () => {
    const gate = evaluateHeatPressGate([
      S("GARMENT_PICK", "COMPLETED"),
      S("DTF_PRINT", "COMPLETED"),
      S("HEAT_PRESS", "PENDING"),
      S("PACKAGING", "PENDING"),
    ]);
    expect(gate.ready).toBe(true);
    expect(gate.waitingOn).toEqual([]);
  });

  it("ฟิล์มยังไม่จบ → รอฟิล์ม", () => {
    const gate = evaluateHeatPressGate([
      S("GARMENT_PICK", "COMPLETED"),
      S("DTF_PRINT", "IN_PROGRESS"),
      S("HEAT_PRESS", "PENDING"),
    ]);
    expect(gate.ready).toBe(false);
    expect(gate.filmReady).toBe(false);
    expect(gate.garmentReady).toBe(true);
  });

  it("เสื้อยังไม่พร้อม (เบิกสต๊อคค้าง + ตัดเย็บค้าง) → รอเสื้อ", () => {
    const gate = evaluateHeatPressGate([
      S("GARMENT_PICK", "IN_PROGRESS"),
      S("SEWING", "PENDING"),
      S("DTF_PRINT", "COMPLETED"),
      S("HEAT_PRESS", "PENDING"),
    ]);
    expect(gate.ready).toBe(false);
    expect(gate.garmentReady).toBe(false);
    expect(gate.filmReady).toBe(true);
  });

  it("ไม่มีขั้นพิมพ์/ขั้นเตรียมเสื้อในใบ → ไม่กั้น (ฟิล์มจากคลัง/เสื้อไม่ต้องเตรียม)", () => {
    const gate = evaluateHeatPressGate([S("HEAT_PRESS", "PENDING"), S("PACKAGING", "PENDING")]);
    expect(gate.ready).toBe(true);
  });

  it("ติดทั้งสองอย่าง → waitingOn ครบ 2 ข้อ", () => {
    const gate = evaluateHeatPressGate([
      S("GARMENT_RECEIVE", "PENDING"),
      S("DTF_PRINT", "PENDING"),
      S("HEAT_PRESS", "PENDING"),
    ]);
    expect(gate.waitingOn).toHaveLength(2);
  });
});
