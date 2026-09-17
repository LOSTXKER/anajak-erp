import { describe, it, expect } from "vitest";
import {
  BANGKOK_TZ,
  daysAgoText,
  formatBaht,
  formatDateFull,
  formatDateNumeric,
  timeAgo,
} from "./utils";
import { formatBaht as formatBahtFromModule } from "./format";

describe("re-export เงินจาก lib/format", () => {
  it("เรียกผ่าน utils หรือ format ก็ได้ผลเดียวกัน", () => {
    expect(formatBaht(1449.5)).toBe(formatBahtFromModule(1449.5));
  });
});

describe("timeAgo — ถ้อยคำชุด '…ก่อน' ชุดเดียวทั้งเว็บ", () => {
  const now = Date.UTC(2026, 8, 18, 10, 0, 0);
  const ago = (ms: number) => timeAgo(new Date(now - ms), now);

  it("ต่ำกว่านาที = เมื่อสักครู่", () => {
    expect(ago(30 * 1000)).toBe("เมื่อสักครู่");
  });

  it("นาที/ชั่วโมง/วัน ใช้คำว่า 'ก่อน' ไม่ใช่ 'ที่แล้ว'", () => {
    expect(ago(5 * 60 * 1000)).toBe("5 นาทีก่อน");
    expect(ago(3 * 60 * 60 * 1000)).toBe("3 ชั่วโมงก่อน");
    expect(ago(3 * 24 * 60 * 60 * 1000)).toBe("3 วันก่อน");
  });

  it("เกิน 7 วันขึ้นสัปดาห์ · เกิน 4 สัปดาห์ขึ้นเดือน", () => {
    expect(ago(10 * 24 * 60 * 60 * 1000)).toBe("1 สัปดาห์ก่อน");
    expect(ago(40 * 24 * 60 * 60 * 1000)).toBe("1 เดือนก่อน");
  });

  it("นับเป็นช่วง 24 ชม. ไม่ใช่วันตามปฏิทิน — เมื่อวานสี่ทุ่มยังเป็นชั่วโมง", () => {
    // 22:00 ของเมื่อวานเวลาไทย = 15:00Z · ตอนนี้ 10:00Z วันถัดมา = ห่าง 19 ชม.
    expect(timeAgo(new Date(Date.UTC(2026, 8, 17, 15, 0, 0)), now)).toBe("19 ชั่วโมงก่อน");
  });
});

describe("daysAgoText — ให้หน้าที่นับวันตามปฏิทินไทยเองใช้คำชุดเดียวกัน", () => {
  it("0 วัน = วันนี้ (ไม่ใช่ '0 วันก่อน')", () => {
    expect(daysAgoText(0)).toBe("วันนี้");
  });

  it("นับเป็นวัน/สัปดาห์/เดือนตามช่วงเดียวกับ timeAgo", () => {
    expect(daysAgoText(3)).toBe("3 วันก่อน");
    expect(daysAgoText(10)).toBe("1 สัปดาห์ก่อน");
    expect(daysAgoText(40)).toBe("1 เดือนก่อน");
  });
});

describe("formatDateFull — วันที่เต็มมีชื่อวัน", () => {
  const d = new Date("2026-09-18T10:00:00Z");

  it("ได้ปี พ.ศ. เท่ากับ locale 'th-TH-u-ca-buddhist' ที่หน้าแรกเคยเขียนไว้", () => {
    const buddhist = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: BANGKOK_TZ,
    }).format(d);
    expect(formatDateFull(d)).toBe(buddhist);
    expect(formatDateFull(d)).toContain("2569");
  });

  it("ยึดเวลาไทย — ห้าทุ่มครึ่ง UTC ยังเป็นวันถัดไปของไทย", () => {
    expect(formatDateFull(new Date("2026-09-18T17:30:00Z"))).toContain("19");
  });
});

describe("formatDateNumeric — วันที่ในไฟล์ที่ดาวน์โหลด", () => {
  it("DD/MM/พ.ศ. เติมศูนย์หน้า และเป็น พ.ศ. ไม่ใช่ ค.ศ.", () => {
    expect(formatDateNumeric(new Date("2026-09-08T03:00:00Z"))).toBe("08/09/2569");
  });

  it("เที่ยงคืนตามเวลาไทย = วันใหม่ ถึงเครื่องที่กดโหลดจะเป็น UTC (17:00Z ของวันก่อน)", () => {
    // เครื่อง UTC อ่านเวลานี้เป็น 17 ก.ย. · ไฟล์ต้องเขียน 18 เหมือนที่คนไทยเห็นบนจอ
    expect(formatDateNumeric(new Date("2026-09-17T17:00:00Z"))).toBe("18/09/2569");
  });

  it("หัวค่ำเวลาไทยยังเป็นวันเดิม (ปลายวันที่ UTC ข้ามไปแล้ว)", () => {
    expect(formatDateNumeric(new Date("2026-09-18T17:30:00Z"))).toBe("19/09/2569");
    expect(formatDateNumeric(new Date("2026-09-18T16:59:00Z"))).toBe("18/09/2569");
  });

  it("รับ string/number ได้เหมือน helper วันที่ตัวอื่น", () => {
    const iso = "2026-01-31T12:00:00Z";
    expect(formatDateNumeric(iso)).toBe("31/01/2569");
    expect(formatDateNumeric(new Date(iso).getTime())).toBe("31/01/2569");
  });
});
