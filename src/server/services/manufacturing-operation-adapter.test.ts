import { describe, expect, it, vi } from "vitest";

import {
  loadSpecializedOperation,
  recordSpecializedOperationEvent,
  recordSpecializedOperationOutput,
} from "./manufacturing-operation-adapter";

function operation(options: {
  workCenterCode?: "PREP" | "FINAL_QC" | "OUTSOURCE";
  workCenterActive?: boolean;
  workOrderState?: "DRAFT" | "RELEASED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  orderStatus?: "CONFIRMED" | "PRODUCTION_QUEUE" | "PRODUCING" | "QUALITY_CHECK" | "PACKING" | "ON_HOLD" | "CANCELLED";
  resource?: {
    isActive: boolean;
    state: "AVAILABLE" | "IN_USE" | "DOWN" | "INACTIVE";
  } | null;
} = {}) {
  const workCenterCode = options.workCenterCode ?? "PREP";
  return {
    id: "operation-1",
    productionId: "production-1",
    operationCode: workCenterCode,
    operationState: "READY" as const,
    executionEnabled: true,
    workCenterId: "wc-prep",
    workResourceId: options.resource ? "resource-1" : null,
    assignedToId: null,
    qtyPlanned: 10,
    qtyGood: 2,
    qtyScrap: 0,
    qtyRework: 0,
    revision: 4,
    workCenter: {
      code: workCenterCode,
      isActive: options.workCenterActive ?? true,
    },
    workResource: options.resource ?? null,
    predecessorLinks: [
      { predecessorStep: { operationState: "COMPLETED" as const } },
    ],
    exceptions: [],
    production: {
      orderId: "order-1",
      workOrderState: options.workOrderState ?? "RELEASED",
      order: { internalStatus: options.orderStatus ?? "PRODUCING" },
    },
  };
}

function harness(
  isMember = true,
  options: Parameters<typeof operation>[0] = {},
) {
  const row = operation(options);
  const tx = {
    productionStep: {
      findUnique: vi.fn().mockResolvedValue(row),
      update: vi.fn().mockResolvedValue({
        id: row.id,
        operationState: "RUNNING",
        qtyPlanned: 10,
        qtyGood: 5,
        qtyScrap: 1,
        qtyRework: 0,
        revision: 5,
      }),
    },
    workCenterMember: {
      findUnique: vi.fn().mockResolvedValue(
        isMember ? { isActive: true } : null,
      ),
    },
    production: { update: vi.fn().mockResolvedValue({}) },
    operationQuantity: {
      findMany: vi.fn().mockResolvedValue([{
        id: "quantity-1",
        productionStepId: row.id,
        qtyPlanned: 10,
        qtyGood: 2,
        qtyScrap: 0,
        qtyRework: 0,
      }]),
      update: vi.fn().mockResolvedValue({ id: "quantity-1" }),
    },
    operationEvent: { create: vi.fn().mockResolvedValue({ id: "event-1" }) },
  };
  return { tx, row };
}

