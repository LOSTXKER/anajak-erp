import { describe, it, expect } from "vitest";
import {
  getInitialStatus,
  getNextStatuses,
  isValidTransition,
  getCustomerStatus,
} from "./order-status";

// เกราะของ status machine — ทุก transition ใหม่/ที่แก้ ต้องบันทึกไว้ที่นี่

describe("getInitialStatus", () => {
  it("CUSTOM เริ่มที่ INQUIRY · READY_MADE เริ่มที่ CONFIRMED", () => {
    expect(getInitialStatus("CUSTOM")).toBe("INQUIRY");
    expect(getInitialStatus("READY_MADE")).toBe("CONFIRMED");
  });
});

describe("isValidTransition — เส้นทางหลัก", () => {
  it("เดินหน้าตาม flow ปกติ", () => {
    expect(isValidTransition("CUSTOM", "INQUIRY", "QUOTATION")).toBe(true);
    expect(isValidTransition("CUSTOM", "CONFIRMED", "DESIGN_PENDING")).toBe(true);
    expect(isValidTransition("CUSTOM", "PRODUCTION_QUEUE", "PRODUCING")).toBe(true);
    expect(isValidTransition("READY_MADE", "CONFIRMED", "PRODUCTION_QUEUE")).toBe(true);
    expect(isValidTransition("CUSTOM", "SHIPPED", "COMPLETED")).toBe(true);
  });

  it("ห้ามกระโดดข้ามขั้น", () => {
    expect(isValidTransition("CUSTOM", "PRODUCING", "COMPLETED")).toBe(false);
    expect(isValidTransition("CUSTOM", "DESIGN_APPROVED", "PRODUCING")).toBe(false);
    expect(isValidTransition("CUSTOM", "INQUIRY", "SHIPPED")).toBe(false);
  });

  it("สถานะจบงาน (COMPLETED/CANCELLED) ออกไปไหนไม่ได้อีก", () => {
    expect(getNextStatuses("CUSTOM", "COMPLETED")).toEqual([]);
    expect(getNextStatuses("CUSTOM", "CANCELLED")).toEqual([]);
  });

  it("ถอยหลังเฉพาะคู่ที่อนุญาต", () => {
    expect(isValidTransition("CUSTOM", "AWAITING_APPROVAL", "DESIGNING")).toBe(true);
    expect(isValidTransition("CUSTOM", "QUALITY_CHECK", "PRODUCING")).toBe(true);
    expect(isValidTransition("CUSTOM", "PACKING", "QUALITY_CHECK")).toBe(true);
    expect(isValidTransition("CUSTOM", "PRODUCING", "PRODUCTION_QUEUE")).toBe(true);
    expect(isValidTransition("CUSTOM", "DESIGN_APPROVED", "DESIGNING")).toBe(false);
  });

  it("ยกเลิกได้จากสถานะทำงานทุกตัว", () => {
    for (const from of ["INQUIRY", "CONFIRMED", "DESIGNING", "PRODUCING", "SHIPPED"] as const) {
      expect(isValidTransition("CUSTOM", from, "CANCELLED")).toBe(true);
    }
  });

  it("ON_HOLD กลับเข้างานได้เฉพาะจุดที่กำหนด", () => {
    expect(getNextStatuses("CUSTOM", "ON_HOLD")).toEqual([
      "CONFIRMED",
      "DESIGN_PENDING",
      "PRODUCTION_QUEUE",
      "CANCELLED",
    ]);
  });
});

describe("transitions ที่เพิ่มตอน P0.2 (อย่าลบโดยไม่รู้ที่มา)", () => {
  it("DESIGNING → DESIGN_APPROVED: ลูกค้าอนุมัติผ่าน token ได้โดยไม่ผ่าน AWAITING_APPROVAL", () => {
    expect(isValidTransition("CUSTOM", "DESIGNING", "DESIGN_APPROVED")).toBe(true);
  });

  it("CONFIRMED → PRODUCTION_QUEUE (CUSTOM): ลูกค้ามีไฟล์มาเอง ข้ามขั้นออกแบบ", () => {
    expect(isValidTransition("CUSTOM", "CONFIRMED", "PRODUCTION_QUEUE")).toBe(true);
  });

  it("INQUIRY → CONFIRMED (CUSTOM): ข้ามใบเสนอราคาได้", () => {
    expect(isValidTransition("CUSTOM", "INQUIRY", "CONFIRMED")).toBe(true);
  });
});

describe("getCustomerStatus — แปลงสถานะภายในเป็นสถานะที่ลูกค้าเห็น", () => {
  it("จุดสำคัญ map ถูก", () => {
    expect(getCustomerStatus("PRODUCING")).toBe("IN_PRODUCTION");
    expect(getCustomerStatus("DESIGNING")).toBe("PREPARING");
    expect(getCustomerStatus("READY_TO_SHIP")).toBe("READY_TO_SHIP");
    expect(getCustomerStatus("COMPLETED")).toBe("COMPLETED");
    expect(getCustomerStatus("ON_HOLD")).toBe("PREPARING");
  });
});
