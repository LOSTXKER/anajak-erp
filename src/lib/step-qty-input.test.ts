import { describe, expect, it } from "vitest";
import { validateStepQtyInput } from "@/lib/step-qty-input";

describe("validateStepQtyInput", () => {
  it("accepts a positive whole number up to the remaining quantity", () => {
    expect(validateStepQtyInput("7", 10)).toEqual({ added: 7, error: null });
    expect(validateStepQtyInput("10", 10)).toEqual({ added: 10, error: null });
  });

  it.each(["", "abc", "1.5", "0", "-1"])("rejects invalid quantity %j", (value) => {
    expect(validateStepQtyInput(value, 10).error).not.toBeNull();
    expect(validateStepQtyInput(value, 10).added).toBe(0);
  });

  it("rejects an over-limit value instead of silently clamping it", () => {
    expect(validateStepQtyInput("11", 10)).toEqual({
      added: 0,
      error: "ทำเพิ่มได้ไม่เกิน 10 ตัว — แก้ตัวเลขก่อนบันทึก",
    });
  });
});
