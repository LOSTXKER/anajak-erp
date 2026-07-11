import { describe, expect, it } from "vitest";
import {
  canCreateDelivery,
  deliveryActionAvailability,
  shouldShowDeliverySection,
} from "./delivery-ui";

describe("delivery UI policy", () => {
  it("สร้างใบส่งได้เฉพาะช่วงแพ็ค/พร้อมส่ง/ส่งแล้วและต้องมีสิทธิ์", () => {
    expect(canCreateDelivery("PACKING", true)).toBe(true);
    expect(canCreateDelivery("READY_TO_SHIP", true)).toBe(true);
    expect(canCreateDelivery("SHIPPED", true)).toBe(true);
    expect(canCreateDelivery("COMPLETED", true)).toBe(false);
    expect(canCreateDelivery("PACKING", false)).toBe(false);
  });

  it("แสดง section ในช่วงจัดส่งหรือเมื่อมีใบส่งเดิม", () => {
    expect(shouldShowDeliverySection("PACKING", false)).toBe(true);
    expect(shouldShowDeliverySection("COMPLETED", false)).toBe(true);
    expect(shouldShowDeliverySection("INQUIRY", false)).toBe(false);
    expect(shouldShowDeliverySection("INQUIRY", true)).toBe(true);
  });

  it("ซ่อน action ที่ permission ฝั่ง server จะปฏิเสธ", () => {
    expect(
      deliveryActionAvailability({
        status: "PENDING",
        canManageDelivery: false,
        canDeleteDelivery: false,
      })
    ).toMatchObject({
      canEditTracking: false,
      canUpdateStatus: false,
      canDelete: false,
    });
  });

  it("ลบได้เฉพาะใบ PENDING และสิทธิ์หัวหน้า", () => {
    expect(
      deliveryActionAvailability({
        status: "PENDING",
        canManageDelivery: true,
        canDeleteDelivery: true,
      }).canDelete
    ).toBe(true);
    expect(
      deliveryActionAvailability({
        status: "PREPARING",
        canManageDelivery: true,
        canDeleteDelivery: true,
      }).canDelete
    ).toBe(false);
  });

  it.each([
    ["PENDING", "PREPARING", "เริ่มเตรียมส่ง"],
    ["PREPARING", "SHIPPED", "ยืนยันส่งแล้ว"],
    ["SHIPPED", "DELIVERED", "ยืนยันถึงแล้ว"],
    ["DELIVERED", "DELIVERED", "จัดการสถานะ"],
    ["RETURNED", "PREPARING", "เตรียมส่งใหม่"],
  ] as const)("เสนอ action ถัดไปจาก %s", (status, nextStatus, label) => {
    const policy = deliveryActionAvailability({
      status,
      canManageDelivery: true,
      canDeleteDelivery: true,
    });

    expect(policy.canUpdateStatus).toBe(true);
    expect(policy.nextAction).toEqual({ status: nextStatus, label });
  });
});
