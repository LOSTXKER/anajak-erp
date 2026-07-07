import { describe, it, expect } from "vitest";
import {
  assertStaffFields,
  planAutoClaim,
  touchesRunGuardedFields,
  assertNotInActiveRun,
  assertStepClosable,
  buildStepUpdateData,
  qtyFollowUp,
  stepDisplayName,
  stepCostEntryPlan,
  failedStepNotification,
} from "./production-step-plan";

describe("assertStaffFields — ด่าน field อำนาจหัวหน้า (มอบงาน/ต้นทุน)", () => {
  it("staff ส่ง assignedToId → ปฏิเสธ", () => {
    expect(() =>
      assertStaffFields({ canSupervise: false, data: { assignedToId: "user-2" } })
    ).toThrow("ฝ่ายผลิตแก้ผู้รับผิดชอบ/ต้นทุนจริงไม่ได้");
  });

  it("staff ส่ง actualCost → ปฏิเสธ", () => {
    expect(() =>
      assertStaffFields({ canSupervise: false, data: { actualCost: 150 } })
    ).toThrow("ฝ่ายผลิตแก้ผู้รับผิดชอบ/ต้นทุนจริงไม่ได้");
  });

  it("staff ส่ง actualCost:0 → ปฏิเสธ (pin: เช็ค !== undefined ไม่ใช่ truthy)", () => {
    expect(() =>
      assertStaffFields({ canSupervise: false, data: { actualCost: 0 } })
    ).toThrow("ฝ่ายผลิตแก้ผู้รับผิดชอบ/ต้นทุนจริงไม่ได้");
  });

  it("หัวหน้าส่งทั้งคู่ → ผ่าน", () => {
    expect(() =>
      assertStaffFields({
        canSupervise: true,
        data: { assignedToId: "user-2", actualCost: 200 },
      })
    ).not.toThrow();
  });

  it("staff ส่งแค่ notes (ไม่แตะ field หัวหน้า) → ผ่าน", () => {
    expect(() => assertStaffFields({ canSupervise: false, data: {} })).not.toThrow();
  });
});

describe("planAutoClaim — งานไม่มีเจ้าของ claim อัตโนมัติ · งานคนอื่นห้ามแตะ", () => {
  it("ยังไม่มีเจ้าของ → autoClaim", () => {
    expect(planAutoClaim({ existingAssignedToId: null, userId: "user-1" })).toEqual({
      autoClaim: true,
    });
  });

  it("เจ้าของคือตัวเอง → ไม่ claim ซ้ำ ไม่ throw", () => {
    expect(planAutoClaim({ existingAssignedToId: "user-1", userId: "user-1" })).toEqual({
      autoClaim: false,
    });
  });

  it("เจ้าของคือคนอื่น → ปฏิเสธ", () => {
    expect(() => planAutoClaim({ existingAssignedToId: "user-2", userId: "user-1" })).toThrow(
      "งานนี้ถูกมอบหมายให้คนอื่นแล้ว"
    );
  });
});

describe("touchesRunGuardedFields — input แตะ field ที่รอบพิมพ์คุมไหม", () => {
  it("status อย่างเดียว → แตะ", () => {
    expect(touchesRunGuardedFields({ status: "COMPLETED" })).toBe(true);
  });

  it("qtyDone:0 → แตะ (0 คือ defined — pin เช็ค !== undefined)", () => {
    expect(touchesRunGuardedFields({ qtyDone: 0 })).toBe(true);
  });

  it("qtyTotal:null → แตะ (explicit null คือ defined — zod nullable)", () => {
    expect(touchesRunGuardedFields({ qtyTotal: null })).toBe(true);
  });

  it("notes/qcPassed อย่างเดียว → ไม่แตะ", () => {
    expect(touchesRunGuardedFields({ notes: "โน้ต" })).toBe(false);
    expect(touchesRunGuardedFields({ qcPassed: true })).toBe(false);
  });
});

