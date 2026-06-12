import { describe, it, expect } from "vitest";
import {
  parseCostRates,
  estimateFilmCost,
  estimateLaborOverhead,
  costRatesConfigured,
  EMPTY_COST_RATES,
} from "./cost-rates";

const RATES = {
  filmRatePerMeter: 40,
  filmRollWidthCm: 60,
  laborPerPiece: 5,
  overheadPerPiece: 3,
  costDeviationAlertPct: 10,
};

describe("cost-rates — เรตต้นทุนกลาง", () => {
  it("parse ค่าเพี้ยน/ว่าง → ค่า default ไม่พังหน้า", () => {
    expect(parseCostRates(null)).toEqual(EMPTY_COST_RATES);
    expect(parseCostRates("not-json")).toEqual(EMPTY_COST_RATES);
    expect(parseCostRates('{"filmRatePerMeter":25}').filmRatePerMeter).toBe(25);
    expect(parseCostRates('{"filmRatePerMeter":25}').filmRollWidthCm).toBe(60);
  });

  it("ค่าฟิล์ม: ลาย 30×20 ซม. 100 ตัว บนม้วน 60 ซม. เรต 40 บ/ม → 10 เมตร = 400 บาท", () => {
    // พื้นที่ 30*20*100 = 60,000 ตร.ซม. ÷ (60*100 ตร.ซม./เมตรวิ่ง) = 10 เมตร
    expect(estimateFilmCost({ widthCm: 30, heightCm: 20 }, 100, RATES)).toBe(400);
  });

  it("ลายไม่รู้ขนาด หรือเรตยังไม่ตั้ง → null (ห้ามโชว์เลขมั่ว)", () => {
    expect(estimateFilmCost({ widthCm: null, heightCm: 20 }, 100, RATES)).toBeNull();
    expect(estimateFilmCost({ widthCm: 30, heightCm: 20 }, 100, EMPTY_COST_RATES)).toBeNull();
  });

  it("ค่าแรง+โสหุ้ย = (5+3) × จำนวน · จำนวนติดลบไม่ทำให้ต้นทุนติดลบ", () => {
    expect(estimateLaborOverhead(100, RATES)).toBe(800);
    expect(estimateLaborOverhead(-5, RATES)).toBe(0);
  });

  it("costRatesConfigured: ค่า default = ยังไม่ตั้ง", () => {
    expect(costRatesConfigured(EMPTY_COST_RATES)).toBe(false);
    expect(costRatesConfigured(RATES)).toBe(true);
  });
});
