import { describe, expect, it } from "vitest";
import { redactCostFields } from "./cost-response";

describe("redactCostFields", () => {
  const response = {
    id: "row-1",
    name: "ฟิล์ม DTF",
    unitCost: 12,
    totalCost: 24,
    costPrice: 11,
  };

  it("ลบ cost keys ออกจาก response เมื่อไม่มีสิทธิ์การเงิน", () => {
    const result = redactCostFields(response, false);

    expect(result).toEqual({ id: "row-1", name: "ฟิล์ม DTF" });
    expect(response).toHaveProperty("unitCost", 12);
  });

  it("คืน response เดิมครบเมื่อมีสิทธิ์การเงิน", () => {
    const result = redactCostFields(response, true);

    expect(result).toBe(response);
    expect(result).toMatchObject({ unitCost: 12, totalCost: 24, costPrice: 11 });
  });
});
