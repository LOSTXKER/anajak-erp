import { describe, expect, it } from "vitest";
import {
  QUOTATION_STATUS_TRANSITIONS,
  canQuotationTransition,
  type QuotationStatus,
} from "./quotation-status";

const ALL: QuotationStatus[] = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED"];

describe("canQuotationTransition (Gate A3)", () => {
  it("CONVERTED เป็นปลายทางตายตัว — ย้อนไปสถานะไหนไม่ได้เลย (กัน convert ซ้ำเป็นออเดอร์ซ้อน)", () => {
    for (const to of ALL) {
      expect(canQuotationTransition("CONVERTED", to)).toBe(false);
    }
  });

  it("ไม่มีสถานะไหนตั้งเป็น CONVERTED ผ่าน updateStatus — ต้องผ่าน convertToOrder เท่านั้น", () => {
    for (const from of ALL) {
      expect(QUOTATION_STATUS_TRANSITIONS[from]).not.toContain("CONVERTED");
    }
  });

  it("SENT ดึงกลับเป็นร่างได้ (ทางออกเดียวของการแก้ใบที่ส่งแล้ว)", () => {
    expect(canQuotationTransition("SENT", "DRAFT")).toBe(true);
  });

  it("DRAFT ส่งได้ และบันทึกตกลงตรงได้ (เคสตกลงกันใน LINE ไม่เคยกดส่ง)", () => {
    expect(canQuotationTransition("DRAFT", "SENT")).toBe(true);
    expect(canQuotationTransition("DRAFT", "ACCEPTED")).toBe(true);
    expect(canQuotationTransition("DRAFT", "REJECTED")).toBe(false);
    expect(canQuotationTransition("DRAFT", "EXPIRED")).toBe(false);
  });

  it("ACCEPTED ถอยได้แค่กลับร่าง (ขอแก้ราคา) หรือปฏิเสธ (เปลี่ยนใจ) — ห้ามกลับ SENT", () => {
    expect(canQuotationTransition("ACCEPTED", "DRAFT")).toBe(true);
    expect(canQuotationTransition("ACCEPTED", "REJECTED")).toBe(true);
    expect(canQuotationTransition("ACCEPTED", "SENT")).toBe(false);
  });

  it("EXPIRED/REJECTED ปลุกกลับได้ทางเดียวคือร่าง — ห้ามข้ามไปตกลงทันที (ราคาต้องยืนใหม่ก่อน)", () => {
    expect(canQuotationTransition("EXPIRED", "DRAFT")).toBe(true);
    expect(canQuotationTransition("EXPIRED", "ACCEPTED")).toBe(false);
    expect(canQuotationTransition("REJECTED", "DRAFT")).toBe(true);
    expect(canQuotationTransition("REJECTED", "ACCEPTED")).toBe(false);
  });

  it("สถานะไม่รู้จัก = fail-closed ไปไหนไม่ได้", () => {
    expect(canQuotationTransition("WEIRD", "DRAFT")).toBe(false);
    expect(canQuotationTransition("", "SENT")).toBe(false);
  });
});
