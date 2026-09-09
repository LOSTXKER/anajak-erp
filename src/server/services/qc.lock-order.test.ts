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

vi.mock("@/server/services/order-status", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/server/services/order-status")>(),
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
    const revisions: Array<{ id: string; changeType: string; newValue: string | null; version: number }> = [];
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
        findUniqueOrThrow: vi.fn(async ({ select }: { select: Record<string, unknown> }) => {
          if (select.productionCompletionOwnerId) {
            log.push("read:production-owner");
            return {
              productionCompletionOwnerId: null,
              productions: [
                { workOrderNumber: null, completionOwnerStepId: null },
                { workOrderNumber: null, completionOwnerStepId: null },
              ],
            };
          }
          log.push("read:order-live");
          return {
            id: "order-1",
            orderNumber: "ORD-1",
            internalStatus: "QUALITY_CHECK",
            items: [{ products: [{
              id: "order-product-1", description: "เสื้อลูกค้า", itemSource: "CUSTOMER_PROVIDED", productId: null,
              variants: [{ id: "order-variant-m", size: "M", color: "ดำ", quantity: 10 }],
            }] }],
            qcRecords: [],
            revisions,
            productions: [{ id: "production-a" }, { id: "production-b" }],
          };
        }),
      },
      orderRevision: {
        count: vi.fn(async () => revisions.length),
        create: vi.fn(async ({ data }: { data: { changeType: string; newValue?: string; version: number } }) => {
          log.push("write:qc-ledger");
          const revision = { ...data, id: `revision-${data.version}`, newValue: data.newValue ?? null };
          revisions.push(revision);
          return revision;
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
      "lock:unknown:order-1",
      "read:production-refs",
      "lock:production_steps:step-a",
      "lock:production_steps:step-b",
      "lock:production_steps:step-c",
      "lock:productions:production-a",
      "lock:productions:production-b",
      "lock:orders:order-1",
      "read:production-owner",
      "read:qc-replay",
      "read:order-live",
      "read:garment-live",
      "read:order-live",
      "write:qc",
      "write:qc-ledger",
      "write:order-status",
      "write:rework",
      "write:audit",
    ]);
    expect(revisions).toHaveLength(1);
    expect(JSON.parse(revisions[0]!.newValue!)).toMatchObject({
      kind: "LEGACY_QC_COUNT", scopeRevisionId: null,
      lines: [{ variantId: "order-variant-m", qtyGood: 8 }],
    });
  });
});
