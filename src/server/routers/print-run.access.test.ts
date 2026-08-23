import type { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";

const serviceMocks = vi.hoisted(() => ({
  getPrintQueue: vi.fn(),
  createPrintRun: vi.fn(),
  markPrintRunPrinted: vi.fn(),
  completePrintRun: vi.fn(),
  cancelPrintRun: vi.fn(),
  listPrintRuns: vi.fn(),
}));

vi.mock("@/server/services/print-run", () => serviceMocks);

import { printRunRouter } from "./print-run";

function context(
  role: Role,
  permissionOverrides: unknown = null,
  userId = "actor-1",
): Context {
  return {
    prisma: {} as Context["prisma"],
    userId,
    userRole: role,
    permissionOverrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  serviceMocks.getPrintQueue.mockResolvedValue([]);
  serviceMocks.listPrintRuns.mockResolvedValue([]);
  serviceMocks.createPrintRun.mockResolvedValue({
    id: "run-1",
    runNumber: "FR-1",
    items: [],
  });
  serviceMocks.markPrintRunPrinted.mockResolvedValue(undefined);
  serviceMocks.completePrintRun.mockResolvedValue(undefined);
  serviceMocks.cancelPrintRun.mockResolvedValue(undefined);
});

describe("printRunRouter access context", () => {
  it.each([
    ["PRODUCTION_STAFF", null, false],
    ["MANAGER", null, true],
    ["PRODUCTION_STAFF", { supervise_operations: true }, true],
    ["MANAGER", { supervise_operations: false }, false],
  ] as const)(
    "queue ส่ง effective supervise ของ %s/override ไป service",
    async (role, overrides, canSupervise) => {
      const ctx = context(role, overrides);

      await printRunRouter.createCaller(ctx).queue();

      expect(serviceMocks.getPrintQueue).toHaveBeenCalledWith(ctx.prisma, {
        userId: "actor-1",
        canOperate: true,
        canSupervise,
      });
    },
  );

  it("mutation ทุกตัวใช้ actor/effective permission จาก session และไม่รับการยกสิทธิ์ใน input", async () => {
    const ctx = context("PRODUCTION_STAFF", null, "worker-1");
    const caller = printRunRouter.createCaller(ctx);

    await caller.create({
      items: [{ stepId: "step-1", qty: 10 }],
      userId: "other-user",
      canSupervise: true,
    } as never);
    await caller.markPrinted({
      runId: "run-1",
      userId: "other-user",
      canSupervise: true,
    } as never);
    await caller.complete({
      runId: "run-1",
      extras: [{ itemId: "item-1", extraQty: 0 }],
      userId: "other-user",
      canSupervise: true,
    } as never);
    await caller.cancel({
      runId: "run-1",
      userId: "other-user",
      canSupervise: true,
    } as never);

    expect(serviceMocks.createPrintRun).toHaveBeenCalledWith(ctx.prisma, {
      items: [{ stepId: "step-1", qty: 10 }],
      userId: "worker-1",
      canOperate: true,
      canSupervise: false,
    });
    expect(serviceMocks.markPrintRunPrinted).toHaveBeenCalledWith(ctx.prisma, {
      runId: "run-1",
      userId: "worker-1",
      canOperate: true,
      canSupervise: false,
    });
    expect(serviceMocks.completePrintRun).toHaveBeenCalledWith(ctx.prisma, {
      runId: "run-1",
      extras: [{ itemId: "item-1", extraQty: 0 }],
      userId: "worker-1",
      canOperate: true,
      canSupervise: false,
    });
    expect(serviceMocks.cancelPrintRun).toHaveBeenCalledWith(ctx.prisma, {
      runId: "run-1",
      userId: "worker-1",
      canOperate: true,
      canSupervise: false,
    });
  });

  it("ส่ง V2 batch command/revision/result ไป service ครบ", async () => {
    const ctx = context("PRODUCTION_STAFF", null, "worker-1");
    const caller = printRunRouter.createCaller(ctx);
    await caller.create({
      commandId: "dtf-create-0001",
      workResourceId: "printer-1",
      items: [
        { operationJobId: "operation-dtf-1", expectedRevision: 3, qty: 10 },
      ],
    });
    await caller.complete({
      runId: "run-1",
      commandId: "dtf-complete-0001",
      results: [
        {
          itemId: "item-1",
          expectedRevision: 4,
          qtyGood: 8,
          qtyScrap: 2,
          qtyReprint: 2,
          quantityLines: [
            { quantityLineId: "quantity-line-1", qtyGood: 8, qtyScrap: 2 },
          ],
        },
      ],
    });
    await caller.markPrinted({
      runId: "run-1",
      commandId: "dtf-printed-0001",
      items: [{ itemId: "item-1", expectedRevision: 4 }],
    });
    await caller.cancel({
      runId: "run-2",
      commandId: "dtf-cancel-0001",
      items: [{ itemId: "item-2", expectedRevision: 7 }],
    });

    expect(serviceMocks.createPrintRun).toHaveBeenLastCalledWith(
      ctx.prisma,
      expect.objectContaining({
        commandId: "dtf-create-0001",
        items: [
          { operationJobId: "operation-dtf-1", expectedRevision: 3, qty: 10 },
        ],
      }),
    );
    expect(serviceMocks.completePrintRun).toHaveBeenLastCalledWith(
      ctx.prisma,
      expect.objectContaining({
        commandId: "dtf-complete-0001",
        results: [expect.objectContaining({
          qtyGood: 8,
          qtyScrap: 2,
          qtyReprint: 2,
          quantityLines: [
            { quantityLineId: "quantity-line-1", qtyGood: 8, qtyScrap: 2 },
          ],
        })],
      }),
    );
    expect(serviceMocks.markPrintRunPrinted).toHaveBeenLastCalledWith(
      ctx.prisma,
      expect.objectContaining({
        runId: "run-1",
        commandId: "dtf-printed-0001",
        items: [{ itemId: "item-1", expectedRevision: 4 }],
      }),
    );
    expect(serviceMocks.cancelPrintRun).toHaveBeenLastCalledWith(
      ctx.prisma,
      expect.objectContaining({
        runId: "run-2",
        commandId: "dtf-cancel-0001",
        items: [{ itemId: "item-2", expectedRevision: 7 }],
      }),
    );
  });

  it("list ส่ง actor + operate/supervise ให้ service ตัด availableCommands", async () => {
    const ctx = context("DESIGNER", null, "viewer-1");

    await printRunRouter.createCaller(ctx).list();

    expect(serviceMocks.listPrintRuns).toHaveBeenCalledWith(ctx.prisma, {
      userId: "viewer-1",
      canOperate: false,
      canSupervise: false,
    });
  });

  it("V2 lifecycle ต้องส่ง commandId และ revision items พร้อมกัน", async () => {
    const caller = printRunRouter.createCaller(
      context("PRODUCTION_STAFF", null, "worker-1"),
    );

    await expect(
      caller.markPrinted({
        runId: "run-1",
        commandId: "dtf-printed-0002",
      }),
    ).rejects.toThrow();
    await expect(
      caller.cancel({
        runId: "run-1",
        items: [{ itemId: "item-1", expectedRevision: 4 }],
      }),
    ).rejects.toThrow();
    expect(serviceMocks.markPrintRunPrinted).not.toHaveBeenCalled();
    expect(serviceMocks.cancelPrintRun).not.toHaveBeenCalled();
  });

  it("ไม่รับผล V2 ที่ไม่มี quantity line", async () => {
    const caller = printRunRouter.createCaller(
      context("PRODUCTION_STAFF", null, "worker-1"),
    );

    await expect(caller.complete({
      runId: "run-1",
      commandId: "dtf-complete-0002",
      results: [{
        itemId: "item-1",
        expectedRevision: 4,
        qtyGood: 8,
        qtyScrap: 2,
        qtyReprint: 2,
      }],
    } as never)).rejects.toThrow();
    expect(serviceMocks.completePrintRun).not.toHaveBeenCalled();
  });
});
