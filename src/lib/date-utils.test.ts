import { describe, expect, it } from "vitest";
import {
  differenceInBangkokDays,
  formatDueDate,
  getMonthRange,
  getStartOfLastMonth,
  getStartOfMonth,
} from "./date-utils";

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

// ยืนยันด้วย ISO (UTC) ไม่ใช่ปี/เดือนของเครื่อง — ถ้ายึดเวลาเครื่อง เคสพวกนี้จะพังบน Vercel (UTC)
// แต่ผ่านบนเครื่องที่ตั้งเวลาไทย ซึ่งเป็นสาเหตุที่บั๊กนี้ซ่อนอยู่ได้นาน
describe("เส้นแบ่งเดือนตามปฏิทินไทย", () => {
  it("00:30 ของวันที่ 1 เวลาไทย ยังอยู่ใน 'เดือนนี้'", () => {
    const justAfterMidnight = new Date("2026-09-01T00:30:00+07:00");
    const start = getStartOfMonth(justAfterMidnight);
    expect(start.toISOString()).toBe("2026-08-31T17:00:00.000Z");
    expect(justAfterMidnight.getTime()).toBeGreaterThanOrEqual(start.getTime());
  });

  it("23:30 ของวันสิ้นเดือนเวลาไทย ยังไม่ข้ามไปเดือนหน้า", () => {
    const lastMinuteOfMonth = new Date("2026-08-31T23:30:00+07:00");
    expect(getStartOfMonth(lastMinuteOfMonth).toISOString()).toBe("2026-07-31T17:00:00.000Z");
  });

  it("เดือนก่อนข้ามปีได้", () => {
    expect(getStartOfLastMonth(new Date("2026-01-01T00:30:00+07:00")).toISOString()).toBe(
      "2025-11-30T17:00:00.000Z",
    );
  });

  it("ช่วงเดือน [start, end) ครอบทั้งเดือนตามเวลาไทย", () => {
    const { start, end } = getMonthRange(0, new Date("2026-09-18T09:00:00+07:00"));
    expect(start.toISOString()).toBe("2026-08-31T17:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-30T17:00:00.000Z");
    // ของที่เปิดต้นเดือนและปลายเดือน (เวลาไทย) ต้องตกอยู่ในถังเดียวกัน
    for (const at of ["2026-09-01T00:30:00+07:00", "2026-09-30T23:30:00+07:00"]) {
      expect(new Date(at).getTime()).toBeGreaterThanOrEqual(start.getTime());
      expect(new Date(at).getTime()).toBeLessThan(end.getTime());
    }
  });

  it("ย้อนหลังหลายเดือนข้ามปีได้", () => {
    const { start, end } = getMonthRange(9, new Date("2026-09-18T09:00:00+07:00"));
    expect(start.toISOString()).toBe("2025-11-30T17:00:00.000Z");
    expect(end.toISOString()).toBe("2025-12-31T17:00:00.000Z");
  });
});

describe("formatDueDate", () => {
  const thisYear = new Date("2026-09-18T09:00:00+07:00");

  it("ปีเดียวกับวันนี้ไม่ใส่ปี", () => {
    expect(formatDueDate(new Date("2026-09-18T09:00:00+07:00"), thisYear)).toBe("18 ก.ย.");
  });

  it("คนละปีใส่ปี พ.ศ. 2 หลัก", () => {
    expect(formatDueDate(new Date("2027-01-05T09:00:00+07:00"), thisYear)).toBe("5 ม.ค. 70");
    expect(formatDueDate(new Date("2025-12-30T09:00:00+07:00"), thisYear)).toBe("30 ธ.ค. 68");
  });

  it("ตัดสินวันและปีด้วยเวลาไทย ไม่ใช่ UTC", () => {
    // 2026-09-17T18:00Z = 18 ก.ย. 01:00 น. ที่ไทย
    expect(formatDueDate("2026-09-17T18:00:00Z", thisYear)).toBe("18 ก.ย.");
    // 2026-12-31T18:00Z = 1 ม.ค. 2027 ที่ไทย → ข้ามปีแล้ว ต้องมีปี
    expect(formatDueDate("2026-12-31T18:00:00Z", thisYear)).toBe("1 ม.ค. 70");
  });
});
