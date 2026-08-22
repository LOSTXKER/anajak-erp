import { z } from "zod";
import { hasPermission } from "@/lib/permissions";
import { notFound } from "@/server/errors";
import { assertProductionV2ApiEnabled } from "@/server/services/production-v2-gate";
import {
  getManufacturingControlList,
  getManufacturingExceptionList,
  getManufacturingStationDispatch,
  getManufacturingStationHandoff,
  getManufacturingStationJob,
  getManufacturingStationOrderContext,
  getManufacturingWorkCenterLoad,
  getManufacturingWorkOrder,
  type ManufacturingReadAccess,
} from "@/server/services/manufacturing-read-model";
import {
  assignManufacturingOperation,
  completeManufacturingOperation,
  decideQcDisposition,
  pauseManufacturingOperation,
  planManufacturingRework,
  raiseManufacturingException,
  releaseManufacturingRework,
  releaseManufacturingWorkOrder,
  reportManufacturingOutput,
  resequenceManufacturingOperation,
  resolveManufacturingException,
  startManufacturingOperation,
} from "@/server/services/manufacturing-commands";
import {
  createManufacturingWorkOrder,
  getManufacturingCreationContext,
} from "@/server/services/manufacturing-work-order";
import { protectedProcedure, requirePermission, router } from "../trpc";

const productionTeam = requirePermission("manage_production");
const productionSupervisor = requirePermission("supervise_operations");
const manufacturingProcedure = protectedProcedure.use(({ next }) => {
  assertProductionV2ApiEnabled();
  return next();
});

const commandBase = z.object({
  commandId: z.string().trim().min(8).max(120),
  expectedRevision: z.number().int().nonnegative(),
});

