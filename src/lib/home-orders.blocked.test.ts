import { describe, expect, it } from "vitest";
import { describeHomeOrder, sortHomeOrders, type HomeOrderLike } from "./home-orders";
import { describeOrderProgress } from "./order-progress";

/**
 * งานที่ขั้นผลิตหยุดเดิน (ช่างแจ้งปัญหา / หัวหน้าสั่งพัก) ต้องบอกได้ว่า "ติดอะไร" ทุกจอ
 *
 * ปัญหาเดิม: ขั้น FAILED/ON_HOLD ไม่เข้า OPEN_STEP_STATUSES จึงหายจากทุกตัวเลข
 * หน้าแรกคอลัมน์ "ต้องจัดการ" ขึ้น "—" ทั้งที่งานหยุดอยู่ และถ้าใบนั้นเลยกำหนดด้วย
 * ก็ขึ้นแค่ "ค้างขั้น รีดร้อน" ซึ่งบอกไม่ได้ว่าต้องไปทำอะไรต่อ (เบสเจอเอง 2026-09-19)
 * เบสเคาะให้เหตุที่ติดชนะ "เลยกำหนด" เพราะมันคือสาเหตุ และเป็นอันที่แก้ได้
 */
const BASE: HomeOrderLike = {
  orderNumber: "ORD-2609-0016",
  internalStatus: "PRODUCING",
  dueInDays: 8,
  currentStep: null,
  stepsDone: 1,
  stepsTotal: 2,
  waitingCustomerDays: null,
  vendor: null,
  stuckDays: null,
  ready: false,
};

const blocked = (over: Partial<NonNullable<HomeOrderLike["blocked"]>> = {}) => ({
  stepLabel: "รีดร้อน",
  reason: "เครื่องรีดหยุดกลางงาน",
  held: false,
  assigneeName: "พี่ก้อย",
  ...over,
});

describe("หน้าแรกต้องบอกว่าติดอะไร ไม่ใช่แค่ว่าติด", () => {
  it("ยังไม่เลยกำหนดแต่ขั้นติดปัญหา = ขึ้นเหตุจริง (เดิมขึ้นขีด)", () => {
    const p = describeHomeOrder({ ...BASE, blocked: blocked() });
    expect(p).not.toBeNull();
    expect(p!.group).toBe("blocked");
    expect(p!.label).toBe("ติดปัญหา · เครื่องรีดหยุดกลางงาน");
    expect(p!.who).toBe("พี่ก้อย");
    expect(p!.tone).toBe("danger");
  });

  it("เลยกำหนดด้วยและติดปัญหาด้วย = เหตุที่ติดชนะ (เบสเคาะ 2026-09-19)", () => {
    const p = describeHomeOrder({ ...BASE, dueInDays: -2, blocked: blocked() });
    expect(p!.kind).toBe("blocked");
    expect(p!.label).toContain("เครื่องรีดหยุดกลางงาน");
    expect(p!.label).not.toContain("ค้างขั้น");
  });

  it("งานแก้/เคลมยังมาก่อนงานติดปัญหา — ลูกค้าถือของเสียอยู่", () => {
    const p = describeHomeOrder({
      ...BASE,
      blocked: blocked(),
      claim: { round: 1, label: "งานแก้รอบ 1" },
    });
    expect(p!.kind).toBe("claim");
  });

  it("หัวหน้าสั่งพัก ใช้คำว่า 'พักไว้' ไม่ใช่ 'ติดปัญหา'", () => {
    const p = describeHomeOrder({ ...BASE, blocked: blocked({ held: true }) });
    expect(p!.label).toBe("พักไว้ · เครื่องรีดหยุดกลางงาน");
  });

  it("ไม่มีเหตุบันทึกไว้ = บอกชื่อขั้นแทน ไม่ปล่อยว่าง", () => {
    const p = describeHomeOrder({ ...BASE, blocked: blocked({ reason: null }) });
    expect(p!.label).toBe("ติดปัญหา · รีดร้อน");
  });

  it("งานติดปัญหาลอยขึ้นเหนืองานเลยกำหนดใบอื่นในตาราง", () => {
    const rows = [
      { ...BASE, orderNumber: "A", dueInDays: -5 },
      { ...BASE, orderNumber: "B", blocked: blocked() },
    ];
    expect(sortHomeOrders(rows).map((r) => r.orderNumber)).toEqual(["B", "A"]);
  });
});

describe("describeOrderProgress อ่านขั้นที่หยุดเดินจากใบผลิต", () => {
  const source = (status: string, notes: string | null) => ({
    orderNumber: "ORD-1",
    internalStatus: "PRODUCING" as const,
    deadline: null,
    updatedAt: new Date("2026-09-19T09:00:00"),
    designs: [],
    revisions: [],
    productions: [
      {
        steps: [
          { stepType: "HEAT_PRESS", customStepName: null, status, notes, qcNotes: null, assignedTo: { name: "พี่ก้อย" }, outsourceOrders: [] },
        ],
      },
    ],
  });

  it("เหตุที่อ่านมาต้องสะอาด ไม่มีบรรทัด marker ติดมา", () => {
    const p = describeOrderProgress(source("FAILED", "ตั้งเครื่องแล้ว\n[แจ้งปัญหาจากสถานี] เครื่องรีดหยุดกลางงาน"), new Date("2026-09-19T10:00:00"));
    expect(p.blocked?.reason).toBe("เครื่องรีดหยุดกลางงาน");
    expect(p.blocked?.held).toBe(false);
    expect(p.blocked?.stepLabel).toBe("รีดร้อน");
  });

  it("ปัญหาที่แก้แล้วไม่ค้างอยู่เป็นเหตุของการพัก", () => {
    const p = describeOrderProgress(source("ON_HOLD", "[แจ้งปัญหาจากสถานี] เครื่องเสีย\n[แก้ปัญหาแล้ว] เปลี่ยนฮีตเตอร์"), new Date("2026-09-19T10:00:00"));
    expect(p.blocked?.held).toBe(true);
    expect(p.blocked?.reason).toBeNull();
  });

  it("ทุกขั้นเดินปกติ = ไม่มี blocked", () => {
    const p = describeOrderProgress(source("IN_PROGRESS", null), new Date("2026-09-19T10:00:00"));
    expect(p.blocked).toBeNull();
  });
});
