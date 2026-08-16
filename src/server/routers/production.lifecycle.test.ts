import { describe, expect, it, vi } from "vitest";
import type { Context } from "../trpc";
import { productionRouter } from "./production";

function transactionContext(
  tx: Record<string, unknown>,
  orderStatus = "PRODUCING",
): Context {
  if (!tx.production) {
    tx.production = {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ orderId: "order-1" }),
    };
  }
  if (!tx.order) {
    tx.order = {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ internalStatus: orderStatus }),
    };
  }
  return {
    prisma: {
      $transaction: vi.fn(
        async (callback: (transaction: unknown) => unknown) => callback(tx),
      ),
    } as unknown as Context["prisma"],
    userId: "production-staff-1",
    userRole: "PRODUCTION_STAFF",
    permissionOverrides: null,
  };
}

describe("production lifecycle invariants", () => {
  it("ใบผลิตใหม่ปฏิเสธ PACKAGING เพราะแพ็กต้องเกิดหลัง QC", async () => {
    const findMany = vi.fn();
    const ctx = {
      prisma: { orderItemProduct: { findMany } } as unknown as Context["prisma"],
      userId: "manager-1",
      userRole: "MANAGER" as const,
      permissionOverrides: null,
    };

    await expect(
      productionRouter.createCaller(ctx).create({
        orderId: "order-1",
        steps: [{ stepType: "PACKAGING", sortOrder: 1 }],
      } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(findMany).not.toHaveBeenCalled();
  });

  it("ถือ row lock ก่อนอ่าน assignee เพื่อให้ staff สองจอ claim งานเดียวกันไม่ได้", async () => {
    const findUniqueOrThrow = vi
      .fn()
      .mockResolvedValueOnce({
        assignedToId: null,
        productionId: "production-1",
        stepType: "HEAT_PRESS",
        status: "PENDING",
      })
      .mockResolvedValueOnce({
        id: "step-1",
        productionId: "production-1",
        stepType: "HEAT_PRESS",
        status: "PENDING",
        assignedToId: "production-staff-1",
      });
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      productionStep: {
        findUniqueOrThrow,
        update: vi.fn().mockResolvedValue({
          id: "step-1",
          productionId: "production-1",
          stepType: "HEAT_PRESS",
          customStepName: null,
          status: "PENDING",
          qtyDone: 0,
          qtyTotal: 10,
          startedAt: null,
          production: { orderId: "order-1" },
        }),
        findMany: vi.fn().mockResolvedValue([
          { stepType: "HEAT_PRESS", status: "PENDING" },
        ]),
      },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    };

    const result = await productionRouter
      .createCaller(transactionContext(tx))
      .updateStep({ stepId: "step-1", notes: "เริ่มตรวจงาน" });

    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.productionStep.findUniqueOrThrow.mock.invocationCallOrder[0],
    );
    expect(String(tx.$queryRaw.mock.calls[0]?.[0])).toContain("production_steps");
    expect(String(tx.$queryRaw.mock.calls[1]?.[0])).toContain("productions");
    expect(String(tx.$queryRaw.mock.calls[2]?.[0])).toContain("orders");
    expect(tx.productionStep.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignedToId: "production-staff-1" }) }),
    );
    expect(JSON.stringify(findUniqueOrThrow.mock.calls.at(-1)?.[0]?.select)).not.toMatch(
      /amount|price|cost/i,
    );
    expect(JSON.stringify(result)).not.toMatch(/amount|price|cost/i);
  });

  it.each(["ON_HOLD", "CANCELLED"])(
    "ปฏิเสธ updateStep เมื่อสถานะออเดอร์สดเป็น %s ก่อนเขียน step",
    async (orderStatus) => {
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        productionStep: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            assignedToId: "production-staff-1",
            productionId: "production-1",
            stepType: "HEAT_PRESS",
            status: "PENDING",
          }),
          update: vi.fn(),
        },
      };

      await expect(
        productionRouter
          .createCaller(transactionContext(tx, orderStatus))
          .updateStep({ stepId: "step-1", status: "IN_PROGRESS" }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      expect(tx.productionStep.update).not.toHaveBeenCalled();
      expect(String(tx.$queryRaw.mock.calls[0]?.[0])).toContain("production_steps");
      expect(String(tx.$queryRaw.mock.calls[1]?.[0])).toContain("productions");
      expect(String(tx.$queryRaw.mock.calls[2]?.[0])).toContain("orders");
    },
  );

  it("retry สถานะ IN_PROGRESS เดิมไม่เขียนซ้ำและไม่ทับ startedAt", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      productionStep: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({
            assignedToId: "production-staff-1",
            productionId: "production-1",
            stepType: "HEAT_PRESS",
            status: "IN_PROGRESS",
          })
          .mockResolvedValueOnce({
            id: "step-1",
            productionId: "production-1",
            stepType: "HEAT_PRESS",
            status: "IN_PROGRESS",
            startedAt: new Date("2026-08-16T01:00:00Z"),
          }),
        update: vi.fn(),
      },
      auditLog: { create: vi.fn() },
    };

    await productionRouter
      .createCaller(transactionContext(tx))
      .updateStep({ stepId: "step-1", status: "IN_PROGRESS" });

    expect(tx.productionStep.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("request เก่าห้ามดึง COMPLETED กลับเป็น PENDING", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      productionStep: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          assignedToId: "production-staff-1",
          productionId: "production-1",
          stepType: "HEAT_PRESS",
          status: "COMPLETED",
        }),
        update: vi.fn(),
      },
    };

    await expect(
      productionRouter
        .createCaller(transactionContext(tx))
        .updateStep({ stepId: "step-1", status: "PENDING" }),
    ).rejects.toThrow("ขั้นนี้ถูกปิดเสร็จแล้วโดยอีกจอ");
    expect(tx.productionStep.update).not.toHaveBeenCalled();
  });

  it("ปฏิเสธ qtyDone ที่เกิน qtyTotal แทนการปิดขั้นด้วยจำนวนผิด", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      productionStep: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          assignedToId: "production-staff-1",
          productionId: "production-1",
          stepType: "HEAT_PRESS",
          status: "IN_PROGRESS",
          qtyDone: 3,
          qtyTotal: 10,
        }),
        update: vi.fn(),
      },
    };

    await expect(
      productionRouter
        .createCaller(transactionContext(tx))
        .updateStep({ stepId: "step-1", qtyDone: 11 }),
    ).rejects.toThrow("บันทึกได้ไม่เกิน 10 ตัว");
    expect(tx.productionStep.update).not.toHaveBeenCalled();
  });

  it("ปฏิเสธการอัปเดต PACKAGING เก่าตรง ๆ เพราะแพ็กจริงต้องทำหลัง QC", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      productionStep: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          assignedToId: null,
          productionId: "production-1",
          stepType: "PACKAGING",
          status: "PENDING",
        }),
        update: vi.fn(),
      },
    };

    await expect(
      productionRouter
        .createCaller(transactionContext(tx))
        .updateStep({ stepId: "legacy-pack", status: "COMPLETED" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(tx.productionStep.update).not.toHaveBeenCalled();
  });

  it.each([
    ["GARMENT_PICK", "ขั้นเบิกเสื้อต้องอัปเดตผ่านเมนูเบิก/คืนเสื้อ"],
    ["DTF_PRINT", "ขั้นพิมพ์ DTF ต้องเดินผ่านหน้ารอบพิมพ์ฟิล์ม"],
  ])("ปฏิเสธปิด %s ตรงผ่าน updateStep", async (stepType, message) => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      productionStep: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          assignedToId: "production-staff-1",
          productionId: "production-1",
          stepType,
          status: "PENDING",
        }),
        update: vi.fn(),
      },
    };

    await expect(
      productionRouter
        .createCaller(transactionContext(tx))
        .updateStep({ stepId: "step-1", status: "COMPLETED" }),
    ).rejects.toThrow(message);
    expect(tx.productionStep.update).not.toHaveBeenCalled();
  });

  it("ปฏิเสธเริ่ม HEAT_PRESS เมื่อเสื้อยังไม่พร้อม แม้ยิง API ตรง", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      productionStep: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          assignedToId: "production-staff-1",
          productionId: "production-1",
          stepType: "HEAT_PRESS",
          status: "PENDING",
        }),
        findMany: vi.fn().mockResolvedValue([
          { id: "pick", stepType: "GARMENT_PICK", status: "PENDING", sortOrder: 1 },
          { id: "print", stepType: "DTF_PRINT", status: "COMPLETED", sortOrder: 2 },
          { id: "press", stepType: "HEAT_PRESS", status: "PENDING", sortOrder: 3 },
        ]),
        update: vi.fn(),
      },
    };

    await expect(
      productionRouter
        .createCaller(transactionContext(tx))
        .updateStep({ stepId: "press", status: "IN_PROGRESS" }),
    ).rejects.toThrow("ยังรีดร้อนไม่ได้");
    expect(tx.productionStep.update).not.toHaveBeenCalled();
  });

  it("ปฏิเสธเริ่มข้ามขั้นแรกในเลนเดียวกัน", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      productionStep: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          assignedToId: "production-staff-1",
          productionId: "production-1",
          stepType: "CUSTOM",
          status: "PENDING",
        }),
        findMany: vi.fn().mockResolvedValue([
          { id: "first", stepType: "CUSTOM", status: "PENDING", sortOrder: 1 },
          { id: "second", stepType: "CUSTOM", status: "PENDING", sortOrder: 2 },
        ]),
        update: vi.fn(),
      },
    };

    await expect(
      productionRouter
        .createCaller(transactionContext(tx))
        .updateStep({ stepId: "second", status: "IN_PROGRESS" }),
    ).rejects.toThrow("ทำขั้นก่อนหน้าในสายงานเดียวกันให้เสร็จก่อน");
    expect(tx.productionStep.update).not.toHaveBeenCalled();
  });

  it("ให้ทีมผลิตส่งใบเก่าที่ขั้นจริงครบแล้วเข้า QC ผ่านทางกู้เฉพาะ", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      productionStep: {
        findMany: vi.fn().mockResolvedValue([
          { stepType: "HEAT_PRESS", status: "COMPLETED" },
          { stepType: "PACKAGING", status: "PENDING" },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      production: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({ orderId: "order-1" })
          .mockResolvedValueOnce({
            id: "production-1",
            orderId: "order-1",
            status: "IN_PROGRESS",
            order: { internalStatus: "PRODUCING" },
            steps: [
              { stepType: "HEAT_PRESS", status: "COMPLETED" },
              { stepType: "PACKAGING", status: "PENDING" },
            ],
          }),
        update: vi.fn().mockResolvedValue({ orderId: "order-1" }),
        count: vi.fn().mockResolvedValue(1),
      },
      order: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ internalStatus: "PRODUCING" }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    };

    await expect(
      productionRouter
        .createCaller(transactionContext(tx))
        .finalizeLegacyPackaging({ productionId: "production-1" }),
    ).resolves.toMatchObject({ finalized: true, movedToQc: false });

    expect(tx.productionStep.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ stepType: "PACKAGING" }),
      }),
    );
    expect(String(tx.$queryRaw.mock.calls[0]?.[0])).toContain("productions");
    expect(String(tx.$queryRaw.mock.calls[1]?.[0])).toContain("orders");
    expect(tx.auditLog.create).toHaveBeenCalled();
  });

  it("retry ทางกู้เป็น idempotent และไม่เขียนซ้ำเมื่อใบเก่าถูกปิดไปแล้ว", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      productionStep: { updateMany: vi.fn() },
      production: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({ orderId: "order-1" })
          .mockResolvedValueOnce({
            id: "production-1",
            orderId: "order-1",
            status: "COMPLETED",
            order: { internalStatus: "QUALITY_CHECK" },
            steps: [{ stepType: "PACKAGING", status: "COMPLETED" }],
          }),
        update: vi.fn(),
      },
      order: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ internalStatus: "QUALITY_CHECK" }),
      },
      auditLog: { create: vi.fn() },
    };

    await expect(
      productionRouter
        .createCaller(transactionContext(tx))
        .finalizeLegacyPackaging({ productionId: "production-1" }),
    ).resolves.toMatchObject({
      finalized: true,
      alreadyFinalized: true,
      movedToQc: true,
    });

    expect(tx.productionStep.updateMany).not.toHaveBeenCalled();
    expect(tx.production.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
