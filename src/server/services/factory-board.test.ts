import { describe, expect, it, vi } from "vitest";
import type { ExtendedPrismaClient } from "@/lib/prisma";
import { buildPackQueue, buildProblems } from "@/server/services/factory-board";

describe("buildProblems", () => {
  it("ไม่ประกาศ PACKAGING รุ่นเก่าเป็นปัญหาก่อน QC บนจอทีวี", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      productionStep: { findMany },
    } as unknown as ExtendedPrismaClient;

    await buildProblems(prisma);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ stepType: { not: "PACKAGING" } }),
      }),
    );
  });
});

describe("buildPackQueue", () => {
  it("อ่านแพ็กสุดท้ายจากสถานะออเดอร์ PACKING ไม่ใช่ PACKAGING ก่อน QC", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "order-pack",
        orderNumber: "ORD-2608-0041",
        title: "เสื้อทีมหน้าร้าน",
        deadline: new Date("2026-08-20T00:00:00.000Z"),
        blindShip: true,
        customer: { name: "ลูกค้าเอ" },
      },
    ]);
    const prisma = {
      order: { findMany },
      productionStep: {
        findMany: vi.fn(() => {
          throw new Error("ห้ามอ่าน PACKAGING production step");
        }),
      },
    } as unknown as ExtendedPrismaClient;

    await expect(buildPackQueue(prisma, { limit: 8 })).resolves.toEqual([
      {
        stepId: "pack:order-pack",
        orderId: "order-pack",
        productionId: null,
        orderNumber: "ORD-2608-0041",
        title: "เสื้อทีมหน้าร้าน",
        customerName: "ลูกค้าเอ",
        deadline: new Date("2026-08-20T00:00:00.000Z"),
        blindShip: true,
        assignedToName: null,
      },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { internalStatus: "PACKING" },
        orderBy: { deadline: "asc" },
        take: 8,
      }),
    );
  });
});
