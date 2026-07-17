import { describe, expect, it } from "vitest";
import {
  firstPendingStepIdsByLane,
  getProductionStepActionPolicy,
} from "./production-step-actions";

const policy = (overrides: Partial<Parameters<typeof getProductionStepActionPolicy>[0]> = {}) =>
  getProductionStepActionPolicy({
    stepType: "HEAT_PRESS",
    status: "PENDING",
    canOutsource: true,
    canUpdateStep: true,
    ownedByOther: false,
    hasActiveOutsource: false,
    qcFailedBlocked: false,
    ...overrides,
  });

describe("getProductionStepActionPolicy", () => {
  it("DTF ภายในไม่เสนอส่งร้านนอก", () => {
    expect(policy({ stepType: "DTF_PRINT" })).toMatchObject({
      structuralMode: "internal",
      primary: "start",
      canSendOutsource: false,
    });
  });

  it("ขั้นร้านนอกใช้ส่งร้านเป็น primary", () => {
    expect(policy({ stepType: "SCREEN_PRINTING" })).toMatchObject({
      structuralMode: "outsource",
      primary: "send-outsource",
      canSendOutsource: true,
      canQuickPass: true,
    });
  });

  it("งานที่มีใบส่งร้านค้างไม่เสนอ action ซ้ำ", () => {
    expect(policy({ stepType: "EMBROIDERY", hasActiveOutsource: true })).toMatchObject({
      primary: null,
      canSendOutsource: false,
      canQuickPass: false,
    });
  });

  it("GARMENT_PICK ต้องปิดผ่านการ์ดเบิกเสื้อเท่านั้น", () => {
    expect(policy({ stepType: "GARMENT_PICK" })).toMatchObject({
      structuralMode: "garment-pick",
      primary: null,
      canRunInternal: false,
    });
  });
});

describe("firstPendingStepIdsByLane", () => {
  it("เลือกเฉพาะขั้นแรกที่ยังไม่เสร็จของแต่ละเลน", () => {
    // เลน DTF (พิมพ์→รีด) + เลนแพ็ค — ขั้นรีดต้อง 'รอขั้นก่อนหน้า' ส่วนแพ็คเป็นตัวแรกของเลนตัวเอง
    const ids = firstPendingStepIdsByLane([
      { id: "print", stepType: "DTF_PRINT", status: "PENDING", sortOrder: 1 },
      { id: "press", stepType: "HEAT_PRESS", status: "PENDING", sortOrder: 2 },
      { id: "pack", stepType: "PACKAGING", status: "PENDING", sortOrder: 3 },
    ]);
    expect(ids).toEqual(new Set(["print", "pack"]));
  });

  it("ขั้นเสร็จแล้วไม่ถูกนับ — ตัวถัดไปในเลนขึ้นเป็นขั้นแรกที่ค้างแทน", () => {
    const ids = firstPendingStepIdsByLane([
      { id: "print", stepType: "DTF_PRINT", status: "COMPLETED", sortOrder: 1 },
      { id: "press", stepType: "HEAT_PRESS", status: "IN_PROGRESS", sortOrder: 2 },
    ]);
    expect(ids).toEqual(new Set(["press"]));
  });

  it("เรียงตาม sortOrder ไม่ใช่ลำดับใน array", () => {
    const ids = firstPendingStepIdsByLane([
      { id: "press", stepType: "HEAT_PRESS", status: "PENDING", sortOrder: 5 },
      { id: "print", stepType: "DTF_PRINT", status: "PENDING", sortOrder: 1 },
    ]);
    expect(ids).toEqual(new Set(["print"]));
  });
});
