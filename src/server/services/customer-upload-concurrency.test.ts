import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtendedPrismaClient } from "@/lib/prisma";

const storageMocks = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
  createSignedUploadUrl: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({ createSignedUrl: storageMocks.createSignedUrl, createSignedUploadUrl: storageMocks.createSignedUploadUrl }),
    },
  }),
}));

import { confirmCustomerUpload, createCustomerUploadUrl } from "./customer-upload";
import { CUSTOMER_UPLOAD_ACCEPT, CUSTOMER_UPLOAD_MAX_BYTES } from "@/lib/customer-upload-policy";

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

describe("customer upload picker and server policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.createSignedUploadUrl.mockResolvedValue({
      data: { path: "order-1/customer/test.7z", token: "test-upload-token" },
      error: null,
    });
  });

  it("ไฟล์งาน 7z ที่ server รับอยู่เดิมเลือกจาก picker ได้ และขนาดสูงสุดยังรับได้", async () => {
    expect(CUSTOMER_UPLOAD_ACCEPT.split(",")).toContain(".7z");
    await expect(createCustomerUploadUrl({ orderId: "order-1", fileName: "งาน.7z", fileSize: CUSTOMER_UPLOAD_MAX_BYTES })).resolves.toMatchObject({ bucket: "designs" });
    expect(storageMocks.createSignedUploadUrl).toHaveBeenCalledOnce();
  });

  it("SVG ไม่อยู่ใน picker และถูกปฏิเสธก่อนออก signed URL", async () => {
    expect(CUSTOMER_UPLOAD_ACCEPT.split(",")).not.toContain(".svg");
    expect(CUSTOMER_UPLOAD_ACCEPT).not.toContain("image/*");
    await expect(createCustomerUploadUrl({ orderId: "order-1", fileName: "reference.svg", fileSize: 100 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(storageMocks.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("เกิน 25 MB แม้เพียงไบต์เดียวต้องไม่ออก signed URL", async () => {
    await expect(createCustomerUploadUrl({ orderId: "order-1", fileName: "reference.pdf", fileSize: 25 * 1024 * 1024 + 1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(storageMocks.createSignedUploadUrl).not.toHaveBeenCalled();
  });
});
