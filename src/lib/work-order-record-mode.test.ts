import { describe, expect, it } from "vitest";
import { canSendToQc, inferredStage, isInferredDone, paperDoneMarker, paperStepsToClose, recordModeOf, stepsBlockingQc, whyRecordOnScreen } from "./work-order-record-mode";

const step = (stepType: string, status = "PENDING", extra: Partial<{ executionMode: string; outsourceOrders: unknown[]; notes: string }> = {}) => ({
  stepType,
  status,
  executionMode: extra.executionMode ?? "IN_HOUSE",
  outsourceOrders: extra.outsourceOrders ?? [],
  notes: extra.notes ?? null,
});

describe("recordModeOf — กระดาษเป็นหลัก จดเฉพาะจุดที่การกดทำงานให้", () => {
  it("เบิกเสื้อ/ตรวจรับ = จดในระบบ (ตัดสต็อก / ใบตรวจรับ)", () => {
    expect(recordModeOf(step("GARMENT_PICK"))).toBe("screen");
    expect(recordModeOf(step("GARMENT_RECEIVE"))).toBe("screen");
  });
  it("ร้านนอกทุกทาง = จดในระบบ (ชนิดขั้น · โหมด OUTSOURCE · มีใบส่งร้าน)", () => {
    expect(recordModeOf(step("EMBROIDERY"))).toBe("screen");
    expect(recordModeOf(step("HEAT_PRESS", "PENDING", { executionMode: "OUTSOURCE" }))).toBe("screen");
    expect(recordModeOf(step("HEAT_PRESS", "PENDING", { outsourceOrders: [{ id: "o1" }] }))).toBe("screen");
  });
  it("พิมพ์ DTF = ผ่านเองจากรอบพิมพ์ · รีดร้อน/อบสี/พิเศษ = จดบนกระดาษ", () => {
    expect(recordModeOf(step("DTF_PRINT"))).toBe("auto");
    expect(recordModeOf(step("HEAT_PRESS"))).toBe("paper");
    expect(recordModeOf(step("CURING"))).toBe("paper");
    expect(recordModeOf(step("SPECIAL_PRINT"))).toBe("paper");
    expect(recordModeOf(step("CUSTOM"))).toBe("paper");
  });
  it("ประโยค 'ทำไมต้องแตะจอ' มีเฉพาะขั้นที่จดในระบบ", () => {
    expect(whyRecordOnScreen(step("GARMENT_PICK"))).toContain("ตัดยอดสต็อก");
    expect(whyRecordOnScreen(step("EMBROIDERY"))).toContain("ของออกจากโรงงาน");
    expect(whyRecordOnScreen(step("HEAT_PRESS"))).toBeNull();
  });
});

describe("ส่งเข้า QC — ขั้นกระดาษถือว่าผ่าน ขั้นที่จดในระบบต้องปิดก่อน", () => {
  const pick = step("GARMENT_PICK", "COMPLETED");
  const dtf = step("DTF_PRINT", "COMPLETED");
  const press = step("HEAT_PRESS", "IN_PROGRESS");
  const emb = step("EMBROIDERY", "COMPLETED");

  it("เบิก/DTF/ร้านนอกปิดแล้ว เหลือรีดร้อนบนกระดาษ → ส่งได้ และปิดรีดร้อนให้", () => {
    const steps = [pick, dtf, emb, press];
    expect(canSendToQc(steps)).toBe(true);
    expect(paperStepsToClose(steps)).toEqual([press]);
    expect(stepsBlockingQc(steps)).toEqual([]);
  });
  it("ร้านนอกยังไม่กลับ → ส่งไม่ได้ บอกขั้นที่กั้น", () => {
    const open = step("EMBROIDERY", "IN_PROGRESS");
    expect(canSendToQc([pick, dtf, open, press])).toBe(false);
    expect(stepsBlockingQc([pick, dtf, open, press])).toEqual([open]);
  });
  it("ขั้นกระดาษที่ติดปัญหา/พัก ก็กั้น — ต้องปลดก่อน", () => {
    const stuck = step("HEAT_PRESS", "FAILED");
    expect(canSendToQc([pick, dtf, stuck])).toBe(false);
    expect(stepsBlockingQc([pick, dtf, stuck])).toEqual([stuck]);
  });
  it("ทุกขั้นปิดหมดแล้ว (ไม่มีอะไรให้ถือว่าผ่าน) → ไม่ใช่งานของ sendToQc (finalize ปกติทำไปแล้ว)", () => {
    expect(canSendToQc([pick, dtf, step("HEAT_PRESS", "COMPLETED")])).toBe(false);
  });
  it("marker ถือว่าผ่าน แยกจากผ่านแล้วจริง", () => {
    const inferred = step("HEAT_PRESS", "COMPLETED", { notes: `เดิม\n${paperDoneMarker()}` });
    expect(isInferredDone(inferred)).toBe(true);
    expect(isInferredDone(step("HEAT_PRESS", "COMPLETED"))).toBe(false);
    expect(isInferredDone(step("HEAT_PRESS", "PENDING", { notes: paperDoneMarker() }))).toBe(false);
  });
});

describe("inferredStage — ช่วงงานที่อนุมานได้ ไม่ใช่สถานะที่ใครกด", () => {
  it("หลังพิมพ์ DTF ก่อนร้านนอกกลับ รีดร้อนดูจากกระดาษ", () => {
    const stage = inferredStage([step("GARMENT_PICK", "COMPLETED"), step("DTF_PRINT", "COMPLETED"), step("EMBROIDERY", "IN_PROGRESS"), step("HEAT_PRESS", "PENDING")]);
    expect(stage?.now).toBe("หลังพิมพ์ฟิล์ม DTF → ก่อนปักลาย (ร้านนอก)");
    expect(stage?.detail).toBe("รีดร้อน ดูจากกระดาษ");
  });
  it("จุดที่จดปิดครบ → ก่อน QC", () => {
    const stage = inferredStage([step("GARMENT_PICK", "COMPLETED"), step("DTF_PRINT", "COMPLETED"), step("HEAT_PRESS", "PENDING")]);
    expect(stage?.now).toBe("หลังพิมพ์ฟิล์ม DTF → ก่อน QC");
  });
  it("ยังไม่จดอะไรเลย → เริ่มงาน · ครบทุกขั้น → รอ QC · ไม่มีขั้น → null", () => {
    expect(inferredStage([step("GARMENT_PICK"), step("HEAT_PRESS")])?.now).toBe("เริ่มงาน → ก่อนเบิกเสื้อจากสต๊อค");
    expect(inferredStage([step("HEAT_PRESS", "COMPLETED")])?.now).toBe("ผลิตครบ → รอ QC");
    expect(inferredStage([])).toBeNull();
  });
});
