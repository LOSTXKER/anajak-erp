import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { attachmentRouter } from "./attachment";
import { orderRouter } from "./order";

function transactionContext(tx: Record<string, unknown>): Context {
  return {
    prisma: {
      $transaction: vi.fn(
        async (callback: (transaction: unknown) => unknown) => callback(tx),
      ),
    } as unknown as Context["prisma"],
    userId: "production-1",
    userRole: "PRODUCTION_STAFF",
    permissionOverrides: null,
  };
}

describe("order child writers share the saveForm parent lock", () => {
  it("updateReceiveTracking ล็อกหัวใบก่อนเขียน product และขยับ updatedAt ใน tx เดียวกัน", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      orderItemProduct: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          orderItem: { orderId: "order-1" },
        }),
        update: vi.fn().mockResolvedValue({
          id: "saved-product-1",
          garmentCondition: "ครบ",
          receivedInspected: true,
          receiveNote: "รับครบแล้ว",
        }),
      },
      order: { update: vi.fn().mockResolvedValue({ id: "order-1" }) },
      auditLog: { create: vi.fn() },
    };

    await expect(
      orderRouter.createCaller(transactionContext(tx)).updateReceiveTracking({
        orderItemProductId: "saved-product-1",
        garmentCondition: "ครบ",
        receivedInspected: true,
        receiveNote: "รับครบแล้ว",
      }),
    ).resolves.toMatchObject({
      id: "saved-product-1",
      receivedInspected: true,
    });

    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.orderItemProduct.update.mock.invocationCallOrder[0],
    );
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { updatedAt: expect.any(Date) },
      select: { id: true },
    });
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
  });

  it("attachment.create ของ ORDER/REFERENCE_IMAGE ล็อกหัวใบและขยับ token", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      attachment: {
        create: vi.fn().mockImplementation(({ data }) => ({
          id: "attachment-1",
          ...data,
        })),
      },
      order: { update: vi.fn().mockResolvedValue({ id: "order-1" }) },
    };
    const ctx = transactionContext(tx);
    Object.assign(ctx.prisma, {
      order: { findUnique: vi.fn().mockResolvedValue({ id: "order-1" }) },
    });

    await attachmentRouter.createCaller(ctx).create({
      entityType: "ORDER",
      entityId: "order-1",
      fileName: "reference.png",
      fileUrl: "/api/files/orders/order-1/reference.png",
      fileType: "image/png",
      fileSize: 123,
      category: "REFERENCE_IMAGE",
    });

    expect(ctx.prisma.$transaction).toHaveBeenCalledOnce();
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.attachment.create.mock.invocationCallOrder[0],
    );
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { updatedAt: expect.any(Date) },
      select: { id: true },
    });
  });

  it("attachment.delete ของ ORDER/REFERENCE_IMAGE ล็อกหัวใบและขยับ token", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      attachment: {
        delete: vi.fn().mockResolvedValue({ id: "attachment-1" }),
      },
      order: { update: vi.fn().mockResolvedValue({ id: "order-1" }) },
    };
    const ctx = transactionContext(tx);
    Object.assign(ctx.prisma, {
      attachment: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          uploadedById: "production-1",
          entityType: "ORDER",
          entityId: "order-1",
          category: "REFERENCE_IMAGE",
        }),
      },
    });

    await attachmentRouter.createCaller(ctx).delete({ id: "attachment-1" });

    expect(ctx.prisma.$transaction).toHaveBeenCalledOnce();
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.attachment.delete.mock.invocationCallOrder[0],
    );
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { updatedAt: expect.any(Date) },
      select: { id: true },
    });
  });
});
