import type { OutsourceStatus } from "@prisma/client";

import type { ExtendedPrismaClient, PrismaTx } from "@/lib/prisma";
import { badRequest, conflict, notFound } from "@/server/errors";
import { createAuditLog } from "@/server/helpers";
import { executeManufacturingCommand } from "@/server/services/manufacturing-commands";
import {
  loadSpecializedOperation,
  recordSpecializedOperationEvent,
  recordSpecializedOperationOutput,
  type SpecializedOperation,
  type SpecializedQuantityOutput,
} from "@/server/services/manufacturing-operation-adapter";
import { moneyInput, round2 } from "@/server/services/money";
import { lockOrderRow } from "@/server/services/order-cost";
import { lockProductionTopology } from "@/server/services/production-topology-lock";
import {
  ManufacturingDomainError,
  resolveReworkOutput,
} from "@/server/services/manufacturing-domain";

type OutsourceCommandAccess = {
  actorId: string;
  canSupervise: boolean;
};

type OutsourceQuantityAllocation = {
  quantityLineId: string;
  qty: number;
};

type V2OutsourceOperation = SpecializedOperation & {
  reworkCaseId: string | null;
};

type CreateV2OutsourceOrderInput = OutsourceCommandAccess & {
  productionStepId: string;
  vendorId: string;
  description: string;
  quantity: number;
  quantityLines: OutsourceQuantityAllocation[];
  unitCost: number;
  expectedBackAt?: string;
  notes?: string;
  commandId: string;
  expectedRevision: number;
};

type TransitionV2OutsourceOrderInput = OutsourceCommandAccess & {
  id: string;
  status: Exclude<OutsourceStatus, "DRAFT">;
  qcNotes?: string;
  disposition?: "REWORK" | "SCRAP";
  quantityLines?: SpecializedQuantityOutput[];
  commandId: string;
  expectedRevision: number;
};

type CancelV2OutsourceOrderInput = OutsourceCommandAccess & {
  id: string;
  commandId: string;
  expectedRevision: number;
};

const OUTSOURCE_TRANSITIONS: Record<OutsourceStatus, readonly OutsourceStatus[]> = {
  DRAFT: ["SENT"],
  SENT: ["IN_PROGRESS", "COMPLETED", "RECEIVED_BACK"],
  IN_PROGRESS: ["COMPLETED", "RECEIVED_BACK"],
  COMPLETED: ["RECEIVED_BACK"],
  RECEIVED_BACK: ["QC_PASSED", "QC_FAILED"],
  QC_PASSED: [],
  QC_FAILED: [],
};

async function lockV2OperationScope(tx: PrismaTx, operationJobId: string) {
  const reference = await tx.productionStep.findUnique({
    where: { id: operationJobId },
    select: {
      productionId: true,
      reworkCaseId: true,
      production: { select: { orderId: true } },
    },
  });
  if (!reference) notFound("Operation Job", operationJobId);
  await lockProductionTopology(tx, reference.production.orderId);
  await tx.$queryRaw`SELECT id FROM production_steps WHERE production_id = ${reference.productionId} ORDER BY id FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM productions WHERE id = ${reference.productionId} FOR UPDATE`;
  await lockOrderRow(tx, reference.production.orderId);
  await tx.$queryRaw`SELECT id FROM operation_quantities WHERE production_id = ${reference.productionId} ORDER BY id FOR UPDATE`;
  return reference;
}

async function loadV2OutsourceOperation(
  tx: PrismaTx,
  input: {
    operationJobId: string;
    expectedRevision: number;
    allowInactiveExecutionScope?: boolean;
  } & OutsourceCommandAccess,
): Promise<V2OutsourceOperation> {
  const reference = await lockV2OperationScope(tx, input.operationJobId);
  const operation = await loadSpecializedOperation(tx, {
    operationJobId: input.operationJobId,
    expectedRevision: input.expectedRevision,
    actorId: input.actorId,
    canSupervise: input.canSupervise,
    requiredWorkCenterCode: "OUTSOURCE",
    allowedStates: ["READY", "RUNNING"],
    allowInactiveExecutionScope: input.allowInactiveExecutionScope,
  });
  return { ...operation, reworkCaseId: reference.reworkCaseId };
}

function resultDto<
  T extends {
    id: string;
    productionStepId: string;
    status: OutsourceStatus;
    quantity: number;
  },
