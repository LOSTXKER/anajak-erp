import { describe, expect, it } from "vitest";
import { describeHomeOrder, type HomeOrderLike } from "./home-orders";
import { describeOrderProgress } from "./order-progress";

/**
 * งานแก้/เคลมต้องโผล่ใน "ต้องจัดการ" ก่อนทุกเหตุ (ก้อน 1)
 *
 * ปัญหาเดิม: ออเดอร์ที่ส่งแล้ว/ปิดแล้วถูกตัดออกจากทุกคิวเพราะถือว่าจบ — พอของตีกลับ
 * กระดิ่งดังครั้งเดียวแล้วเรื่องก็หายไปจากทุกจอ เทสต์นี้ล็อกว่ากฎเดียวที่แก้ครอบทั้ง 4 จอ
 */
const BASE: HomeOrderLike = {
  orderNumber: "ORD-2609-0001",
  internalStatus: "SHIPPED",
  dueInDays: null,
  currentStep: null,
  stepsDone: 0,
  stepsTotal: 0,
  waitingCustomerDays: null,
  vendor: null,
  stuckDays: null,
  ready: false,
};

describe("describeHomeOrder — งานแก้มาก่อนทุกเหตุ", () => {
  it("ออเดอร์ที่ส่งแล้วและไม่มีเคลม = ไม่ขึ้นต้องจัดการ (พฤติกรรมเดิม)", () => {
    expect(describeHomeOrder(BASE)).toBeNull();
  });

  it("ส่งแล้วแต่มีงานแก้ค้าง = ขึ้นต้องจัดการ กลุ่มบนสุด", () => {
    const problem = describeHomeOrder({
      ...BASE,
      claim: { round: 2, label: "งานแก้ รอบที่ 2 · 12 ตัว · รอตัดสิน" },
    });
    expect(problem).not.toBeNull();
    expect(problem!.group).toBe("claim");
    expect(problem!.kind).toBe("claim");
    expect(problem!.tone).toBe("danger");
    expect(problem!.label).toBe("งานแก้ รอบที่ 2 · 12 ตัว · รอตัดสิน");
  });

  it("งานแก้มาก่อนแม้ใบนั้นจะเลยกำหนดส่งด้วย", () => {
    const problem = describeHomeOrder({
      ...BASE,
      internalStatus: "PRODUCING",
      dueInDays: -5,
      claim: { round: 1, label: "งานแก้ รอบที่ 1 · รอตัดสิน" },
    });
    expect(problem!.kind).toBe("claim");
  });
});

describe("describeOrderProgress — ส่งต่อใบเคลมให้ทุกจอที่ include มา", () => {
  const now = new Date("2026-09-18T10:00:00+07:00");
  const source = {
    orderNumber: "ORD-2609-0001",
    internalStatus: "SHIPPED" as const,
    deadline: null,
    updatedAt: now,
    designs: [],
    revisions: [],
    productions: [],
  };

  it("query ที่ไม่ include ใบเคลม = ไม่มีผลใดๆ", () => {
    expect(describeOrderProgress(source, now).claim).toBeNull();
  });

  it("ใบเคลมที่ยังไม่จบ ถูกแปลงเป็นข้อความพร้อมรอบและจำนวน", () => {
    const progress = describeOrderProgress(
      {
        ...source,
        claims: [
          { round: 1, state: "CLOSED", resolution: "REWORK", lines: [{ qtyClaimed: 5 }] },
          { round: 2, state: "OPEN", resolution: null, lines: [{ qtyClaimed: 7 }, { qtyClaimed: 5 }] },
        ],
      },
      now,
    );
    expect(progress.claim).toEqual({ round: 2, label: "งานแก้ รอบที่ 2 · 12 ตัว · รอตัดสิน" });
  });

  it("ใบที่จบไปแล้วทั้งหมด = ไม่ค้างในคิว", () => {
    const progress = describeOrderProgress(
      { ...source, claims: [{ round: 1, state: "CLOSED", resolution: "REWORK", lines: [] }] },
      now,
    );
    expect(progress.claim).toBeNull();
  });
});
