import type {
  ExceptionSeverity,
  InternalStatus,
  OperationEventType,
  OperationState,
  Prisma,
  QualityDisposition,
  WorkResourceState,
  WorkOrderState,
} from "@prisma/client";
import type { ExtendedPrismaClient, PrismaTx } from "@/lib/prisma";
import { badRequest, conflict, forbidden, notFound } from "@/server/errors";
import { advanceOrderForward } from "@/server/services/order-status";
import { lockOrderRow } from "@/server/services/order-cost";
import { lockProductionTopology } from "@/server/services/production-topology-lock";
import {
  assertExpectedRevision,
  assertOutputDelta,
  operationCanComplete,
  operationPredecessorsComplete,
  assertQcDispositionDecision,
  assertQualityExceptionResolution,
  manufacturingOperationCanAdvance,
  manufacturingOperationCanPlan,
  manufacturingParentCanAdvance,
  manufacturingParentCanPlan,
  type ManufacturingCommandName,
  type OutputDelta,
} from "./manufacturing-command-policy";
import {
  decideManufacturingCommand,
  hashManufacturingCommand,
} from "./manufacturing-command";
import {
  assertRoutingConvergesToFinalPack,
  assertExceptionTransition,
  ManufacturingDomainError,
  resolveReworkOutput,
} from "./manufacturing-domain";
import { assertFinalPackOutput } from "./final-pack";
import { assertPrepGarmentSurplusCleared } from "./manufacturing-prep-readiness";

type CommandBase = {
  commandId: string;
  expectedRevision: number;
  actorId: string;
};

type CommandScope = {
  productionId: string;
  productionStepId?: string | null;
};

type CommandExecution<T> = CommandScope & { result: T };

const RELEASE_READY_ORDER_STATUSES: InternalStatus[] = [
  "DESIGN_APPROVED",
  "PRODUCTION_QUEUE",
  "PRODUCING",
];

const SPECIALIZED_EVIDENCE_OPERATION_CODES = new Set([
  "PREP",
  "DTF_PRINT",
  "FINAL_QC",
  "OUTSOURCE",
]);