>(
  order: T,
  operationRevision: number,
) {
  return { ...order, operationJobId: order.productionStepId, operationRevision };
}

export function createV2OutsourceOrder(
  prisma: ExtendedPrismaClient,
  input: CreateV2OutsourceOrderInput,
) {
  return executeManufacturingCommand(
    prisma,
    "createOutsourceOrder",
    input,
    async (tx) => {
      const operation = await loadV2OutsourceOperation(tx, {
        operationJobId: input.productionStepId,
        expectedRevision: input.expectedRevision,
        actorId: input.actorId,
        canSupervise: input.canSupervise,
      });
      if (input.quantityLines.length === 0) {
        badRequest(
          "ใบงานร้านนอก Production V2 ต้องระบุจำนวนตามสินค้า สี ไซซ์ และจุดพิมพ์",
        );
      }
      if (
        new Set(input.quantityLines.map((line) => line.quantityLineId)).size !==
        input.quantityLines.length
      ) {
        badRequest("quantity line ซ้ำกันในใบงานร้านนอก");
      }
      if (
        input.quantityLines.some(
          (line) => !Number.isSafeInteger(line.qty) || line.qty <= 0,
        )
      ) {
        badRequest("จำนวนที่ส่งร้านต่อ quantity line ต้องเป็นจำนวนเต็มมากกว่า 0");
      }
      const allocatedTotal = input.quantityLines.reduce(
        (sum, line) => sum + line.qty,
        0,
      );
      if (allocatedTotal !== input.quantity) {
        badRequest("ผลรวม quantity line ต้องตรงกับจำนวนรวมของใบงานร้านนอก");
      }
      const currentLines = await tx.operationQuantity.findMany({
        where: {
          productionStepId: operation.id,
          id: { in: input.quantityLines.map((line) => line.quantityLineId) },
        },
        select: {
          id: true,
          qtyPlanned: true,
          qtyGood: true,
          qtyRework: true,
        },
      });
      if (currentLines.length !== input.quantityLines.length) {
        badRequest("quantity line ของใบงานร้านนอกไม่ได้อยู่ใน Operation Job นี้");
      }
      const openAllocations = await tx.outsourceOrderLine.findMany({
        where: {
          operationQuantity: { productionStepId: operation.id },
          outsourceOrder: {
            status: { notIn: ["QC_PASSED", "QC_FAILED"] },
          },
        },
        select: { operationQuantityId: true, qty: true },
      });
      const openAllocatedByLine = new Map<string, number>();
      for (const allocation of openAllocations) {
        openAllocatedByLine.set(
          allocation.operationQuantityId,
          (openAllocatedByLine.get(allocation.operationQuantityId) ?? 0) +
            allocation.qty,
        );
      }
      const currentById = new Map(currentLines.map((line) => [line.id, line]));
      for (const allocation of input.quantityLines) {
        const current = currentById.get(allocation.quantityLineId)!;
        const available = Math.max(
          0,
          current.qtyPlanned -
            current.qtyGood -
            current.qtyRework -
            (openAllocatedByLine.get(current.id) ?? 0),
        );
        if (allocation.qty > available) {
          badRequest(
            `จำนวนส่งร้านของ ${current.id} เกินยอดที่ยังไม่ได้จัดสรร (${available} ตัว)`,
          );
        }
      }
      if (operation.reworkCaseId) {
        const rework = await tx.reworkCase.findUnique({
          where: { id: operation.reworkCaseId },
          select: {
            id: true,
            productionId: true,
            sourceOperationId: true,
            sourceQcDefectId: true,
            state: true,
            qty: true,
          },
        });
        const operationLineCount = await tx.operationQuantity.count({
          where: { productionStepId: operation.id },
        });
        const allocation = input.quantityLines[0];
        const quantityLine = allocation
          ? currentById.get(allocation.quantityLineId)
          : null;
        if (
          !rework ||
          rework.productionId !== operation.productionId ||
          !rework.sourceOperationId ||
          !rework.sourceQcDefectId
        ) {
          conflict("งานแก้ร้านนอกไม่มี trace กลับไปยัง QC defect ต้นทาง");
        }
        if (rework.state !== "RELEASED") {
          badRequest("เปิดใบงานร้านนอกได้เมื่อ Rework Case ถูก Release แล้วเท่านั้น");
        }
        if (
          input.quantityLines.length !== 1 ||
          operationLineCount !== 1 ||
          !allocation ||
          !quantityLine ||
          allocation.qty !== rework.qty ||
          quantityLine.qtyPlanned !== rework.qty ||
          operation.qtyPlanned !== rework.qty
        ) {
          badRequest(
            "ใบส่งแก้งานร้านนอกต้องจัดสรรเต็มจำนวนจาก quantity line ของ defect ต้นทางเพียงรายการเดียว",
          );
        }
      }

      const unitCost = moneyInput(input.unitCost);
      const order = await tx.outsourceOrder.create({
        data: {
          productionStepId: operation.id,
          vendorId: input.vendorId,
          description: input.description,
          quantity: input.quantity,
          unitCost: unitCost.toNumber(),
          totalCost: round2(unitCost.times(input.quantity)).toNumber(),
          expectedBackAt: input.expectedBackAt
            ? new Date(input.expectedBackAt)
            : null,
          notes: input.notes,
          allocations: {
            create: input.quantityLines.map((line) => ({
              operationQuantityId: line.quantityLineId,
              qty: line.qty,
            })),
          },
        },
        include: {
          allocations: {
            select: { id: true, operationQuantityId: true, qty: true },
          },
        },
      });
      const updatedOperation = await recordSpecializedOperationEvent(tx, {
        operation,
        commandId: input.commandId,
        actorId: input.actorId,
        eventType: "CREATED",
        nextState: operation.operationState,
        payload: {
          outsourceOrderId: order.id,
          status: order.status,
          quantityAllocations: input.quantityLines,
        },
      });
      await createAuditLog(tx, {
        userId: input.actorId,
        action: "CREATE",
        entityType: "OUTSOURCE_ORDER",
        entityId: order.id,
        newValue: {
          productionStepId: operation.id,
          vendorId: input.vendorId,
          quantity: input.quantity,
          quantityAllocations: input.quantityLines,
          source: "PRODUCTION_V2",
        },
      });
      return {
        productionId: operation.productionId,
        productionStepId: operation.id,
        result: resultDto(order, updatedOperation.revision),
      };
    },
  );
}

