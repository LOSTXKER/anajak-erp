import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtendedPrismaClient } from "@/lib/prisma";

const storageMocks = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({ createSignedUrl: storageMocks.createSignedUrl }),
    },
  }),
}));

import { confirmCustomerUpload } from "./customer-upload";

describe("confirmCustomerUpload concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.test/signed" },
      error: null,
    });
  });

  it("ตรวจ storage ก่อนถือ order lock แล้ว create+touch parent ใน transaction เดียว", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      attachment: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "customer-file-1" }),
      },
      order: { update: vi.fn().mockResolvedValue({ id: "order-1" }) },
    };
    const prisma = {
      attachment: { count: vi.fn().mockResolvedValue(0) },
      $transaction: vi.fn(
        async (callback: (transaction: unknown) => unknown) => callback(tx),
      ),
      user: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as ExtendedPrismaClient;

    await confirmCustomerUpload(prisma, {
      order: {
        id: "order-1",
        orderNumber: "ORD-001",
        title: "งานทดสอบ",
      },
      path: "order-1/customer/reference.png",
      fileName: "reference.png",
      fileType: "image/png",
      fileSize: 123,
    });

    expect(storageMocks.createSignedUrl).toHaveBeenCalledOnce();
    expect(storageMocks.createSignedUrl.mock.invocationCallOrder[0]).toBeLessThan(
      tx.$queryRaw.mock.invocationCallOrder[0],
    );
    expect(tx.attachment.count).toHaveBeenCalledWith({
      where: {
        entityType: "ORDER",
        entityId: "order-1",
        uploadedById: null,
      },
    });
    expect(tx.attachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: "ORDER",
        entityId: "order-1",
        category: "REFERENCE_IMAGE",
        uploadedById: null,
      }),
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { updatedAt: expect.any(Date) },
      select: { id: true },
    });
  });
});
