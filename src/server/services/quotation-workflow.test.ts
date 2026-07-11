import { describe, expect, it, vi } from "vitest";
import type { ExtendedPrismaClient } from "@/lib/prisma";
import { prepareQuotationShare, quotationSharePath, updateQuotationDraft } from "./quotation-workflow";

function makePrisma(overrides: Record<string, unknown> = {}) {
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "quote-1" }]),
    quotation: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        status: "DRAFT",
        title: "หัวเดิม",
        validUntil: futureDate,
        discount: 0,
        tax: 0,
        totalAmount: 100,
        sentAt: null,
        confirmToken: null,
        _count: { items: 1 },
      }),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "quote-1", ...data })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    quotationItem: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    ...overrides,
  };
  const prisma = {
    $transaction: vi.fn().mockImplementation((fn) => fn(tx)),
  } as unknown as ExtendedPrismaClient;
  return { prisma, tx };
}

describe("updateQuotationDraft", () => {
  it("ล็อกก่อน แล้วบันทึกหัวใบ+รายการ+ยอด+audit ใน transaction เดียว", async () => {
    const { prisma, tx } = makePrisma();

    const result = await updateQuotationDraft(prisma, {
      id: "quote-1",
      userId: "user-1",
      title: "เสื้อทีม",
      description: "DTF หน้าอก",
      validUntil: new Date("2027-01-31"),
      discount: 50,
      tax: 35,
      items: [
        { name: "เสื้อ", quantity: 10, unit: "ตัว", unitPrice: 100 },
        { name: "ค่าพิมพ์", quantity: 2, unit: "จุด", unitPrice: 25 },
      ],
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.quotationItem.deleteMany).toHaveBeenCalledWith({
      where: { quotationId: "quote-1" },
    });
    expect(tx.quotation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "quote-1" },
        data: expect.objectContaining({
          title: "เสื้อทีม",
          subtotal: 1050,
          discount: 50,
          tax: 35,
          totalAmount: 1035,
          items: {
            create: [
              expect.objectContaining({ totalPrice: 1000, sortOrder: 0 }),
              expect.objectContaining({ totalPrice: 50, sortOrder: 1 }),
            ],
          },
        }),
      })
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "UPDATE",
          entityType: "QUOTATION",
          entityId: "quote-1",
          reason: "บันทึกหัวใบและรายการใบเสนอพร้อมกัน",
        }),
      })
    );
    expect(result).toEqual(expect.objectContaining({ totalAmount: 1035 }));
  });

  it("ไม่ใช่ DRAFT ต้องหยุดก่อนลบรายการหรือเขียน audit", async () => {
    const { prisma, tx } = makePrisma();
    tx.quotation.findUniqueOrThrow.mockResolvedValueOnce({
      status: "SENT",
      title: "ส่งแล้ว",
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      discount: 0,
      tax: 0,
      totalAmount: 100,
      _count: { items: 1 },
    });

    await expect(
      updateQuotationDraft(prisma, {
        id: "quote-1",
        userId: "user-1",
        title: "พยายามแก้",
        validUntil: new Date("2027-01-31"),
        discount: 0,
        tax: 0,
        items: [{ name: "เสื้อ", quantity: 1, unit: "ตัว", unitPrice: 100 }],
      })
    ).rejects.toThrow(/เฉพาะฉบับร่าง/);

    expect(tx.quotationItem.deleteMany).not.toHaveBeenCalled();
    expect(tx.quotation.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("prepareQuotationShare", () => {
  it("DRAFT → SENT พร้อม token และ audit ใน transaction เดียว", async () => {
    const { prisma, tx } = makePrisma();

    const result = await prepareQuotationShare(prisma, {
      id: "quote-1",
      userId: "user-1",
      expectedStatus: "DRAFT",
    });

    expect(result.status).toBe("SENT");
    expect(result.token).toMatch(/^[a-f0-9]{64}$/);
    expect(result.sharePath).toBe(`/quote/${result.token}`);
    expect(tx.quotation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "quote-1", status: "DRAFT" },
        data: expect.objectContaining({ status: "SENT", confirmToken: result.token }),
      })
    );
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("ใบ SENT ที่มี token แล้วคืนลิงก์เดิมโดยไม่เขียนซ้ำ", async () => {
    const { prisma, tx } = makePrisma();
    tx.quotation.findUniqueOrThrow.mockResolvedValueOnce({
      status: "SENT",
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      sentAt: new Date("2026-12-01"),
      confirmToken: "tokenเดิม",
    });

    const result = await prepareQuotationShare(prisma, {
      id: "quote-1",
      userId: "user-1",
      expectedStatus: "SENT",
    });

    expect(result).toEqual({
      status: "SENT",
      token: "tokenเดิม",
      sharePath: "/quote/tokenเดิม",
    });
    expect(tx.quotation.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("ใบหมดอายุหยุดก่อนเปลี่ยนสถานะหรือออก token", async () => {
    const { prisma, tx } = makePrisma();
    tx.quotation.findUniqueOrThrow.mockResolvedValueOnce({
      status: "DRAFT",
      validUntil: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      sentAt: null,
      confirmToken: null,
    });

    await expect(
      prepareQuotationShare(prisma, {
        id: "quote-1",
        userId: "user-1",
        expectedStatus: "DRAFT",
      })
    ).rejects.toThrow(/หมดอายุ/);

    expect(tx.quotation.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("ลิงก์ path คงรูปแบบ public เดิม", () => {
    expect(quotationSharePath("abc123")).toBe("/quote/abc123");
  });
});
