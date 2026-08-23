import type {
  ExceptionSeverity,
  ExceptionState,
  InternalStatus,
  OperationState,
  Prisma,
  WorkOrderState,
} from "@prisma/client";
import type { ExtendedPrismaClient } from "@/lib/prisma";
import { forbidden } from "@/server/errors";
import { availableOperationCommands, dueRiskOf } from "./manufacturing-command-policy";
import { assertRoutingConvergesToFinalPack } from "./manufacturing-domain";
import { getPrepGarmentSurplus } from "./manufacturing-prep-readiness";

export type ManufacturingReadAccess = {
  actorId: string;
  canOperate: boolean;
  canSupervise: boolean;
};

const ACTIVE_OPERATION_STATES: OperationState[] = [
  "PLANNED",
  "READY",
  "RUNNING",
  "BLOCKED",
];
const OPEN_EXCEPTION_STATES: ExceptionState[] = ["OPEN", "ACKNOWLEDGED"];
const ACTIVE_STATION_WORK_ORDER_STATES: WorkOrderState[] = ["RELEASED", "IN_PROGRESS"];
const ACTIVE_STATION_ORDER_STATUSES: InternalStatus[] = [
  "PRODUCTION_QUEUE",
  "PRODUCING",
  "QUALITY_CHECK",
  "PACKING",
];
const RELEASE_READY_ORDER_STATUSES: InternalStatus[] = [
  "DESIGN_APPROVED",
  "PRODUCTION_QUEUE",
  "PRODUCING",
];

type ManufacturingParentState = {
  workOrderState: WorkOrderState;
  order: { internalStatus: InternalStatus };
};

type ManufacturingAdvanceOperation = {
  executionEnabled: boolean;
  operationCode: string | null;
  operationState: OperationState;
  qtyRework: number;
  workCenter: { code: string; isActive: boolean } | null;
};

function manufacturingParentCanAdvance(parent: ManufacturingParentState) {
  return ACTIVE_STATION_WORK_ORDER_STATES.includes(parent.workOrderState) &&
    ACTIVE_STATION_ORDER_STATUSES.includes(parent.order.internalStatus);
}

function operationCanAdvance(
  parent: ManufacturingParentState,
  operation: ManufacturingAdvanceOperation | null | undefined,
) {
  return Boolean(
    operation &&
      manufacturingParentCanAdvance(parent) &&
      operation.workCenter?.isActive !== false,
  );
}

function exceptionCanResolve(input: {
  code: string | null;
  blocksJob: boolean;
  disposition: string | null;
  sourceQcDefect: {
    disposition: string | null;
    hasReworkCase: boolean;
  } | null;
}) {
  const isQualityException = /QC|QUALITY|DEFECT/i.test(input.code ?? "");
  if (
    input.blocksJob &&
    isQualityException &&
    (!input.disposition || input.disposition === "HOLD")
  ) {
    return false;
  }
  if (
    input.sourceQcDefect &&
    input.sourceQcDefect.disposition !== input.disposition
  ) {
    return false;
  }
  return !(
    input.sourceQcDefect?.disposition === "REWORK" &&
    !input.sourceQcDefect.hasReworkCase
  );
}

const activeStationProductionWhere = {
  workOrderState: { in: ACTIVE_STATION_WORK_ORDER_STATES },
  order: { internalStatus: { in: ACTIVE_STATION_ORDER_STATUSES } },
} satisfies Prisma.ProductionWhereInput;

const activeStationResourceWhere = {
  OR: [
    { workResourceId: null },
    {
      workResource: {
        is: {
          isActive: true,
          state: { in: ["AVAILABLE" as const, "IN_USE" as const] },
        },
      },
    },
  ],
} satisfies Prisma.ProductionStepWhereInput;

const orderIdentitySelect = {
  id: true,
  orderNumber: true,
  title: true,
  deadline: true,
  priority: true,
  internalStatus: true,
  customer: { select: { name: true } },
} satisfies Prisma.OrderSelect;

const operationSummarySelect = {
  id: true,
  operationCode: true,
  operationName: true,
  operationState: true,
  executionMode: true,
  executionEnabled: true,
  routingOperationId: true,
  dispatchSequence: true,
  revision: true,
  qtyPlanned: true,
  qtyGood: true,
  qtyScrap: true,
  qtyRework: true,
  plannedStartAt: true,
  plannedEndAt: true,
  readyAt: true,
  startedAt: true,
  completedAt: true,
  assignedToId: true,
  assignedTo: { select: { id: true, name: true } },
  workCenter: {
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
      resources: {
        where: {
          isActive: true,
          state: { notIn: ["DOWN" as const, "INACTIVE" as const] },
        },
        orderBy: [{ code: "asc" as const }, { id: "asc" as const }],
        select: { id: true, code: true, name: true, state: true },
      },
    },
  },
  workResource: {
    select: { id: true, code: true, name: true, isActive: true, state: true },
  },
  exceptions: {
    where: { state: { in: OPEN_EXCEPTION_STATES } },
    select: { id: true, severity: true, title: true, state: true, blocksJob: true },
  },
  predecessorLinks: {
    select: { predecessorStep: { select: { operationState: true } } },
  },
} satisfies Prisma.ProductionStepSelect;

type OperationSummaryRow = Prisma.ProductionStepGetPayload<{
  select: typeof operationSummarySelect;
}>;

