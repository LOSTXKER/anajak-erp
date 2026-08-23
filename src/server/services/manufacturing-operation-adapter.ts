import type {
  InternalStatus,
  OperationEventType,
  OperationState,
  Prisma,
  WorkOrderState,
} from "@prisma/client";

import type { PrismaTx } from "@/lib/prisma";
import { badRequest, forbidden } from "@/server/errors";
import {
  assertExpectedRevision,
  assertOutputDelta,
  manufacturingParentCanAdvance,
  operationPredecessorsComplete,
  type OutputDelta,
} from "@/server/services/manufacturing-command-policy";

type SpecializedExecutionScope = {
  workCenter: { isActive: boolean } | null;
  workResource: {
    isActive: boolean;
    state: "AVAILABLE" | "IN_USE" | "DOWN" | "INACTIVE";
  } | null;
  production: {
    workOrderState: WorkOrderState;
    order: { internalStatus: InternalStatus };
  };
};

/**
 * เหตุผลกลางที่คำสั่งเดินงานต้องหยุด ใช้ร่วมกับ read contract เพื่อไม่ให้หน้า
 * งานเสนอปุ่มที่คำสั่งจริงจะปฏิเสธ ส่วนคำสั่งเก็บกวาดเลือกข้ามด่านนี้ได้ชัดเจน.
 */
export function specializedExecutionScopeBlockedReason(
  operation: SpecializedExecutionScope,
): string | null {
  if (!manufacturingParentCanAdvance({
    workOrderState: operation.production.workOrderState,
    orderStatus: operation.production.order.internalStatus,
  })) {
    return "งานนี้ถูกพัก ยกเลิก หรือปิดแล้ว จึงทำต่อไม่ได้ กรุณากลับไปดูคิวงาน";
  }
  if (operation.workCenter?.isActive === false) {
    return "จุดทำงานนี้ปิดใช้งานอยู่ จึงทำงานต่อไม่ได้";
  }
  if (
    operation.workResource &&
    (!operation.workResource.isActive ||
      ["DOWN", "INACTIVE"].includes(operation.workResource.state))
  ) {
    return "เครื่องหรืออุปกรณ์ที่เลือกไม่พร้อมใช้งาน";
  }
  return null;
}

export type SpecializedOperation = {
  id: string;
  productionId: string;
  operationCode: string | null;
  operationState: OperationState;
  executionEnabled: boolean;
  workCenterId: string | null;
  workResourceId: string | null;
  assignedToId: string | null;
  qtyPlanned: number;
  qtyGood: number;
  qtyScrap: number;
  qtyRework: number;
  revision: number;
  workCenter: { code: string; isActive: boolean } | null;
  workResource: {
    isActive: boolean;
    state: "AVAILABLE" | "IN_USE" | "DOWN" | "INACTIVE";
  } | null;
  predecessorLinks: Array<{
    predecessorStep: { operationState: OperationState };
  }>;
  exceptions: Array<{ id: string }>;
  production: {
    orderId: string;
    workOrderState: WorkOrderState;
    order: { internalStatus: InternalStatus };
  };
};

export type SpecializedQuantityOutput = OutputDelta & {
  quantityLineId: string;
};