describe("assertNotInActiveRun — ขั้นในรอบพิมพ์ค้างห้ามแก้มือ", () => {
  it("มีรอบค้าง (แถวมีจริง) → ปฏิเสธพร้อมเลขรอบ", () => {
    expect(() => assertNotInActiveRun({ runNumber: "PR-2026-0001" })).toThrow(
      "งานอยู่ในรอบพิมพ์ PR-2026-0001 — จัดการที่หน้ารอบพิมพ์ฟิล์ม (พิมพ์จบ/ตัดแยกเสร็จ หรือยกเลิกรอบ)"
    );
  });

  it("ไม่มีรอบค้าง → ผ่าน", () => {
    expect(() => assertNotInActiveRun(null)).not.toThrow();
  });
});

describe("assertStepClosable — ด่านปิดขั้น (outsource ค้าง + QC_FAILED)", () => {
  it("มีใบค้างกับร้าน → ปฏิเสธพร้อมจำนวนใบ", () => {
    expect(() =>
      assertStepClosable({ openOutsourceCount: 2, latestOutsourceStatus: "SENT", canSupervise: true })
    ).toThrow("ขั้นนี้มีงานค้างอยู่กับร้านนอก 2 ใบ — กดรับกลับ/ตัดสิน QC ที่ใบ outsource ก่อน");
  });

  it("QC_FAILED + staff → ปฏิเสธ (ห้ามผ่านรวดทับงานที่ตัดสินไม่ผ่านแล้ว)", () => {
    expect(() =>
      assertStepClosable({
        openOutsourceCount: 0,
        latestOutsourceStatus: "QC_FAILED",
        canSupervise: false,
      })
    ).toThrow("งานนี้ QC ไม่ผ่านจากร้าน — ส่งแก้รอบใหม่ หรือให้หัวหน้าเป็นคนปิดขั้น");
  });

  it("QC_FAILED + หัวหน้า → ผ่าน (supervisor override ได้)", () => {
    expect(() =>
      assertStepClosable({
        openOutsourceCount: 0,
        latestOutsourceStatus: "QC_FAILED",
        canSupervise: true,
      })
    ).not.toThrow();
  });

  it("ใบค้าง + QC_FAILED พร้อมกัน → ข้อความ outsource ค้างชนะ (pin ลำดับด่าน)", () => {
    expect(() =>
      assertStepClosable({
        openOutsourceCount: 1,
        latestOutsourceStatus: "QC_FAILED",
        canSupervise: false,
      })
    ).toThrow("ขั้นนี้มีงานค้างอยู่กับร้านนอก 1 ใบ — กดรับกลับ/ตัดสิน QC ที่ใบ outsource ก่อน");
  });

  it("ใบล่าสุด QC_PASSED + staff → ผ่าน", () => {
    expect(() =>
      assertStepClosable({
        openOutsourceCount: 0,
        latestOutsourceStatus: "QC_PASSED",
        canSupervise: false,
      })
    ).not.toThrow();
  });

  it("ไม่เคยมีใบ outsource เลย → ผ่าน", () => {
    expect(() =>
      assertStepClosable({ openOutsourceCount: 0, latestOutsourceStatus: null, canSupervise: false })
    ).not.toThrow();
  });
});

