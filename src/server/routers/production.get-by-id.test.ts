import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { productionRouter } from "./production";

describe("production.getById", () => {
  it("คืน NOT_FOUND ที่ UI แยกจาก server error ได้เมื่อไม่มีใบผลิต", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const ctx: Context = {
      prisma: {
        production: { findUnique },
      } as unknown as Context["prisma"],
      userId: "production-viewer",
      userRole: "PRODUCTION_STAFF",
      permissionOverrides: null,
    };

    await expect(
      productionRouter.createCaller(ctx).getById({ id: "missing-production" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "ไม่พบงานผลิต (missing-production)",
    });
    expect(findUnique).toHaveBeenCalledOnce();
  });
});