const workOrderStates = [
  "DRAFT",
  "RELEASED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
const exceptionStates = ["OPEN", "ACKNOWLEDGED", "RESOLVED", "CLOSED"] as const;
const exceptionSeverities = ["INFO", "WARNING", "CRITICAL"] as const;
const qualityDispositions = ["HOLD", "REWORK", "SCRAP"] as const;

function readAccess(ctx: {
  userId: string;
  userRole: NonNullable<Parameters<typeof hasPermission>[0]>;
  permissionOverrides?: unknown;
}): ManufacturingReadAccess {
  return {
    actorId: ctx.userId,
    canOperate: hasPermission(
      ctx.userRole,
      ctx.permissionOverrides,
      "manage_production",
    ),
    canSupervise: hasPermission(
      ctx.userRole,
      ctx.permissionOverrides,
      "supervise_operations",
    ),
  };
}

export const manufacturingRouter = router({
  creationContext: manufacturingProcedure
    .use(productionSupervisor)
    .input(z.object({ orderId: z.string().min(1) }))
    .query(({ ctx, input }) =>
      getManufacturingCreationContext(ctx.prisma, input.orderId),
    ),

  createWorkOrder: manufacturingProcedure
    .use(productionSupervisor)
    .input(
      commandBase.extend({
        orderId: z.string().min(1),
        routingVersionId: z.string().min(1),
      }),
    )
    .mutation(({ ctx, input }) =>
      createManufacturingWorkOrder(ctx.prisma, {
        ...input,
        actorId: ctx.userId,
      }),
    ),

  controlList: manufacturingProcedure
    .input(
      z.object({
        query: z.string().trim().max(120).optional(),
        state: z.enum(workOrderStates).optional(),
        workCenterId: z.string().min(1).optional(),
        assigneeId: z.string().min(1).optional(),
        exceptionState: z.enum(exceptionStates).optional(),
        sort: z.enum(["priority", "dueDate", "updatedAt"]).default("dueDate"),
        cursor: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(100).default(30),
      }),
    )
    .query(({ ctx, input }) =>
      getManufacturingControlList(ctx.prisma, input, readAccess(ctx)),
    ),

  workOrder: manufacturingProcedure
    .input(z.object({ workOrderId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const result = await getManufacturingWorkOrder(
        ctx.prisma,
        input.workOrderId,
        readAccess(ctx),
      );
      if (!result) notFound("ใบสั่งผลิต", input.workOrderId);
      return result;
    }),

  workCenterLoad: manufacturingProcedure.query(({ ctx }) =>
    getManufacturingWorkCenterLoad(ctx.prisma, new Date(), readAccess(ctx)),
  ),

  stationDispatch: manufacturingProcedure
    .input(
      z.object({
        workCenterCode: z.string().trim().min(1).max(80),
        cursor: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(100).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const result = await getManufacturingStationDispatch(
        ctx.prisma,
        input,
        readAccess(ctx),
      );
      if (!result) notFound("Work Center", input.workCenterCode);
      return result;
    }),

  stationJob: manufacturingProcedure
    .input(z.object({ operationJobId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const result = await getManufacturingStationJob(
        ctx.prisma,
        input.operationJobId,
        readAccess(ctx),
      );
      if (!result) notFound("งานสถานี", input.operationJobId);
      return result;
    }),

  stationHandoff: manufacturingProcedure
    .input(
      z.object({
        workOrderId: z.string().min(1),
        completedOperationId: z.string().min(1),
      }),
    )
    .query(({ ctx, input }) =>
      getManufacturingStationHandoff(ctx.prisma, input, readAccess(ctx)),
    ),

  stationOrderContext: manufacturingProcedure
    .input(z.object({ orderId: z.string().min(1) }))
    .query(({ ctx, input }) =>
      getManufacturingStationOrderContext(
        ctx.prisma,
        input.orderId,
        readAccess(ctx),
      ),
    ),

  exceptionList: manufacturingProcedure
    .input(
      z.object({
        state: z.enum(exceptionStates).optional(),
        severity: z.enum(exceptionSeverities).optional(),
        workCenterId: z.string().min(1).optional(),
        cursor: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(100).default(30),
      }),
    )
    .query(({ ctx, input }) =>
      getManufacturingExceptionList(ctx.prisma, input, readAccess(ctx)),
    ),

  releaseWorkOrder: manufacturingProcedure
    .use(productionSupervisor)
    .input(commandBase.extend({ workOrderId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      releaseManufacturingWorkOrder(ctx.prisma, { ...input, actorId: ctx.userId }),
    ),

  assignOperation: manufacturingProcedure
    .use(productionSupervisor)
    .input(
      commandBase.extend({
        operationJobId: z.string().min(1),
        assigneeId: z.string().min(1).nullable().optional(),
        workResourceId: z.string().min(1).nullable().optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      assignManufacturingOperation(ctx.prisma, { ...input, actorId: ctx.userId }),
    ),

  resequenceOperation: manufacturingProcedure
    .use(productionSupervisor)
    .input(
      commandBase.extend({
        operationJobId: z.string().min(1),
        dispatchSequence: z.number().int().nonnegative(),
        plannedStartAt: z.coerce.date().nullable().optional(),
        plannedEndAt: z.coerce.date().nullable().optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      resequenceManufacturingOperation(ctx.prisma, {
        ...input,
        actorId: ctx.userId,
      }),
    ),

  startOperation: manufacturingProcedure
    .use(productionTeam)
    .input(commandBase.extend({ operationJobId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      startManufacturingOperation(
        ctx.prisma,
        { ...input, actorId: ctx.userId },
        readAccess(ctx),
      ),
    ),

  pauseOperation: manufacturingProcedure
    .use(productionTeam)
    .input(
      commandBase.extend({
        operationJobId: z.string().min(1),
        reason: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      pauseManufacturingOperation(
        ctx.prisma,
        { ...input, actorId: ctx.userId },
        readAccess(ctx),
      ),
    ),

  reportOutput: manufacturingProcedure
    .use(productionTeam)
    .input(
      commandBase.extend({
        operationJobId: z.string().min(1),
        qtyGood: z.number().int().nonnegative(),
        qtyScrap: z.number().int().nonnegative(),
        qtyRework: z.number().int().nonnegative(),
        note: z.string().trim().max(1000).optional(),
        quantityLines: z
          .array(
            z.object({
              quantityLineId: z.string().min(1),
              expectedRevision: z.number().int().nonnegative(),
              qtyGood: z.number().int().nonnegative(),
              qtyScrap: z.number().int().nonnegative(),
              qtyRework: z.number().int().nonnegative(),
            }),
          )
          .max(200)
          .optional(),
        reworkResolution: z
          .object({
            reworkCaseId: z.string().min(1),
            expectedRevision: z.number().int().nonnegative(),
            qty: z.number().int().positive(),
            disposition: z.enum(["GOOD", "SCRAP"]),
          })
          .optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      reportManufacturingOutput(
        ctx.prisma,
        { ...input, actorId: ctx.userId },
        readAccess(ctx),
      ),
    ),

  completeOperation: manufacturingProcedure
    .use(productionTeam)
    .input(commandBase.extend({ operationJobId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      completeManufacturingOperation(
        ctx.prisma,
        { ...input, actorId: ctx.userId },
        readAccess(ctx),
      ),
    ),

  raiseException: manufacturingProcedure
    .use(productionTeam)
    .input(
      commandBase.extend({
        workOrderId: z.string().min(1),
        operationJobId: z.string().min(1).optional(),
        category: z.string().trim().min(1).max(80),
        title: z.string().trim().min(1).max(200),
        severity: z.enum(exceptionSeverities),
        blocksJob: z.boolean().default(true),
        note: z.string().trim().max(2000).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      raiseManufacturingException(
        ctx.prisma,
        { ...input, actorId: ctx.userId },
        readAccess(ctx),
      ),
    ),

  resolveException: manufacturingProcedure
    .use(productionSupervisor)
    .input(
      commandBase.extend({
        exceptionId: z.string().min(1),
        resolution: z.string().trim().min(1).max(2000),
        disposition: z.enum(qualityDispositions).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      resolveManufacturingException(ctx.prisma, { ...input, actorId: ctx.userId }),
    ),

  decideQcDisposition: manufacturingProcedure
    .use(productionSupervisor)
    .input(
      commandBase.extend({
        exceptionId: z.string().min(1),
        disposition: z.enum(["REWORK", "SCRAP"]),
        note: z.string().trim().max(2000).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      decideQcDisposition(ctx.prisma, { ...input, actorId: ctx.userId }),
    ),

  planRework: manufacturingProcedure
    .use(productionSupervisor)
    .input(
      commandBase.extend({
        workOrderId: z.string().min(1),
        sourceOperationJobId: z.string().min(1),
        qcDefectId: z.string().min(1).optional(),
        sourceExceptionId: z.string().min(1).optional(),
        targetWorkCenterId: z.string().min(1),
        qty: z.number().int().positive(),
        reason: z.string().trim().min(1).max(2000),
      }),
    )
    .mutation(({ ctx, input }) =>
      planManufacturingRework(ctx.prisma, { ...input, actorId: ctx.userId }),
    ),

  releaseRework: manufacturingProcedure
    .use(productionSupervisor)
    .input(commandBase.extend({ reworkCaseId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      releaseManufacturingRework(ctx.prisma, { ...input, actorId: ctx.userId }),
    ),
});
