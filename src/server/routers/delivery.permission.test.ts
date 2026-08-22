import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@prisma/client";
import type { Context } from "../trpc";
import { deliveryRouter } from "./delivery";

function context(role: Role, permissionOverrides: unknown = null): Context {
  const before = {
    recipientName: "ผู้รับ",
    phone: "0812345678",
    address: "กรุงเทพฯ",
    subDistrict: null,
    district: null,
    province: null,
    postalCode: null,
    shippingMethod: "ขนส่ง",
    trackingNumber: null,
    shippingCost: 0,
    isPaid: false,
    notes: null,
    status: "PENDING",
  };
  const tx = {
    delivery: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(before),
      update: vi.fn().mockResolvedValue({ id: "delivery-1", ...before }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  };
  return {
    prisma: {
      $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
    } as unknown as Context["prisma"],
    userId: "actor-1",
    userRole: role,
    permissionOverrides,
  };
}

describe("delivery writer permission — shipping is office-owned", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["OWNER", "MANAGER", "SALES"] as const)(
    "%s แก้เลขติดตามได้ด้วย ship_orders",
    async (role) => {
      await expect(
        deliveryRouter.createCaller(context(role)).update({
          id: "delivery-1",
          trackingNumber: "TRACK-001",
        }),
      ).resolves.toMatchObject({ id: "delivery-1" });
    },
  );

  it("PRODUCTION_STAFF แพ็กผ่าน Station ได้ แต่เขียนใบส่ง/เลขติดตามไม่ได้", async () => {
    await expect(
      deliveryRouter.createCaller(context("PRODUCTION_STAFF")).update({
        id: "delivery-1",
        trackingNumber: "TRACK-001",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("ใช้ effective permission override จาก session", async () => {
    await expect(
      deliveryRouter.createCaller(context("SALES", { ship_orders: false })).update({
        id: "delivery-1",
        trackingNumber: "TRACK-001",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
