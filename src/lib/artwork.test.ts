import { describe, expect, it } from "vitest";
import { artworkSpecGaps, buildArtworkName } from "./artwork";

describe("buildArtworkName", () => {
  it("ครบทุกส่วน: ตำแหน่ง · ชนิด · ขนาด", () => {
    expect(
      buildArtworkName({ position: "FRONT", printType: "DTF", width: 21, height: 29.7 })
    ).toBe("หน้า · DTF · 21×29.7 ซม.");
  });

  it("ขนาดไม่ครบ (กว้างอย่างเดียว/ศูนย์) ไม่โชว์ขนาด", () => {
    expect(buildArtworkName({ position: "BACK", printType: "DTG", width: 20, height: 0 })).toBe(
      "หลัง · DTG"
    );
    expect(buildArtworkName({ position: "BACK", printType: "DTG" })).toBe("หลัง · DTG");
  });

  it("position นอก dictionary ใช้ค่าดิบ (free string ใน DB)", () => {
    expect(buildArtworkName({ position: "CHEST_LEFT", printType: "DTF" })).toBe(
      "CHEST_LEFT · DTF"
    );
  });

  it("ไม่มีข้อมูลเลย = ชื่อ fallback", () => {
    expect(buildArtworkName({})).toBe("ลายไม่ระบุชื่อ");
  });
});

describe("artworkSpecGaps", () => {
  it("สเปกครบ = ไม่มี gap", () => {
    expect(
      artworkSpecGaps({ widthCm: 21, heightCm: 29.7, heatTempC: 160, heatPressSec: 15 })
    ).toEqual([]);
  });

  it("ขาดอะไรบอกอันนั้น", () => {
    expect(artworkSpecGaps({ widthCm: 21, heightCm: null, heatTempC: null, heatPressSec: 15 })).toEqual([
      "ขนาดลาย",
      "อุณหภูมิรีด",
    ]);
    expect(artworkSpecGaps({})).toEqual(["ขนาดลาย", "อุณหภูมิรีด", "เวลารีด"]);
  });
});
