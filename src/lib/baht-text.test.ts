import { describe, it, expect } from "vitest";
import { bahtText } from "./baht-text";

// ตัวอักษรบนเอกสารเงินผิดไม่ได้ — ครอบทุกกฎไวยากรณ์ (เอ็ด/ยี่สิบ/ล้าน/สตางค์)

describe("bahtText", () => {
  it("จำนวนเต็มพื้นฐาน", () => {
    expect(bahtText(0)).toBe("ศูนย์บาทถ้วน");
    expect(bahtText(1)).toBe("หนึ่งบาทถ้วน");
    expect(bahtText(5)).toBe("ห้าบาทถ้วน");
    expect(bahtText(10)).toBe("สิบบาทถ้วน");
  });

  it("กฎ เอ็ด / ยี่สิบ", () => {
    expect(bahtText(11)).toBe("สิบเอ็ดบาทถ้วน");
    expect(bahtText(21)).toBe("ยี่สิบเอ็ดบาทถ้วน");
    expect(bahtText(20)).toBe("ยี่สิบบาทถ้วน");
    expect(bahtText(101)).toBe("หนึ่งร้อยเอ็ดบาทถ้วน");
    expect(bahtText(111)).toBe("หนึ่งร้อยสิบเอ็ดบาทถ้วน");
  });

  it("หลักร้อยถึงแสน", () => {
    expect(bahtText(100)).toBe("หนึ่งร้อยบาทถ้วน");
    expect(bahtText(1234)).toBe("หนึ่งพันสองร้อยสามสิบสี่บาทถ้วน");
    expect(bahtText(50000)).toBe("ห้าหมื่นบาทถ้วน");
    expect(bahtText(999999)).toBe("เก้าแสนเก้าหมื่นเก้าพันเก้าร้อยเก้าสิบเก้าบาทถ้วน");
  });

  it("หลักล้านและล้านซ้อน", () => {
    expect(bahtText(1_000_000)).toBe("หนึ่งล้านบาทถ้วน");
    expect(bahtText(1_000_001)).toBe("หนึ่งล้านเอ็ดบาทถ้วน");
    expect(bahtText(2_500_000)).toBe("สองล้านห้าแสนบาทถ้วน");
    expect(bahtText(11_000_000)).toBe("สิบเอ็ดล้านบาทถ้วน");
    expect(bahtText(1_000_000_000_000)).toBe("หนึ่งล้านล้านบาทถ้วน");
  });

  it("สตางค์", () => {
    expect(bahtText(0.25)).toBe("ศูนย์บาทยี่สิบห้าสตางค์");
    expect(bahtText(5.05)).toBe("ห้าบาทห้าสตางค์");
    expect(bahtText(1234.5)).toBe("หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์");
    expect(bahtText(99.99)).toBe("เก้าสิบเก้าบาทเก้าสิบเก้าสตางค์");
    expect(bahtText(1.01)).toBe("หนึ่งบาทหนึ่งสตางค์");
    expect(bahtText(21.21)).toBe("ยี่สิบเอ็ดบาทยี่สิบเอ็ดสตางค์");
  });

  it("เคสจริงจากระบบ (สูตร A)", () => {
    expect(bahtText(1284)).toBe("หนึ่งพันสองร้อยแปดสิบสี่บาทถ้วน");
    expect(bahtText(115.03)).toBe("หนึ่งร้อยสิบห้าบาทสามสตางค์");
    expect(bahtText(14770)).toBe("หนึ่งหมื่นสี่พันเจ็ดร้อยเจ็ดสิบบาทถ้วน");
  });

  it("ติดลบ (ใบลดหนี้)", () => {
    expect(bahtText(-500)).toBe("ลบห้าร้อยบาทถ้วน");
  });

  it("กัน float เพี้ยน", () => {
    expect(bahtText(0.1 + 0.2)).toBe("ศูนย์บาทสามสิบสตางค์");
    expect(bahtText(1284.0000000000002)).toBe("หนึ่งพันสองร้อยแปดสิบสี่บาทถ้วน");
  });
});
