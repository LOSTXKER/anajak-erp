import { describe, it, expect } from "vitest";
import { formatAmount, formatBaht, formatBahtRounded } from "./format";

/* กฎที่เบสเคาะ 2026-09-18 — ล็อกไว้กันกลับไปเป็น "0–2 ตำแหน่งตามค่า" อีก
   (ของเดิมทำให้ยอด .50 โผล่เป็น "฿1,449.5" ข้างช่องกรอกที่เป็น 1449.50) */

describe("formatBaht — ยอดเต็ม ทศนิยม 2 ตำแหน่งเสมอ", () => {
  it("ยอดลงท้าย .5 ต้องเป็น .50 ไม่ใช่ .5", () => {
    expect(formatBaht(1449.5)).toBe("฿1,449.50");
  });

  it("จำนวนเต็มก็ยังมี .00", () => {
    expect(formatBaht(1449)).toBe("฿1,449.00");
    expect(formatBaht(1234567)).toBe("฿1,234,567.00");
  });

  it("ศูนย์ = ฿0.00", () => {
    expect(formatBaht(0)).toBe("฿0.00");
  });

  it("ติดลบ: เครื่องหมายอยู่หน้า ฿ ไม่ใช่ ฿-", () => {
    expect(formatBaht(-1449.5)).toBe("-฿1,449.50");
  });

  it("เศษติดลบจาก floating-point ที่ปัดแล้วเป็นศูนย์ ต้องไม่ขึ้น -฿0.00", () => {
    expect(formatBaht(-0.004)).toBe("฿0.00");
  });
});

describe("formatBahtRounded — ช่องตัวเลขใหญ่ ไม่มีทศนิยมเลย", () => {
  it("ตัดทศนิยมทิ้งทุกค่า ไม่ใช่ตัดเฉพาะที่ลงตัว", () => {
    expect(formatBahtRounded(1449.5)).toBe("฿1,450");
    expect(formatBahtRounded(1449.4)).toBe("฿1,449");
    expect(formatBahtRounded(1449)).toBe("฿1,449");
  });

  it("ศูนย์ = ฿0 · ติดลบเครื่องหมายอยู่หน้า ฿", () => {
    expect(formatBahtRounded(0)).toBe("฿0");
    expect(formatBahtRounded(-1449.5)).toBe("-฿1,450");
  });

  it("ยอดติดลบที่ปัดแล้วเหลือศูนย์ ต้องไม่ขึ้น -฿0", () => {
    expect(formatBahtRounded(-0.4)).toBe("฿0");
  });
});

describe("formatAmount — เลขเปล่าสำหรับข้อความที่ลงท้ายด้วย 'บาท'", () => {
  it("ไม่มี ฿ นำหน้า (ไม่งั้นข้อความทวงหนี้จะเป็น '฿1,449.00 บาท')", () => {
    expect(formatAmount(1449.5)).toBe("1,449.50");
    expect(formatAmount(1449)).toBe("1,449.00");
    expect(formatAmount(0)).toBe("0.00");
    expect(formatAmount(-1449.5)).toBe("-1,449.50");
  });
});