describe("buildStepUpdateData — ประกอบ data ก้อนแรก (timestamps quirk)", () => {
  const now = new Date("2026-07-07T10:00:00Z");

  it("IN_PROGRESS ไม่มี assignedToId → set startedAt", () => {
    expect(
      buildStepUpdateData({ data: { status: "IN_PROGRESS" }, autoClaim: false, userId: "u1", now })
    ).toEqual({ status: "IN_PROGRESS", startedAt: now });
  });

  it("IN_PROGRESS + assignedToId (หัวหน้ามอบพร้อมเริ่ม) → ไม่ set startedAt (pin falsy check)", () => {
    expect(
      buildStepUpdateData({
        data: { status: "IN_PROGRESS", assignedToId: "u2" },
        autoClaim: false,
        userId: "u1",
        now,
      })
    ).toEqual({ status: "IN_PROGRESS", assignedToId: "u2" });
  });

  it("COMPLETED → set completedAt", () => {
    expect(
      buildStepUpdateData({ data: { status: "COMPLETED" }, autoClaim: false, userId: "u1", now })
    ).toEqual({ status: "COMPLETED", completedAt: now });
  });

  it("autoClaim → assignedToId = ตัวเอง", () => {
    expect(
      buildStepUpdateData({ data: { notes: "เริ่มละ" }, autoClaim: true, userId: "u1", now })
    ).toEqual({ notes: "เริ่มละ", assignedToId: "u1" });
  });

  it("autoClaim + COMPLETED พร้อมกัน → ได้ทั้ง assignedToId และ completedAt", () => {
    expect(
      buildStepUpdateData({ data: { status: "COMPLETED" }, autoClaim: true, userId: "u1", now })
    ).toEqual({ status: "COMPLETED", assignedToId: "u1", completedAt: now });
  });

  it("autoClaim + IN_PROGRESS (staff เริ่มงานไร้เจ้าของ) → ได้ทั้ง assignedToId และ startedAt (pin: เช็ค data ดิบ ไม่ใช่ updateData)", () => {
    expect(
      buildStepUpdateData({ data: { status: "IN_PROGRESS" }, autoClaim: true, userId: "u1", now })
    ).toEqual({ status: "IN_PROGRESS", assignedToId: "u1", startedAt: now });
  });
});

describe("qtyFollowUp — update ครั้งที่สองหลังก้อนแรก (snap จำนวน / autostart)", () => {
  const now = new Date("2026-07-07T10:00:00Z");

  it("COMPLETED ทำแล้ว 5 จาก 10 → snap qtyDone เท่าทั้งหมด", () => {
    expect(
      qtyFollowUp({ status: "COMPLETED", qtyDone: 5, qtyTotal: 10, startedAt: now }, now)
    ).toEqual({ qtyDone: 10 });
  });

  it("COMPLETED qtyTotal null (ขั้นแบบติ๊กเฉยๆ) → ไม่ต้องยิง", () => {
    expect(
      qtyFollowUp({ status: "COMPLETED", qtyDone: 0, qtyTotal: null, startedAt: now }, now)
    ).toBeNull();
  });

  it("COMPLETED qtyTotal 0 → ไม่ snap (pin truthy check)", () => {
    expect(
      qtyFollowUp({ status: "COMPLETED", qtyDone: 0, qtyTotal: 0, startedAt: now }, now)
    ).toBeNull();
  });

  it("COMPLETED ทำครบพอดี → ไม่ต้องยิง", () => {
    expect(
      qtyFollowUp({ status: "COMPLETED", qtyDone: 10, qtyTotal: 10, startedAt: now }, now)
    ).toBeNull();
  });

  it("PENDING แต่กรอกจำนวนแล้ว → ขั้นเริ่มเอง + startedAt = ตอนนี้", () => {
    expect(
      qtyFollowUp({ status: "PENDING", qtyDone: 3, qtyTotal: 10, startedAt: null }, now)
    ).toEqual({ status: "IN_PROGRESS", startedAt: now });
  });

  it("PENDING ที่เคยมี startedAt → คงเวลาเดิม ไม่ทับ", () => {
    const earlier = new Date("2026-07-01T08:00:00Z");
    expect(
      qtyFollowUp({ status: "PENDING", qtyDone: 3, qtyTotal: 10, startedAt: earlier }, now)
    ).toEqual({ status: "IN_PROGRESS", startedAt: earlier });
  });

  it("PENDING จำนวน 0 → ไม่ต้องยิง", () => {
    expect(
      qtyFollowUp({ status: "PENDING", qtyDone: 0, qtyTotal: 10, startedAt: null }, now)
    ).toBeNull();
  });

  it("IN_PROGRESS → ไม่ต้องยิง", () => {
    expect(
      qtyFollowUp({ status: "IN_PROGRESS", qtyDone: 5, qtyTotal: 10, startedAt: now }, now)
    ).toBeNull();
  });
});

