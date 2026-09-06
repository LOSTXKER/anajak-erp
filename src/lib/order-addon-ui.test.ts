import { describe, expect, it } from "vitest";
import { addonSelectValue, CUSTOM_ADDON_OPTION } from "./order-addon-ui";

const catalog = [
  { id: "c1", type: "SIZE_LABEL", name: "ป้ายไซส์" },
  { id: "c2", type: "NECK_LABEL", name: "ป้ายคอ" },
];

describe("addonSelectValue — ช่องส่วนเสริมช่องเดียวโชว์ตัวเลือกไหน", () => {
  it("แถวที่มาจากแค็ตตาล็อก → id ของรายการนั้น", () => {
    expect(addonSelectValue({ addonType: "SIZE_LABEL", name: "ป้ายไซส์" }, catalog)).toBe("c1");
  });
  it("ชื่อถูกแก้จนไม่ตรงแค็ตตาล็อก → อื่นๆ (ไม่แอบจับคู่ผิดตัว)", () => {
    expect(addonSelectValue({ addonType: "SIZE_LABEL", name: "ป้ายไซส์พิเศษ" }, catalog)).toBe(CUSTOM_ADDON_OPTION);
  });
  it("พิมพ์เอง (CUSTOM) → อื่นๆ แม้ชื่อจะเหมือนของในแค็ตตาล็อก", () => {
    expect(addonSelectValue({ addonType: "CUSTOM", name: "ป้ายไซส์" }, catalog)).toBe(CUSTOM_ADDON_OPTION);
  });
  it("ออเดอร์เก่าที่ไม่มีรหัสแต่มีชื่อ → อื่นๆ (ชื่อยังโชว์ให้แก้ได้)", () => {
    expect(addonSelectValue({ addonType: "", name: "ถุงซิป" }, catalog)).toBe(CUSTOM_ADDON_OPTION);
  });
  it("แถวใหม่ว่างเปล่า → ยังไม่เลือก", () => {
    expect(addonSelectValue({ addonType: "", name: "" }, catalog)).toBe("");
  });
});
