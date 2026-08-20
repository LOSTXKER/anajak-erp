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
      canSupervise: false,
    });
    expect(serviceMocks.markPrintRunPrinted).toHaveBeenCalledWith(ctx.prisma, {
      runId: "run-1",
      userId: "worker-1",
      canSupervise: false,
    });
    expect(serviceMocks.completePrintRun).toHaveBeenCalledWith(ctx.prisma, {
      runId: "run-1",
      extras: [{ itemId: "item-1", extraQty: 0 }],
      userId: "worker-1",
      canSupervise: false,
    });
    expect(serviceMocks.cancelPrintRun).toHaveBeenCalledWith(ctx.prisma, {
      runId: "run-1",
      userId: "worker-1",
      canSupervise: false,
    });
  });
});
