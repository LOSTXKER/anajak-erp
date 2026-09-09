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

  it("คืนเศษเสื้อเป็น recovery ของหัวหน้าและ staff ยิง API ตรงไม่ได้", async () => {
    const ctx: Context = {
      prisma: {} as Context["prisma"],
      userId: "production-staff-1",
      userRole: "PRODUCTION_STAFF",
      permissionOverrides: null,
    };

    await expect(
      productionRouter.createCaller(ctx).returnGarments({
        productionId: "production-1",
        idempotencyKey: "return-staff-bypass",
        lines: [{ sku: "TS-M", qty: 1 }],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
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
        assignedToId: null,
        productionId: "production-1",
        stepType: "HEAT_PRESS",
        status: "PENDING",
        qtyDone: 0,
        qtyTotal: 10,
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
          { id: "step-1", stepType: "HEAT_PRESS", status: "PENDING", sortOrder: 1 },
        ]),
      },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    };

    const result = await productionRouter
      .createCaller(transactionContext(tx))
      .updateStep({ stepId: "step-1", notes: "เริ่มตรวจงาน" });

    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(
      tx.productionStep.findUniqueOrThrow.mock.invocationCallOrder[1],
    );
    expect(String(tx.$queryRaw.mock.calls[0]?.[0])).toContain("pg_advisory_xact_lock");
    expect(String(tx.$queryRaw.mock.calls[1]?.[0])).toContain("production_steps");
    expect(String(tx.$queryRaw.mock.calls[1]?.[0])).toContain("ORDER BY id");
    expect(String(tx.$queryRaw.mock.calls[2]?.[0])).toContain("productions");
    expect(String(tx.$queryRaw.mock.calls[3]?.[0])).toContain("orders");
    expect(tx.productionStep.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignedToId: "production-staff-1" }) }),
    );
    expect(JSON.stringify(findUniqueOrThrow.mock.calls.at(-1)?.[0]?.select)).not.toMatch(
      /amount|price|cost/i,
    );
    expect(JSON.stringify(result)).not.toMatch(/amount|price|cost/i);
  });

  it("notes/QC-only ยิงขั้นอนาคตไม่ได้และไม่ auto-claim", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      productionStep: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "step-future",
          assignedToId: null,
          productionId: "production-1",
          stepType: "HEAT_PRESS",
          status: "PENDING",
          sortOrder: 2,
          qtyDone: 0,
          qtyTotal: 10,
        }),
        findMany: vi.fn().mockResolvedValue([
          { id: "step-current", stepType: "DTF_PRINT", status: "PENDING", sortOrder: 1 },
          { id: "step-future", stepType: "HEAT_PRESS", status: "PENDING", sortOrder: 2 },
        ]),
        update: vi.fn(),
      },
    };

    await expect(
      productionRouter
        .createCaller(transactionContext(tx))
        .updateStep({ stepId: "step-future", notes: "ขอจองงานนี้ไว้" }),
    ).rejects.toThrow("ทำขั้นก่อนหน้า");

    expect(tx.productionStep.update).not.toHaveBeenCalled();
  });

  it("สถานะเดิมบนขั้น unassigned เป็น no-op ไม่กลายเป็นการ claim", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      productionStep: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "step-1",
          assignedToId: null,
          productionId: "production-1",
          stepType: "HEAT_PRESS",
          status: "PENDING",
          qtyDone: 0,
          qtyTotal: 10,
        }),
        findMany: vi.fn(),
        update: vi.fn(),
      },
    };

    await expect(
      productionRouter
        .createCaller(transactionContext(tx))
        .updateStep({ stepId: "step-1", status: "PENDING" }),
    ).resolves.toMatchObject({ status: "PENDING", assignedToId: null });

    expect(tx.productionStep.findMany).not.toHaveBeenCalled();
    expect(tx.productionStep.update).not.toHaveBeenCalled();
  });

  it("retry qty/notes/QC ค่าเดิมเป็น no-op ไม่ claim หรือสร้าง audit ซ้ำ", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      productionStep: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "step-1",
          assignedToId: null,
          productionId: "production-1",
          stepType: "HEAT_PRESS",
          status: "PENDING",
          qtyDone: 2,
          qtyTotal: 10,
          qcPassed: false,
          qcNotes: "รอตรวจซ้ำ",
          notes: "ตั้งแรงกด 6 bar",
        }),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      auditLog: { create: vi.fn() },
    };

    await expect(
      productionRouter.createCaller(transactionContext(tx)).updateStep({
        stepId: "step-1",
        qtyDone: 2,
        qtyTotal: 10,
        qcPassed: false,
        qcNotes: "รอตรวจซ้ำ",
        notes: "ตั้งแรงกด 6 bar",
      }),
    ).resolves.toMatchObject({ assignedToId: null, qtyDone: 2 });

    expect(tx.productionStep.findMany).not.toHaveBeenCalled();
    expect(tx.productionStep.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
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
      expect(String(tx.$queryRaw.mock.calls[0]?.[0])).toContain("pg_advisory_xact_lock");
      expect(String(tx.$queryRaw.mock.calls[1]?.[0])).toContain("production_steps");
      expect(String(tx.$queryRaw.mock.calls[2]?.[0])).toContain("productions");
      expect(String(tx.$queryRaw.mock.calls[3]?.[0])).toContain("orders");
    },
  );

  it("schema ปฏิเสธการสร้าง FAILED ผ่าน generic update ก่อนเปิด transaction", async () => {
    const tx = { $queryRaw: vi.fn() };
    const ctx = transactionContext(tx);

    await expect(
      productionRouter.createCaller(ctx).updateStep({
        stepId: "step-1",
        status: "FAILED",
      } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("generic update ออกจาก FAILED ไม่ได้ ต้องผ่าน resolveStationProblem", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      productionStep: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "step-1",
          assignedToId: "production-staff-1",
          productionId: "production-1",
          stepType: "HEAT_PRESS",
          status: "FAILED",
          qtyDone: 2,
          qtyTotal: 10,
        }),
        update: vi.fn(),
      },
    };

    await expect(
      productionRouter
        .createCaller(transactionContext(tx))
        .updateStep({ stepId: "step-1", status: "PENDING" }),
    ).rejects.toThrow("ต้องแก้ผ่านคำสั่งแก้ปัญหา");

    expect(tx.productionStep.update).not.toHaveBeenCalled();
  });

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
            assignedToId: "production-staff-1",
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
    ["GARMENT_RECEIVE", "ขั้นรับเสื้อลูกค้าต้องอัปเดตผ่านใบตรวจรับ"],
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

  it.each(["GARMENT_PICK", "GARMENT_RECEIVE", "DTF_PRINT"])(
    "ปฏิเสธ notes/QC-only บน service-managed %s เพื่อไม่ forge หลักฐานหรือ claim งาน",
    async (stepType) => {
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        productionStep: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: "step-1",
            assignedToId: null,
            productionId: "production-1",
            stepType,
            status: "PENDING",
            qtyDone: 0,
            qtyTotal: 1,
          }),
          findMany: vi.fn(),
          update: vi.fn(),
        },
      };

      await expect(
        productionRouter
          .createCaller(transactionContext(tx))
          .updateStep({ stepId: "step-1", notes: "บันทึกผ่าน API ทั่วไป" }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      expect(tx.productionStep.findMany).not.toHaveBeenCalled();
      expect(tx.productionStep.update).not.toHaveBeenCalled();
    },
  );

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
    expect(String(tx.$queryRaw.mock.calls[0]?.[0])).toContain("pg_advisory_xact_lock");
    expect(String(tx.$queryRaw.mock.calls[1]?.[0])).toContain("production_steps");
    expect(String(tx.$queryRaw.mock.calls[1]?.[0])).toContain("ORDER BY id");
    expect(String(tx.$queryRaw.mock.calls[2]?.[0])).toContain("productions");
    expect(String(tx.$queryRaw.mock.calls[3]?.[0])).toContain("orders");
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
  // ---- ใบผลิตแบบฟอร์ม (ROADMAP §A9.2–A9.4) ----
  function formStepTx(step: Record<string, unknown>, extra: Record<string, unknown> = {}) {
    return {
      $queryRaw: vi.fn().mockResolvedValue([]),
      productionStep: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "press",
          assignedToId: "production-staff-1",
          productionId: "production-1",
          stepType: "HEAT_PRESS",
          status: "IN_PROGRESS",
          sortOrder: 3,
          qtyDone: 0,
          qtyTotal: 10,
          startedAt: new Date("2026-09-09T01:00:00.000Z"),
          completedAt: null,
          ...step,
        }),
        findMany: vi.fn().mockResolvedValue([
          { id: "pick", stepType: "GARMENT_PICK", status: "COMPLETED", sortOrder: 1 },
          { id: "print", stepType: "DTF_PRINT", status: "COMPLETED", sortOrder: 2 },
          { id: "press", stepType: "HEAT_PRESS", status: "IN_PROGRESS", sortOrder: 3 },
          { id: "fold", stepType: "CUSTOM", status: "PENDING", sortOrder: 4 },
        ]),
        update: vi.fn().mockResolvedValue({ id: "press", status: "IN_PROGRESS" }),
      },
      printRunItem: { findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0) },
      outsourceOrder: { findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0) },
      goodsReceipt: { count: vi.fn().mockResolvedValue(0) },
      productionStepCheck: {
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
      ...extra,
    };
  }
  function managerContext(tx: Record<string, unknown>): Context {
    return { ...transactionContext(tx), userId: "manager-1", userRole: "MANAGER" };
  }

  it("ปิดขั้นผ่าน updateStep ไม่ได้ถ้ายังติ๊กข้อกำหนดไม่ครบ (ด่านอยู่ที่ server)", async () => {
    const tx = formStepTx({});
    await expect(
      productionRouter
        .createCaller(transactionContext(tx))
        .updateStep({ stepId: "press", status: "COMPLETED" }),
    ).rejects.toThrow("ติ๊กข้อกำหนดให้ครบก่อนปิดขั้น — เหลืออีก 3 ข้อ");
    expect(tx.productionStep.update).not.toHaveBeenCalled();
  });

  it.each(["update", "piece"])("แก้ยอดรับเสื้อจนขาดบล็อกรีดที่กำลังทำอยู่ผ่าน %s", async (command) => {
    const tx = formStepTx({ qtyDone: 1 });
    tx.productionStep.findMany.mockResolvedValue([
      { id: "receive", stepType: "GARMENT_RECEIVE", status: "IN_PROGRESS", sortOrder: 1 },
      { id: "print", stepType: "DTF_PRINT", status: "COMPLETED", sortOrder: 2 },
      { id: "press", stepType: "HEAT_PRESS", status: "IN_PROGRESS", sortOrder: 3 },
    ]);
    const caller = productionRouter.createCaller(transactionContext(tx));
    await expect(command === "update"
      ? caller.updateStep({ stepId: "press", qtyDone: 2 })
      : caller.reportPieceQty({ stepId: "press", rows: [{ variantId: "size-m", done: 2, waste: 0 }] }),
    ).rejects.toThrow("รอเสื้อ");
    expect(tx.productionStep.update).not.toHaveBeenCalled();
  });

  it("ติ๊กข้อกำหนด: ช่างแตะขั้นของคนอื่นไม่ได้ · ข้อที่ไม่อยู่ในรายการถูกปฏิเสธ · ติ๊กแล้วจำชื่อคนแรก", async () => {
    const item = "ตั้งอุณหภูมิ/เวลา/แรงกดตามค่าของลายในใบงาน";
    const other = formStepTx({ assignedToId: "other-staff" });
    await expect(
      productionRouter
        .createCaller(transactionContext(other))
        .tickStandard({ stepId: "press", item, checked: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const own = formStepTx({});
    await expect(
      productionRouter
        .createCaller(transactionContext(own))
        .tickStandard({ stepId: "press", item: "ข้อที่ไม่มี", checked: true }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await productionRouter
      .createCaller(transactionContext(own))
      .tickStandard({ stepId: "press", item, checked: true });
    expect(own.productionStepCheck.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ itemKey: item, checkedById: "production-staff-1" }),
        update: {},
      }),
    );
    expect(own.auditLog.create).toHaveBeenCalled();
  });

  it("ติ๊กข้อกำหนดบนขั้นที่ปิดแล้วไม่ได้", async () => {
    const tx = formStepTx({ status: "COMPLETED" });
    await expect(
      productionRouter
        .createCaller(transactionContext(tx))
        .tickStandard({ stepId: "press", item: "ตั้งอุณหภูมิ/เวลา/แรงกดตามค่าของลายในใบงาน", checked: false }),
    ).rejects.toThrow("ขั้นนี้ปิดแล้ว");
    expect(tx.productionStepCheck.deleteMany).not.toHaveBeenCalled();
  });

  it("ย้อนขั้น: ช่างยิงตรงไม่ได้ (หัวหน้าเท่านั้น)", async () => {
    const tx = formStepTx({ status: "COMPLETED" });
    await expect(
      productionRouter.createCaller(transactionContext(tx)).reopenStep({ stepId: "press" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(tx.productionStep.update).not.toHaveBeenCalled();
  });

  it("ย้อนขั้น: หัวหน้าเปิดขั้นที่ปิดแล้วกลับเป็นกำลังทำ + จด audit พร้อมเหตุผล", async () => {
    const tx = formStepTx({ status: "COMPLETED", completedAt: new Date("2026-09-09T02:00:00.000Z") });
    await productionRouter
      .createCaller(managerContext(tx))
      .reopenStep({ stepId: "press", reason: "รีดสลับไซซ์" });
    expect(tx.productionStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "press" },
        data: expect.objectContaining({ status: "IN_PROGRESS", completedAt: null }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entityType: "PRODUCTION_STEP", reason: "รีดสลับไซซ์" }),
      }),
    );
  });

  it("ย้อนขั้นไม่ได้เมื่อขั้นถัดไปเริ่มแล้ว หรือขั้นมีใบส่งร้านผูก", async () => {
    const started = formStepTx({ status: "COMPLETED" });
    started.productionStep.findMany.mockResolvedValue([
      { id: "press", stepType: "HEAT_PRESS", status: "COMPLETED", sortOrder: 3 },
      { id: "tag", stepType: "TAGGING", status: "IN_PROGRESS", sortOrder: 4 },
    ]);
    await expect(
      productionRouter.createCaller(managerContext(started)).reopenStep({ stepId: "press" }),
    ).rejects.toThrow("ขั้นถัดไปเริ่มทำแล้ว");

    const outsourced = formStepTx({ status: "COMPLETED", stepType: "EMBROIDERY" });
    outsourced.outsourceOrder.count.mockResolvedValue(1);
    await expect(
      productionRouter.createCaller(managerContext(outsourced)).reopenStep({ stepId: "press" }),
    ).rejects.toThrow("ใบส่งร้าน");
    expect(outsourced.productionStep.update).not.toHaveBeenCalled();
  });

  it("ยอดต่อแถว: รวมเป็นยอดของขั้น + สร้างแถว OperationQuantity ชนิด VARIANT · เกินยอดถูกปฏิเสธ", async () => {
    const variants = {
      findMany: vi.fn().mockResolvedValue([
        { id: "v1", size: "S", color: "กรมท่า", quantity: 4, orderItemProduct: { id: "p1", description: "โปโล", product: null } },
        { id: "v2", size: "M", color: "กรมท่า", quantity: 6, orderItemProduct: { id: "p1", description: "โปโล", product: null } },
      ]),
    };
    const quantities = { upsert: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 0 }) };
    const tx = formStepTx({}, { orderItemVariant: variants, operationQuantity: quantities });
    tx.productionStep.update.mockResolvedValue({ status: "IN_PROGRESS", qtyDone: 7, qtyTotal: 10, startedAt: new Date() });
    await productionRouter
      .createCaller(transactionContext(tx))
      .reportPieceQty({ stepId: "press", rows: [{ variantId: "v1", done: 4, waste: 0 }, { variantId: "v2", done: 3, waste: 1 }] });
    expect(quantities.upsert).toHaveBeenCalledTimes(2);
    expect(quantities.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ scopeKind: "VARIANT", sourceOrderItemVariantId: "v2", qtyGood: 3, qtyScrap: 1 }),
      }),
    );
    expect(tx.productionStep.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ qtyDone: 7 }) }),
    );

    const overQuantities = { upsert: vi.fn(), updateMany: vi.fn() };
    const over = formStepTx({}, { orderItemVariant: variants, operationQuantity: overQuantities });
    await expect(
      productionRouter
        .createCaller(transactionContext(over))
        .reportPieceQty({ stepId: "press", rows: [{ variantId: "v1", done: 5, waste: 0 }] }),
    ).rejects.toThrow("เกิน 4 ตัว");
    expect(overQuantities.upsert).not.toHaveBeenCalled();
  });

  it("ยอดต่อแถว: ขั้นที่นับผ่าน flow ของตัวเอง (เบิก/ตรวจรับ/รอบพิมพ์) ถูกปฏิเสธ", async () => {
    const tx = formStepTx({ stepType: "DTF_PRINT" });
    await expect(
      productionRouter
        .createCaller(transactionContext(tx))
        .reportPieceQty({ stepId: "press", rows: [{ variantId: "v1", done: 1, waste: 0 }] }),
    ).rejects.toThrow("นับยอดผ่านเมนูของตัวเอง");
  });
});