export async function loadSpecializedOperation(
  tx: PrismaTx,
  input: {
    operationJobId: string;
    expectedRevision: number;
    actorId: string;
    canSupervise: boolean;
    requiredWorkCenterCode: string;
    orderId?: string;
    productionId?: string;
    allowedStates?: readonly OperationState[];
    // ใช้เฉพาะคำสั่งเก็บกวาดที่ต้องทำได้หลังพัก/ยกเลิก เช่น คืนเสื้อหรือยกเลิกใบงานร่าง.
    allowInactiveExecutionScope?: boolean;
  },
): Promise<SpecializedOperation> {
  const operation = await tx.productionStep.findUnique({
    where: { id: input.operationJobId },
    select: {
      id: true,
      productionId: true,
      operationCode: true,
      operationState: true,
      executionEnabled: true,
      workCenterId: true,
      workResourceId: true,
      assignedToId: true,
      qtyPlanned: true,
      qtyGood: true,
      qtyScrap: true,
      qtyRework: true,
      revision: true,
      workCenter: { select: { code: true, isActive: true } },
      workResource: { select: { isActive: true, state: true } },
      predecessorLinks: {
        select: {
          predecessorStep: { select: { operationState: true } },
        },
      },
      exceptions: {
        where: {
          state: { in: ["OPEN", "ACKNOWLEDGED"] },
          blocksJob: true,
        },
        select: { id: true },
      },
      production: {
        select: {
          orderId: true,
          workOrderState: true,
          order: { select: { internalStatus: true } },
        },
      },
    },
  });
  if (!operation) badRequest("ไม่พบ Operation Job ที่ระบุ");
  if (!operation.executionEnabled) {
    badRequest("ขั้นเดิมนี้ยังไม่ถูกเปิดใช้ใน Production V2");
  }
  if (input.orderId && operation.production.orderId !== input.orderId) {
    badRequest("Operation Job ไม่ได้อยู่ในออเดอร์นี้");
  }
  if (input.productionId && operation.productionId !== input.productionId) {
    badRequest("Operation Job ไม่ได้อยู่ในใบสั่งผลิตนี้");
  }
  if (operation.workCenter?.code !== input.requiredWorkCenterCode) {
    badRequest(`คำสั่งนี้ใช้ได้เฉพาะ Work Center ${input.requiredWorkCenterCode}`);
  }
  if (!input.allowInactiveExecutionScope) {
    const blockedReason = specializedExecutionScopeBlockedReason(operation);
    if (blockedReason) badRequest(blockedReason);
  }
  if (!input.canSupervise) {
    const membership = operation.workCenterId
      ? await tx.workCenterMember.findUnique({
          where: {
            workCenterId_userId: {
              workCenterId: operation.workCenterId,
              userId: input.actorId,
            },
          },
          select: { isActive: true },
        })
      : null;
    if (!membership?.isActive) {
      forbidden("บัญชีนี้ไม่ได้เป็นสมาชิกของ Work Center นี้");
    }
  }
  assertExpectedRevision(operation.revision, input.expectedRevision);
  if (
    operation.assignedToId &&
    operation.assignedToId !== input.actorId &&
    !input.canSupervise
  ) {
    forbidden("Operation Job นี้มีผู้รับผิดชอบคนอื่นอยู่");
  }
  if (operation.exceptions.length > 0) {
    badRequest("Operation Job ยังมีปัญหาที่บล็อกอยู่");
  }
  if (
    !operationPredecessorsComplete(
      operation.predecessorLinks.map(
        (dependency) => dependency.predecessorStep.operationState,
      ),
    )
  ) {
    badRequest("Operation Job ยังไม่พร้อม — งานก่อนหน้ายังไม่เสร็จ");
  }
  const allowedStates = input.allowedStates ?? (["READY", "RUNNING"] as const);
  if (!allowedStates.includes(operation.operationState)) {
    badRequest("Operation Job ไม่อยู่ในสถานะที่รับคำสั่งนี้ได้");
  }
  return operation;
}

type SpecializedOperationEventInput = {
  operation: SpecializedOperation;
  commandId: string;
  sequence?: number;
  actorId: string;
  eventType: OperationEventType;
  nextState?: OperationState;
  payload?: Prisma.InputJsonValue;
};

async function recordSpecializedQuantityLines(
  tx: PrismaTx,
  operation: SpecializedOperation,
  delta: OutputDelta,
  quantityLines: SpecializedQuantityOutput[] | undefined,
) {
  const currentLines = await tx.operationQuantity.findMany({
    where: { productionStepId: operation.id },
    select: {
      id: true,
      productionStepId: true,
      qtyPlanned: true,
      qtyGood: true,
      qtyScrap: true,
      qtyRework: true,
    },
  });
  if (currentLines.length === 0) {
    if (quantityLines?.length) {
      badRequest("Operation Job นี้ไม่มี quantity line สำหรับหลักฐานที่ส่งมา");
    }
    return;
  }
  if (!quantityLines?.length) {
    badRequest("ต้องผูกผลผลิตกับ quantity line ตามสินค้า สี ไซซ์ และจุดพิมพ์");
  }
  if (new Set(quantityLines.map((line) => line.quantityLineId)).size !== quantityLines.length) {
    badRequest("quantity line ซ้ำกันในผลผลิตชุดเดียวกัน");
  }
  const sums = quantityLines.reduce<OutputDelta>(
    (total, line) => ({
      qtyGood: total.qtyGood + line.qtyGood,
      qtyScrap: total.qtyScrap + line.qtyScrap,
      qtyRework: total.qtyRework + line.qtyRework,
    }),
    { qtyGood: 0, qtyScrap: 0, qtyRework: 0 },
  );
  if (
    sums.qtyGood !== delta.qtyGood ||
    sums.qtyScrap !== delta.qtyScrap ||
    sums.qtyRework !== delta.qtyRework
  ) {
    badRequest("ผลรวม quantity line ไม่ตรงกับยอดรวมของ Operation Job");
  }
  const currentById = new Map(currentLines.map((line) => [line.id, line]));
  for (const lineDelta of quantityLines) {
    const current = currentById.get(lineDelta.quantityLineId);
    if (!current || current.productionStepId !== operation.id) {
      badRequest("quantity line ไม่ได้อยู่ใน Operation Job นี้");
    }
    assertOutputDelta(current, lineDelta);
    await tx.operationQuantity.update({
      where: { id: current.id },
      data: {
        qtyGood: { increment: lineDelta.qtyGood },
        qtyScrap: { increment: lineDelta.qtyScrap },
        qtyRework: { increment: lineDelta.qtyRework },
        revision: { increment: 1 },
      },
    });
  }
}

