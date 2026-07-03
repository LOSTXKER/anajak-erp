import { describe, it, expect } from "vitest";
import {
  isValidDeliveryTransition,
  nextDeliveryStatuses,
  DELIVERY_STATUSES,
  type DeliveryStatus,
} from "./delivery-status";

describe("delivery state machine (B13)", () => {
  it("self-transition = ได้เสมอ (อัปเดตเลขพัสดุโดยไม่เปลี่ยนสถานะ)", () => {
    for (const s of DELIVERY_STATUSES) {
      expect(isValidDeliveryTransition(s, s)).toBe(true);
    }
  });

  it("เดินหน้าตามคิวปกติ: PENDING→PREPARING→SHIPPED→DELIVERED", () => {
    expect(isValidDeliveryTransition("PENDING", "PREPARING")).toBe(true);
    expect(isValidDeliveryTransition("PREPARING", "SHIPPED")).toBe(true);
    expect(isValidDeliveryTransition("SHIPPED", "DELIVERED")).toBe(true);
  });

  it("ส่งตรง/รับเอง: PENDING/PREPARING → SHIPPED/DELIVERED ข้ามได้", () => {
    expect(isValidDeliveryTransition("PENDING", "SHIPPED")).toBe(true);
    expect(isValidDeliveryTransition("PENDING", "DELIVERED")).toBe(true);
    expect(isValidDeliveryTransition("PREPARING", "DELIVERED")).toBe(true);
  });

  it("ตีกลับได้ทุกจุด (ก่อนตีกลับ)", () => {
    for (const s of ["PENDING", "PREPARING", "SHIPPED", "DELIVERED"] as DeliveryStatus[]) {
      expect(isValidDeliveryTransition(s, "RETURNED")).toBe(true);
    }
  });

  it("แก้พลาดถอยหนึ่งก้าว: SHIPPED→PREPARING · DELIVERED→SHIPPED", () => {
    expect(isValidDeliveryTransition("SHIPPED", "PREPARING")).toBe(true);
    expect(isValidDeliveryTransition("DELIVERED", "SHIPPED")).toBe(true);
  });

  it("จัดการใหม่หลังตีกลับ: RETURNED → PENDING/PREPARING/SHIPPED", () => {
    expect(isValidDeliveryTransition("RETURNED", "PREPARING")).toBe(true);
    expect(isValidDeliveryTransition("RETURNED", "SHIPPED")).toBe(true);
    expect(isValidDeliveryTransition("RETURNED", "PENDING")).toBe(true);
  });

  it("บล็อกถอยไกลข้ามขั้น (ต้องถอยทีละก้าว)", () => {
    expect(isValidDeliveryTransition("SHIPPED", "PENDING")).toBe(false);
    expect(isValidDeliveryTransition("DELIVERED", "PENDING")).toBe(false);
    expect(isValidDeliveryTransition("DELIVERED", "PREPARING")).toBe(false);
  });

  it("บล็อกไป RETURNED → DELIVERED ตรง (ตีกลับแล้วต้องส่งใหม่ก่อน)", () => {
    expect(isValidDeliveryTransition("RETURNED", "DELIVERED")).toBe(false);
  });

  it("nextDeliveryStatuses = current + ที่ไปได้ (dropdown)", () => {
    const fromPending = nextDeliveryStatuses("PENDING");
    expect(fromPending[0]).toBe("PENDING"); // current นำหน้าเสมอ
    expect(fromPending).toContain("PREPARING");
    expect(fromPending).not.toContain(undefined);
    // DELIVERED กดได้แค่ตัวเอง + SHIPPED + RETURNED
    expect(nextDeliveryStatuses("DELIVERED").sort()).toEqual(
      ["DELIVERED", "RETURNED", "SHIPPED"].sort()
    );
  });
});
