import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { customerStatusRouter } from "./customer-status";
import { customerUploadRouter } from "./customer-upload";
import { designRouter } from "./design";

describe("public token access", () => {
  it.each(["status", "upload"])("%s link requires the same effective permission as generating it", async (kind) => {
    const read = vi.fn().mockResolvedValue({ statusToken: "private", uploadToken: "private" });
    const ctx: Context = { prisma: { order: { findUnique: read } } as unknown as Context["prisma"], userId: "staff", userRole: "PRODUCTION_STAFF" };
    const call = (context: Context) => kind === "status" ? customerStatusRouter.createCaller(context).getLink({ orderId: "order" }) : customerUploadRouter.createCaller(context).getLink({ orderId: "order" });
    await expect(call(ctx)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(read).not.toHaveBeenCalled();
    await expect(call({ ...ctx, permissionOverrides: { create_sales_docs: true } })).resolves.toMatchObject({ token: "private" });
    await expect(call({ ...ctx, userRole: "OWNER", permissionOverrides: { create_sales_docs: false } })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("a revoked design token returns NOT_FOUND so the UI removes cached data", async () => {
    const ctx: Context = { prisma: { designVersion: { findUnique: vi.fn().mockResolvedValue(null) } } as unknown as Context["prisma"], userId: null, userRole: null };
    await expect(designRouter.createCaller(ctx).getByToken({ token: "revoked" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(designRouter.createCaller(ctx).approveByToken({ token: "revoked", approved: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
