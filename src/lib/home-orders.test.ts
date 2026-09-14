import { describe, expect, it } from "vitest";
import {
  describeHomeOrder,
  matchesHomeFilter,
  sortHomeOrders,
  type HomeOrderLike,
} from "./home-orders";

function order(over: Partial<HomeOrderLike> = {}): HomeOrderLike {
  return {
    orderNumber: "ORD-2609-0100",
    internalStatus: "PRODUCING",
    dueInDays: 5,
    currentStep: { label: "รีดร้อน", assigneeName: "นนท์", outsource: false },
    stepsDone: 3,
    stepsTotal: 5,
    waitingCustomerDays: null,
    vendor: null,
    stuckDays: 0,
    ready: false,
    ...over,
  };
}

describe("describeHomeOrder — เหตุที่ต้องจัดการหนึ่งอย่างต่อใบ", () => {
  it("เลยกำหนดเพราะร้านนอก บอกชื่อร้านและวันที่เลยรับ", () => {
    const problem = describeHomeOrder(
      order({ dueInDays: -2, vendor: { name: "ร้านสกรีนบางพลี", overdueDays: 2 } }),
    );
    expect(problem).toMatchObject({ group: "late", kind: "vendor-late", tone: "danger" });
    expect(problem?.label).toBe("ร้านสกรีนบางพลี · เลยรับ 2 วัน");
  });

  it("เลยกำหนดในโรงงาน บอกขั้นที่ค้างและผู้ทำ", () => {
    const problem = describeHomeOrder(order({ dueInDays: -1 }));
    expect(problem).toMatchObject({ group: "late", kind: "overdue", label: "ค้างขั้น รีดร้อน", who: "นนท์" });
  });

  it("ส่งวันนี้: แพ็กแล้วเป็นสีสำเร็จ · ยังทำอยู่บอกขั้นที่ถึง", () => {
    expect(describeHomeOrder(order({ dueInDays: 0, ready: true, internalStatus: "READY_TO_SHIP" }))).toMatchObject({
      group: "today",
      kind: "ready",
      tone: "success",
    });
    expect(describeHomeOrder(order({ dueInDays: 0 }))).toMatchObject({
      group: "today",
      kind: "in-progress",
      tone: "warning",
      label: "รีดร้อน · ขั้น 4/5",
    });
  });

  it("รอลูกค้าอนุมัติแบบ: ส่งพรุ่งนี้ = เตือน · ยังอีกหลายวัน = ปกติ", () => {
    expect(describeHomeOrder(order({ dueInDays: 1, waitingCustomerDays: 2, currentStep: null, internalStatus: "DESIGNING" }))).toMatchObject({
      group: "wait",
      kind: "customer",
      tone: "warning",
      label: "รอลูกค้าอนุมัติแบบ · 2 วัน",
    });
    expect(describeHomeOrder(order({ dueInDays: 6, waitingCustomerDays: 1 }))?.tone).toBe("neutral");
  });

  it("อยู่ร้านนอกยังไม่ถึงกำหนด = รอรับกลับ (ไม่แดง)", () => {
    expect(describeHomeOrder(order({ vendor: { name: "ร้านปัก", overdueDays: 0 } }))).toMatchObject({
      group: "wait",
      kind: "vendor",
      tone: "neutral",
      label: "ร้านปัก · รอรับกลับ",
    });
  });

  it("นิ่งเกิน 3 วันถึงนับว่าไม่ขยับ · ปกติคืน null", () => {
    expect(describeHomeOrder(order({ stuckDays: 4, currentStep: null, internalStatus: "CONFIRMED" }))).toMatchObject({
      group: "stuck",
      label: "ยืนยันออเดอร์ · ไม่มีความเคลื่อนไหว 4 วัน",
    });
    expect(describeHomeOrder(order({ stuckDays: 2 }))).toBeNull();
  });
});

describe("sortHomeOrders / matchesHomeFilter", () => {
  const late = order({ orderNumber: "A", dueInDays: -2 });
  const today = order({ orderNumber: "B", dueInDays: 0 });
  const waiting = order({ orderNumber: "C", dueInDays: 3, vendor: { name: "ร้าน", overdueDays: 0 } });
  const stuck = order({ orderNumber: "D", dueInDays: 4, stuckDays: 5 });
  const normal = order({ orderNumber: "E", dueInDays: 2 });
  const noDeadline = order({ orderNumber: "F", dueInDays: null });

  it("เรียง เลยกำหนด → ส่งวันนี้ → รอคนอื่น → ไม่ขยับ → ปกติ และไม่มีกำหนดอยู่ท้าย", () => {
    const sorted = sortHomeOrders([noDeadline, normal, stuck, waiting, today, late]);
    expect(sorted.map((o) => o.orderNumber)).toEqual(["A", "B", "C", "D", "E", "F"]);
  });

  it("ตัวกรองแต่ละตัวเลือกเฉพาะกลุ่มของตัวเอง", () => {
    expect(matchesHomeFilter(late, "late")).toBe(true);
    expect(matchesHomeFilter(today, "today")).toBe(true);
    expect(matchesHomeFilter(waiting, "wait")).toBe(true);
    expect(matchesHomeFilter(stuck, "stuck")).toBe(true);
    expect(matchesHomeFilter(normal, "late")).toBe(false);
    expect(matchesHomeFilter(normal, "all")).toBe(true);
  });
});