describe("stepCostEntryPlan — ต้นทุนจริงต่อขั้น → แผน costEntry", () => {
  const base = { stepId: "step-1", customStepName: null, stepType: "HEAT_PRESS" };

  it("ไม่ส่ง actualCost → ไม่สร้าง", () => {
    expect(stepCostEntryPlan({ ...base, actualCost: undefined })).toBeNull();
  });

  it("actualCost 0 → ไม่สร้างแถว 0 บาท (pin: > 0 เท่านั้น)", () => {
    expect(stepCostEntryPlan({ ...base, actualCost: 0 })).toBeNull();
  });

  it("actualCost 200 + customStepName → sourceRef/ชื่อ/ยอดครบ", () => {
    expect(
      stepCostEntryPlan({ ...base, customStepName: "รีดพิเศษ", actualCost: 200 })
    ).toEqual({
      sourceRef: "step:step-1",
      name: "ต้นทุนขั้นตอน: รีดพิเศษ",
      amount: 200,
    });
  });

  it("customStepName null → ใช้ป้ายกลางตาม stepType", () => {
    expect(stepCostEntryPlan({ ...base, actualCost: 150 })).toEqual({
      sourceRef: "step:step-1",
      name: "ต้นทุนขั้นตอน: รีดร้อน",
      amount: 150,
    });
  });

  it("stepType นอก dict → ใช้ stepType ดิบ", () => {
    expect(
      stepCostEntryPlan({ stepId: "step-2", customStepName: null, stepType: "MYSTERY", actualCost: 50 })
    ).toEqual({
      sourceRef: "step:step-2",
      name: "ต้นทุนขั้นตอน: MYSTERY",
      amount: 50,
    });
  });
});

describe("stepDisplayName — ชื่อขั้นที่คนอ่านรู้เรื่อง", () => {
  it("customStepName มาก่อน → ป้ายกลาง → stepType ดิบ", () => {
    expect(stepDisplayName({ customStepName: "รีดพิเศษ", stepType: "HEAT_PRESS" })).toBe("รีดพิเศษ");
    expect(stepDisplayName({ customStepName: null, stepType: "HEAT_PRESS" })).toBe("รีดร้อน");
    expect(stepDisplayName({ customStepName: null, stepType: "MYSTERY" })).toBe("MYSTERY");
  });
});

describe("failedStepNotification — เนื้อกระดิ่งหาผู้จัดการเมื่อขั้นมีปัญหา", () => {
  const base = {
    orderNumber: "ORD-2026-0001",
    orderTitle: "เสื้อรุ่นพิเศษ",
    stepName: "รีดร้อน",
    productionId: "prod-1",
    orderId: "order-1",
  };

  it("มี notes → message = ชื่อขั้น: notes (ชื่องาน)", () => {
    expect(failedStepNotification({ ...base, notes: "เครื่องรีดพัง" })).toEqual({
      type: "ORDER",
      title: "ขั้นตอนผลิตมีปัญหา — ORD-2026-0001",
      message: "รีดร้อน: เครื่องรีดพัง (เสื้อรุ่นพิเศษ)",
      link: "/production/prod-1",
      entityType: "ORDER",
      entityId: "order-1",
    });
  });

  it("ไม่มี notes → message = ชื่อขั้น (ชื่องาน)", () => {
    expect(failedStepNotification(base).message).toBe("รีดร้อน (เสื้อรุ่นพิเศษ)");
  });

  it("notes เป็น string ว่าง → เหมือนไม่มี notes (falsy ไม่ใส่โคลอน)", () => {
    expect(failedStepNotification({ ...base, notes: "" }).message).toBe("รีดร้อน (เสื้อรุ่นพิเศษ)");
  });

  it("title มีคำว่า 'มีปัญหา' + เลขออเดอร์ (verify-ops 8.1 assert contains)", () => {
    const n = failedStepNotification(base);
    expect(n.title).toContain("มีปัญหา");
    expect(n.title).toContain("ORD-2026-0001");
  });

  it("link ชี้หน้าใบผลิตตรงๆ", () => {
    expect(failedStepNotification(base).link).toBe("/production/prod-1");
  });
});