function operationSummary(
  row: OperationSummaryRow,
  access: ManufacturingReadAccess,
  parent: ManufacturingParentState,
) {
  const hasBlockingException = row.exceptions.some((exception) => exception.blocksJob);
  return {
    id: row.id,
    code: row.operationCode ?? "LEGACY",
    name: row.operationName ?? "ขั้นงาน",
    state: row.operationState,
    executionMode: row.executionMode,
    dispatchSequence: row.dispatchSequence,
    revision: row.revision,
    quantities: {
      planned: row.qtyPlanned,
      good: row.qtyGood,
      scrap: row.qtyScrap,
      rework: row.qtyRework,
      remaining: Math.max(0, row.qtyPlanned - row.qtyGood),
    },
    plannedStartAt: row.plannedStartAt,
    plannedEndAt: row.plannedEndAt,
    readyAt: row.readyAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    assignee: row.assignedTo,
    workCenter: row.workCenter,
    resource: row.workResource
      ? {
          id: row.workResource.id,
          code: row.workResource.code,
          name: row.workResource.name,
        }
      : null,
    blockers: row.exceptions.filter((exception) => exception.blocksJob),
    availableCommands: availableOperationCommands({
      operationCode: row.operationCode,
      state: row.operationState,
      executionEnabled: row.executionEnabled,
      qtyPlanned: row.qtyPlanned,
      qtyGood: row.qtyGood,
      qtyRework: row.qtyRework,
      hasBlockingException,
      dependenciesComplete: row.predecessorLinks.every(
        (link) => link.predecessorStep.operationState === "COMPLETED",
      ),
      assignedToId: row.assignedToId,
      actorId: access.actorId,
      canOperate: access.canOperate,
      canSupervise: access.canSupervise,
      workOrderState: parent.workOrderState,
      orderStatus: parent.order.internalStatus,
      workCenterActive: row.workCenter?.isActive ?? null,
    }),
  };
}

export type ControlListInput = {
  query?: string;
  state?: WorkOrderState;
  workCenterId?: string;
  assigneeId?: string;
  exceptionState?: ExceptionState;
  sort?: "priority" | "dueDate" | "updatedAt";
  cursor?: string;
  limit: number;
};

export const MANUFACTURING_PRIORITY_ORDER = [
  "URGENT",
  "HIGH",
  "NORMAL",
  "LOW",
] as const;

const controlListSelect = {
  id: true,
  workOrderNumber: true,
  workOrderState: true,
  revision: true,
  plannedStartAt: true,
  plannedEndAt: true,
  updatedAt: true,
  order: { select: orderIdentitySelect },
  steps: {
    where: { executionEnabled: true },
    orderBy: [{ dispatchSequence: "asc" as const }, { sortOrder: "asc" as const }, { id: "asc" as const }],
    select: operationSummarySelect,
  },
  exceptions: {
    where: { state: { in: OPEN_EXCEPTION_STATES } },
    select: { id: true },
  },
} satisfies Prisma.ProductionSelect;

