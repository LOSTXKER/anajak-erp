import { describe, expect, it } from "vitest";
import { describeReworkForCustomer, type CustomerReworkInput } from "./claim-customer";

/**
 * สิ่งที่ลูกค้าเห็นตอนงานเข้ารอบแก้ (ก้อน 1)
 *
 * สองเจตนาที่ล็อกไว้ที่นี่:
 *   1. หน้าติดตามงานต้องไม่เดินถอยหลังเงียบๆ — มีรอบแก้เมื่อไรต้องมีคำอธิบายเสมอ
 *   2. คำที่ออกไปต้องไม่มีเงิน ไม่มีคนผิด ไม่มีเลขใบเคลม (หน้านั้นเปิดได้โดยไม่ต้องล็อกอิน
 *      และลูกค้า reseller ส่งลิงก์ต่อให้ปลายทางได้)
 */
const BASE: CustomerReworkInput = {
  round: 2,
  state: "OPEN",
  resolution: null,
  customerMessage: null,
  reworkSteps: 0,
  openReworkSteps: 0,
};

describe("describeReworkForCustomer — ขั้นที่ลูกค้าเห็น", () => {
  it("ไม่มีเรื่องค้าง = ไม่มีอะไรโผล่บนหน้าลูกค้า", () => {
    expect(describeReworkForCustomer(null)).toBeNull();
  });

  it("ใบที่ปิด/ยกเลิกแล้ว ต้องหายจากหน้าลูกค้า ไม่ค้างเป็นป้ายถาวร", () => {
    expect(describeReworkForCustomer({ ...BASE, state: "CLOSED" })).toBeNull();
    expect(describeReworkForCustomer({ ...BASE, state: "CANCELLED" })).toBeNull();
  });

  it("เพิ่งรับเรื่อง = อยู่ขั้นแรกของแถบสามขั้น", () => {
    const view = describeReworkForCustomer(BASE)!;
    expect(view.stage).toBe("RECEIVED");
    expect(view.steps.map((s) => s.state)).toEqual(["current", "todo", "todo"]);
  });

  it("ตัดสินว่าซ่อม = บอกว่ากำลังแก้ให้ แม้ยังไม่ได้ปล่อยเข้าสายผลิต", () => {
    const view = describeReworkForCustomer({ ...BASE, state: "DECIDED", resolution: "REWORK" })!;
    expect(view.stage).toBe("FIXING");
    expect(view.headline).toBe("กำลังแก้งานให้");
    expect(view.steps.map((s) => s.state)).toEqual(["done", "current", "todo"]);
  });

  it("งานแก้ในสายผลิตจบครบแล้ว = ขยับไปขั้นเตรียมส่งกลับ", () => {
    const view = describeReworkForCustomer({
      ...BASE,
      state: "DECIDED",
      resolution: "REPLACE",
      reworkSteps: 3,
      openReworkSteps: 0,
    })!;
    expect(view.stage).toBe("SENDING_BACK");
    expect(view.steps.map((s) => s.state)).toEqual(["done", "done", "current"]);
  });

  it("ยังเหลือขั้นงานแก้ = ยังไม่ใช่ขั้นเตรียมส่งกลับ", () => {
    const view = describeReworkForCustomer({
      ...BASE,
      state: "DECIDED",
      resolution: "REWORK",
      reworkSteps: 3,
      openReworkSteps: 1,
    })!;
    expect(view.stage).toBe("FIXING");
  });

  it("ทางที่ไม่ได้แตะของ (ลดราคา/คืนเงิน/ไม่รับเคลม) = ไม่ขึ้นแถบส่งกลับให้ใหม่", () => {
    for (const resolution of ["DISCOUNT", "REFUND", "GOODWILL", "REJECTED", "EXTRA_CHARGE"]) {
      const view = describeReworkForCustomer({ ...BASE, state: "DECIDED", resolution })!;
      expect(view.stage).toBe("SETTLING");
      expect(view.steps).toEqual([]);
    }
  });

  it("ร้านเขียนข้อความเองได้ และข้อความนั้นชนะคำปริยาย", () => {
    const view = describeReworkForCustomer({
      ...BASE,
      state: "DECIDED",
      resolution: "REWORK",
      customerMessage: "  ทำใหม่ให้ 12 ตัว ส่งกลับวันศุกร์นี้ค่ะ  ",
    })!;
    expect(view.note).toBe("ทำใหม่ให้ 12 ตัว ส่งกลับวันศุกร์นี้ค่ะ");
  });

  it("ข้อความว่างเปล่า/เว้นวรรคล้วน = ถอยไปใช้คำปริยาย ไม่ปล่อยช่องว่างบนจอ", () => {
    const view = describeReworkForCustomer({ ...BASE, customerMessage: "   " })!;
    expect(view.note).toBe(STAGE_NOTE_RECEIVED);
    expect(view.note.length).toBeGreaterThan(0);
  });

  it("คำที่ออกไปต้องไม่มีเงิน ไม่มีคนผิด ไม่มีคำว่าเคลม", () => {
    const forbidden = ["เคลม", "บาท", "ลดราคา", "คืนเงิน", "ร้านผิด", "ลูกค้าผิด", "CLM"];
    for (const state of ["OPEN", "DECIDED"]) {
      for (const resolution of ["REWORK", "REPLACE", "DISCOUNT", "REFUND", "GOODWILL", "REJECTED"]) {
        const view = describeReworkForCustomer({ ...BASE, state, resolution })!;
        const text = `${view.headline} ${view.note} ${view.steps.map((s) => s.label).join(" ")}`;
        for (const word of forbidden) expect(text).not.toContain(word);
      }
    }
  });
});

const STAGE_NOTE_RECEIVED = "ทีมงานได้รับเรื่องแล้ว กำลังดูให้ว่าจะแก้ให้อย่างไร แล้วจะติดต่อกลับ";
