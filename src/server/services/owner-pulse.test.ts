import { describe, expect, it, vi } from "vitest";
import { getOwnerPulse } from "./owner-pulse";

describe("getOwnerPulse — ไม่นับ PACKAGING compatibility เป็นผลงานผลิต", () => {
  it("ตัด PACKAGING จากทั้งขั้นเสร็จวันนี้และขั้นเปิดค้าง", async () => {
    const productionCount = vi.fn().mockResolvedValue(0);
    const prisma = {
      order: { count: vi.fn().mockResolvedValue(0) },
      outsourceOrder: { count: vi.fn().mockResolvedValue(0) },
      productionStep: { count: productionCount },
      invoice: { count: vi.fn().mockResolvedValue(0) },
      quotation: { count: vi.fn().mockResolvedValue(0) },
    };

    await getOwnerPulse(prisma as never);

    expect(productionCount).toHaveBeenCalledTimes(2);
    for (const [query] of productionCount.mock.calls) {
      expect(query.where.stepType).toEqual({ not: "PACKAGING" });
    }
  });
});
