import { describe, expect, it, vi } from "vitest";
import type { PrismaTx } from "@/lib/prisma";
import { lockProductionTopology } from "@/server/services/production-topology-lock";

describe("lockProductionTopology", () => {
  it("cast ผล void ของ advisory lock ก่อนให้ Prisma deserialize", async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ lock_result: "" }]);

    await lockProductionTopology(
      { $queryRaw: queryRaw } as unknown as PrismaTx,
      "order-1",
    );

    expect(queryRaw).toHaveBeenCalledOnce();
    const [query, orderId] = queryRaw.mock.calls[0] ?? [];
    expect((query as TemplateStringsArray).join(" ")).toContain(
      "pg_advisory_xact_lock",
    );
    expect((query as TemplateStringsArray).join(" ")).toMatch(
      /\)::text\s+AS\s+lock_result/,
    );
    expect(orderId).toBe("order-1");
  });
});
