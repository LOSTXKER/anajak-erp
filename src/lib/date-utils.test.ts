import { describe, expect, it } from "vitest";
import { differenceInBangkokDays } from "./date-utils";

describe("differenceInBangkokDays", () => {
  it("วันที่ UTC ต่างกัน แต่ยังเป็นวันเดียวกันที่ไทย", () => {
    expect(differenceInBangkokDays("2026-09-08T17:30:00Z", "2026-09-09T16:30:00Z")).toBe(0);
  });

  it("ข้ามเที่ยงคืนไทยเพียงนาทีเดียวก็นับเป็นพรุ่งนี้", () => {
    expect(differenceInBangkokDays("2026-09-08T17:00:00Z", "2026-09-08T16:59:00Z")).toBe(1);
  });

  it("เมื่อเลยเที่ยงคืนไทย กำหนดส่งเมื่อวานเป็นลบหนึ่งวัน", () => {
    expect(differenceInBangkokDays("2026-09-08T16:59:00Z", "2026-09-08T17:00:00Z")).toBe(-1);
  });

  it.each([
    ["2026-10-01T00:01:00+07:00", "2026-09-30T23:59:00+07:00", 1],
    ["2027-01-01T00:01:00+07:00", "2026-12-31T23:59:00+07:00", 1],
    ["2028-03-01T00:01:00+07:00", "2028-02-28T23:59:00+07:00", 2],
    ["2026-03-09T00:01:00+07:00", "2026-03-07T23:59:00+07:00", 2],
  ])("ข้ามเดือน ปี และวันเปลี่ยนเวลาเครื่อง: %s", (target, reference, expected) => {
    expect(differenceInBangkokDays(target, reference)).toBe(expected);
  });

  it("รับ Date, timestamp และวันที่ไม่มีเวลาได้", () => {
    const reference = new Date("2026-09-09T09:00:00+07:00");
    expect(differenceInBangkokDays(new Date("2026-09-10T00:00:00+07:00"), reference.getTime())).toBe(1);
    expect(differenceInBangkokDays("2026-09-09", reference)).toBe(0);
    expect(differenceInBangkokDays(0, 0)).toBe(0);
  });

  it("ไม่มีวันที่หรือวันที่ไม่ถูกต้องไม่กลายเป็นวันนี้", () => {
    const reference = new Date("2026-09-09T09:00:00+07:00");
    for (const target of [null, undefined, "", "invalid", new Date(Number.NaN)]) {
      expect(differenceInBangkokDays(target, reference)).toBeNull();
    }
    expect(differenceInBangkokDays(reference, new Date(Number.NaN))).toBeNull();
  });
});