async function recordSpecializedOperationChange(
  tx: PrismaTx,
  input: SpecializedOperationEventInput & { delta: OutputDelta },
) {
  const delta = input.delta;
  const fromState = input.operation.operationState;
  const toState =
    input.nextState ?? (fromState === "READY" ? "RUNNING" : fromState);
  const now = new Date();
  const updated = await tx.productionStep.update({
    where: { id: input.operation.id },
    data: {
      operationState: toState,
      status: toState === "BLOCKED" ? "ON_HOLD" : "IN_PROGRESS",
      qtyGood: { increment: delta.qtyGood },
      qtyScrap: { increment: delta.qtyScrap },
      qtyRework: { increment: delta.qtyRework },
      qtyDone: { increment: delta.qtyGood },
      revision: { increment: 1 },
      ...(fromState === "READY" ? { startedAt: now } : {}),
      ...(input.operation.assignedToId === null
        ? { assignedToId: input.actorId }
        : {}),
    },
    select: {
      id: true,
      operationState: true,
      qtyPlanned: true,
      qtyGood: true,
      qtyScrap: true,
      qtyRework: true,
      revision: true,
    },
  });
  if (input.operation.production.workOrderState === "RELEASED") {
    await tx.production.update({
      where: { id: input.operation.productionId },
      data: {
        workOrderState: "IN_PROGRESS",
        status: "IN_PROGRESS",
        startDate: now,
        revision: { increment: 1 },
      },
    });
  }
  await tx.operationEvent.create({
    data: {
      productionId: input.operation.productionId,
      productionStepId: input.operation.id,
      eventType: input.eventType,
      commandId: input.commandId,
      sequence: input.sequence ?? 0,
      actorId: input.actorId,
      fromState,
      toState,
      qtyGoodDelta: delta.qtyGood,
      qtyScrapDelta: delta.qtyScrap,
      qtyReworkDelta: delta.qtyRework,
      ...(input.payload ? { payload: input.payload } : {}),
    },
  });
  return updated;
}

/** บันทึกผลผลิตจริงเท่านั้น จึงไม่ยอมรับ zero-delta. */
export async function recordSpecializedOperationOutput(
  tx: PrismaTx,
  input: SpecializedOperationEventInput & {
    delta: OutputDelta;
    quantityLines?: SpecializedQuantityOutput[];
  },
) {
  assertOutputDelta(input.operation, input.delta);
  await recordSpecializedQuantityLines(
    tx,
    input.operation,
    input.delta,
    input.quantityLines,
  );
  return recordSpecializedOperationChange(tx, input);
}

/**
 * บันทึกเหตุการณ์ปฏิบัติการที่ไม่มีผลต่อจำนวน เช่น เริ่ม DTF batch หรือคืนวัสดุ.
 * แยก API จาก output เพื่อไม่ให้ caller ข้าม quantity invariant โดยส่งศูนย์ทุกช่อง.
 */
export async function recordSpecializedOperationEvent(
  tx: PrismaTx,
  input: SpecializedOperationEventInput,
) {
  return recordSpecializedOperationChange(tx, {
    ...input,
    delta: { qtyGood: 0, qtyScrap: 0, qtyRework: 0 },
  });
}
