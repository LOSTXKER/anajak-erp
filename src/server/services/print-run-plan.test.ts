import { describe, it, expect } from "vitest";
import {
  isFileReadyForPrint,
  printQueueSlotOf,
  compareDueDate,
  planRunItemQty,
  shouldCloseStep,
} from "./print-run-plan";

describe("isFileReadyForPrint — ไฟล์พร้อมพิมพ์", () => {
  it("มีแบบอนุมัติ → พร้อม (สถานะไหนก็ได้)", () => {
    expect(isFileReadyForPrint(true, "PRODUCING")).toBe(true);
    expect(isFileReadyForPrint(true, "DESIGNING")).toBe(true);
  });

  it("ไม่มีแบบแต่เลยเฟสออกแบบแล้ว (ไฟล์ลูกค้าพร้อมพิมพ์ข้ามขั้นออกแบบ) → พร้อม", () => {
    expect(isFileReadyForPrint(false, "PRODUCTION_QUEUE")).toBe(true);
    expect(isFileReadyForPrint(false, "DESIGN_APPROVED")).toBe(true);
  });

  it("ไม่มีแบบ + ยังอยู่เฟสออกแบบ/ต้นทาง → ไม่พร้อม", () => {
    expect(isFileReadyForPrint(false, "DESIGNING")).toBe(false);
    expect(isFileReadyForPrint(false, "CONFIRMED")).toBe(false);
  });
});

describe("printQueueSlotOf — ช่องในคิวพิมพ์ (null = ไม่โผล่)", () => {
  const base = {
    inActiveRun: false,
    hasApprovedDesign: true,
    orderInternalStatus: "PRODUCING",
    qtyDone: 0,
    qtyTotal: 100 as number | null,
    orderQty: 100,
  };

  it("งานปกติ → โผล่พร้อม remaining ที่เหลือจริง", () => {
    expect(printQueueSlotOf(base)).toEqual({ qtyTotal: 100, remaining: 100 });
    expect(printQueueSlotOf({ ...base, qtyDone: 60 })).toEqual({ qtyTotal: 100, remaining: 40 });
  });

  it("ติดรอบ active อยู่ → ไม่โผล่ (กันนับซ้อน)", () => {
    expect(printQueueSlotOf({ ...base, inActiveRun: true })).toBeNull();
  });

  it("ไฟล์ไม่พร้อม → ไม่โผล่เลย (มติ flow-redesign)", () => {
    expect(
      printQueueSlotOf({ ...base, hasApprovedDesign: false, orderInternalStatus: "DESIGNING" })
    ).toBeNull();
  });

  it("ขั้นไม่รู้จำนวน → ใช้ยอดรวมออเดอร์แทน · ทั้งคู่ไม่รู้ (ยอด 0) → กัน entry ผี", () => {
    expect(printQueueSlotOf({ ...base, qtyTotal: null, orderQty: 80 })).toEqual({
      qtyTotal: 80,
      remaining: 80,
    });
    expect(printQueueSlotOf({ ...base, qtyTotal: null, orderQty: 0 })).toBeNull();
  });

  it("พิมพ์ครบแล้ว (รวมกรณีเกิน — clamp 0) → ไม่โผล่ (รอรอบเก่าปิดขั้น)", () => {
    expect(printQueueSlotOf({ ...base, qtyDone: 100 })).toBeNull();
    expect(printQueueSlotOf({ ...base, qtyDone: 120 })).toBeNull();
  });
});

describe("compareDueDate — เรียงคิวตามกำหนดส่ง งานไม่มีกำหนดไปท้าย", () => {
  const d1 = new Date("2026-07-01");
  const d2 = new Date("2026-07-05");

  it("มีกำหนดทั้งคู่ → ใกล้ก่อน · ฝั่งเดียว → ฝั่งมีกำหนดมาก่อน · ไม่มีทั้งคู่ → เสมอ", () => {
    expect(compareDueDate(d1, d2)).toBeLessThan(0);
    expect(compareDueDate(d2, d1)).toBeGreaterThan(0);
    expect(compareDueDate(d1, null)).toBe(-1);
    expect(compareDueDate(null, d1)).toBe(1);
    expect(compareDueDate(null, null)).toBe(0);
  });
});