async function loadV2OutsourceOrder(
  tx: PrismaTx,
  id: string,
  input: Pick<TransitionV2OutsourceOrderInput, "actorId" | "canSupervise" | "expectedRevision">,
  options: { allowInactiveExecutionScope?: boolean } = {},
) {
  const reference = await tx.outsourceOrder.findUnique({
    where: { id },
    select: { productionStepId: true },
  });
  if (!reference) notFound("ใบงานร้านนอก", id);
  const operation = await loadV2OutsourceOperation(tx, {
    operationJobId: reference.productionStepId,
    ...input,
    ...options,
  });
  const order = await tx.outsourceOrder.findUnique({
    where: { id },
    include: {
      allocations: {
        select: { id: true, operationQuantityId: true, qty: true },
      },
    },
  });
  if (!order || order.productionStepId !== operation.id) {
    conflict("ใบงานร้านนอกถูกย้ายไป Operation Job อื่นแล้ว — กรุณารีเฟรช");
  }
  return { operation, order };
}

async function completeExternalReworkReinspection(
  tx: PrismaTx,
  input: {
    operation: V2OutsourceOperation;
    updatedOperation: {
      id: string;
      operationState: string;
      qtyPlanned: number;
      qtyGood: number;
      qtyScrap: number;
      qtyRework: number;
      revision: number;
    };
    outsourceOrderId: string;
    qty: number;
    actorId: string;
    commandId: string;
  },
) {
  if (!input.operation.reworkCaseId) return null;
  const rework = await tx.reworkCase.findUnique({
    where: { id: input.operation.reworkCaseId },
    select: {
      id: true,
      productionId: true,
      sourceOperationId: true,
      sourceQcDefectId: true,
      sourceExceptionId: true,
      state: true,
      qty: true,
      sourceQcDefect: {
        select: {
          id: true,
          disposition: true,
          operationQuantityId: true,
          operationQuantity: {
            select: {
              id: true,
              productionStepId: true,
              qtyPlanned: true,
              qtyGood: true,
              qtyScrap: true,
              qtyRework: true,
              revision: true,
            },
          },
        },
      },
      sourceException: {
        select: {
          id: true,
          productionStepId: true,
          sourceQcDefectId: true,
          state: true,
          disposition: true,
          blocksJob: true,
        },
      },
      sourceOperation: {
        select: {
          id: true,
          productionId: true,
          operationState: true,
          qtyPlanned: true,
          qtyGood: true,
          qtyScrap: true,
          qtyRework: true,
        },
      },
    },
  });
  if (
    !rework ||
    rework.productionId !== input.operation.productionId ||
    !rework.sourceOperation ||
    !rework.sourceQcDefect ||
    !rework.sourceQcDefect.operationQuantity ||
    !rework.sourceException ||
    rework.sourceOperationId !== rework.sourceOperation.id ||
    rework.sourceQcDefectId !== rework.sourceQcDefect.id ||
    rework.sourceExceptionId !== rework.sourceException.id ||
    rework.sourceQcDefect.operationQuantityId !==
      rework.sourceQcDefect.operationQuantity.id ||
    rework.sourceQcDefect.operationQuantity.productionStepId !==
      rework.sourceOperation.id ||
    rework.sourceException.productionStepId !== rework.sourceOperation.id ||
    rework.sourceException.sourceQcDefectId !== rework.sourceQcDefect.id
  ) {
    conflict("Rework Case ร้านนอกไม่มี trace ต้นทางที่ครบถ้วน");
  }
  if (rework.state !== "IN_PROGRESS") {
    badRequest("Rework Case ร้านนอกยังไม่อยู่สถานะกำลังทำ");
  }
  if (
    rework.qty !== input.qty ||
    input.updatedOperation.qtyGood !== input.updatedOperation.qtyPlanned ||
    input.updatedOperation.qtyRework !== 0
  ) {
    conflict("ผล QC ร้านนอกยังไม่ครบจำนวนของ Rework Case");
  }
  if (
    rework.sourceQcDefect.disposition !== "REWORK" ||
    rework.sourceException.disposition !== "REWORK" ||
    !["OPEN", "ACKNOWLEDGED", "RESOLVED", "CLOSED"].includes(
      rework.sourceException.state,
    ) ||
    ["COMPLETED", "CANCELLED"].includes(
      rework.sourceOperation.operationState,
    )
  ) {
    conflict("สถานะต้นทางของ Rework Case ไม่พร้อมรับผลตรวจซ้ำ");
  }
  try {
    resolveReworkOutput({
      current: rework.sourceOperation,
      qtyFromRework: input.qty,
      disposition: "GOOD",
    });
    resolveReworkOutput({
      current: rework.sourceQcDefect.operationQuantity,
      qtyFromRework: input.qty,
      disposition: "GOOD",
    });
  } catch (error) {
    if (error instanceof ManufacturingDomainError) badRequest(error.message);
    throw error;
  }

  const completedAt = new Date();
  const exceptionWasOpen = ["OPEN", "ACKNOWLEDGED"].includes(
    rework.sourceException.state,
  );
  if (exceptionWasOpen) {
    await tx.productionException.update({
      where: { id: rework.sourceException.id },
      data: {
        state: "RESOLVED",
        resolution: "งานแก้ร้านนอกผ่านการตรวจซ้ำ",
        ...(rework.sourceException.state === "OPEN"
          ? { acknowledgedAt: completedAt }
          : {}),
        resolvedAt: completedAt,
        revision: { increment: 1 },
      },
    });
  }
  const otherBlockers = await tx.productionException.count({
    where: {
      productionStepId: rework.sourceOperation.id,
      id: { not: rework.sourceException.id },
      blocksJob: true,
      state: { in: ["OPEN", "ACKNOWLEDGED"] },
    },
  });
  const sourceNextState = otherBlockers > 0 ? "BLOCKED" : "RUNNING";
  const sourceQuantityLine = await tx.operationQuantity.update({
    where: { id: rework.sourceQcDefect.operationQuantity.id },
    data: {
      qtyGood: { increment: input.qty },
      qtyRework: { decrement: input.qty },
      revision: { increment: 1 },
    },
    select: { id: true, qtyGood: true, qtyRework: true, revision: true },
  });
  const sourceOperation = await tx.productionStep.update({
    where: { id: rework.sourceOperation.id },
    data: {
      operationState: sourceNextState,
      status: sourceNextState === "BLOCKED" ? "ON_HOLD" : "IN_PROGRESS",
      qtyGood: { increment: input.qty },
      qtyRework: { decrement: input.qty },
      revision: { increment: 1 },
    },
    select: {
      id: true,
      operationState: true,
      qtyGood: true,
      qtyRework: true,
      revision: true,
    },
  });
  const completedRework = await tx.reworkCase.update({
    where: { id: rework.id },
    data: {
      qty: 0,
      state: "COMPLETED",
      reinspectedAt: completedAt,
      completedAt,
      revision: { increment: 1 },
    },
    select: {
      id: true,
      state: true,
      qty: true,
      reinspectedAt: true,
      completedAt: true,
      revision: true,
    },
  });
  const completedOperation = await tx.productionStep.update({
    where: { id: input.operation.id },
    data: {
      operationState: "COMPLETED",
      status: "COMPLETED",
      completedAt,
      revision: { increment: 1 },
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
  await tx.operationEvent.create({
    data: {
      productionId: input.operation.productionId,
      productionStepId: rework.sourceOperation.id,
      eventType: "QC_RECORDED",
      commandId: input.commandId,
      sequence: 1,
      actorId: input.actorId,
      fromState: rework.sourceOperation.operationState,
      toState: sourceNextState,
      qtyGoodDelta: input.qty,
      qtyReworkDelta: -input.qty,
      payload: {
        action: "OUTSOURCE_REWORK_REINSPECTED",
        outsourceOrderId: input.outsourceOrderId,
        reworkCaseId: rework.id,
        sourceQcDefectId: rework.sourceQcDefect.id,
        sourceExceptionId: rework.sourceException.id,
        sourceOperationQuantityId: sourceQuantityLine.id,
      },
    },
  });
  await tx.operationEvent.create({
    data: {
      productionId: input.operation.productionId,
      productionStepId: input.operation.id,
      eventType: "COMPLETED",
      commandId: input.commandId,
      sequence: 2,
      actorId: input.actorId,
      fromState: input.updatedOperation.operationState,
      toState: "COMPLETED",
      payload: {
        action: "OUTSOURCE_REWORK_COMPLETED",
        outsourceOrderId: input.outsourceOrderId,
        reworkCaseId: rework.id,
      },
    },
  });
  return {
    operation: completedOperation,
    rework: completedRework,
    sourceOperation,
    sourceQuantityLine,
    sourceExceptionId: rework.sourceException.id,
    sourceExceptionResolved: exceptionWasOpen,
    qty: input.qty,
  };
}

export function transitionV2OutsourceOrder(
  prisma: ExtendedPrismaClient,
  input: TransitionV2OutsourceOrderInput,
) {
  return executeManufacturingCommand(
    prisma,
    "transitionOutsourceOrder",
    input,
    async (tx) => {
      const { operation, order } = await loadV2OutsourceOrder(tx, input.id, input);
      if (!OUTSOURCE_TRANSITIONS[order.status].includes(input.status)) {
        badRequest(`ใบงานร้านนอกสถานะ ${order.status} เปลี่ยนเป็น ${input.status} ไม่ได้`);
      }
      if (input.status === "RECEIVED_BACK") {
        const receiptCount = await tx.goodsReceipt.count({
          where: {
            outsourceOrderId: order.id,
            receiptType: "OUTSOURCE_RETURN",
          },
        });
        if (receiptCount === 0) {
          badRequest("ยังไม่มีใบตรวจนับรับของกลับจากร้านนอก");
        }
      }
      if (input.status === "SENT" && operation.reworkCaseId) {
        const rework = await tx.reworkCase.findUnique({
          where: { id: operation.reworkCaseId },
          select: { productionId: true, state: true },
        });
        if (
          !rework ||
          rework.productionId !== operation.productionId ||
          rework.state !== "RELEASED"
        ) {
          badRequest("Rework Case ร้านนอกไม่อยู่สถานะพร้อมส่ง");
        }
        await tx.reworkCase.update({
          where: { id: operation.reworkCaseId },
          data: { state: "IN_PROGRESS", revision: { increment: 1 } },
        });
      }

      let qcDelta: {
        qtyGood: number;
        qtyScrap: number;
        qtyRework: number;
      } | null = null;
      let failedQuantityLines: Array<{
        quantityLineId: string;
        qty: number;
        description: string;
        size: string | null;
        color: string | null;
        printPosition: string | null;
      }> = [];
      if (input.status === "QC_PASSED" || input.status === "QC_FAILED") {
        const quantityLines = input.quantityLines ?? [];
        const qtyGood = quantityLines.reduce(
          (sum, line) => sum + line.qtyGood,
          0,
        );
        const qtyScrap = quantityLines.reduce(
          (sum, line) => sum + line.qtyScrap,
          0,
        );
        const qtyRework = quantityLines.reduce(
          (sum, line) => sum + line.qtyRework,
          0,
        );
        if (quantityLines.length === 0) {
          badRequest(
            "ผล QC งานร้านนอกต้องแจกแจงจำนวนตามสินค้า สี ไซซ์ และจุดพิมพ์",
          );
        }
        if (
          new Set(quantityLines.map((line) => line.quantityLineId)).size !==
          quantityLines.length
        ) {
          badRequest("quantity line ซ้ำกันในผล QC งานร้านนอก");
        }
        const allocatedByLine = new Map(
          order.allocations.map((line) => [line.operationQuantityId, line.qty]),
        );
        if (
          order.allocations.length === 0 ||
          order.allocations.reduce((sum, line) => sum + line.qty, 0) !==
            order.quantity
        ) {
          conflict(
            "ใบงานร้านนอก Production V2 ไม่มี allocation ที่ครบถ้วน กรุณายกเลิกและเปิดใบใหม่",
          );
        }
        if (
          quantityLines.length !== allocatedByLine.size ||
          quantityLines.some(
            (line) => !allocatedByLine.has(line.quantityLineId),
          )
        ) {
          badRequest(
            "ผล QC ต้องใช้ quantity line ชุดเดียวกับที่จัดสรรไว้ตอนเปิดใบงานร้านนอก",
          );
        }
        if (input.status === "QC_PASSED") {
          if (
            qtyGood !== order.quantity ||
            qtyScrap !== 0 ||
            qtyRework !== 0
          ) {
            badRequest(
              "QC ผ่านงานร้านนอกต้องแจกแจงของดีครบตามจำนวนใน quantity line และไม่มี scrap/rework",
            );
          }
          if (
            quantityLines.some(
              (line) =>
                line.qtyGood !== allocatedByLine.get(line.quantityLineId),
            )
          ) {
            badRequest("ยอด QC ผ่านต้องตรงกับ allocation ของแต่ละ quantity line");
          }
        } else {
          if (!input.disposition) {
            badRequest("QC ไม่ผ่านต้องเลือกส่งแก้หรือคัดทิ้ง");
          }
          const dispositionMatches =
            (input.disposition === "REWORK" &&
              qtyGood === 0 &&
              qtyScrap === 0 &&
              qtyRework === order.quantity) ||
            (input.disposition === "SCRAP" &&
              qtyGood === 0 &&
              qtyScrap === order.quantity &&
              qtyRework === 0);
          if (!dispositionMatches) {
            badRequest(
              "ยอด QC ไม่ผ่านต้องครบตามจำนวนใบงาน และตรงกับการตัดสินส่งแก้หรือคัดทิ้ง",
            );
          }
          if (
            quantityLines.some((line) => {
              const rejectedQty =
                input.disposition === "REWORK"
                  ? line.qtyRework
                  : line.qtyScrap;
              return rejectedQty !== allocatedByLine.get(line.quantityLineId);
            })
          ) {
            badRequest("ยอด QC ไม่ผ่านต้องตรงกับ allocation ของแต่ละ quantity line");
          }
          const rejectedByLine = quantityLines
            .map((line) => ({
              quantityLineId: line.quantityLineId,
              qty:
                input.disposition === "REWORK"
                  ? line.qtyRework
                  : line.qtyScrap,
            }))
            .filter((line) => line.qty > 0);
          const scopedLines = await tx.operationQuantity.findMany({
            where: {
              productionStepId: operation.id,
              id: { in: rejectedByLine.map((line) => line.quantityLineId) },
            },
            select: {
              id: true,
              description: true,
              size: true,
              color: true,
              printPosition: true,
            },
          });
          if (scopedLines.length !== rejectedByLine.length) {
            badRequest("quantity line ของผล QC ไม่ได้อยู่ใน Operation Job นี้");
          }
          const scopedLineById = new Map(
            scopedLines.map((line) => [line.id, line]),
          );
          failedQuantityLines = rejectedByLine.map((line) => {
            const scoped = scopedLineById.get(line.quantityLineId)!;
            return {
              ...line,
              description: scoped.description,
              size: scoped.size,
              color: scoped.color,
              printPosition: scoped.printPosition,
            };
          });
        }
        qcDelta = { qtyGood, qtyScrap, qtyRework };
      } else if (input.disposition || input.quantityLines?.length) {
        badRequest("disposition และ quantity line ใช้ได้เฉพาะตอนตัดสิน QC");
      }

      const written = await tx.outsourceOrder.updateMany({
        where: { id: order.id, status: order.status },
        data: {
          status: input.status,
          ...(input.status === "SENT" ? { sentAt: new Date() } : {}),
          ...(input.status === "RECEIVED_BACK"
            ? { receivedAt: new Date() }
            : {}),
          ...(input.status === "QC_PASSED" ? { qcPassed: true } : {}),
          ...(input.status === "QC_FAILED" ? { qcPassed: false } : {}),
          ...(input.qcNotes ? { qcNotes: input.qcNotes } : {}),
        },
      });
      if (written.count !== 1) {
        conflict("ใบงานร้านนอกเพิ่งถูกอัปเดตจากอีกจอ กรุณารีเฟรช");
      }

      const payload = {
        outsourceOrderId: order.id,
        quantity: order.quantity,
        fromStatus: order.status,
        toStatus: input.status,
        ...(input.disposition ? { disposition: input.disposition } : {}),
        ...(input.qcNotes ? { qcNotes: input.qcNotes } : {}),
      };
      let updatedOperation;
      let qcRecordId: string | null = null;
      let reworkResolution: Awaited<
        ReturnType<typeof completeExternalReworkReinspection>
      > = null;
      const exceptionTraces: Array<{
        exceptionId: string;
        qcDefectId: string;
        quantityLineId: string;
        qty: number;
      }> = [];
      if (input.status === "QC_PASSED") {
        updatedOperation = await recordSpecializedOperationOutput(tx, {
          operation,
          commandId: input.commandId,
          actorId: input.actorId,
          eventType: "QC_RECORDED",
          delta: qcDelta!,
          quantityLines: input.quantityLines,
          payload,
        });
        reworkResolution = await completeExternalReworkReinspection(tx, {
          operation,
          updatedOperation,
          outsourceOrderId: order.id,
          qty: order.quantity,
          actorId: input.actorId,
          commandId: input.commandId,
        });
        if (reworkResolution) {
          updatedOperation = reworkResolution.operation;
        }
      } else if (input.status === "QC_FAILED") {
        const qcRecord = await tx.qcRecord.create({
          data: {
            orderId: operation.production.orderId,
            productionStepId: operation.id,
            qtyGood: 0,
            qtyDefect: order.quantity,
            notes: input.qcNotes ?? `งานร้านนอก ${order.description} ไม่ผ่าน QC`,
            checkedById: input.actorId,
          },
          select: { id: true },
        });
        qcRecordId = qcRecord.id;
        for (const line of failedQuantityLines) {
          const defect = await tx.qcDefect.create({
            data: {
              qcRecordId: qcRecord.id,
              operationQuantityId: line.quantityLineId,
              qty: line.qty,
              size: line.size,
              color: line.color,
              printLabel: line.printPosition,
              reason: "OTHER",
              disposition: input.disposition!,
              note: input.qcNotes ?? `งานร้านนอก ${order.description} ไม่ผ่าน QC`,
            },
            select: { id: true },
          });
          const exception = await tx.productionException.create({
            data: {
              productionId: operation.productionId,
              productionStepId: operation.id,
              workCenterId: operation.workCenterId,
              sourceQcDefectId: defect.id,
              code: `OUTSOURCE_QC_FAILED:${defect.id}`,
              title: `งานร้านนอกไม่ผ่าน QC: ${line.description}`,
              description: input.qcNotes
                ? `${input.qcNotes} · จำนวน ${line.qty} ตัว`
                : `${line.description} ไม่ผ่าน QC จำนวน ${line.qty} ตัว`,
              severity: input.disposition === "REWORK" ? "CRITICAL" : "WARNING",
              blocksJob: true,
              state: "OPEN",
              disposition: input.disposition!,
              raisedById: input.actorId,
            },
            select: { id: true },
          });
          exceptionTraces.push({
            exceptionId: exception.id,
            qcDefectId: defect.id,
            quantityLineId: line.quantityLineId,
            qty: line.qty,
          });
        }
        updatedOperation = await recordSpecializedOperationOutput(tx, {
          operation,
          commandId: input.commandId,
          actorId: input.actorId,
          eventType: "QC_RECORDED",
          nextState: "BLOCKED",
          delta: qcDelta!,
          quantityLines: input.quantityLines,
          payload: {
            ...payload,
            qcRecordId,
            exceptionTraces,
          },
        });
      } else {
        updatedOperation = await recordSpecializedOperationEvent(tx, {
          operation,
          commandId: input.commandId,
          actorId: input.actorId,
          eventType:
            input.status === "RECEIVED_BACK"
              ? "RECEIPT_RECORDED"
              : "STARTED",
          nextState:
            input.status === "SENT" ? "RUNNING" : operation.operationState,
          payload,
        });
      }

      await createAuditLog(tx, {
        userId: input.actorId,
        action: "UPDATE",
        entityType: "OUTSOURCE_ORDER",
        entityId: order.id,
        oldValue: { status: order.status },
        newValue: {
          status: input.status,
          ...(input.disposition ? { disposition: input.disposition } : {}),
          ...(qcRecordId ? { qcRecordId } : {}),
          ...(reworkResolution
            ? {
                reworkCaseId: reworkResolution.rework.id,
                reworkState: reworkResolution.rework.state,
                sourceExceptionId: reworkResolution.sourceExceptionId,
                sourceQuantityLineId: reworkResolution.sourceQuantityLine.id,
                reinspectionQty: reworkResolution.qty,
              }
            : {}),
          source: "PRODUCTION_V2",
        },
      });
      const updatedOrder = await tx.outsourceOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          allocations: {
            select: { id: true, operationQuantityId: true, qty: true },
          },
        },
      });
      return {
        productionId: operation.productionId,
        productionStepId: operation.id,
        result: {
          ...resultDto(updatedOrder, updatedOperation.revision),
          ...(qcRecordId ? { qcRecordId } : {}),
          ...(reworkResolution ? { reworkResolution } : {}),
          ...(exceptionTraces.length
            ? {
                exceptionId: exceptionTraces[0]!.exceptionId,
                exceptionIds: exceptionTraces.map((trace) => trace.exceptionId),
                exceptionTraces,
              }
            : {}),
        },
      };
    },
  );
}

