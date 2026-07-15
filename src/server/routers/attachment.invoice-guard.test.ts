import { describe, expect, it } from "vitest";
import { attachmentRouter } from "./attachment";
import type { Context } from "../trpc";

// ด่านแนบไฟล์บนเอกสารเงิน (INVOICE) — เฉพาะคนมีสิทธิ์บิล/รับเงิน (manage_billing_docs | record_payments)
// ปิด mutation สุดท้ายที่เส้นทางทั่วไปเคย login-only (audit 07-15)

const makeCtx = (userRole: string) =>
  ({
    prisma: {
      invoice: {
        findUnique: async () => ({ id: "inv-1" }),
      },
      attachment: {
        create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "att-1", ...data }),
      },
    } as unknown as Context["prisma"],
    userId: "user-1",
    userRole,
    permissionOverrides: null,
  }) as Context;

const input = {
  entityType: "INVOICE",
  entityId: "inv-1",
  fileName: "slip.jpg",
  fileUrl: "/api/files/invoices/inv-1/slip.jpg",
  fileType: "image/jpeg",
  fileSize: 1024,
};

describe("attachment.create — ด่านเอกสารเงิน (INVOICE)", () => {
  it("SALES แนบไฟล์บนใบแจ้งหนี้ไม่ได้ (FORBIDDEN)", async () => {
    await expect(
      attachmentRouter.createCaller(makeCtx("SALES")).create(input)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("PRODUCTION_STAFF แนบไฟล์บนใบแจ้งหนี้ไม่ได้ (FORBIDDEN)", async () => {
    await expect(
      attachmentRouter.createCaller(makeCtx("PRODUCTION_STAFF")).create(input)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("ACCOUNTANT (record_payments) แนบสลิปบนใบแจ้งหนี้ได้", async () => {
    await expect(
      attachmentRouter.createCaller(makeCtx("ACCOUNTANT")).create(input)
    ).resolves.toMatchObject({ entityType: "INVOICE", uploadedById: "user-1" });
  });

  it("MANAGER (manage_billing_docs) แนบได้", async () => {
    await expect(
      attachmentRouter.createCaller(makeCtx("MANAGER")).create(input)
    ).resolves.toMatchObject({ entityType: "INVOICE" });
  });

  it("SALES ยังแนบไฟล์ทั่วไปบน ORDER ได้ (เส้นทางเดิมไม่พัง)", async () => {
    const ctx = makeCtx("SALES");
    (ctx.prisma as unknown as { order: { findUnique: () => Promise<{ id: string }> } }).order = {
      findUnique: async () => ({ id: "ord-1" }),
    };
    await expect(
      attachmentRouter
        .createCaller(ctx)
        .create({ ...input, entityType: "ORDER", entityId: "ord-1", fileUrl: "/api/files/orders/ord-1/ref.jpg" })
    ).resolves.toMatchObject({ entityType: "ORDER" });
  });
});