describe("planRunItemQty — ด่านจำนวนตอนเปิดรอบ + seed qtyTotal", () => {
  const base = { orderNumber: "ORD-1", stepQtyDone: 0, stepQtyTotal: 100 as number | null, orderQty: 100 };

  it("จำนวนไม่ใช่จำนวนเต็มบวก → ปฏิเสธ", () => {
    for (const qty of [0, -5, 2.5]) {
      expect(() => planRunItemQty({ ...base, qty })).toThrow(
        "งาน ORD-1: จำนวนพิมพ์ต้องเป็นจำนวนเต็มมากกว่า 0"
      );
    }
  });

  it("พิมพ์เกินจำนวนงาน → ปฏิเสธพร้อมจำนวนที่เหลือจริง (พอดีเป๊ะผ่าน — ฟิล์มเผื่อกรอกตอนปิดรอบ)", () => {
    expect(() => planRunItemQty({ ...base, stepQtyDone: 60, qty: 41 })).toThrow(
      "งาน ORD-1: พิมพ์เกินจำนวนงาน (เหลือ 40 จาก 100 — ฟิล์มเผื่อกรอกตอนปิดรอบ)"
    );
    expect(() => planRunItemQty({ ...base, stepQtyDone: 60, qty: 40 })).not.toThrow();
  });

  it("ขั้นยังไม่เคยนับจำนวน → seed จากยอดออเดอร์ (ตรรกะปิดเมื่อครบจะได้ทำงาน)", () => {
    expect(planRunItemQty({ ...base, stepQtyTotal: null, qty: 30 })).toEqual({
      seedQtyTotal: 100,
    });
    // ขั้นนับแล้ว → ไม่ seed ทับ
    expect(planRunItemQty({ ...base, qty: 30 })).toEqual({ seedQtyTotal: null });
  });

  it("ไม่รู้จำนวนทั้งขั้นและออเดอร์ → ไม่มีเพดาน (และไม่ seed)", () => {
    expect(planRunItemQty({ ...base, stepQtyTotal: null, orderQty: 0, qty: 999 })).toEqual({
      seedQtyTotal: null,
    });
  });
});

describe("shouldCloseStep — ปิดขั้นพิมพ์เมื่อครบและไม่มีรอบค้าง", () => {
  it("จำนวนครบ + ไม่มีรอบ active อื่น → ปิด (พอดีเป๊ะก็ปิด)", () => {
    expect(shouldCloseStep({ qtyDone: 100, qtyTotal: 100, openRuns: 0 })).toBe(true);
    expect(shouldCloseStep({ qtyDone: 120, qtyTotal: 100, openRuns: 0 })).toBe(true);
  });

  it("ยังไม่ครบ หรือมีรอบ active อื่นค้าง (แบ่งพิมพ์หลายรอบ) → ยังไม่ปิด", () => {
    expect(shouldCloseStep({ qtyDone: 99, qtyTotal: 100, openRuns: 0 })).toBe(false);
    expect(shouldCloseStep({ qtyDone: 100, qtyTotal: 100, openRuns: 1 })).toBe(false);
  });

  it("ไม่รู้จำนวน (qtyTotal null) → ปิดตามรอบเมื่อไม่มีรอบค้าง (pattern เดิม)", () => {
    expect(shouldCloseStep({ qtyDone: 5, qtyTotal: null, openRuns: 0 })).toBe(true);
    expect(shouldCloseStep({ qtyDone: 5, qtyTotal: null, openRuns: 2 })).toBe(false);
  });
});