export async function getManufacturingControlList(
  prisma: ExtendedPrismaClient,
  input: ControlListInput,
  access: ManufacturingReadAccess,
) {
  const query = input.query?.trim();
  const where: Prisma.ProductionWhereInput = {
    workOrderNumber: { not: null },
    ...(input.state ? { workOrderState: input.state } : {}),
    ...(input.workCenterId || input.assigneeId
      ? {
          steps: {
            some: {
              executionEnabled: true,
              ...(input.workCenterId ? { workCenterId: input.workCenterId } : {}),
              ...(input.assigneeId ? { assignedToId: input.assigneeId } : {}),
            },
          },
        }
      : {}),
    ...(input.exceptionState
      ? { exceptions: { some: { state: input.exceptionState } } }
      : {}),
    ...(query
      ? {
          OR: [
            { workOrderNumber: { contains: query, mode: "insensitive" } },
            { order: { orderNumber: { contains: query, mode: "insensitive" } } },
            { order: { title: { contains: query, mode: "insensitive" } } },
            { order: { customer: { name: { contains: query, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.ProductionOrderByWithRelationInput[] =
    input.sort === "updatedAt"
      ? [{ updatedAt: "desc" }, { id: "asc" }]
      : [
            { order: { deadline: { sort: "asc", nulls: "last" } } },
            { id: "asc" },
          ];

  let rows: Prisma.ProductionGetPayload<{ select: typeof controlListSelect }>[];
  if (input.sort === "priority") {
    let cursorPriority: string | null = null;
    if (input.cursor) {
      const cursorRow = await prisma.production.findUnique({
        where: { id: input.cursor },
        select: { order: { select: { priority: true } } },
      });
      cursorPriority = cursorRow?.order.priority ?? null;
    }
    const cursorBucketIndex = cursorPriority
      ? MANUFACTURING_PRIORITY_ORDER.indexOf(
          cursorPriority as (typeof MANUFACTURING_PRIORITY_ORDER)[number],
        )
      : 0;
    const firstBucketIndex = cursorBucketIndex >= 0 ? cursorBucketIndex : 0;
    rows = [];
    for (
      let index = firstBucketIndex;
      index < MANUFACTURING_PRIORITY_ORDER.length && rows.length < input.limit + 1;
      index += 1
    ) {
      const priority = MANUFACTURING_PRIORITY_ORDER[index];
      const inCursorBucket = Boolean(input.cursor) && index === firstBucketIndex;
      const batch = await prisma.production.findMany({
        where: { ...where, order: { priority } },
        orderBy: [
          { order: { deadline: { sort: "asc", nulls: "last" } } },
          { id: "asc" },
        ],
        take: input.limit + 1 - rows.length,
        ...(inCursorBucket ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: controlListSelect,
      });
      rows.push(...batch);
    }
  } else {
    rows = await prisma.production.findMany({
      where,
      orderBy,
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: controlListSelect,
    });
  }
  const hasMore = rows.length > input.limit;
  const page = hasMore ? rows.slice(0, input.limit) : rows;

  return {
    items: page.map((row) => {
      const operations = row.steps.map((step) =>
        operationSummary(step, access, row),
      );
      const currentOperations = operations.filter((operation) =>
        ["READY", "RUNNING", "BLOCKED"].includes(operation.state),
      );
      return {
        id: row.id,
        workOrderNumber: row.workOrderNumber,
        state: row.workOrderState,
        revision: row.revision,
        order: {
          id: row.order.id,
          orderNumber: row.order.orderNumber,
          title: row.order.title,
          customerName: row.order.customer.name,
          deadline: row.order.deadline,
          priority: row.order.priority,
        },
        plannedStartAt: row.plannedStartAt,
        plannedEndAt: row.plannedEndAt,
        progress: {
          operationsCompleted: operations.filter((operation) => operation.state === "COMPLETED")
            .length,
          operationsTotal: operations.length,
          qtyPlanned: operations.reduce((sum, operation) => sum + operation.quantities.planned, 0),
          qtyGood: operations.reduce((sum, operation) => sum + operation.quantities.good, 0),
          qtyScrap: operations.reduce((sum, operation) => sum + operation.quantities.scrap, 0),
          qtyRework: operations.reduce((sum, operation) => sum + operation.quantities.rework, 0),
        },
        currentOperations,
        openExceptionCount: row.exceptions.length,
        dueRisk: dueRiskOf(row.order.deadline, row.workOrderState),
        updatedAt: row.updatedAt,
      };
    }),
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  };
}

export async function getManufacturingWorkOrder(
  prisma: ExtendedPrismaClient,
  workOrderId: string,
  access: ManufacturingReadAccess,
) {
  const row = await prisma.production.findUnique({
    where: { id: workOrderId },
    select: {
      id: true,
      workOrderNumber: true,
      workOrderState: true,
      revision: true,
      plannedStartAt: true,
      plannedEndAt: true,
      releasedAt: true,
      routingVersionId: true,
      routingSnapshot: true,
      instructionSnapshot: true,
      approvedMockupSnapshot: true,
      routingVersion: {
        select: {
          state: true,
          operations: { select: { id: true } },
        },
      },
      order: {
        select: {
          ...orderIdentitySelect,
          designs: {
            where: { approvalStatus: "APPROVED" },
            orderBy: { versionNumber: "desc" },
            take: 1,
            select: { id: true, versionNumber: true },
          },
        },
      },
      steps: {
        where: { executionEnabled: true },
        orderBy: [{ dispatchSequence: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
        select: operationSummarySelect,
      },
      quantityLines: {
        orderBy: [{ productionStepId: "asc" }, { scopeKey: "asc" }],
        select: {
          id: true,
          productionStepId: true,
          scopeKey: true,
          scopeKind: true,
          description: true,
          sku: true,
          size: true,
          color: true,
          printPosition: true,
          qtyPlanned: true,
          qtyGood: true,
          qtyScrap: true,
          qtyRework: true,
          revision: true,
        },
      },
      events: {
        orderBy: [{ occurredAt: "desc" }, { sequence: "desc" }],
        take: 200,
        select: {
          id: true,
          productionStepId: true,
          eventType: true,
          actorId: true,
          fromState: true,
          toState: true,
          qtyGoodDelta: true,
          qtyScrapDelta: true,
          qtyReworkDelta: true,
          occurredAt: true,
        },
      },
      exceptions: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          productionStepId: true,
          workCenterId: true,
          code: true,
          title: true,
          description: true,
          severity: true,
          state: true,
          blocksJob: true,
          disposition: true,
          sourceQcDefect: {
            select: {
              id: true,
              operationQuantityId: true,
              qty: true,
              disposition: true,
              operationQuantity: {
                select: { productionId: true, productionStepId: true },
              },
            },
          },
          ownerId: true,
          resolution: true,
          revision: true,
          createdAt: true,
          acknowledgedAt: true,
          resolvedAt: true,
        },
      },
      reworkCases: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          sourceOperationId: true,
          sourceQcRecordId: true,
          sourceQcDefectId: true,
          sourceQcDefect: {
            select: {
              id: true,
              operationQuantityId: true,
              qty: true,
              disposition: true,
              operationQuantity: {
                select: { productionId: true, productionStepId: true },
              },
            },
          },
          sourceExceptionId: true,
          targetWorkCenterId: true,
          targetWorkCenter: {
            select: { code: true, isActive: true },
          },
          state: true,
          qty: true,
          reason: true,
          requiresReinspection: true,
          revision: true,
          releasedAt: true,
          completedAt: true,
        },
      },
    },
  });
  if (!row) return null;

  const dependencyRows = await prisma.operationJobDependency.findMany({
    where: {
      OR: [
        { predecessorStep: { productionId: workOrderId } },
        { successorStep: { productionId: workOrderId } },
      ],
    },
    select: { predecessorStepId: true, successorStepId: true },
  });
  const reworkDefectIds = new Set(
    row.reworkCases.flatMap((rework) =>
      rework.sourceQcDefectId ? [rework.sourceQcDefectId] : [],
    ),
  );
  const releaseBlockers: string[] = [];
  if (row.workOrderState === "DRAFT") {
    if (!RELEASE_READY_ORDER_STATUSES.includes(row.order.internalStatus)) {
      releaseBlockers.push("สถานะออเดอร์ยังไม่พร้อมเริ่มผลิต");
    }
    if (!row.workOrderNumber) releaseBlockers.push("ยังไม่มีเลขใบสั่งผลิต");
    if (!row.routingVersionId || row.routingVersion?.state !== "RELEASED") {
      releaseBlockers.push("Routing ต้องเป็นเวอร์ชันที่ปล่อยใช้แล้ว");
    }
    if (!row.routingSnapshot || !row.instructionSnapshot) {
      releaseBlockers.push("ข้อมูลเส้นทางและคำสั่งการผลิตยังไม่ครบ");
    }
    if (row.order.designs.length === 0) {
      releaseBlockers.push("ยังไม่มีแบบอนุมัติล่าสุด จึงเริ่มผลิตไม่ได้");
    }
    if (row.steps.length === 0) {
      releaseBlockers.push("ยังไม่มีขั้นงานในใบสั่งผลิต");
    } else if (
      row.steps.some(
        (step) =>
          !step.operationCode ||
          !step.operationName ||
          !step.workCenter ||
          !step.workCenter.isActive,
      )
    ) {
      releaseBlockers.push("ทุกขั้นต้องมีรหัส ชื่อ และศูนย์งานที่เปิดใช้งาน");
    }
    const routingOperationIds = new Set(
      row.routingVersion?.operations.map((operation) => operation.id) ?? [],
    );
    const snapshotOperationIds = row.steps.map(
      (step) => step.routingOperationId,
    );
    if (
      snapshotOperationIds.some(
        (operationId) => !operationId || !routingOperationIds.has(operationId),
      ) ||
      new Set(snapshotOperationIds).size !== snapshotOperationIds.length ||
      snapshotOperationIds.length !== routingOperationIds.size
    ) {
      releaseBlockers.push("ขั้นงานไม่ตรงกับ Routing เวอร์ชันที่เลือก");
    } else if (row.steps.length > 0) {
      try {
        assertRoutingConvergesToFinalPack(
          row.steps.map((step) => ({
            id: step.id,
            operationCode: step.operationCode ?? "",
          })),
          dependencyRows.map((dependency) => ({
            predecessorOperationId: dependency.predecessorStepId,
            successorOperationId: dependency.successorStepId,
          })),
        );
      } catch (error) {
        releaseBlockers.push(
          error instanceof Error
            ? error.message
            : "ลำดับขั้นงานไม่พร้อมปล่อยผลิต",
        );
      }
    }
  }

  return {
    id: row.id,
    workOrderNumber: row.workOrderNumber,
    state: row.workOrderState,
    revision: row.revision,
    order: {
      id: row.order.id,
      orderNumber: row.order.orderNumber,
      title: row.order.title,
      customerName: row.order.customer.name,
      deadline: row.order.deadline,
      priority: row.order.priority,
      internalStatus: row.order.internalStatus,
    },
    plannedStartAt: row.plannedStartAt,
    plannedEndAt: row.plannedEndAt,
    releasedAt: row.releasedAt,
    routingSnapshot: row.routingSnapshot,
    instructionSnapshot: row.instructionSnapshot,
    approvedMockupSnapshot: row.approvedMockupSnapshot,
    releaseBlockers,
    availableCommands:
      access.canSupervise &&
      row.workOrderState === "DRAFT" &&
      releaseBlockers.length === 0
        ? (["releaseWorkOrder"] as const)
        : [],
    operations: row.steps.map((step) => operationSummary(step, access, row)),
    dependencies: dependencyRows,
    quantityLines: row.quantityLines,
    exceptions: row.exceptions.map(({ sourceQcDefect, ...exception }) => {
      const isOpen = OPEN_EXCEPTION_STATES.includes(exception.state);
      const sourceOperation = row.steps.find(
        (step) => step.id === exception.productionStepId,
      );
      const sourceCanAdvance = operationCanAdvance(row, sourceOperation);
      const allocatedReworkQty = row.reworkCases
        .filter(
          (rework) =>
            rework.sourceOperationId === sourceOperation?.id &&
            !["COMPLETED", "CANCELLED"].includes(rework.state),
        )
        .reduce((sum, rework) => sum + rework.qty, 0);
      const canDecideQcDisposition = Boolean(
        access.canSupervise &&
          sourceCanAdvance &&
          sourceOperation?.executionEnabled &&
          (sourceOperation.operationCode === "FINAL_QC" ||
            sourceOperation.workCenter?.code === "FINAL_QC") &&
          sourceOperation.operationState === "BLOCKED" &&
          isOpen &&
          exception.blocksJob &&
          exception.disposition === "HOLD" &&
          sourceQcDefect?.disposition === "HOLD" &&
          sourceQcDefect.operationQuantityId,
      );
      const canPlanRework = Boolean(
        access.canSupervise &&
          sourceCanAdvance &&
          sourceOperation &&
          !["COMPLETED", "CANCELLED"].includes(sourceOperation.operationState) &&
          isOpen &&
          sourceQcDefect?.disposition === "REWORK" &&
          sourceQcDefect.operationQuantityId &&
          sourceQcDefect.qty <=
            Math.max(0, (sourceOperation?.qtyRework ?? 0) - allocatedReworkQty) &&
          !reworkDefectIds.has(sourceQcDefect.id),
      );
      const canResolve = Boolean(
        access.canSupervise &&
          isOpen &&
          exceptionCanResolve({
            code: exception.code,
            blocksJob: exception.blocksJob,
            disposition: exception.disposition,
            sourceQcDefect: sourceQcDefect
              ? {
                  disposition: sourceQcDefect.disposition,
                  hasReworkCase: reworkDefectIds.has(sourceQcDefect.id),
                }
              : null,
          }),
      );
      return {
        ...exception,
        sourceQcDefect: sourceQcDefect
          ? {
              id: sourceQcDefect.id,
              quantityLineId: sourceQcDefect.operationQuantityId,
              qty: sourceQcDefect.qty,
              disposition: sourceQcDefect.disposition,
            }
          : null,
        availableCommands: canDecideQcDisposition
          ? (["decideQcDisposition"] as const)
          : canPlanRework
            ? (["planRework"] as const)
            : canResolve
              ? (["resolveException"] as const)
              : [],
      };
    }),
    reworkCases: row.reworkCases.map(({ sourceQcDefect, ...rework }) => ({
      ...rework,
      sourceQcDefect: sourceQcDefect
        ? {
            id: sourceQcDefect.id,
            quantityLineId: sourceQcDefect.operationQuantityId,
            qty: sourceQcDefect.qty,
            disposition: sourceQcDefect.disposition,
          }
        : null,
      availableCommands:
        access.canSupervise &&
        manufacturingParentCanAdvance(row) &&
        rework.state === "PLANNED" &&
        rework.targetWorkCenter.isActive &&
        (rework.targetWorkCenter.code !== "OUTSOURCE" ||
          Boolean(
            sourceQcDefect?.operationQuantity &&
              sourceQcDefect.operationQuantity.productionId === row.id &&
              sourceQcDefect.operationQuantity.productionStepId ===
                rework.sourceOperationId,
          ))
          ? (["releaseRework"] as const)
          : [],
    })),
    events: row.events,
  };
}

export async function getManufacturingWorkCenterLoad(
  prisma: ExtendedPrismaClient,
  now = new Date(),
  access?: ManufacturingReadAccess,
) {
  const centers = await prisma.workCenter.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      capacityUnit: true,
      capacityPerDay: true,
      resources: {
        where: {
          isActive: true,
          state: { notIn: ["DOWN", "INACTIVE"] },
        },
        select: { capacityUnit: true, capacityPerDay: true },
      },
      members: {
        where: access
          ? { userId: access.actorId, isActive: true }
          : { id: "__no_station_actor__" },
        select: { id: true },
      },
      operationJobs: {
        where: {
          executionEnabled: true,
          operationState: { in: ACTIVE_OPERATION_STATES },
          production: activeStationProductionWhere,
          AND: [activeStationResourceWhere],
        },
        select: {
          operationState: true,
          qtyPlanned: true,
          qtyGood: true,
          production: { select: { order: { select: { deadline: true } } } },
        },
      },
      exceptions: {
        where: { state: { in: OPEN_EXCEPTION_STATES } },
        select: { id: true },
      },
    },
  });

  return centers.map((center) => {
    const resourceCapacity = center.resources
      .filter((resource) => resource.capacityUnit === center.capacityUnit)
      .reduce<number | null>(
        (sum, resource) =>
          resource.capacityPerDay === null ? sum : (sum ?? 0) + resource.capacityPerDay,
        null,
      );
    return {
      workCenter: { id: center.id, code: center.code, name: center.name },
      availableForStation:
        access?.canSupervise === true || center.members.length > 0,
      planned: center.operationJobs.filter((job) => job.operationState === "PLANNED").length,
      ready: center.operationJobs.filter((job) => job.operationState === "READY").length,
      running: center.operationJobs.filter((job) => job.operationState === "RUNNING").length,
      blocked: center.operationJobs.filter((job) => job.operationState === "BLOCKED").length,
      overdue: center.operationJobs.filter(
        (job) => job.production.order.deadline && job.production.order.deadline < now,
      ).length,
      openExceptions: center.exceptions.length,
      loadQty: center.operationJobs.reduce(
        (sum, job) => sum + Math.max(0, job.qtyPlanned - job.qtyGood),
        0,
      ),
      capacity:
        center.capacityPerDay !== null || resourceCapacity !== null
          ? {
              value: center.capacityPerDay ?? resourceCapacity ?? 0,
              unit: center.capacityUnit,
            }
          : null,
    };
  });
}

const stationOrderSelect = {
  ...orderIdentitySelect,
  items: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      products: {
        orderBy: { sortOrder: "asc" as const },
        select: {
          description: true,
          productType: true,
          itemSource: true,
          fabricColor: true,
          totalQuantity: true,
          variants: {
            orderBy: { size: "asc" as const },
            select: { id: true, size: true, color: true, quantity: true },
          },
        },
      },
      prints: {
        orderBy: { position: "asc" as const },
        select: {
          id: true,
          position: true,
          printType: true,
          printSize: true,
          width: true,
          height: true,
          designNote: true,
          designImageUrl: true,
          artwork: {
            select: {
              imageUrl: true,
              heatTempC: true,
              heatPressSec: true,
              heatPressure: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.OrderSelect;

const stationJobSelect = {
  ...operationSummarySelect,
  instructionSnapshot: true,
  referenceSnapshot: true,
  quantities: {
    orderBy: { scopeKey: "asc" as const },
    select: {
      id: true,
      scopeKey: true,
      scopeKind: true,
      description: true,
      sku: true,
      size: true,
      color: true,
      printPosition: true,
      qtyPlanned: true,
      qtyGood: true,
      qtyScrap: true,
      qtyRework: true,
      revision: true,
    },
  },
  predecessorLinks: {
    select: {
      predecessorStep: {
        select: {
          id: true,
          operationCode: true,
          operationName: true,
          operationState: true,
        },
      },
    },
  },
  sourceReworkCases: {
    where: { state: "AWAITING_REINSPECTION" as const },
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    select: {
      id: true,
      state: true,
      qty: true,
      reason: true,
      requiresReinspection: true,
      revision: true,
      sourceQcRecordId: true,
      sourceQcDefectId: true,
      sourceQcDefect: {
        select: {
          id: true,
          operationQuantityId: true,
          qty: true,
          disposition: true,
        },
      },
      sourceExceptionId: true,
      targetWorkCenter: {
        select: { id: true, code: true, name: true },
      },
    },
  },
  production: {
    select: {
      id: true,
      workOrderNumber: true,
      workOrderState: true,
      revision: true,
      approvedMockupSnapshot: true,
      order: { select: stationOrderSelect },
    },
  },
} satisfies Prisma.ProductionStepSelect;

type StationJobRow = Prisma.ProductionStepGetPayload<{ select: typeof stationJobSelect }>;

const STATION_SENSITIVE_JSON_KEY =
  /(?:price|cost|amount|total|margin|profit|revenue|discount|tax|vat|payment|currency|fee|budget|quote|invoice|billing|commission|salary|wage|charge|financial|finance|shipping|rate|ราคา|ต้นทุน|ยอดเงิน|กำไร|ส่วนลด|ภาษี|ค่าจ้าง|ค่าขนส่ง)/i;

/** Snapshot เป็น JSON อิสระ จึงต้องตัด key ทางการเงินก่อนออก DTO ของ Station. */
export function sanitizeStationSnapshot(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeStationSnapshot);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !STATION_SENSITIVE_JSON_KEY.test(key.replaceAll("_", "")))
      .map(([key, nested]) => [key, sanitizeStationSnapshot(nested)]),
  );
}

type PrepSurplusCache = Map<
  string,
  ReturnType<typeof getPrepGarmentSurplus>
>;

async function stationJobDto(
  prisma: ExtendedPrismaClient,
  row: StationJobRow,
  access: ManufacturingReadAccess,
  prepSurplusCache: PrepSurplusCache = new Map(),
) {
  const summary = operationSummary(row, access, row.production);
  let prepGarmentSurplus = null;
  if (
    row.operationCode === "PREP" &&
    summary.availableCommands.includes("completeOperation")
  ) {
    let pending = prepSurplusCache.get(row.production.order.id);
    if (!pending) {
      pending = getPrepGarmentSurplus(prisma, row.production.order.id);
      prepSurplusCache.set(row.production.order.id, pending);
    }
    prepGarmentSurplus = await pending;
  }
  const prepCompletionBlocker =
    prepGarmentSurplus && prepGarmentSurplus.totalSurplusQty > 0
      ? {
          id: `prep-surplus:${row.id}`,
          severity: "WARNING" as const,
          title: `ยังมีเสื้อส่วนเกินค้างอยู่ ${prepGarmentSurplus.totalSurplusQty} ตัว กรุณาคืนส่วนเกินก่อนปิดงาน`,
          state: "OPEN" as const,
          blocksJob: true,
        }
      : null;
  const summaryCommands = prepCompletionBlocker
    ? summary.availableCommands.filter(
        (command) => command !== "completeOperation",
      )
    : summary.availableCommands;
  const canActOnAssignment =
    access.canOperate &&
    (access.canSupervise || row.assignedToId === null || row.assignedToId === access.actorId);
  const canReinspect =
    row.operationCode === "FINAL_QC" &&
    row.sourceReworkCases.length > 0 &&
    canActOnAssignment &&
    ["READY", "RUNNING"].includes(row.operationState) &&
    !row.exceptions.some((exception) => exception.blocksJob) &&
    row.predecessorLinks.every(
      (link) => link.predecessorStep.operationState === "COMPLETED",
    );
  const availableCommands = canReinspect
    ? ([...summaryCommands, "reinspectQuality"] as const)
    : summaryCommands;
  return {
    operation: {
      ...summary,
      blockers: prepCompletionBlocker
        ? [...summary.blockers, prepCompletionBlocker]
        : summary.blockers,
      availableCommands,
      instructionSnapshot: sanitizeStationSnapshot(row.instructionSnapshot),
      referenceSnapshot: sanitizeStationSnapshot(row.referenceSnapshot),
    },
    workOrder: {
      id: row.production.id,
      workOrderNumber: row.production.workOrderNumber,
      state: row.production.workOrderState,
      revision: row.production.revision,
    },
    order: {
      id: row.production.order.id,
      orderNumber: row.production.order.orderNumber,
      title: row.production.order.title,
      customerName: row.production.order.customer.name,
      deadline: row.production.order.deadline,
      priority: row.production.order.priority,
    },
    approvedMockupSnapshot: sanitizeStationSnapshot(
      row.production.approvedMockupSnapshot,
    ),
    prepGarmentSurplus,
    workGroups: row.production.order.items,
    quantityLines: row.quantities,
    dependencies: row.predecessorLinks.map((link) => link.predecessorStep),
    sourceReworkCases: row.sourceReworkCases.map(
      ({ sourceQcDefect, ...rework }) => ({
        ...rework,
        sourceQcDefect: sourceQcDefect
          ? {
              id: sourceQcDefect.id,
              quantityLineId: sourceQcDefect.operationQuantityId,
              qty: sourceQcDefect.qty,
              disposition: sourceQcDefect.disposition,
            }
          : null,
      }),
    ),
    exceptions: row.exceptions,
    availableCommands,
  };
}

function stationJobIsActive(row: StationJobRow) {
  return ACTIVE_STATION_WORK_ORDER_STATES.includes(row.production.workOrderState) &&
    ACTIVE_STATION_ORDER_STATUSES.includes(row.production.order.internalStatus);
}

function stationJobResourceIsAvailable(row: StationJobRow) {
  return !row.workResource ||
    (row.workResource.isActive &&
      ["AVAILABLE", "IN_USE"].includes(row.workResource.state));
}

export async function getManufacturingStationJob(
  prisma: ExtendedPrismaClient,
  operationJobId: string,
  access: ManufacturingReadAccess,
) {
  const row = await prisma.productionStep.findUnique({
    where: { id: operationJobId },
    select: stationJobSelect,
  });
  if (
    !row?.executionEnabled ||
    !row.workCenter?.isActive ||
    !stationJobResourceIsAvailable(row) ||
    !stationJobIsActive(row)
  ) {
    return null;
  }
  if (!access.canSupervise) {
    const membership = row.workCenter
      ? await prisma.workCenterMember.findUnique({
          where: {
            workCenterId_userId: {
              workCenterId: row.workCenter.id,
              userId: access.actorId,
            },
          },
          select: { isActive: true },
        })
      : null;
    if (!membership?.isActive) {
      forbidden("บัญชีนี้ไม่ได้เป็นสมาชิกของ Work Center นี้");
    }
  }
  return stationJobDto(prisma, row, access);
}

/** Same-order handoff for Station. Returns only the sanitized Station DTO shape. */
export async function getManufacturingStationHandoff(
  prisma: ExtendedPrismaClient,
  input: { workOrderId: string; completedOperationId: string },
  access: ManufacturingReadAccess,
) {
  const candidates = await prisma.productionStep.findMany({
    where: {
      productionId: input.workOrderId,
      production: activeStationProductionWhere,
      id: { not: input.completedOperationId },
      executionEnabled: true,
      executionMode: "IN_HOUSE",
      operationState: { in: ["READY", "RUNNING", "BLOCKED"] },
      AND: [activeStationResourceWhere],
      workCenter: {
        isActive: true,
        ...(!access.canSupervise
          ? {
              members: {
                some: { userId: access.actorId, isActive: true },
              },
            }
          : {}),
      },
      ...(!access.canSupervise
        ? { OR: [{ assignedToId: access.actorId }, { assignedToId: null }] }
        : {}),
    },
    orderBy: [
      { dispatchSequence: { sort: "asc", nulls: "last" } },
      { id: "asc" },
    ],
    select: stationJobSelect,
  });
  const prepSurplusCache: PrepSurplusCache = new Map();
  return Promise.all(
    candidates.map((row) =>
      stationJobDto(prisma, row, access, prepSurplusCache),
    ),
  );
}

/** Resolve an order-level QR into accessible jobs without starting any operation. */
export async function getManufacturingStationOrderContext(
  prisma: ExtendedPrismaClient,
  orderId: string,
  access: ManufacturingReadAccess,
) {
  const candidates = await prisma.productionStep.findMany({
    where: {
      production: { orderId, ...activeStationProductionWhere },
      executionEnabled: true,
      executionMode: "IN_HOUSE",
      operationState: { in: ["READY", "RUNNING", "BLOCKED"] },
      AND: [activeStationResourceWhere],
      workCenter: {
        isActive: true,
        ...(!access.canSupervise
          ? {
              members: {
                some: { userId: access.actorId, isActive: true },
              },
            }
          : {}),
      },
      ...(!access.canSupervise
        ? { OR: [{ assignedToId: access.actorId }, { assignedToId: null }] }
        : {}),
    },
    orderBy: [
      { production: { createdAt: "asc" } },
      { dispatchSequence: { sort: "asc", nulls: "last" } },
      { id: "asc" },
    ],
    select: stationJobSelect,
  });
  const prepSurplusCache: PrepSurplusCache = new Map();
  return Promise.all(
    candidates.map((row) =>
      stationJobDto(prisma, row, access, prepSurplusCache),
    ),
  );
}

export async function getManufacturingStationDispatch(
  prisma: ExtendedPrismaClient,
  input: { workCenterCode: string; cursor?: string; limit: number },
  access: ManufacturingReadAccess,
) {
  const workCenter = await prisma.workCenter.findUnique({
    where: { code: input.workCenterCode },
    select: { id: true, code: true, name: true, isActive: true },
  });
  if (!workCenter?.isActive) return null;
  if (!access.canSupervise) {
    const membership = await prisma.workCenterMember.findUnique({
      where: {
        workCenterId_userId: {
          workCenterId: workCenter.id,
          userId: access.actorId,
        },
      },
      select: { isActive: true },
    });
    if (!membership?.isActive) {
      forbidden("บัญชีนี้ไม่ได้เป็นสมาชิกของ Work Center นี้");
    }
  }

  const ownFilter: Prisma.ProductionStepWhereInput = access.canSupervise
    ? {}
    : { OR: [{ assignedToId: access.actorId }, { assignedToId: null }] };
  const where: Prisma.ProductionStepWhereInput = {
    workCenterId: workCenter.id,
    production: activeStationProductionWhere,
    executionEnabled: true,
    operationState: { in: ["READY", "RUNNING", "BLOCKED"] },
    AND: [activeStationResourceWhere],
    ...ownFilter,
  };
  // “งานปัจจุบัน” เป็นของ actor เสมอ แม้ actor เป็น supervisor; งาน RUNNING ของคนอื่น
  // อยู่ใน queue ไม่แย่งตำแหน่ง current และไม่กิน slot pagination.
  const currentRow = await prisma.productionStep.findFirst({
    where: {
      ...where,
      operationState: "RUNNING",
      assignedToId: access.actorId,
    },
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    select: stationJobSelect,
  });
  const queueWhere: Prisma.ProductionStepWhereInput = {
    ...where,
    ...(currentRow ? { id: { not: currentRow.id } } : {}),
  };
  const queueStateOrder = ["RUNNING", "READY", "BLOCKED"] as const;
  let cursorState: (typeof queueStateOrder)[number] | null = null;
  if (input.cursor) {
    const cursorRow = await prisma.productionStep.findUnique({
      where: { id: input.cursor },
      select: { operationState: true },
    });
    cursorState = queueStateOrder.includes(
      cursorRow?.operationState as (typeof queueStateOrder)[number],
    )
      ? (cursorRow?.operationState as (typeof queueStateOrder)[number])
      : null;
  }
  const cursorBucketIndex = cursorState ? queueStateOrder.indexOf(cursorState) : 0;
  const rows: StationJobRow[] = [];
  for (
    let index = cursorBucketIndex;
    index < queueStateOrder.length && rows.length < input.limit + 1;
    index += 1
  ) {
    const operationState = queueStateOrder[index];
    const inCursorBucket = Boolean(input.cursor && cursorState) && index === cursorBucketIndex;
    const batch = await prisma.productionStep.findMany({
      where: { ...queueWhere, operationState },
      orderBy: [
        { dispatchSequence: { sort: "asc", nulls: "last" } },
        { production: { order: { deadline: { sort: "asc", nulls: "last" } } } },
        { id: "asc" },
      ],
      take: input.limit + 1 - rows.length,
      ...(inCursorBucket ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: stationJobSelect,
    });
    rows.push(...batch);
  }
  const hasMore = rows.length > input.limit;
  const page = hasMore ? rows.slice(0, input.limit) : rows;

  const prepSurplusCache: PrepSurplusCache = new Map();
  const [currentJob, queue] = await Promise.all([
    currentRow
      ? stationJobDto(prisma, currentRow, access, prepSurplusCache)
      : null,
    Promise.all(
      page.map((row) =>
        stationJobDto(prisma, row, access, prepSurplusCache),
      ),
    ),
  ]);
  return {
    workCenter: { id: workCenter.id, code: workCenter.code, name: workCenter.name },
    currentJob,
    queue,
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  };
}

export async function getManufacturingExceptionList(
  prisma: ExtendedPrismaClient,
  input: {
    state?: ExceptionState;
    severity?: ExceptionSeverity;
    workCenterId?: string;
    cursor?: string;
    limit: number;
  },
  access: ManufacturingReadAccess,
) {
  const rows = await prisma.productionException.findMany({
    where: {
      ...(input.state ? { state: input.state } : {}),
      ...(input.severity ? { severity: input.severity } : {}),
      ...(input.workCenterId ? { workCenterId: input.workCenterId } : {}),
    },
    orderBy: [{ severity: "desc" }, { createdAt: "asc" }, { id: "asc" }],
    take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      productionStepId: true,
      code: true,
      title: true,
      description: true,
      severity: true,
      state: true,
      blocksJob: true,
      disposition: true,
      sourceQcDefect: {
        select: {
          id: true,
          operationQuantityId: true,
          qty: true,
          disposition: true,
          reworkCase: { select: { id: true } },
        },
      },
      ownerId: true,
      revision: true,
      createdAt: true,
      acknowledgedAt: true,
      resolvedAt: true,
      resolution: true,
      workCenter: { select: { id: true, code: true, name: true } },
      productionStep: {
        select: {
          id: true,
          executionEnabled: true,
          operationCode: true,
          operationState: true,
          qtyRework: true,
          workCenter: {
            select: { code: true, isActive: true },
          },
          sourceReworkCases: {
            where: { state: { notIn: ["COMPLETED", "CANCELLED"] } },
            select: { qty: true },
          },
        },
      },
      production: {
        select: {
          id: true,
          workOrderNumber: true,
          workOrderState: true,
          order: { select: orderIdentitySelect },
        },
      },
    },
  });
  const hasMore = rows.length > input.limit;
  const page = hasMore ? rows.slice(0, input.limit) : rows;
  return {
    items: page.map(({ sourceQcDefect, ...row }) => {
      const isOpen = OPEN_EXCEPTION_STATES.includes(row.state);
      const sourceOperation = row.productionStep;
      const sourceCanAdvance = operationCanAdvance(
        row.production,
        sourceOperation,
      );
      const allocatedReworkQty =
        sourceOperation?.sourceReworkCases.reduce(
          (sum, rework) => sum + rework.qty,
          0,
        ) ?? 0;
      const canDecideQcDisposition = Boolean(
        access.canSupervise &&
          sourceCanAdvance &&
          sourceOperation?.executionEnabled &&
          (sourceOperation.operationCode === "FINAL_QC" ||
            sourceOperation.workCenter?.code === "FINAL_QC") &&
          sourceOperation.operationState === "BLOCKED" &&
          isOpen &&
          row.blocksJob &&
          row.disposition === "HOLD" &&
          sourceQcDefect?.disposition === "HOLD" &&
          sourceQcDefect.operationQuantityId,
      );
      const canPlanRework = Boolean(
        access.canSupervise &&
          sourceCanAdvance &&
          sourceOperation &&
          !["COMPLETED", "CANCELLED"].includes(sourceOperation.operationState) &&
          isOpen &&
          sourceQcDefect?.disposition === "REWORK" &&
          sourceQcDefect.operationQuantityId &&
          sourceQcDefect.qty <=
            Math.max(0, (sourceOperation?.qtyRework ?? 0) - allocatedReworkQty) &&
          !sourceQcDefect.reworkCase,
      );
      const canResolve = Boolean(
        access.canSupervise &&
          isOpen &&
          exceptionCanResolve({
            code: row.code,
            blocksJob: row.blocksJob,
            disposition: row.disposition,
            sourceQcDefect: sourceQcDefect
              ? {
                  disposition: sourceQcDefect.disposition,
                  hasReworkCase: Boolean(sourceQcDefect.reworkCase),
                }
              : null,
          }),
      );
      return {
        ...row,
        sourceQcDefect: sourceQcDefect
          ? {
              id: sourceQcDefect.id,
              quantityLineId: sourceQcDefect.operationQuantityId,
              qty: sourceQcDefect.qty,
              disposition: sourceQcDefect.disposition,
            }
          : null,
        availableCommands: canDecideQcDisposition
          ? (["decideQcDisposition"] as const)
          : canPlanRework
            ? (["planRework"] as const)
            : canResolve
              ? (["resolveException"] as const)
              : [],
      };
    }),
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  };
}