function assertGenericExecutionAllowed(
  operationCode: string | null,
  command: "start" | "report",
) {
  if (!operationCode || !SPECIALIZED_EVIDENCE_OPERATION_CODES.has(operationCode)) {
    return;
  }
  const action =
    operationCode === "PREP"
      ? "รับ/เบิกเสื้อ"
      : operationCode === "DTF_PRINT"
        ? "รอบพิมพ์ DTF"
        : operationCode === "FINAL_QC"
          ? "ใบบันทึก QC"
          : "ใบงาน Outsource";
  badRequest(
    command === "start"
      ? `งานนี้ต้องเริ่มจาก${action}ที่ผูกกับหลักฐานจริง`
      : `งานนี้ต้องบันทึกผลผ่าน${action} ห้ามกรอกยอดรวมข้ามหลักฐาน`,
  );
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

type ApprovedMockupReference = {
  id: string;
  versionNumber: number;
  fileUrl: string;
  thumbnailUrl: string | null;
  approvedAt: Date | null;
  files: Array<{
    fileUrl: string;
    thumbnailUrl: string | null;
    position: string | null;
    caption: string | null;
  }>;
};

function approvedMockupReferenceSnapshot(
  design: ApprovedMockupReference | null,
): Prisma.InputJsonValue | null {
  if (!design) return null;
  return asJson({
    designId: design.id,
    versionNumber: design.versionNumber,
    fileUrl: design.fileUrl,
    thumbnailUrl: design.thumbnailUrl,
    approvedAt: design.approvedAt,
    files: design.files,
  });
}

function operationReferenceWithApprovedMockup(
  referenceSnapshot: Prisma.JsonValue | null,
  routingOperationId: string,
  approvedMockup: Prisma.InputJsonValue,
): Prisma.InputJsonValue {
  const reference =
    referenceSnapshot &&
    typeof referenceSnapshot === "object" &&
    !Array.isArray(referenceSnapshot)
      ? referenceSnapshot
      : {};
  return asJson({
    ...reference,
    routingOperationId,
    approvedMockup,
  });
}

async function lockCommandId(tx: PrismaTx, commandId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`manufacturing:${commandId}`}, 0))::text AS lock_result`;
}

export async function executeManufacturingCommand<T>(
  prisma: ExtendedPrismaClient,
  commandType: ManufacturingCommandName,
  request: CommandBase & Record<string, unknown>,
  execute: (tx: PrismaTx) => Promise<CommandExecution<T>>,
): Promise<T> {
  const hash = hashManufacturingCommand({
    commandType,
    expectedRevision: request.expectedRevision,
    actorId: request.actorId,
    payload: request,
  });
  return prisma.$transaction(async (tx) => {
    await lockCommandId(tx, request.commandId);
    const existing = await tx.manufacturingCommand.findUnique({
      where: { commandId: request.commandId },
      select: {
        commandType: true,
        requestHash: true,
        status: true,
        result: true,
        errorCode: true,
        errorMessage: true,
      },
    });
    let decision: ReturnType<typeof decideManufacturingCommand>;
    try {
      decision = decideManufacturingCommand({ existing, requestHash: hash });
    } catch (error) {
      if (error instanceof ManufacturingDomainError) conflict(error.message);
      throw error;
    }
    if (decision.kind === "REPLAY_SUCCESS") return decision.result as T;
    if (decision.kind === "REPLAY_FAILURE") {
      conflict(decision.errorMessage ?? "คำสั่งนี้เคยทำไม่สำเร็จ กรุณาสร้าง commandId ใหม่");
    }
    if (decision.kind === "IN_FLIGHT") {
      conflict("คำสั่งนี้กำลังประมวลผลอยู่ กรุณารอสักครู่แล้วลองใหม่");
    }

    await tx.manufacturingCommand.create({
      data: {
        commandId: request.commandId,
        commandType,
        requestHash: hash,
        actorId: request.actorId,
        expectedRevision: request.expectedRevision,
        status: "PENDING",
      },
    });

    const executed = await execute(tx);
    const result = asJson(executed.result);
    await tx.manufacturingCommand.update({
      where: { commandId: request.commandId },
      data: {
        productionId: executed.productionId,
        productionStepId: executed.productionStepId ?? null,
        status: "SUCCEEDED",
        result,
        completedAt: new Date(),
      },
    });
    return result as T;
  });
}

async function lockWorkOrder(tx: PrismaTx, productionId: string) {
  const reference = await tx.production.findUnique({
    where: { id: productionId },
    select: { id: true, orderId: true },
  });
  if (!reference) notFound("ใบสั่งผลิต", productionId);

  await lockProductionTopology(tx, reference.orderId);
  await tx.$queryRaw`SELECT id FROM production_steps WHERE production_id = ${productionId} ORDER BY id FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM productions WHERE id = ${productionId} FOR UPDATE`;
  await lockOrderRow(tx, reference.orderId);
  return reference;
}

async function lockOperation(tx: PrismaTx, productionStepId: string) {
  const reference = await tx.productionStep.findUnique({
    where: { id: productionStepId },
    select: { id: true, productionId: true, production: { select: { orderId: true } } },
  });
  if (!reference) notFound("งานปฏิบัติการ", productionStepId);
  await lockWorkOrder(tx, reference.productionId);
  const current = await tx.productionStep.findUnique({
    where: { id: productionStepId },
    select: {
      id: true,
      productionId: true,
      operationCode: true,
      operationName: true,
      operationState: true,
      executionEnabled: true,
      reworkCaseId: true,
      workCenterId: true,
      workCenter: { select: { code: true, isActive: true } },
      workResourceId: true,
      workResource: { select: { isActive: true, state: true } },
      assignedToId: true,
      dispatchSequence: true,
      qtyPlanned: true,
      qtyGood: true,
      qtyScrap: true,
      qtyRework: true,
      revision: true,
      startedAt: true,
      completedAt: true,
      sortOrder: true,
      stepType: true,
      predecessorLinks: {
        select: {
          predecessorStep: { select: { id: true, operationState: true } },
        },
      },
      exceptions: {
        where: { state: { in: ["OPEN", "ACKNOWLEDGED"] }, blocksJob: true },
        select: { id: true },
      },
      production: {
        select: {
          id: true,
          orderId: true,
          workOrderState: true,
          revision: true,
          order: { select: { internalStatus: true } },
        },
      },
    },
  });
  if (!current || current.productionId !== reference.productionId) {
    conflict("โครงใบสั่งผลิตเปลี่ยนจากอีกหน้าจอแล้ว — กรุณาโหลดใหม่");
  }
  return current;
}

async function createOperationEvent(
  tx: PrismaTx,
  input: {
    productionId: string;
    productionStepId?: string | null;
    eventType: OperationEventType;
    commandId: string;
    sequence?: number;
    actorId: string;
    fromState?: string | null;
    toState?: string | null;
    qtyGoodDelta?: number;
    qtyScrapDelta?: number;
    qtyReworkDelta?: number;
    payload?: Prisma.InputJsonValue;
  },
) {
  return tx.operationEvent.create({
    data: {
      productionId: input.productionId,
      productionStepId: input.productionStepId ?? null,
      eventType: input.eventType,
      commandId: input.commandId,
      sequence: input.sequence ?? 0,
      actorId: input.actorId,
      fromState: input.fromState ?? null,
      toState: input.toState ?? null,
      qtyGoodDelta: input.qtyGoodDelta ?? 0,
      qtyScrapDelta: input.qtyScrapDelta ?? 0,
      qtyReworkDelta: input.qtyReworkDelta ?? 0,
      ...(input.payload ? { payload: input.payload } : {}),
    },
  });
}

function assertExecutionEnabled(operation: { executionEnabled: boolean }) {
  if (!operation.executionEnabled) {
    badRequest("ขั้นเดิมนี้ยังไม่ถูกเปิดใช้ใน Production V2");
  }
}

function assertManufacturingParentCanAdvance(operation: {
  production: {
    workOrderState: WorkOrderState;
    order: { internalStatus: InternalStatus };
  };
}) {
  if (!manufacturingParentCanAdvance({
    workOrderState: operation.production.workOrderState,
    orderStatus: operation.production.order.internalStatus,
  })) {
    badRequest(
      "งานนี้ถูกพัก ยกเลิก หรือปิดแล้ว จึงทำต่อไม่ได้ กรุณากลับไปดูคิวงาน",
    );
  }
}

function assertOperationCanAdvance(operation: {
  workCenter: { isActive: boolean } | null;
  production: {
    workOrderState: WorkOrderState;
    order: { internalStatus: InternalStatus };
  };
}) {
  if (!manufacturingOperationCanAdvance({
    workOrderState: operation.production.workOrderState,
    orderStatus: operation.production.order.internalStatus,
    workCenterActive: operation.workCenter?.isActive ?? null,
  })) {
    assertManufacturingParentCanAdvance(operation);
    badRequest("จุดทำงานนี้ปิดใช้งานอยู่ จึงทำงานต่อไม่ได้");
  }
}

function assertOperationCanPlan(operation: {
  workCenter: { isActive: boolean } | null;
  production: {
    workOrderState: WorkOrderState;
    order: { internalStatus: InternalStatus };
  };
}) {
  const parentState = {
    workOrderState: operation.production.workOrderState,
    orderStatus: operation.production.order.internalStatus,
  };
  if (!manufacturingParentCanPlan(parentState)) {
    badRequest(
      "งานนี้ถูกพัก ยกเลิก หรือปิดแล้ว จึงจัดแผนต่อไม่ได้ ให้หัวหน้าตรวจงานก่อน",
    );
  }
  if (!manufacturingOperationCanPlan({
    ...parentState,
    workCenterActive: operation.workCenter?.isActive ?? null,
  })) {
    badRequest("จุดทำงานนี้ปิดใช้งานอยู่ จึงจัดแผนต่อไม่ได้");
  }
}

function assertAssignedResourceCanStart(operation: {
  workResource: { isActive: boolean; state: WorkResourceState } | null;
}) {
  if (
    operation.workResource &&
    (!operation.workResource.isActive ||
      ["DOWN", "INACTIVE"].includes(operation.workResource.state))
  ) {
    badRequest("เครื่องหรืออุปกรณ์ที่เลือกไม่พร้อมใช้งาน");
  }
}

export type ReleaseWorkOrderCommand = CommandBase & { workOrderId: string };

export function releaseManufacturingWorkOrder(
  prisma: ExtendedPrismaClient,
  input: ReleaseWorkOrderCommand,
) {
  return executeManufacturingCommand(
    prisma,
    "releaseWorkOrder",
    input,
    async (tx) => {
      const scope = await lockWorkOrder(tx, input.workOrderId);
      const production = await tx.production.findUniqueOrThrow({
        where: { id: input.workOrderId },
        select: {
          id: true,
          workOrderNumber: true,
          workOrderState: true,
          routingVersionId: true,
          revision: true,
          routingSnapshot: true,
          instructionSnapshot: true,
          approvedMockupSnapshot: true,
          snapshots: {
            where: {
              kind: "APPROVED_MOCKUP",
              productionStepId: null,
            },
            orderBy: { version: "desc" },
            take: 1,
            select: { version: true },
          },
          order: {
            select: {
              internalStatus: true,
              designs: {
                where: { approvalStatus: "APPROVED" },
                orderBy: { versionNumber: "desc" },
                take: 1,
                select: {
                  id: true,
                  versionNumber: true,
                  fileUrl: true,
                  thumbnailUrl: true,
                  approvedAt: true,
                  files: {
                    orderBy: { sortOrder: "asc" },
                    select: {
                      fileUrl: true,
                      thumbnailUrl: true,
                      position: true,
                      caption: true,
                    },
                  },
                },
              },
            },
          },
          routingVersion: {
            select: {
              state: true,
              operations: { select: { id: true } },
            },
          },
          steps: {
            where: { executionEnabled: true },
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            select: {
              id: true,
              operationCode: true,
              operationName: true,
              workCenterId: true,
              routingOperationId: true,
              qtyPlanned: true,
              referenceSnapshot: true,
              workCenter: { select: { isActive: true } },
              predecessorLinks: { select: { predecessorStepId: true } },
            },
          },
        },
      });
      assertExpectedRevision(production.revision, input.expectedRevision);
      if (production.workOrderState !== "DRAFT") {
        badRequest("Release ได้เฉพาะใบสั่งผลิตสถานะร่าง");
      }
      if (!RELEASE_READY_ORDER_STATUSES.includes(production.order.internalStatus)) {
        badRequest(
          "ออเดอร์ยังไม่พร้อมเริ่มผลิต ให้หัวหน้าตรวจสถานะออเดอร์ก่อน",
        );
      }
      if (!production.workOrderNumber) badRequest("ใบสั่งผลิตยังไม่มีเลขที่เอกสาร");
      if (!production.routingVersionId || production.routingVersion?.state !== "RELEASED") {
        badRequest("ต้องเลือกรouting version ที่ Release แล้วก่อนปล่อยใบสั่งผลิต");
      }
      if (
        !production.routingSnapshot ||
        !production.instructionSnapshot
      ) {
        badRequest("ต้องเก็บสำเนา Routing และคำสั่งการผลิตให้ครบก่อนปล่อยผลิต");
      }
      const currentApprovedDesign = production.order.designs[0] ?? null;
      const currentApprovedMockup = approvedMockupReferenceSnapshot(
        currentApprovedDesign,
      );
      if (!currentApprovedDesign || !currentApprovedMockup) {
        badRequest(
          "ยังไม่มีแบบอนุมัติล่าสุด จึงเริ่มผลิตไม่ได้ ให้หัวหน้าตรวจแบบก่อน",
        );
      }
      if (production.steps.length === 0) badRequest("ใบสั่งผลิตยังไม่มี Operation Job");
      const invalid = production.steps.find(
        (step) =>
          !step.operationCode ||
          !step.operationName ||
          !step.workCenterId ||
          !step.workCenter?.isActive,
      );
      if (invalid) {
        badRequest("Operation Job ทุกขั้นต้องมีรหัส ชื่อ และ Work Center ที่เปิดใช้งาน");
      }
      const routingOperationIds = new Set(
        production.routingVersion.operations.map((operation) => operation.id),
      );
      const snapshotOperationIds = production.steps.map(
        (step) => step.routingOperationId,
      );
      if (
        snapshotOperationIds.some(
          (operationId) => !operationId || !routingOperationIds.has(operationId),
        ) ||
        new Set(snapshotOperationIds).size !== snapshotOperationIds.length ||
        snapshotOperationIds.length !== routingOperationIds.size
      ) {
        badRequest("Operation Job ไม่ตรงกับ Routing version ที่เลือก กรุณาสร้างใบสั่งผลิตใหม่");
      }

      const dependencies = await tx.operationJobDependency.findMany({
        where: {
          OR: [
            { predecessorStep: { productionId: production.id } },
            { successorStep: { productionId: production.id } },
          ],
        },
        select: { predecessorStepId: true, successorStepId: true },
      });
      try {
        assertRoutingConvergesToFinalPack(
          production.steps.map((step) => ({
            id: step.id,
            operationCode: step.operationCode!,
          })),
          dependencies.map((dependency) => ({
            predecessorOperationId: dependency.predecessorStepId,
            successorOperationId: dependency.successorStepId,
          })),
        );
      } catch (error) {
        if (error instanceof ManufacturingDomainError) badRequest(error.message);
        throw error;
      }

      const now = new Date();
      for (const [index, step] of production.steps.entries()) {
        const isRoot = step.predecessorLinks.length === 0;
        await tx.productionStep.update({
          where: { id: step.id },
          data: {
            operationState: isRoot ? "READY" : "PLANNED",
            status: "PENDING",
            readyAt: isRoot ? now : null,
            referenceSnapshot: operationReferenceWithApprovedMockup(
              step.referenceSnapshot,
              step.routingOperationId!,
              currentApprovedMockup,
            ),
            revision: { increment: 1 },
          },
        });
        await createOperationEvent(tx, {
          productionId: production.id,
          productionStepId: step.id,
          eventType: "RELEASED",
          commandId: input.commandId,
          sequence: index + 1,
          actorId: input.actorId,
          fromState: "PLANNED",
          toState: isRoot ? "READY" : "PLANNED",
        });
      }
      await tx.manufacturingReferenceSnapshot.create({
        data: {
          productionId: production.id,
          kind: "APPROVED_MOCKUP",
          version: (production.snapshots[0]?.version ?? 0) + 1,
          sourceEntityType: "DesignVersion",
          sourceEntityId: currentApprovedDesign.id,
          contentHash: `${currentApprovedDesign.id}:v${currentApprovedDesign.versionNumber}`,
          payload: currentApprovedMockup,
        },
      });
      const updated = await tx.production.update({
        where: { id: production.id },
        data: {
          workOrderState: "RELEASED",
          releasedAt: now,
          releasedById: input.actorId,
          approvedMockupSnapshot: currentApprovedMockup,
          revision: { increment: 1 },
        },
        select: { id: true, workOrderNumber: true, workOrderState: true, revision: true },
      });
      await createOperationEvent(tx, {
        productionId: production.id,
        eventType: "RELEASED",
        commandId: input.commandId,
        actorId: input.actorId,
        fromState: "DRAFT",
        toState: "RELEASED",
      });
      await advanceOrderForward(tx, {
        orderId: scope.orderId,
        target: "PRODUCING",
        changedBy: input.actorId,
        onlyFrom: ["CONFIRMED", "DESIGN_APPROVED", "PRODUCTION_QUEUE"],
        reason: `ปล่อยใบสั่งผลิต ${updated.workOrderNumber}`,
      });
      return { productionId: production.id, result: updated };
    },
  );
}

export type AssignOperationCommand = CommandBase & {
  operationJobId: string;
  assigneeId?: string | null;
  workResourceId?: string | null;
};

export function assignManufacturingOperation(
  prisma: ExtendedPrismaClient,
  input: AssignOperationCommand,
) {
  return executeManufacturingCommand(prisma, "assignOperation", input, async (tx) => {
    const operation = await lockOperation(tx, input.operationJobId);
    assertExecutionEnabled(operation);
    assertOperationCanPlan(operation);
    assertExpectedRevision(operation.revision, input.expectedRevision);
    if (["COMPLETED", "CANCELLED"].includes(operation.operationState)) {
      badRequest("งานที่ปิดแล้วไม่สามารถมอบหมายใหม่ได้");
    }
    if (input.assigneeId) {
      const user = await tx.user.findUnique({
        where: { id: input.assigneeId },
        select: { isActive: true },
      });
      if (!user?.isActive) badRequest("ผู้รับผิดชอบไม่พร้อมใช้งาน");
      if (!operation.workCenterId) {
        badRequest("งานนี้ยังไม่ได้กำหนด Work Center จึงมอบหมายผู้รับผิดชอบไม่ได้");
      }
      const membership = await tx.workCenterMember.findUnique({
        where: {
          workCenterId_userId: {
            workCenterId: operation.workCenterId,
            userId: input.assigneeId,
          },
        },
        select: { isActive: true },
      });
      if (!membership?.isActive) {
        badRequest("ผู้รับผิดชอบไม่ได้เป็นสมาชิกที่เปิดใช้งานของ Work Center นี้");
      }
    }
    if (input.workResourceId) {
      const resource = await tx.workResource.findUnique({
        where: { id: input.workResourceId },
        select: { workCenterId: true, isActive: true, state: true },
      });
      if (
        !resource?.isActive ||
        ["DOWN", "INACTIVE"].includes(resource.state) ||
        resource.workCenterId !== operation.workCenterId
      ) {
        badRequest("Resource ต้องเปิดใช้งานและอยู่ใน Work Center ของงานนี้");
      }
    }
    const updated = await tx.productionStep.update({
      where: { id: operation.id },
      data: {
        ...(input.assigneeId !== undefined ? { assignedToId: input.assigneeId } : {}),
        ...(input.workResourceId !== undefined
          ? { workResourceId: input.workResourceId }
          : {}),
        revision: { increment: 1 },
      },
      select: { id: true, assignedToId: true, workResourceId: true, revision: true },
    });
    await createOperationEvent(tx, {
      productionId: operation.productionId,
      productionStepId: operation.id,
      eventType: "ASSIGNED",
      commandId: input.commandId,
      actorId: input.actorId,
      fromState: operation.operationState,
      toState: operation.operationState,
      payload: asJson({ assigneeId: updated.assignedToId, workResourceId: updated.workResourceId }),
    });
    return {
      productionId: operation.productionId,
      productionStepId: operation.id,
      result: updated,
    };
  });
}

export type ResequenceOperationCommand = CommandBase & {
  operationJobId: string;
  dispatchSequence: number;
  plannedStartAt?: Date | null;
  plannedEndAt?: Date | null;
};

export function resequenceManufacturingOperation(
  prisma: ExtendedPrismaClient,
  input: ResequenceOperationCommand,
) {
  return executeManufacturingCommand(prisma, "resequenceOperation", input, async (tx) => {
    const operation = await lockOperation(tx, input.operationJobId);
    assertExecutionEnabled(operation);
    assertOperationCanPlan(operation);
    assertExpectedRevision(operation.revision, input.expectedRevision);
    if (["COMPLETED", "CANCELLED"].includes(operation.operationState)) {
      badRequest("งานที่ปิดแล้วไม่สามารถจัดคิวใหม่ได้");
    }
    if (
      input.plannedStartAt &&
      input.plannedEndAt &&
      input.plannedEndAt < input.plannedStartAt
    ) {
      badRequest("เวลาสิ้นสุดแผนต้องไม่ก่อนเวลาเริ่ม");
    }
    const updated = await tx.productionStep.update({
      where: { id: operation.id },
      data: {
        dispatchSequence: input.dispatchSequence,
        ...(input.plannedStartAt !== undefined
          ? { plannedStartAt: input.plannedStartAt }
          : {}),
        ...(input.plannedEndAt !== undefined ? { plannedEndAt: input.plannedEndAt } : {}),
        revision: { increment: 1 },
      },
      select: {
        id: true,
        dispatchSequence: true,
        plannedStartAt: true,
        plannedEndAt: true,
        revision: true,
      },
    });
    await createOperationEvent(tx, {
      productionId: operation.productionId,
      productionStepId: operation.id,
      eventType: "RESEQUENCED",
      commandId: input.commandId,
      actorId: input.actorId,
      fromState: operation.operationState,
      toState: operation.operationState,
      payload: asJson({ dispatchSequence: input.dispatchSequence }),
    });
    return {
      productionId: operation.productionId,
      productionStepId: operation.id,
      result: updated,
    };
  });
}

type OperateCommandAccess = { canSupervise: boolean };

async function assertActorMayAccessWorkCenter(
  tx: PrismaTx,
  operation: { workCenterId: string | null },
  input: CommandBase,
  access: OperateCommandAccess,
) {
  if (access.canSupervise) return;
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

function assertActorMayOperate(
  operation: { assignedToId: string | null },
  input: CommandBase,
  access: OperateCommandAccess,
) {
  if (
    operation.assignedToId &&
    operation.assignedToId !== input.actorId &&
    !access.canSupervise
  ) {
    badRequest("งานนี้ถูกมอบหมายให้พนักงานคนอื่น");
  }
}

export type StartOperationCommand = CommandBase & { operationJobId: string };

export function startManufacturingOperation(
  prisma: ExtendedPrismaClient,
  input: StartOperationCommand,
  access: OperateCommandAccess,
) {
  return executeManufacturingCommand(prisma, "startOperation", input, async (tx) => {
    const operation = await lockOperation(tx, input.operationJobId);
    assertExecutionEnabled(operation);
    assertOperationCanAdvance(operation);
    assertAssignedResourceCanStart(operation);
    assertExpectedRevision(operation.revision, input.expectedRevision);
    await assertActorMayAccessWorkCenter(tx, operation, input, access);
    assertActorMayOperate(operation, input, access);
    assertGenericExecutionAllowed(operation.operationCode, "start");
    if (operation.operationState !== "READY") badRequest("เริ่มได้เฉพาะงานที่พร้อมทำ");
    if (operation.exceptions.length > 0) badRequest("งานยังมีปัญหาที่บล็อกอยู่");
    if (!operationPredecessorsComplete(
      operation.predecessorLinks.map((link) => link.predecessorStep.operationState),
    )) {
      badRequest("ขั้นก่อนหน้ายังไม่เสร็จ งานนี้จึงยังเริ่มไม่ได้");
    }
    if (operation.reworkCaseId) {
      const rework = await tx.reworkCase.findUnique({
        where: { id: operation.reworkCaseId },
        select: { state: true },
      });
      if (rework?.state !== "RELEASED") {
        badRequest("Rework Case ไม่ได้อยู่สถานะพร้อมเริ่ม");
      }
    }
    const now = new Date();
    const updated = await tx.productionStep.update({
      where: { id: operation.id },
      data: {
        operationState: "RUNNING",
        status: "IN_PROGRESS",
        assignedToId: operation.assignedToId ?? input.actorId,
        startedAt: operation.startedAt ?? now,
        revision: { increment: 1 },
      },
      select: { id: true, operationState: true, assignedToId: true, revision: true },
    });
    if (operation.reworkCaseId) {
      await tx.reworkCase.update({
        where: { id: operation.reworkCaseId },
        data: { state: "IN_PROGRESS", revision: { increment: 1 } },
      });
    }
    if (operation.production.workOrderState === "RELEASED") {
      await tx.production.update({
        where: { id: operation.productionId },
        data: {
          workOrderState: "IN_PROGRESS",
          status: "IN_PROGRESS",
          startDate: now,
          revision: { increment: 1 },
        },
      });
    }
    await createOperationEvent(tx, {
      productionId: operation.productionId,
      productionStepId: operation.id,
      eventType: "STARTED",
      commandId: input.commandId,
      actorId: input.actorId,
      fromState: operation.operationState,
      toState: "RUNNING",
    });
    return {
      productionId: operation.productionId,
      productionStepId: operation.id,
      result: updated,
    };
  });
}

export type PauseOperationCommand = CommandBase & {
  operationJobId: string;
  reason?: string;
};

export function pauseManufacturingOperation(
  prisma: ExtendedPrismaClient,
  input: PauseOperationCommand,
  access: OperateCommandAccess,
) {
  return executeManufacturingCommand(prisma, "pauseOperation", input, async (tx) => {
    const operation = await lockOperation(tx, input.operationJobId);
    assertExecutionEnabled(operation);
    assertExpectedRevision(operation.revision, input.expectedRevision);
    await assertActorMayAccessWorkCenter(tx, operation, input, access);
    assertActorMayOperate(operation, input, access);
    if (operation.operationState !== "RUNNING") badRequest("พักได้เฉพาะงานที่กำลังทำ");
    const updated = await tx.productionStep.update({
      where: { id: operation.id },
      data: { operationState: "READY", revision: { increment: 1 } },
      select: { id: true, operationState: true, revision: true },
    });
    await createOperationEvent(tx, {
      productionId: operation.productionId,
      productionStepId: operation.id,
      eventType: "PAUSED",
      commandId: input.commandId,
      actorId: input.actorId,
      fromState: "RUNNING",
      toState: "READY",
      ...(input.reason ? { payload: asJson({ reason: input.reason }) } : {}),
    });
    return {
      productionId: operation.productionId,
      productionStepId: operation.id,
      result: updated,
    };
  });
}

export type ReportOutputCommand = CommandBase &
  OutputDelta & {
    operationJobId: string;
    note?: string;
    quantityLines?: Array<
      OutputDelta & { quantityLineId: string; expectedRevision: number }
    >;
    reworkResolution?: {
      reworkCaseId: string;
      expectedRevision: number;
      qty: number;
      disposition: "GOOD" | "SCRAP";
    };
  };

export function reportManufacturingOutput(
  prisma: ExtendedPrismaClient,
  input: ReportOutputCommand,
  access: OperateCommandAccess,
) {
  return executeManufacturingCommand(prisma, "reportOutput", input, async (tx) => {
    const operation = await lockOperation(tx, input.operationJobId);
    assertExecutionEnabled(operation);
    assertOperationCanAdvance(operation);
    assertExpectedRevision(operation.revision, input.expectedRevision);
    await assertActorMayAccessWorkCenter(tx, operation, input, access);
    assertActorMayOperate(operation, input, access);
    if (!input.reworkResolution) {
      assertGenericExecutionAllowed(operation.operationCode, "report");
      if (input.qtyScrap > 0 || input.qtyRework > 0) {
        badRequest(
          "ผลเสียหรืองานแก้ต้องบันทึกผ่าน QC พร้อม disposition เท่านั้น",
        );
      }
    }
    if (
      operation.operationState !== "RUNNING" &&
      !(input.reworkResolution && operation.operationState === "READY")
    ) {
      badRequest("รายงานผลผลิตได้เฉพาะงานที่กำลังทำ");
    }
    if (
      input.reworkResolution &&
      operation.operationState === "READY" &&
      !operationPredecessorsComplete(
        operation.predecessorLinks.map(
          (link) => link.predecessorStep.operationState,
        ),
      )
    ) {
      badRequest("งานแก้ยังไม่เสร็จ จึงยังตรวจซ้ำไม่ได้");
    }
    if (operation.exceptions.length > 0) badRequest("งานยังมีปัญหาที่บล็อกอยู่");
    const quantityLineCount = await tx.operationQuantity.count({
      where: { productionStepId: operation.id },
    });
    if (
      quantityLineCount > 0 &&
      (!input.quantityLines || input.quantityLines.length === 0)
    ) {
      badRequest("ต้องบันทึกจำนวนแยกตามสินค้า สี ไซซ์ และจุดพิมพ์");
    }
    if (operation.workCenter?.code === "FINAL_PACK") {
      assertFinalPackOutput(input);
    }
    let delta = {
      qtyGood: input.qtyGood,
      qtyScrap: input.qtyScrap,
      qtyRework: input.qtyRework,
    };
    let reworkResolvedQty = 0;
    if (input.reworkResolution) {
      if (
        delta.qtyGood !== 0 ||
        delta.qtyScrap !== 0 ||
        delta.qtyRework !== 0
      ) {
        badRequest("ผลตรวจซ้ำต้องบันทึกแยกจากผลผลิตปกติ");
      }
      const rework = await tx.reworkCase.findUnique({
        where: { id: input.reworkResolution.reworkCaseId },
        select: {
          id: true,
          productionId: true,
          sourceOperationId: true,
          sourceQcDefect: {
            select: { operationQuantityId: true },
          },
          state: true,
          qty: true,
          revision: true,
        },
      });
      if (
        !rework ||
        rework.productionId !== operation.productionId ||
        rework.sourceOperationId !== operation.id
      ) {
        badRequest("Rework Case ไม่ได้รอตรวจซ้ำที่ Operation Job นี้");
      }
      assertExpectedRevision(rework.revision, input.reworkResolution.expectedRevision);
      if (rework.state !== "AWAITING_REINSPECTION") {
        badRequest("Rework Case ยังไม่พร้อมตรวจซ้ำ");
      }
      if (input.reworkResolution.qty > rework.qty) {
        badRequest("จำนวนที่ตรวจซ้ำเกินจำนวนคงเหลือใน Rework Case");
      }
      const sourceQuantityLineId = rework.sourceQcDefect?.operationQuantityId;
      if (sourceQuantityLineId) {
        const sourceLine = input.quantityLines?.find(
          (line) => line.quantityLineId === sourceQuantityLineId,
        );
        const otherLineHasOutput = input.quantityLines?.some(
          (line) =>
            line.quantityLineId !== sourceQuantityLineId &&
            (line.qtyGood > 0 || line.qtyScrap > 0 || line.qtyRework > 0),
        );
        if (
          !sourceLine ||
          sourceLine.qtyRework !== input.reworkResolution.qty ||
          otherLineHasOutput
        ) {
          badRequest("ผลตรวจซ้ำต้องลง quantity line เดียวกับของเสียต้นทาง");
        }
      }
      try {
        resolveReworkOutput({
          current: operation,
          qtyFromRework: input.reworkResolution.qty,
          disposition: input.reworkResolution.disposition,
        });
      } catch (error) {
        if (error instanceof ManufacturingDomainError) badRequest(error.message);
        throw error;
      }
      reworkResolvedQty = input.reworkResolution.qty;
      delta = {
        qtyGood:
          input.reworkResolution.disposition === "GOOD"
            ? input.reworkResolution.qty
            : 0,
        qtyScrap:
          input.reworkResolution.disposition === "SCRAP"
            ? input.reworkResolution.qty
            : 0,
        qtyRework: 0,
      };
      const reinspectedAt = new Date();
      const remainingCaseQty = rework.qty - reworkResolvedQty;
      await tx.reworkCase.update({
        where: { id: rework.id },
        data: {
          qty: remainingCaseQty,
          state:
            remainingCaseQty === 0
              ? "COMPLETED"
              : "AWAITING_REINSPECTION",
          reinspectedAt,
          ...(remainingCaseQty === 0 ? { completedAt: reinspectedAt } : {}),
          revision: { increment: 1 },
        },
      });
    } else {
      assertOutputDelta(operation, delta);
    }

    if (input.quantityLines?.length) {
      const lineSums = input.quantityLines.reduce<OutputDelta>(
        (sum, line) => ({
          qtyGood: sum.qtyGood + line.qtyGood,
          qtyScrap: sum.qtyScrap + line.qtyScrap,
          qtyRework: sum.qtyRework + line.qtyRework,
        }),
        { qtyGood: 0, qtyScrap: 0, qtyRework: 0 },
      );
      const lineSumsMatch = input.reworkResolution
        ? lineSums.qtyGood === delta.qtyGood &&
          lineSums.qtyScrap === delta.qtyScrap &&
          lineSums.qtyRework === reworkResolvedQty
        : lineSums.qtyGood === delta.qtyGood &&
          lineSums.qtyScrap === delta.qtyScrap &&
          lineSums.qtyRework === delta.qtyRework;
      if (!lineSumsMatch) {
        badRequest("ผลรวมต่อสินค้า/สี/ไซซ์/ตำแหน่งพิมพ์ไม่ตรงกับยอดรวม");
      }
      for (const lineDelta of input.quantityLines) {
        const line = await tx.operationQuantity.findUnique({
          where: { id: lineDelta.quantityLineId },
          select: {
            id: true,
            productionStepId: true,
            qtyPlanned: true,
            qtyGood: true,
            qtyScrap: true,
            qtyRework: true,
            revision: true,
          },
        });
        if (!line || line.productionStepId !== operation.id) {
          badRequest("ไม่พบ quantity line ใน Operation Job นี้");
        }
        assertExpectedRevision(line.revision, lineDelta.expectedRevision);
        if (input.reworkResolution) {
          if (
            (input.reworkResolution.disposition === "GOOD" &&
              (lineDelta.qtyGood !== lineDelta.qtyRework || lineDelta.qtyScrap !== 0)) ||
            (input.reworkResolution.disposition === "SCRAP" &&
              (lineDelta.qtyScrap !== lineDelta.qtyRework || lineDelta.qtyGood !== 0))
          ) {
            badRequest("ผลตรวจซ้ำต่อ quantity line ไม่ตรงกับ disposition");
          }
          try {
            resolveReworkOutput({
              current: line,
              qtyFromRework: lineDelta.qtyRework,
              disposition: input.reworkResolution.disposition,
            });
          } catch (error) {
            if (error instanceof ManufacturingDomainError) badRequest(error.message);
            throw error;
          }
        } else {
          assertOutputDelta(line, lineDelta);
        }
        await tx.operationQuantity.update({
          where: { id: line.id },
          data: {
            qtyGood: { increment: lineDelta.qtyGood },
            qtyScrap: { increment: lineDelta.qtyScrap },
            qtyRework: input.reworkResolution
              ? { decrement: lineDelta.qtyRework }
              : { increment: lineDelta.qtyRework },
            revision: { increment: 1 },
          },
        });
      }
    }

    const updated = await tx.productionStep.update({
      where: { id: operation.id },
      data: {
        ...(input.reworkResolution && operation.operationState === "READY"
          ? {
              operationState: "RUNNING" as const,
              status: "IN_PROGRESS" as const,
              assignedToId: operation.assignedToId ?? input.actorId,
              startedAt: operation.startedAt ?? new Date(),
            }
          : {}),
        qtyGood: { increment: delta.qtyGood },
        qtyScrap: { increment: delta.qtyScrap },
        qtyRework:
          reworkResolvedQty > 0
            ? { decrement: reworkResolvedQty }
            : { increment: delta.qtyRework },
        qtyDone: { increment: delta.qtyGood },
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
    await createOperationEvent(tx, {
      productionId: operation.productionId,
      productionStepId: operation.id,
      eventType: input.reworkResolution
        ? "QC_RECORDED"
        : operation.workCenter?.code === "FINAL_PACK"
          ? "PACK_RECORDED"
          : "OUTPUT_REPORTED",
      commandId: input.commandId,
      actorId: input.actorId,
      fromState: operation.operationState,
      toState: "RUNNING",
      qtyGoodDelta: delta.qtyGood,
      qtyScrapDelta: delta.qtyScrap,
      qtyReworkDelta: input.reworkResolution ? -reworkResolvedQty : delta.qtyRework,
      ...(input.note || input.reworkResolution
        ? {
            payload: asJson({
              ...(input.note ? { note: input.note } : {}),
              ...(input.reworkResolution
                ? {
                    reworkCaseId: input.reworkResolution.reworkCaseId,
                    disposition: input.reworkResolution.disposition,
                    qty: reworkResolvedQty,
                  }
                : {}),
            }),
          }
        : {}),
    });
    return {
      productionId: operation.productionId,
      productionStepId: operation.id,
      result: updated,
    };
  });
}

async function unlockReadySuccessors(
  tx: PrismaTx,
  operation: { id: string; productionId: string },
  command: CommandBase,
) {
  const links = await tx.operationJobDependency.findMany({
    where: { predecessorStepId: operation.id },
    select: {
      successorStep: {
        select: {
          id: true,
          productionId: true,
          operationState: true,
          executionEnabled: true,
          predecessorLinks: {
            select: { predecessorStep: { select: { operationState: true } } },
          },
          exceptions: {
            where: { state: { in: ["OPEN", "ACKNOWLEDGED"] }, blocksJob: true },
            select: { id: true },
          },
        },
      },
    },
  });
  let sequence = 1;
  for (const { successorStep } of links) {
    const dependenciesComplete = operationPredecessorsComplete(
      successorStep.predecessorLinks.map(
        (dependency) => dependency.predecessorStep.operationState,
      ),
    );
    if (
      successorStep.executionEnabled &&
      dependenciesComplete &&
      successorStep.exceptions.length === 0 &&
      ["PLANNED", "BLOCKED"].includes(successorStep.operationState)
    ) {
      const changed = await tx.productionStep.updateMany({
        where: {
          id: successorStep.id,
          operationState: successorStep.operationState,
        },
        data: {
          operationState: "READY",
          status: "PENDING",
          readyAt: new Date(),
          revision: { increment: 1 },
        },
      });
      if (changed.count > 0) {
        await createOperationEvent(tx, {
          productionId: successorStep.productionId,
          productionStepId: successorStep.id,
          eventType: "UNBLOCKED",
          commandId: command.commandId,
          sequence,
          actorId: command.actorId,
          fromState: successorStep.operationState,
          toState: "READY",
        });
        sequence += 1;
      }
    }
  }
}

export async function syncManufacturingOrderAfterCompletion(
  tx: PrismaTx,
  operation: {
    id: string;
    productionId: string;
    operationCode: string | null;
  },
  actorId: string,
) {
  const production = await tx.production.findUniqueOrThrow({
    where: { id: operation.productionId },
    select: {
      orderId: true,
      workOrderState: true,
      completionOwnerStepId: true,
      steps: {
        where: { executionEnabled: true },
        select: { id: true, operationCode: true, operationState: true },
      },
    },
  });
  const owner = await tx.order.findUniqueOrThrow({
    where: { id: production.orderId },
    select: { productionCompletionOwnerId: true },
  });
  const finalQc = production.steps.find((step) => step.operationCode === "FINAL_QC");
  const finalPackOperations = production.steps.filter(
    (step) => step.operationCode === "FINAL_PACK",
  );
  const finalPack = finalPackOperations[0];
  const allOperationsCompleted =
    production.steps.length > 0 &&
    production.steps.every((step) => step.operationState === "COMPLETED");
  if (
    finalPackOperations.length !== 1 ||
    !finalPack ||
    production.completionOwnerStepId !== finalPack.id ||
    owner.productionCompletionOwnerId !== operation.productionId
  ) {
    badRequest(
      "ใบสั่งผลิตไม่มีเจ้าของการปิดงานที่แน่นอน — หยุดเลื่อนสถานะออเดอร์และให้หัวหน้าตรวจใบผลิต",
    );
  }
  if (finalQc?.operationState === "READY") {
    await advanceOrderForward(tx, {
      orderId: production.orderId,
      target: "QUALITY_CHECK",
      changedBy: actorId,
      onlyFrom: ["PRODUCING"],
    });
  }
  if (operation.operationCode === "FINAL_QC") {
    await advanceOrderForward(tx, {
      orderId: production.orderId,
      target: "PACKING",
      changedBy: actorId,
      onlyFrom: ["QUALITY_CHECK"],
    });
  }
  if (operation.operationCode === "FINAL_PACK") {
    if (!allOperationsCompleted) {
      badRequest(
        "ยังมีขั้นงานที่ไม่เสร็จ จึงยืนยันพร้อมส่งไม่ได้ กรุณากลับไปดูคิวงาน",
      );
    }
    await advanceOrderForward(tx, {
      orderId: production.orderId,
      target: "READY_TO_SHIP",
      changedBy: actorId,
      onlyFrom: ["PACKING"],
    });
  }
  if (allOperationsCompleted) {
    await tx.production.update({
      where: { id: operation.productionId },
      data: {
        workOrderState: "COMPLETED",
        status: "COMPLETED",
        endDate: new Date(),
        completionOwnerStepId: finalPack.id,
        revision: { increment: 1 },
      },
    });
  }
}

export type CompleteOperationCommand = CommandBase & { operationJobId: string };

export function completeManufacturingOperation(
  prisma: ExtendedPrismaClient,
  input: CompleteOperationCommand,
  access: OperateCommandAccess,
) {
  return executeManufacturingCommand(prisma, "completeOperation", input, async (tx) => {
    const operation = await lockOperation(tx, input.operationJobId);
    assertExecutionEnabled(operation);
    assertOperationCanAdvance(operation);
    assertExpectedRevision(operation.revision, input.expectedRevision);
    await assertActorMayAccessWorkCenter(tx, operation, input, access);
    assertActorMayOperate(operation, input, access);
    if (
      !operationCanComplete({
        state: operation.operationState,
        qtyPlanned: operation.qtyPlanned,
        qtyGood: operation.qtyGood,
        qtyRework: operation.qtyRework,
        hasBlockingException: operation.exceptions.length > 0,
      })
    ) {
      badRequest("ปิดงานไม่ได้ — งานต้องกำลังทำ ของดีครบเป้า และไม่มีปัญหาค้าง");
    }
    if (
      operation.operationCode === "PREP" ||
      operation.stepType === "GARMENT_PICK" ||
      operation.stepType === "GARMENT_RECEIVE"
    ) {
      await assertPrepGarmentSurplusCleared(
        tx,
        operation.production.orderId,
      );
    }
    if (operation.reworkCaseId) {
      const rework = await tx.reworkCase.findUnique({
        where: { id: operation.reworkCaseId },
        select: { state: true },
      });
      if (rework?.state !== "IN_PROGRESS") {
        badRequest("Rework Case ไม่ได้อยู่สถานะกำลังทำ");
      }
    }
    const completedAt = new Date();
    const updated = await tx.productionStep.update({
      where: { id: operation.id },
      data: {
        operationState: "COMPLETED",
        status: "COMPLETED",
        completedAt,
        revision: { increment: 1 },
      },
      select: { id: true, operationState: true, completedAt: true, revision: true },
    });
    if (operation.reworkCaseId) {
      await tx.reworkCase.update({
        where: { id: operation.reworkCaseId },
        data: { state: "AWAITING_REINSPECTION", revision: { increment: 1 } },
      });
    }
    await createOperationEvent(tx, {
      productionId: operation.productionId,
      productionStepId: operation.id,
      eventType: "COMPLETED",
      commandId: input.commandId,
      actorId: input.actorId,
      fromState: operation.operationState,
      toState: "COMPLETED",
    });
    await unlockReadySuccessors(tx, operation, input);
    await syncManufacturingOrderAfterCompletion(tx, operation, input.actorId);
    return {
      productionId: operation.productionId,
      productionStepId: operation.id,
      result: updated,
    };
  });
}

export type RaiseExceptionCommand = CommandBase & {
  workOrderId: string;
  operationJobId?: string;
  category: string;
  title: string;
  severity: ExceptionSeverity;
  blocksJob: boolean;
  note?: string;
};

export function raiseManufacturingException(
  prisma: ExtendedPrismaClient,
  input: RaiseExceptionCommand,
  access: OperateCommandAccess,
) {
  return executeManufacturingCommand(prisma, "raiseException", input, async (tx) => {
    const operation = input.operationJobId
      ? await lockOperation(tx, input.operationJobId)
      : null;
    if (operation && operation.productionId !== input.workOrderId) {
      badRequest("Operation Job ไม่ได้อยู่ในใบสั่งผลิตนี้");
    }
    if (operation) {
      assertExecutionEnabled(operation);
      assertOperationCanAdvance(operation);
      await assertActorMayAccessWorkCenter(tx, operation, input, access);
    }
    if (!operation) await lockWorkOrder(tx, input.workOrderId);
    const production = await tx.production.findUniqueOrThrow({
      where: { id: input.workOrderId },
      select: {
        revision: true,
        workOrderState: true,
        order: { select: { internalStatus: true } },
      },
    });
    if (!operation) {
      assertManufacturingParentCanAdvance({ production });
    }
    assertExpectedRevision(operation?.revision ?? production.revision, input.expectedRevision);

    const exception = await tx.productionException.create({
      data: {
        productionId: input.workOrderId,
        productionStepId: operation?.id ?? null,
        workCenterId: operation?.workCenterId ?? null,
        code: input.category,
        title: input.title,
        description: input.note,
        severity: input.severity,
        blocksJob: input.blocksJob,
        state: "OPEN",
        disposition: input.blocksJob ? "HOLD" : null,
        raisedById: input.actorId,
      },
      select: {
        id: true,
        productionStepId: true,
        severity: true,
        state: true,
        blocksJob: true,
        revision: true,
      },
    });
    if (operation && input.blocksJob && !["COMPLETED", "CANCELLED"].includes(operation.operationState)) {
      await tx.productionStep.update({
        where: { id: operation.id },
        data: {
          operationState: "BLOCKED",
          status: "ON_HOLD",
          revision: { increment: 1 },
        },
      });
    } else if (!operation) {
      await tx.production.update({
        where: { id: input.workOrderId },
        data: { revision: { increment: 1 } },
      });
    }
    await createOperationEvent(tx, {
      productionId: input.workOrderId,
      productionStepId: operation?.id,
      eventType: "EXCEPTION_RAISED",
      commandId: input.commandId,
      actorId: input.actorId,
      fromState: operation?.operationState ?? null,
      toState: operation && input.blocksJob ? "BLOCKED" : operation?.operationState,
      payload: asJson({ exceptionId: exception.id, category: input.category }),
    });
    return {
      productionId: input.workOrderId,
      productionStepId: operation?.id,
      result: exception,
    };
  });
}

export type ResolveExceptionCommand = CommandBase & {
  exceptionId: string;
  resolution: string;
  disposition?: QualityDisposition;
};

export type DecideQcDispositionCommand = CommandBase & {
  exceptionId: string;
  disposition: "REWORK" | "SCRAP";
  note?: string;
};

export function decideQcDisposition(
  prisma: ExtendedPrismaClient,
  input: DecideQcDispositionCommand,
) {
  return executeManufacturingCommand(
    prisma,
    "decideQcDisposition",
    input,
    async (tx) => {
      const reference = await tx.productionException.findUnique({
        where: { id: input.exceptionId },
        select: {
          productionId: true,
          productionStepId: true,
          sourceQcDefectId: true,
        },
      });
      if (!reference) notFound("ปัญหาการผลิต", input.exceptionId);
      if (!reference.productionStepId || !reference.sourceQcDefectId) {
        badRequest("ปัญหานี้ไม่ได้ผูกกับ QC defect และ Operation Job");
      }

      const operation = await lockOperation(tx, reference.productionStepId);
      assertExecutionEnabled(operation);
      assertOperationCanAdvance(operation);
      if (
        operation.operationCode !== "FINAL_QC" &&
        operation.workCenter?.code !== "FINAL_QC"
      ) {
        badRequest("คำสั่งนี้ใช้ได้เฉพาะปัญหาจาก Final QC");
      }
      if (operation.operationState !== "BLOCKED") {
        badRequest("QC HOLD ต้องอยู่ในสถานะบล็อกก่อนตัดสิน disposition");
      }

      const current = await tx.productionException.findUniqueOrThrow({
        where: { id: input.exceptionId },
        select: {
          id: true,
          productionId: true,
          productionStepId: true,
          state: true,
          blocksJob: true,
          disposition: true,
          revision: true,
          sourceQcDefect: {
            select: {
              id: true,
              qty: true,
              disposition: true,
              operationQuantityId: true,
              qcRecord: { select: { productionStepId: true } },
            },
          },
        },
      });
      if (
        current.productionId !== operation.productionId ||
        current.productionStepId !== operation.id ||
        !current.sourceQcDefect ||
        current.sourceQcDefect.id !== reference.sourceQcDefectId ||
        current.sourceQcDefect.qcRecord.productionStepId !== operation.id
      ) {
        badRequest("QC defect ไม่ได้อยู่ในใบสั่งผลิตและ Operation Job เดียวกับปัญหา");
      }
      assertExpectedRevision(current.revision, input.expectedRevision);
      assertQcDispositionDecision({
        exceptionState: current.state,
        exceptionDisposition: current.disposition,
        defectDisposition: current.sourceQcDefect.disposition,
        blocksJob: current.blocksJob,
        defectQty: current.sourceQcDefect.qty,
        operationQuantityId: current.sourceQcDefect.operationQuantityId,
      });

      const quantityLine = await tx.operationQuantity.findUnique({
        where: { id: current.sourceQcDefect.operationQuantityId! },
        select: {
          id: true,
          productionStepId: true,
          qtyPlanned: true,
          qtyGood: true,
          qtyScrap: true,
          qtyRework: true,
          revision: true,
        },
      });
      if (!quantityLine || quantityLine.productionStepId !== operation.id) {
        badRequest("quantity line ของ QC defect ไม่ได้อยู่ใน Operation Job นี้");
      }
      if (
        quantityLine.qtyGood +
          quantityLine.qtyRework +
          current.sourceQcDefect.qty >
        quantityLine.qtyPlanned
      ) {
        badRequest("จำนวน HOLD เกินจำนวนคงเหลือของ quantity line");
      }

      const qty = current.sourceQcDefect.qty;
      const now = new Date();
      const updatedDefect = await tx.qcDefect.update({
        where: { id: current.sourceQcDefect.id },
        data: { disposition: input.disposition },
        select: { id: true, disposition: true },
      });
      const updatedQuantityLine = await tx.operationQuantity.update({
        where: { id: quantityLine.id },
        data: {
          ...(input.disposition === "REWORK"
            ? { qtyRework: { increment: qty } }
            : { qtyScrap: { increment: qty } }),
          revision: { increment: 1 },
        },
        select: {
          id: true,
          qtyScrap: true,
          qtyRework: true,
          revision: true,
        },
      });
      const updatedException = await tx.productionException.update({
        where: { id: current.id },
        data:
          input.disposition === "REWORK"
            ? {
                disposition: "REWORK",
                revision: { increment: 1 },
              }
            : {
                disposition: "SCRAP",
                state: "RESOLVED",
                resolution: input.note ?? "คัดทิ้งตามผล QC",
                ...(current.state === "OPEN" ? { acknowledgedAt: now } : {}),
                resolvedAt: now,
                revision: { increment: 1 },
              },
        select: {
          id: true,
          state: true,
          disposition: true,
          revision: true,
        },
      });

      let nextOperationState: OperationState = "BLOCKED";
      if (input.disposition === "SCRAP") {
        const otherBlockers = await tx.productionException.count({
          where: {
            productionStepId: operation.id,
            id: { not: current.id },
            blocksJob: true,
            state: { in: ["OPEN", "ACKNOWLEDGED"] },
          },
        });
        if (otherBlockers === 0) {
          const lastRaise = await tx.operationEvent.findFirst({
            where: {
              productionStepId: operation.id,
              eventType: "EXCEPTION_RAISED",
            },
            orderBy: [{ occurredAt: "desc" }, { sequence: "desc" }],
            select: { fromState: true },
          });
          nextOperationState =
            lastRaise?.fromState === "RUNNING" ? "RUNNING" : "READY";
        }
      }
      const updatedOperation = await tx.productionStep.update({
        where: { id: operation.id },
        data: {
          ...(input.disposition === "REWORK"
            ? { qtyRework: { increment: qty } }
            : { qtyScrap: { increment: qty } }),
          operationState: nextOperationState,
          status:
            nextOperationState === "BLOCKED"
              ? "ON_HOLD"
              : nextOperationState === "RUNNING"
                ? "IN_PROGRESS"
                : "PENDING",
          revision: { increment: 1 },
        },
        select: {
          id: true,
          operationState: true,
          qtyScrap: true,
          qtyRework: true,
          revision: true,
        },
      });
      await createOperationEvent(tx, {
        productionId: operation.productionId,
        productionStepId: operation.id,
        eventType: "QC_RECORDED",
        commandId: input.commandId,
        actorId: input.actorId,
        fromState: operation.operationState,
        toState: nextOperationState,
        qtyScrapDelta: input.disposition === "SCRAP" ? qty : 0,
        qtyReworkDelta: input.disposition === "REWORK" ? qty : 0,
        payload: asJson({
          action: "QC_DISPOSITION_DECIDED",
          exceptionId: current.id,
          qcDefectId: current.sourceQcDefect.id,
          quantityLineId: quantityLine.id,
          disposition: input.disposition,
          qty,
          ...(input.note ? { note: input.note } : {}),
        }),
      });

      return {
        productionId: operation.productionId,
        productionStepId: operation.id,
        result: {
          exception: updatedException,
          defect: updatedDefect,
          operation: updatedOperation,
          quantityLine: updatedQuantityLine,
          qty,
        },
      };
    },
  );
}

export function resolveManufacturingException(
  prisma: ExtendedPrismaClient,
  input: ResolveExceptionCommand,
) {
  return executeManufacturingCommand(prisma, "resolveException", input, async (tx) => {
    const reference = await tx.productionException.findUnique({
      where: { id: input.exceptionId },
      select: { productionId: true, productionStepId: true },
    });
    if (!reference) notFound("ปัญหาการผลิต", input.exceptionId);
    const operation = reference.productionStepId
      ? await lockOperation(tx, reference.productionStepId)
      : null;
    if (!operation) await lockWorkOrder(tx, reference.productionId);
    const current = await tx.productionException.findUniqueOrThrow({
      where: { id: input.exceptionId },
      select: {
        id: true,
        productionId: true,
        productionStepId: true,
        code: true,
        state: true,
        blocksJob: true,
        disposition: true,
        sourceQcDefect: {
          select: {
            disposition: true,
            reworkCase: { select: { id: true } },
          },
        },
        revision: true,
      },
    });
    assertExpectedRevision(current.revision, input.expectedRevision);
    if (!["OPEN", "ACKNOWLEDGED"].includes(current.state)) {
      badRequest("ปัญหานี้ถูกแก้หรือปิดแล้ว");
    }
    try {
      if (current.state === "OPEN") {
        assertExceptionTransition("OPEN", "ACKNOWLEDGED");
        assertExceptionTransition("ACKNOWLEDGED", "RESOLVED");
      } else {
        assertExceptionTransition(current.state, "RESOLVED");
      }
    } catch (error) {
      if (error instanceof ManufacturingDomainError) badRequest(error.message);
      throw error;
    }
    const resolutionDisposition =
      input.disposition ?? current.disposition ?? undefined;
    assertQualityExceptionResolution({
      category: current.code,
      blocksJob: current.blocksJob,
      disposition: resolutionDisposition,
      currentDisposition: current.disposition,
      sourceQcDefectDisposition: current.sourceQcDefect?.disposition,
      sourceQcDefectHasReworkCase: Boolean(current.sourceQcDefect?.reworkCase),
    });
    const resolvedAt = new Date();
    const updated = await tx.productionException.update({
      where: { id: current.id },
      data: {
        state: "RESOLVED",
        resolution: input.resolution,
        ...(input.disposition ? { disposition: input.disposition } : {}),
        ...(current.state === "OPEN" ? { acknowledgedAt: resolvedAt } : {}),
        resolvedAt,
        revision: { increment: 1 },
      },
      select: {
        id: true,
        state: true,
        disposition: true,
        resolution: true,
        resolvedAt: true,
        revision: true,
      },
    });
    if (operation && current.blocksJob) {
      const otherBlockers = await tx.productionException.count({
        where: {
          productionStepId: operation.id,
          id: { not: current.id },
          blocksJob: true,
          state: { in: ["OPEN", "ACKNOWLEDGED"] },
        },
      });
      if (otherBlockers === 0 && operation.operationState === "BLOCKED") {
        const lastRaise = await tx.operationEvent.findFirst({
          where: { productionStepId: operation.id, eventType: "EXCEPTION_RAISED" },
          orderBy: [{ occurredAt: "desc" }, { sequence: "desc" }],
          select: { fromState: true },
        });
        const restoreState: OperationState =
          lastRaise?.fromState === "RUNNING" ? "RUNNING" : "READY";
        await tx.productionStep.update({
          where: { id: operation.id },
          data: {
            operationState: restoreState,
            status: restoreState === "RUNNING" ? "IN_PROGRESS" : "PENDING",
            revision: { increment: 1 },
          },
        });
      }
    }
    await createOperationEvent(tx, {
      productionId: current.productionId,
      productionStepId: current.productionStepId,
      eventType: "EXCEPTION_RESOLVED",
      commandId: input.commandId,
      actorId: input.actorId,
      fromState: operation?.operationState,
      toState: operation?.operationState,
      payload: asJson({
        exceptionId: current.id,
        disposition: resolutionDisposition,
      }),
    });
    return {
      productionId: current.productionId,
      productionStepId: current.productionStepId,
      result: updated,
    };
  });
}

export type PlanReworkCommand = CommandBase & {
  workOrderId: string;
  sourceOperationJobId: string;
  qcDefectId?: string;
  sourceExceptionId?: string;
  targetWorkCenterId: string;
  qty: number;
  reason: string;
};

export function planManufacturingRework(
  prisma: ExtendedPrismaClient,
  input: PlanReworkCommand,
) {
  return executeManufacturingCommand(prisma, "planRework", input, async (tx) => {
    const operation = await lockOperation(tx, input.sourceOperationJobId);
    if (operation.productionId !== input.workOrderId) {
      badRequest("Operation Job ไม่ได้อยู่ในใบสั่งผลิตนี้");
    }
    assertOperationCanAdvance(operation);
    assertExpectedRevision(operation.revision, input.expectedRevision);
    if (input.qty <= 0) badRequest("จำนวนงานแก้ต้องมากกว่า 0");
    if (["COMPLETED", "CANCELLED"].includes(operation.operationState)) {
      badRequest("งานที่ปิดแล้วไม่สามารถวางแผน Rework ย้อนหลังได้");
    }
    const isQcRework = ["FINAL_QC", "OUTSOURCE"].includes(
      operation.operationCode ?? operation.workCenter?.code ?? "",
    );
    if (isQcRework && (!input.qcDefectId || !input.sourceExceptionId)) {
      badRequest("QC Rework ต้องระบุทั้งของเสียและปัญหาต้นทาง");
    }
    if (input.qty > operation.qtyRework) {
      badRequest("จำนวนงานแก้เกินจำนวนที่รอแก้ใน Operation Job");
    }
    const allocated = await tx.reworkCase.aggregate({
      where: {
        sourceOperationId: operation.id,
        state: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      _sum: { qty: true },
    });
    const openAllocatedQty = allocated._sum.qty ?? 0;
    if (input.qty > operation.qtyRework - openAllocatedQty) {
      badRequest("จำนวนงานแก้เกินยอดรอแก้ที่ยังไม่ได้วางแผน");
    }
    const target = await tx.workCenter.findUnique({
      where: { id: input.targetWorkCenterId },
      select: { isActive: true },
    });
    if (!target?.isActive) badRequest("Work Center งานแก้ไม่พร้อมใช้งาน");

    let sourceQcRecordId: string | null = null;
    let sourceQcDefectId = input.qcDefectId ?? null;
    if (input.sourceExceptionId) {
      const exception = await tx.productionException.findUnique({
        where: { id: input.sourceExceptionId },
        select: {
          productionId: true,
          productionStepId: true,
          sourceQcDefectId: true,
          state: true,
          disposition: true,
        },
      });
      if (exception?.productionId !== input.workOrderId) {
        badRequest("ปัญหาต้นทางไม่ได้อยู่ในใบสั่งผลิตนี้");
      }
      if (exception.productionStepId && exception.productionStepId !== operation.id) {
        badRequest("ปัญหาต้นทางไม่ได้ผูกกับ Operation Job นี้");
      }
      if (!["OPEN", "ACKNOWLEDGED"].includes(exception.state)) {
        badRequest("ปัญหาต้นทางถูกแก้หรือปิดแล้ว");
      }
      if (
        sourceQcDefectId &&
        exception.sourceQcDefectId &&
        sourceQcDefectId !== exception.sourceQcDefectId
      ) {
        badRequest("รายการของเสีย QC ไม่ตรงกับปัญหาต้นทาง");
      }
      if (isQcRework && exception.disposition !== "REWORK") {
        badRequest("ปัญหา QC นี้ไม่ได้ถูกเลือก disposition เป็น Rework");
      }
      sourceQcDefectId = sourceQcDefectId ?? exception.sourceQcDefectId;
      await tx.productionException.update({
        where: { id: input.sourceExceptionId },
        data: {
          disposition: "REWORK",
          ...(sourceQcDefectId ? { sourceQcDefectId } : {}),
          revision: { increment: 1 },
        },
      });
    }
    if (sourceQcDefectId) {
      const defect = await tx.qcDefect.findUnique({
        where: { id: sourceQcDefectId },
        select: {
          qty: true,
          disposition: true,
          operationQuantityId: true,
          qcRecordId: true,
          qcRecord: { select: { productionStepId: true } },
          reworkCase: { select: { id: true } },
        },
      });
      if (!defect) notFound("รายการของเสีย QC", sourceQcDefectId);
      if (defect.reworkCase) badRequest("รายการของเสียนี้มี Rework Case แล้ว");
      if (isQcRework && defect.disposition !== "REWORK") {
        badRequest("ของเสีย QC นี้ไม่ได้ถูกเลือก disposition เป็น Rework");
      }
      if (isQcRework && !defect.operationQuantityId) {
        badRequest("ของเสีย QC นี้ไม่มี quantity line ต้นทางสำหรับตรวจซ้ำ");
      }
      if (isQcRework && input.qty !== defect.qty) {
        badRequest("QC Rework ต้องวางแผนเต็มจำนวนของเสียต้นทาง");
      }
      if (!isQcRework && input.qty > defect.qty) {
        badRequest("จำนวนงานแก้เกินจำนวนของเสียที่ตรวจพบ");
      }
      if (defect.qcRecord.productionStepId !== operation.id) {
        badRequest("รายการของเสีย QC ไม่ได้ผูกกับ Operation Job นี้");
      }
      sourceQcRecordId = defect.qcRecordId;
      await tx.qcDefect.update({
        where: { id: sourceQcDefectId },
        data: { disposition: "REWORK" },
      });
    }
    const rework = await tx.reworkCase.create({
      data: {
        productionId: input.workOrderId,
        sourceOperationId: operation.id,
        sourceQcRecordId,
        sourceQcDefectId,
        sourceExceptionId: input.sourceExceptionId ?? null,
        targetWorkCenterId: input.targetWorkCenterId,
        state: "PLANNED",
        qty: input.qty,
        reason: input.reason,
        plannedById: input.actorId,
      },
      select: { id: true, state: true, qty: true, revision: true },
    });
    if (!["COMPLETED", "CANCELLED"].includes(operation.operationState)) {
      await tx.productionStep.update({
        where: { id: operation.id },
        data: {
          operationState: "BLOCKED",
          status: "ON_HOLD",
          revision: { increment: 1 },
        },
      });
    }
    await createOperationEvent(tx, {
      productionId: operation.productionId,
      productionStepId: operation.id,
      eventType: "REWORK_PLANNED",
      commandId: input.commandId,
      actorId: input.actorId,
      fromState: operation.operationState,
      toState: "BLOCKED",
      payload: asJson({ reworkCaseId: rework.id, qty: input.qty }),
    });
    return {
      productionId: operation.productionId,
      productionStepId: operation.id,
      result: rework,
    };
  });
}

export type ReleaseReworkCommand = CommandBase & { reworkCaseId: string };

export function releaseManufacturingRework(
  prisma: ExtendedPrismaClient,
  input: ReleaseReworkCommand,
) {
  return executeManufacturingCommand(prisma, "releaseRework", input, async (tx) => {
    const reference = await tx.reworkCase.findUnique({
      where: { id: input.reworkCaseId },
      select: { productionId: true },
    });
    if (!reference) notFound("Rework Case", input.reworkCaseId);
    await lockWorkOrder(tx, reference.productionId);
    const rework = await tx.reworkCase.findUniqueOrThrow({
      where: { id: input.reworkCaseId },
      select: {
        id: true,
        productionId: true,
        sourceOperationId: true,
        sourceQcDefectId: true,
        sourceQcDefect: {
          select: {
            id: true,
            operationQuantityId: true,
            operationQuantity: {
              select: {
                id: true,
                productionId: true,
                productionStepId: true,
                scopeKey: true,
                scopeKind: true,
                sourceOrderItemId: true,
                sourceOrderItemProductId: true,
                sourceOrderItemVariantId: true,
                sourceOrderItemPrintId: true,
                description: true,
                sku: true,
                size: true,
                color: true,
                printPosition: true,
                referenceSnapshot: true,
              },
            },
          },
        },
        targetWorkCenterId: true,
        targetWorkCenter: { select: { code: true, isActive: true } },
        state: true,
        qty: true,
        reason: true,
        revision: true,
        production: {
          select: {
            workOrderState: true,
            order: { select: { internalStatus: true } },
          },
        },
      },
    });
    assertManufacturingParentCanAdvance(rework);
    assertExpectedRevision(rework.revision, input.expectedRevision);
    if (rework.state !== "PLANNED") badRequest("Release ได้เฉพาะ Rework ที่วางแผนแล้ว");
    if (!rework.targetWorkCenter.isActive) {
      badRequest("Work Center งานแก้ไม่พร้อมใช้งาน");
    }
    const isExternalOutsource = rework.targetWorkCenter.code === "OUTSOURCE";
    const sourceQuantityLine = rework.sourceQcDefect?.operationQuantity ?? null;
    if (
      isExternalOutsource &&
      (!rework.sourceQcDefectId ||
        !sourceQuantityLine ||
        sourceQuantityLine.productionId !== rework.productionId ||
        sourceQuantityLine.productionStepId !== rework.sourceOperationId)
    ) {
      badRequest(
        "งานแก้ร้านนอกต้องมี quantity line ที่ผูกกับ QC defect ต้นทาง",
      );
    }
    const lastStep = await tx.productionStep.findFirst({
      where: { productionId: rework.productionId },
      orderBy: [{ sortOrder: "desc" }, { id: "desc" }],
      select: { sortOrder: true, dispatchSequence: true },
    });
    const now = new Date();
    const operation = await tx.productionStep.create({
      data: {
        productionId: rework.productionId,
        stepType: "CUSTOM",
        customStepName: isExternalOutsource ? "ส่งแก้งานร้านนอก" : "งานแก้",
        status: "PENDING",
        sortOrder: (lastStep?.sortOrder ?? 0) + 1,
        operationCode: isExternalOutsource
          ? "OUTSOURCE"
          : `REWORK-${rework.id.slice(-8).toUpperCase()}`,
        operationName: isExternalOutsource ? "ส่งแก้งานร้านนอก" : "งานแก้",
        operationState: "READY",
        executionMode: isExternalOutsource ? "OUTSOURCE" : "IN_HOUSE",
        operationPhase: isExternalOutsource ? "OUTSOURCE" : "MANUFACTURING",
        workCenterId: rework.targetWorkCenterId,
        reworkCaseId: rework.id,
        dispatchSequence: (lastStep?.dispatchSequence ?? 0) + 1,
        qtyPlanned: rework.qty,
        qtyTotal: rework.qty,
        readyAt: now,
        executionEnabled: true,
        instructionSnapshot: asJson({
          reason: rework.reason,
          ...(isExternalOutsource
            ? {
                reworkCaseId: rework.id,
                sourceQcDefectId: rework.sourceQcDefectId,
                sourceOperationQuantityId: sourceQuantityLine!.id,
              }
            : {}),
        }),
        ...(isExternalOutsource
          ? {
              referenceSnapshot: asJson({
                reworkCaseId: rework.id,
                sourceQcDefectId: rework.sourceQcDefectId,
                sourceOperationQuantityId: sourceQuantityLine!.id,
              }),
            }
          : {}),
      },
      select: {
        id: true,
        operationCode: true,
        operationState: true,
        executionMode: true,
        workCenterId: true,
        reworkCaseId: true,
        revision: true,
      },
    });
    const quantityLine = isExternalOutsource
      ? await tx.operationQuantity.create({
          data: {
            productionId: rework.productionId,
            productionStepId: operation.id,
            scopeKey: sourceQuantityLine!.scopeKey,
            scopeKind: sourceQuantityLine!.scopeKind,
            sourceOrderItemId: sourceQuantityLine!.sourceOrderItemId,
            sourceOrderItemProductId:
              sourceQuantityLine!.sourceOrderItemProductId,
            sourceOrderItemVariantId:
              sourceQuantityLine!.sourceOrderItemVariantId,
            sourceOrderItemPrintId: sourceQuantityLine!.sourceOrderItemPrintId,
            description: sourceQuantityLine!.description,
            sku: sourceQuantityLine!.sku,
            size: sourceQuantityLine!.size,
            color: sourceQuantityLine!.color,
            printPosition: sourceQuantityLine!.printPosition,
            qtyPlanned: rework.qty,
            referenceSnapshot: asJson({
              source: sourceQuantityLine!.referenceSnapshot,
              reworkCaseId: rework.id,
              sourceQcDefectId: rework.sourceQcDefectId,
              sourceOperationQuantityId: sourceQuantityLine!.id,
            }),
          },
          select: {
            id: true,
            scopeKey: true,
            qtyPlanned: true,
            revision: true,
          },
        })
      : null;
    if (rework.sourceOperationId) {
      await tx.operationJobDependency.create({
        data: {
          predecessorStepId: operation.id,
          successorStepId: rework.sourceOperationId,
        },
      });
    }
    const updated = await tx.reworkCase.update({
      where: { id: rework.id },
      data: {
        state: "RELEASED",
        releasedById: input.actorId,
        releasedAt: now,
        revision: { increment: 1 },
      },
      select: { id: true, state: true, releasedAt: true, revision: true },
    });
    await createOperationEvent(tx, {
      productionId: rework.productionId,
      productionStepId: operation.id,
      eventType: "REWORK_RELEASED",
      commandId: input.commandId,
      actorId: input.actorId,
      fromState: "PLANNED",
      toState: "READY",
      payload: asJson({
        reworkCaseId: rework.id,
        sourceOperationId: rework.sourceOperationId,
        executionMode: isExternalOutsource ? "OUTSOURCE" : "IN_HOUSE",
        ...(quantityLine
          ? {
              quantityLineId: quantityLine.id,
              sourceOperationQuantityId: sourceQuantityLine!.id,
            }
          : {}),
      }),
    });
    return {
      productionId: rework.productionId,
      productionStepId: operation.id,
      result: { rework: updated, operation, quantityLine },
    };
  });
}
