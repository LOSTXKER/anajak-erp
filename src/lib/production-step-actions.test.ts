import { describe, expect, it } from "vitest";
import {
  firstPendingStepIdsByLane,
  getProductionStepActionPolicy,
  selectNowSteps,
  type NowStepInput,
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
  it("DTF เดินผ่านรอบพิมพ์ ไม่เสนอปุ่ม generic หรือส่งร้านนอก", () => {
    expect(policy({ stepType: "DTF_PRINT" })).toMatchObject({
      structuralMode: "internal",
      primary: null,
      canSendOutsource: false,
      canRunInternal: false,
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

  it("PACKAGING เก่าเป็นข้อมูล compatibility เท่านั้น — ไม่เสนอ action ผลิต", () => {
    expect(policy({ stepType: "PACKAGING" })).toMatchObject({
      primary: null,
      canSendOutsource: false,
      canQuickPass: false,
      canRunInternal: false,
    });
  });
});

describe("firstPendingStepIdsByLane", () => {
  it("เลือกเฉพาะขั้นแรกที่ยังไม่เสร็จของแต่ละเลน", () => {
    // เลน DTF (พิมพ์→รีด) · PACKAGING เก่าไม่ใช่งานผลิตที่ลงมือได้แล้ว
    const ids = firstPendingStepIdsByLane([
      { id: "print", stepType: "DTF_PRINT", status: "PENDING", sortOrder: 1 },
      { id: "press", stepType: "HEAT_PRESS", status: "PENDING", sortOrder: 2 },
      { id: "pack", stepType: "PACKAGING", status: "PENDING", sortOrder: 3 },
    ]);
    expect(ids).toEqual(new Set(["print"]));
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

describe("selectNowSteps — ตอนนี้ต้องทำอะไร (ใบงาน PC2)", () => {
  const READY_GATE = { ready: true, waitingOn: [] };
  const PERMS = {
    canOutsource: true,
    canUpdateStep: true,
    canSupervise: true,
    meId: "u1",
    pressGate: READY_GATE,
  };
  let seq = 0;
  const mk = (over: Partial<NowStepInput> & { stepType: string }): NowStepInput => {
    seq += 1;
    return { id: `s${seq}`, status: "PENDING", sortOrder: seq, ...over };
  };

  it("คืนขั้นถึงคิวของทุกเลน — งานผสมลงมือได้พร้อมกันหลายสาย", () => {
    const now = selectNowSteps(
      [
        mk({ stepType: "GARMENT_PICK", status: "COMPLETED" }),
        mk({ stepType: "DTF_PRINT" }),
        mk({ stepType: "EMBROIDERY" }),
      ],
      PERMS,
    );
    expect(now.map((n) => n.step.stepType)).toEqual(["DTF_PRINT", "EMBROIDERY"]);
  });

  it("ขั้นนับจำนวนที่ยังไม่ครบให้บันทึกจำนวน ไม่ใช่ปิดรวด", () => {
    const [now] = selectNowSteps(
      [mk({ stepType: "HEAT_PRESS", status: "IN_PROGRESS", qtyDone: 20, qtyTotal: 60 })],
      PERMS,
    );
    expect(now!.action).toBe("record-qty");

    const [done] = selectNowSteps(
      [mk({ stepType: "HEAT_PRESS", status: "IN_PROGRESS", qtyDone: 60, qtyTotal: 60 })],
      PERMS,
    );
    expect(done!.action).toBe("complete");
  });

  it("คิวรีดที่ยังไม่พร้อมบอกว่ารออะไร และไม่ให้ปุ่ม", () => {
    const [now] = selectNowSteps([mk({ stepType: "HEAT_PRESS" })], {
      ...PERMS,
      pressGate: { ready: false, waitingOn: ["รอฟิล์ม — พิมพ์/ตัดแยกยังไม่จบ"] },
    });
    expect(now!.action).toBeNull();
    expect(now!.group).toBe("waiting");
    expect(now!.waitingOn).toEqual(["รอฟิล์ม — พิมพ์/ตัดแยกยังไม่จบ"]);
  });

  it("ขั้นที่อยู่ในรอบพิมพ์ไม่ให้ปุ่ม เพราะ server บล็อกไว้", () => {
    const [now] = selectNowSteps(
      [mk({ stepType: "DTF_PRINT", printRunItems: [{ printRun: { runNumber: "FR-2608-016" } }] })],
      PERMS,
    );
    expect(now!.action).toBeNull();
    expect(now!.group).toBe("current");
    expect(now!.note).toContain("FR-2608-016");
  });

  it("งานของคนอื่นไม่ให้ปุ่มกับช่าง แต่หัวหน้าแตะได้", () => {
    const step = mk({ stepType: "HEAT_PRESS", assignedTo: { id: "u2" } });
    const [staff] = selectNowSteps([step], { ...PERMS, canSupervise: false });
    expect(staff!.action).toBeNull();
    expect(staff!.group).toBe("waiting");
    expect(staff!.note).toBe("เป็นงานของคนอื่น");

    const [boss] = selectNowSteps([step], PERMS);
    expect(boss!.action).toBe("start");
  });

  it("ขั้นร้านนอกที่มีใบส่งค้างอยู่ ไม่ให้ปิดทับ", () => {
    const [now] = selectNowSteps(
      [mk({ stepType: "EMBROIDERY", outsourceOrders: [{ status: "SENT" }] })],
      PERMS,
    );
    expect(now!.action).toBeNull();
    expect(now!.group).toBe("waiting");
    expect(now!.note).toBe("อยู่ที่ร้านนอก");
  });

  it.each(["IN_PROGRESS", "COMPLETED"])(
    "ขั้นร้านนอกสถานะ %s ยังเป็นงานค้างและไม่เสนอเปิดใบซ้ำ",
    (status) => {
      const [now] = selectNowSteps(
        [mk({ stepType: "EMBROIDERY", outsourceOrders: [{ status }] })],
        PERMS,
      );

      expect(now).toMatchObject({
        action: null,
        group: "waiting",
        note: "อยู่ที่ร้านนอก",
      });
    },
  );

  it("ขั้นร้านนอกที่ยังไม่เปิดใบส่ง — หัวหน้าเปิดใบได้ ช่างผ่านรวดได้", () => {
    const step = mk({ stepType: "EMBROIDERY" });
    expect(selectNowSteps([step], PERMS)[0]!.action).toBe("send-outsource");
    expect(
      selectNowSteps([step], { ...PERMS, canOutsource: false, canSupervise: false })[0]!.action,
    ).toBe("quick-pass");
  });

  it("ขั้นที่มีปัญหาให้เปิดดูรายละเอียด ไม่ใช่กดปิดทับ", () => {
    const [now] = selectNowSteps([mk({ stepType: "DTF_PRINT", status: "FAILED" })], PERMS);
    expect(now!.action).toBeNull();
    expect(now!.note).toContain("มีปัญหา");
  });

  it("สิทธิ์อ่านอย่างเดียวจัดขั้นพร้อมทำไว้ใต้กลุ่มรอ และไม่เสนอทางเบิกเสื้อ", () => {
    const readOnly = { ...PERMS, canOutsource: false, canUpdateStep: false };
    const [internal] = selectNowSteps([mk({ stepType: "HEAT_PRESS" })], readOnly);
    const [garment] = selectNowSteps([mk({ stepType: "GARMENT_PICK" })], readOnly);

    expect(internal).toMatchObject({ group: "waiting", action: null });
    expect(garment).toMatchObject({ group: "waiting", action: null });
  });

  it("เบิกเสื้อที่มีสิทธิ์ยังเป็นงานพร้อมทำผ่านการ์ดเบิกเฉพาะทาง", () => {
    const [garment] = selectNowSteps([mk({ stepType: "GARMENT_PICK" })], PERMS);
    expect(garment).toMatchObject({ group: "current", action: null });
  });

  it("ใบที่ทุกขั้นเสร็จแล้วไม่เหลืออะไรต้องทำ", () => {
    expect(
      selectNowSteps([mk({ stepType: "DTF_PRINT", status: "COMPLETED" })], PERMS),
    ).toHaveLength(0);
  });

  it("ใบเก่าที่เหลือ PACKAGING ไม่เสนอเป็นงานปัจจุบัน", () => {
    expect(selectNowSteps([mk({ stepType: "PACKAGING" })], PERMS)).toHaveLength(0);
  });
});
