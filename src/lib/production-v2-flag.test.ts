import { describe, expect, it } from "vitest";
import { productionV2Enabled } from "./production-v2-flag";

describe("productionV2Enabled", () => {
  it.each(["1", "true"])("เปิดเฉพาะค่าที่ระบุชัด (%s)", (value) => {
    expect(productionV2Enabled(value)).toBe(true);
  });

  it.each([undefined, "", "0", "false", "yes"])("ปิดเป็นค่าเริ่มต้น (%s)", (value) => {
    expect(productionV2Enabled(value)).toBe(false);
  });
});
