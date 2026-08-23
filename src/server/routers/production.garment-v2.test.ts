import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";

const garmentMocks = vi.hoisted(() => ({
  getGarmentPickState: vi.fn(),
  issueGarments: vi.fn(),
  returnGarments: vi.fn(),
}));

vi.mock("@/server/services/garment-pick", () => garmentMocks);

import { productionRouter } from "./production";

const ctx = {
  prisma: {} as Context["prisma"],
  userId: "worker-1",
  userRole: "PRODUCTION_STAFF" as const,
  permissionOverrides: null,
};

describe("garment V2 router contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    garmentMocks.issueGarments.mockResolvedValue({ docNumber: "ISSUE-1" });
    garmentMocks.returnGarments.mockResolvedValue({ docNumber: "RETURN-1" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("flag off ปฏิเสธ operationJobId แต่ไม่ปิด legacy contract", async () => {
    vi.stubEnv("PRODUCTION_V2_ENABLED", "false");
    const caller = productionRouter.createCaller(ctx);

    await expect(
      caller.issueGarments({
        productionId: "production-1",
        operationJobId: "operation-prep-1",
        expectedRevision: 2,
        idempotencyKey: "issue-command-1",
        lines: [{ sku: "TS-M", qty: 10 }],
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(garmentMocks.issueGarments).not.toHaveBeenCalled();

    await expect(
      caller.issueGarments({
        productionId: "production-1",
        stepId: "legacy-prep-1",
        idempotencyKey: "legacy-issue-1",
        lines: [{ sku: "TS-M", qty: 10 }],
      }),
    ).resolves.toEqual({ docNumber: "ISSUE-1" });
  });

  it("Production Staff เบิก/คืนผ่าน PREP operation ได้ แต่ legacy return ยังเป็นหัวหน้า", async () => {
    const caller = productionRouter.createCaller(ctx);
    await caller.issueGarments({
      productionId: "production-1",
      operationJobId: "operation-prep-1",
      expectedRevision: 2,
      idempotencyKey: "issue-command-1",
      lines: [{ sku: "TS-M", qty: 10 }],
    });
    await caller.returnGarments({
      productionId: "production-1",
      operationJobId: "operation-prep-1",
      expectedRevision: 3,
      idempotencyKey: "return-command-1",
      lines: [{ sku: "TS-M", qty: 1 }],
    });

    expect(garmentMocks.issueGarments).toHaveBeenCalledWith(
      ctx.prisma,
      expect.objectContaining({ operationJobId: "operation-prep-1" }),
    );
    expect(garmentMocks.returnGarments).toHaveBeenCalledWith(
      ctx.prisma,
      expect.objectContaining({
        operationJobId: "operation-prep-1",
        canSupervise: false,
      }),
    );
    await expect(
      caller.returnGarments({
        productionId: "production-1",
        idempotencyKey: "legacy-return-1",
        lines: [{ sku: "TS-M", qty: 1 }],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
