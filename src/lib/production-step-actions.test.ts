import { describe, expect, it } from "vitest";
import { getProductionStepActionPolicy } from "./production-step-actions";

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
