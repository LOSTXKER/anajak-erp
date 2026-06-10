import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { D, round2, moneyInput, sumMoney, aggToNumber } from "./money";

describe("round2 — ปัดเงิน half-up 2 ตำแหน่ง", () => {
  it("ครึ่งสตางค์ปัดขึ้น (ค่าจาก string = เลขแน่นอน)", () => {
    expect(round2(D("1.005")).toNumber()).toBe(1.01);
    expect(round2(D("7.525")).toNumber()).toBe(7.53);
    expect(round2(D("2.004")).toNumber()).toBe(2.0);
  });
});

describe("moneyInput — ค่าจากผู้ใช้ (zod number)", () => {
  it("บังคับเหลือ 2 ตำแหน่ง", () => {
    expect(moneyInput(100.4).toNumber()).toBe(100.4);
    expect(moneyInput(100.456).toNumber()).toBe(100.46);
  });
});

describe("sumMoney", () => {
  it("รวมเลขทศนิยมที่ float บวกพลาด (0.1+0.2)", () => {
    expect(sumMoney([0.1, 0.2]).toNumber()).toBe(0.3);
    expect(sumMoney([]).toNumber()).toBe(0);
  });
});

describe("aggToNumber — ผล aggregate ที่ extension ไม่ครอบ", () => {
  it("Decimal → number · number ผ่านตรง · null/undefined → 0", () => {
    expect(aggToNumber(new Prisma.Decimal("123.45"))).toBe(123.45);
    expect(aggToNumber(99)).toBe(99);
    expect(aggToNumber(null)).toBe(0);
    expect(aggToNumber(undefined)).toBe(0);
  });
});
