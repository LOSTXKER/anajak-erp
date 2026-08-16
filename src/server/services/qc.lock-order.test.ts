import { describe, expect, it, vi } from "vitest";
import type { ExtendedPrismaClient } from "@/lib/prisma";

const serviceMocks = vi.hoisted(() => ({
  transitionOrder: vi.fn(),
  advanceOrderForward: vi.fn(),
  reopenProductionsForRework: vi.fn(),
  getGarmentPickState: vi.fn(),
  promoteOrderArtworks: vi.fn(),
  createAuditLog: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock("@/server/services/order-status", () => ({
  transitionOrder: serviceMocks.transitionOrder,
  advanceOrderForward: serviceMocks.advanceOrderForward,
  reopenProductionsForRework: serviceMocks.reopenProductionsForRework,
}));
vi.mock("@/server/services/garment-pick", () => ({
  getGarmentPickState: serviceMocks.getGarmentPickState,
}));
vi.mock("@/server/services/artwork", () => ({
  promoteOrderArtworks: serviceMocks.promoteOrderArtworks,
}));
vi.mock("@/server/helpers", () => ({
  createAuditLog: serviceMocks.createAuditLog,
  createNotification: serviceMocks.createNotification,
}));

import { createQcRecord } from "./qc";

describe("createQcRecord production lock contract", () => {
  it("ใช้ลำดับเดียวกับ production writer: step IDs → production IDs → order แล้วค่อยอ่าน state สดและเปิด rework", async () => {
    const log: string[] = [];
    serviceMocks.transitionOrder.mockImplementation(async () => {
      log.push("write:order-status");
      return { changed: true, from: "QUALITY_CHECK" };
    });
    serviceMocks.reopenProductionsForRework.mockImplementation(async () => {
      log.push("write:rework");
      return 2;
    });
    serviceMocks.getGarmentPickState.mockImplementation(async () => {
      log.push("read:garment-live");
      return { lines: [] };
    });
    serviceMocks.createAuditLog.mockImplementation(async () => {
      log.push("write:audit");
    });

    const tx = {
      $queryRaw: vi.fn(async (query: TemplateStringsArray, id: string) => {
        const table = String(query[0]).match(/FROM\s+(\w+)/i)?.[1] ?? "unknown";
        log.push(`lock:${table}:${id}`);
        return [];
      }),
      production: {
        findMany: vi.fn(async () => {
          log.push("read:production-refs");
          return [
            { id: "production-b", steps: [{ id: "step-b" }] },
            { id: "production-a", steps: [{ id: "step-c" }, { id: "step-a" }] },
          ];
        }),
      },
      order: {
        findUniqueOrThrow: vi.fn(async () => {
          log.push("read:order-live");
          return {
            id: "order-1",
            orderNumber: "ORD-1",
            internalStatus: "QUALITY_CHECK",
            items: [{ products: [{ variants: [{ quantity: 10 }] }] }],
            qcRecords: [],
            productions: [{ id: "production-a" }, { id: "production-b" }],
          };
        }),
      },
      qcRecord: {
        findUnique: vi.fn(async () => {
          log.push("read:qc-replay");
          return null;
        }),
        create: vi.fn(async ({ data }: {
          data: {
            id: string;
            orderId: string;
            qtyGood: number;
            qtyDefect: number;
            checkedById: string;
            defects: { create: Array<{ qty: number; reason: string }> };
          };
        }) => {
          log.push("write:qc");
          return {
            id: data.id,
            orderId: data.orderId,
            qtyGood: data.qtyGood,
            qtyDefect: data.qtyDefect,
            checkedById: data.checkedById,
            defects: data.defects.create,
          };
        }),
      },
    };
    const prisma = {
      ...tx,
      order: {
        ...tx.order,
        findUniqueOrThrow: vi.fn(async () => ({ orderNumber: "ORD-1" })),
      },
      user: { findMany: vi.fn().mockResolvedValue([]) },
      notification: { create: vi.fn() },
      $transaction: vi.fn(async <T>(callback: (client: typeof tx) => Promise<T>) => callback(tx)),
    } as unknown as ExtendedPrismaClient;

    await expect(createQcRecord(prisma, {
      orderId: "order-1",
      idempotencyKey: "qc-lock-order-0001",
      qtyGood: 8,
      defects: [{ qty: 1, reason: "PRINT_PEEL" }],
      userId: "staff-1",
    })).resolves.toMatchObject({ reworkOpened: true, movedToPacking: false });

    expect(tx.production.findMany).toHaveBeenCalledWith({
      where: { orderId: "order-1" },
      select: { id: true, steps: { select: { id: true } } },
    });
    expect(log).toEqual([
      "read:production-refs",
      "lock:production_steps:step-a",
      "lock:production_steps:step-b",
      "lock:production_steps:step-c",
      "lock:productions:production-a",
      "lock:productions:production-b",
      "lock:orders:order-1",
      "read:qc-replay",
      "read:order-live",
      "read:garment-live",
      "write:qc",
      "write:order-status",
      "write:rework",
      "write:audit",
    ]);
  });
});
