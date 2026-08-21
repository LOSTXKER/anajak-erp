import { describe, expect, it } from "vitest";
import { canUseStationShirtDiagram } from "./station-work-visual";

describe("canUseStationShirtDiagram", () => {
  it("ให้ใช้เฉพาะ item ที่เป็นทรงเสื้อทั้งหมด", () => {
    expect(canUseStationShirtDiagram(["T_SHIRT", "POLO"])).toBe(true);
    expect(canUseStationShirtDiagram(["CAP"])).toBe(false);
    expect(canUseStationShirtDiagram(["T_SHIRT", "TOTE_BAG"])).toBe(false);
    expect(canUseStationShirtDiagram(["OTHER"])).toBe(false);
    expect(canUseStationShirtDiagram([])).toBe(false);
  });
});