describe("specialized manufacturing operation adapter", () => {
  it("บังคับ active Work Center membership สำหรับพนักงาน แต่ supervisor ข้ามได้", async () => {
    const denied = harness(false);
    await expect(
      loadSpecializedOperation(denied.tx as never, {
        operationJobId: "operation-1",
        expectedRevision: 4,
        actorId: "worker-1",
        canSupervise: false,
        requiredWorkCenterCode: "PREP",
        orderId: "order-1",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const supervisor = harness(false);
    await expect(
      loadSpecializedOperation(supervisor.tx as never, {
        operationJobId: "operation-1",
        expectedRevision: 4,
        actorId: "manager-1",
        canSupervise: true,
        requiredWorkCenterCode: "PREP",
      }),
    ).resolves.toMatchObject({ id: "operation-1" });
    expect(supervisor.tx.workCenterMember.findUnique).not.toHaveBeenCalled();
  });

  it("reject ศูนย์งานผิดและ revision เก่า ก่อนเขียนผล", async () => {
    const { tx } = harness();
    await expect(
      loadSpecializedOperation(tx as never, {
        operationJobId: "operation-1",
        expectedRevision: 4,
        actorId: "worker-1",
        canSupervise: false,
        requiredWorkCenterCode: "DTF_PRINT",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      loadSpecializedOperation(tx as never, {
        operationJobId: "operation-1",
        expectedRevision: 3,
        actorId: "worker-1",
        canSupervise: false,
        requiredWorkCenterCode: "PREP",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it.each([
    ["PREP receipt", "PREP", "COMPLETED", "PRODUCING"],
    ["Final QC", "FINAL_QC", "CANCELLED", "QUALITY_CHECK"],
    ["Outsource", "OUTSOURCE", "DRAFT", "PRODUCING"],
    ["PREP receipt", "PREP", "IN_PROGRESS", "ON_HOLD"],
    ["Final QC", "FINAL_QC", "IN_PROGRESS", "CANCELLED"],
    ["Outsource", "OUTSOURCE", "RELEASED", "CONFIRMED"],
  ] as const)(
    "%s ปฏิเสธใบงานหรือออเดอร์ที่ไม่ active ก่อนบันทึกผล",
    async (_path, workCenterCode, workOrderState, orderStatus) => {
      const { tx } = harness(true, {
        workCenterCode,
        workOrderState,
        orderStatus,
      });

      await expect(
        loadSpecializedOperation(tx as never, {
          operationJobId: "operation-1",
          expectedRevision: 4,
          actorId: "worker-1",
          canSupervise: false,
          requiredWorkCenterCode: workCenterCode,
        }),
      ).rejects.toThrow("ถูกพัก ยกเลิก หรือปิดแล้ว");

      expect(tx.workCenterMember.findUnique).not.toHaveBeenCalled();
      expect(tx.productionStep.update).not.toHaveBeenCalled();
      expect(tx.operationQuantity.update).not.toHaveBeenCalled();
      expect(tx.operationEvent.create).not.toHaveBeenCalled();
    },
  );

  it.each(["PREP", "FINAL_QC", "OUTSOURCE"] as const)(
    "%s ยังรับคำสั่งเมื่อใบงาน ออเดอร์ และจุดทำงาน active",
    async (workCenterCode) => {
      const { tx } = harness(true, {
        workCenterCode,
        workOrderState: "IN_PROGRESS",
        orderStatus:
          workCenterCode === "FINAL_QC" ? "QUALITY_CHECK" : "PRODUCING",
      });

      await expect(
        loadSpecializedOperation(tx as never, {
          operationJobId: "operation-1",
          expectedRevision: 4,
          actorId: "worker-1",
          canSupervise: false,
          requiredWorkCenterCode: workCenterCode,
        }),
      ).resolves.toMatchObject({ id: "operation-1" });
    },
  );

  it("ปฏิเสธจุดทำงานที่ปิดก่อนบันทึกผล", async () => {
    const { tx } = harness(true, { workCenterActive: false });
    await expect(
      loadSpecializedOperation(tx as never, {
        operationJobId: "operation-1",
        expectedRevision: 4,
        actorId: "worker-1",
        canSupervise: false,
        requiredWorkCenterCode: "PREP",
      }),
    ).rejects.toThrow("จุดทำงานนี้ปิดใช้งานอยู่");
    expect(tx.productionStep.update).not.toHaveBeenCalled();
  });

  it.each([
    [{ isActive: true, state: "DOWN" as const }],
    [{ isActive: true, state: "INACTIVE" as const }],
    [{ isActive: false, state: "AVAILABLE" as const }],
  ])("ปฏิเสธเครื่องหรืออุปกรณ์ที่ไม่พร้อมใช้งาน", async (resource) => {
    const { tx } = harness(true, { resource });
    await expect(
      loadSpecializedOperation(tx as never, {
        operationJobId: "operation-1",
        expectedRevision: 4,
        actorId: "worker-1",
        canSupervise: false,
        requiredWorkCenterCode: "PREP",
      }),
    ).rejects.toThrow("เครื่องหรืออุปกรณ์ที่เลือกไม่พร้อมใช้งาน");
    expect(tx.productionStep.update).not.toHaveBeenCalled();
  });

  it("คำสั่งเก็บกวาดที่ระบุชัดยังคืนงานได้หลังพักหรือปิดจุดทำงาน", async () => {
    const { tx } = harness(true, {
      workCenterActive: false,
      workOrderState: "CANCELLED",
      orderStatus: "CANCELLED",
      resource: { isActive: true, state: "DOWN" },
    });
    const loaded = await loadSpecializedOperation(tx as never, {
      operationJobId: "operation-1",
      expectedRevision: 4,
      actorId: "worker-1",
      canSupervise: false,
      requiredWorkCenterCode: "PREP",
      allowInactiveExecutionScope: true,
    });

    await recordSpecializedOperationEvent(tx as never, {
      operation: loaded,
      commandId: "cleanup-return-1",
      actorId: "worker-1",
      eventType: "MATERIAL_RETURNED",
    });

    expect(tx.operationEvent.create).toHaveBeenCalledOnce();
  });

  it("เพิ่ม qty, revision, event และเริ่ม Work Order ใน transaction เดียวกัน", async () => {
    const { tx, row } = harness();
    await recordSpecializedOperationOutput(tx as never, {
      operation: row,
      commandId: "receipt-command-1",
      actorId: "worker-1",
      eventType: "RECEIPT_RECORDED",
      delta: { qtyGood: 3, qtyScrap: 1, qtyRework: 0 },
      quantityLines: [{
        quantityLineId: "quantity-1",
        qtyGood: 3,
        qtyScrap: 1,
        qtyRework: 0,
      }],
      payload: { receiptId: "receipt-1" },
    });

    expect(tx.productionStep.update).toHaveBeenCalledWith({
      where: { id: "operation-1" },
      data: expect.objectContaining({
        operationState: "RUNNING",
        qtyGood: { increment: 3 },
        qtyScrap: { increment: 1 },
        revision: { increment: 1 },
      }),
      select: expect.any(Object),
    });
    expect(tx.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        commandId: "receipt-command-1",
        eventType: "RECEIPT_RECORDED",
        qtyGoodDelta: 3,
      }),
    });
    expect(tx.operationQuantity.update).toHaveBeenCalledOnce();
    expect(tx.production.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workOrderState: "IN_PROGRESS" }),
      }),
    );
  });

  it("event-only เพิ่ม revision และ event โดยไม่ปลอม quantity", async () => {
    const { tx, row } = harness();
    await recordSpecializedOperationEvent(tx as never, {
      operation: row,
      commandId: "dtf-start-command-1",
      actorId: "worker-1",
      eventType: "STARTED",
      payload: { printRunId: "run-1" },
    });

    expect(tx.productionStep.update).toHaveBeenCalledWith({
      where: { id: "operation-1" },
      data: expect.objectContaining({
        qtyGood: { increment: 0 },
        qtyScrap: { increment: 0 },
        qtyRework: { increment: 0 },
        revision: { increment: 1 },
      }),
      select: expect.any(Object),
    });
    expect(tx.operationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        commandId: "dtf-start-command-1",
        qtyGoodDelta: 0,
        qtyScrapDelta: 0,
        qtyReworkDelta: 0,
      }),
    });
  });

  it("output API ยัง reject zero-delta", async () => {
    const { tx, row } = harness();
    await expect(
      recordSpecializedOperationOutput(tx as never, {
        operation: row,
        commandId: "bad-output-command-1",
        actorId: "worker-1",
        eventType: "OUTPUT_REPORTED",
        delta: { qtyGood: 0, qtyScrap: 0, qtyRework: 0 },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(tx.productionStep.update).not.toHaveBeenCalled();
  });
});