export function cancelV2OutsourceOrder(
  prisma: ExtendedPrismaClient,
  input: CancelV2OutsourceOrderInput,
) {
  return executeManufacturingCommand(
    prisma,
    "cancelOutsourceOrder",
    input,
    async (tx) => {
      const { operation, order } = await loadV2OutsourceOrder(tx, input.id, input, {
        allowInactiveExecutionScope: true,
      });
      if (order.status !== "DRAFT") {
        badRequest("ยกเลิกได้เฉพาะใบงานร้านนอกฉบับร่าง");
      }
      const deleted = await tx.outsourceOrder.deleteMany({
        where: { id: order.id, status: "DRAFT" },
      });
      if (deleted.count !== 1) {
        conflict("ใบงานร้านนอกเพิ่งถูกส่งจากอีกจอ กรุณารีเฟรช");
      }
      const otherExecutingOrders = await tx.outsourceOrder.count({
        where: {
          productionStepId: operation.id,
          id: { not: order.id },
          status: {
            in: ["SENT", "IN_PROGRESS", "COMPLETED", "RECEIVED_BACK"],
          },
        },
      });
      const updatedOperation = await recordSpecializedOperationEvent(tx, {
        operation,
        commandId: input.commandId,
        actorId: input.actorId,
        eventType: "CANCELLED",
        nextState:
          otherExecutingOrders > 0 || operation.qtyGood > 0
            ? "RUNNING"
            : "READY",
        payload: { outsourceOrderId: order.id, status: "CANCELLED" },
      });
      await createAuditLog(tx, {
        userId: input.actorId,
        action: "DELETE",
        entityType: "OUTSOURCE_ORDER",
        entityId: order.id,
        oldValue: { status: order.status, source: "PRODUCTION_V2" },
      });
      return {
        productionId: operation.productionId,
        productionStepId: operation.id,
        result: { ok: true, operationRevision: updatedOperation.revision },
      };
    },
  );
}
