import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";

const serviceMocks = vi.hoisted(() => ({
  getQcContext: vi.fn(),
  createQcRecord: vi.fn(),
}));

vi.mock("@/server/services/qc", () => serviceMocks);

import { qcRouter } from "./qc";

function caller(overrides: unknown = null) {
  return qcRouter.createCaller({
    prisma: {} as Context["prisma"],
    userId: "worker-1",
    userRole: "PRODUCTION_STAFF",
    permissionOverrides: overrides,
  });
}

describe("qc V2 router contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.createQcRecord.mockResolvedValue({ id: "qc-1" });
  });

  it("reject ต้องมี disposition และส่ง operation revision/effective supervisor", async () => {
    await expect(
      caller().create({
        orderId: "order-1",
        idempotencyKey: "qc-command-0001",
        operationJobId: "operation-qc-1",
        expectedRevision: 5,
        qtyGood: 8,
        quantityLines: [{ quantityLineId: "quantity-qc-1", qtyGood: 8 }],
        defects: [{ quantityLineId: "quantity-qc-1", qty: 2, reason: "PRINT_PEEL" }],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await caller({ supervise_operations: true }).create({
      orderId: "order-1",
      idempotencyKey: "qc-command-0001",
      operationJobId: "operation-qc-1",
      expectedRevision: 5,
      qtyGood: 8,
      quantityLines: [{ quantityLineId: "quantity-qc-1", qtyGood: 8 }],
      defects: [
        {
          quantityLineId: "quantity-qc-1",
          qty: 2,
          reason: "PRINT_PEEL",
          disposition: "REWORK",
        },
      ],
    });
    expect(serviceMocks.createQcRecord).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        operationJobId: "operation-qc-1",
        expectedRevision: 5,
        canSupervise: true,
        defects: [expect.objectContaining({ disposition: "REWORK" })],
      }),
    );
  });
});
