/**
 * รอบพิมพ์ฟิล์ม DTF (FLOW-REDESIGN ก้อน 2 — หน้าเครื่อง)
 *
 * ความจริงหน้าเครื่อง: คิวพิมพ์ฟิล์มกับคิวรีดเป็นคนละคิว — ช่างพิมพ์เลือกหลายงาน
 * จากคิว (เฉพาะงานไฟล์พร้อม) รวมลงม้วนเดียวเป็น "รอบพิมพ์" จัดวางในโปรแกรมเครื่อง
 * (RIP — ระบบจงใจไม่ทำ auto-nesting) แล้วกดเป็นจังหวะชุด:
 *
 *   PRINTING ──พิมพ์จบทั้งม้วน──▶ PRINTED ──ตัดแยก+ติดป้ายเสร็จ──▶ COMPLETED
 *
 * ขั้น DTF_PRINT ของงานสมาชิกถูกนับ/ปิด "ตอน COMPLETED เท่านั้น" — จุดตัดแยกฟิล์ม
 * เป็นด่านบังคับกันฟิล์มสลับออเดอร์ (ฟิล์มยังเป็นม้วนรวม = ยังรีดไม่ได้)
 * ฟิล์มพิมพ์เผื่อ (กรอกตอนปิดรอบ — batch เดียว ไม่เพิ่มงานหน้างาน) เข้าคลัง FilmStock
 *
 * กติกา:
 * - ปิดขั้นเป็นชุด = pattern เดียวกับ outsource QC_PASSED: lock แถวขั้น FOR UPDATE →
 *   increment qtyDone → ปิดเมื่อไม่มีรอบค้างอื่น + จำนวนครบ → finalizeProductionIfComplete
 * - งานหนึ่งแบ่งพิมพ์หลายรอบได้ แต่ห้ามอยู่สองรอบ active พร้อมกัน (กันนับซ้อน)
 * - ไม่มีเงินใน flow นี้ (มติเลิกคิดต้นทุนต่องาน 2026-06-12)
 */

import { createHash } from "node:crypto";
import type { OperationState, Prisma } from "@prisma/client";
import { badRequest, conflict, forbidden, notFound } from "@/server/errors";
import { INTERNAL_STATUS_LABELS } from "@/lib/order-status";
import { nextDocumentNumber } from "@/server/services/document-number";
import { finalizeProductionIfComplete } from "@/server/services/order-status";
import { resolveSoleOrderArtworkId } from "@/server/services/artwork";
import { lockProductionTopology } from "@/server/services/production-topology-lock";
import { firstPendingStepIdsByLane } from "@/lib/production-step-actions";
import { createAuditLog } from "@/server/helpers";
// สูตรตัดสินล้วน (ช่องคิว/ไฟล์พร้อม/เพดานจำนวน/ปิดขั้น) — unit test ได้ไม่ต้องมี DB
import {
  isFileReadyForPrint,
  printQueueSlotOf,
  compareDueDate,
  planRunItemQty,
  shouldCloseStep,
} from "@/server/services/print-run-plan";
import type { ExtendedPrismaClient, PrismaTx } from "@/lib/prisma";
import {
  loadSpecializedOperation,
  recordSpecializedOperationEvent,
  recordSpecializedOperationOutput,
  specializedExecutionScopeBlockedReason,
  type SpecializedOperation,
} from "@/server/services/manufacturing-operation-adapter";
import {
  assertPrintRunItemResult,
  ManufacturingDomainError,
} from "@/server/services/manufacturing-domain";
import {
  decideManufacturingCommand,
  hashManufacturingCommand,
} from "@/server/services/manufacturing-command";
import { assertExpectedRevision } from "@/server/services/manufacturing-command-policy";
import { assertProductionV2ApiEnabled } from "@/server/services/production-v2-gate";

// สถานะรอบที่ยังกินงานอยู่ — งานในรอบเหล่านี้ห้ามโผล่ในคิว/ห้ามเข้ารอบใหม่
const ACTIVE_RUN_STATUSES = ["PRINTING", "PRINTED"] as const;
const ACTIVE_STATION_WORK_ORDER_STATES = ["RELEASED", "IN_PROGRESS"] as const;
const ACTIVE_STATION_ORDER_STATUSES = [
  "PRODUCTION_QUEUE",
  "PRODUCING",
  "QUALITY_CHECK",
  "PACKING",
] as const;

const ACTIVE_STATION_RESOURCE_WHERE = {
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

function printRunEventCommandId(kind: string, commandId: string) {
  return `print-run:${kind}:${createHash("sha256")
    .update(commandId)
    .digest("hex")}`;
}

type PrintRunOrderState = {
  orderNumber: string;
  internalStatus: string;
};

export type PrintRunAccess = {
  userId: string;
  canOperate?: boolean;
  canSupervise: boolean;
};

type ManageablePrintRun = {
  createdById: string;
  items: readonly { productionStep: { assignedToId: string | null } }[];
};

function canManagePrintRun(run: ManageablePrintRun, access: PrintRunAccess) {
  if (access.canOperate === false) return false;
  if (access.canSupervise) return true;
  const allAssignedToActor =
    run.items.length > 0 &&
    run.items.every((item) => item.productionStep.assignedToId === access.userId);
  const creatorStillOwnsRun =
    run.createdById === access.userId &&
    run.items.every((item) => {
      const assignedToId = item.productionStep.assignedToId;
      return assignedToId === null || assignedToId === access.userId;
    });
  return allAssignedToActor || creatorStillOwnsRun;
}

function assertCanManagePrintRun(run: ManageablePrintRun, access: PrintRunAccess) {
  if (canManagePrintRun(run, access)) return;
  forbidden("รอบพิมพ์นี้เป็นงานของผู้สร้างหรือผู้รับผิดชอบคนอื่น");
}

async function assertV2PrintRunMembership(
  tx: PrismaTx,
  items: readonly {
    productionStep: {
      executionEnabled: boolean;
      workCenterId: string | null;
      workCenter: { code: string } | null;
    };
  }[],
  access: PrintRunAccess,
) {
  if (access.canSupervise) return;
  if (
    items.some(
      (item) =>
        item.productionStep.executionEnabled &&
        item.productionStep.workCenter?.code === "DTF_PRINT" &&
        !item.productionStep.workCenterId,
    )
  ) {
    forbidden("Operation Job DTF ยังไม่ได้ผูก Work Center ที่เข้าใช้งานได้");
  }
  const workCenterIds = [
    ...new Set(
      items
        .filter(
          (item) =>
            item.productionStep.executionEnabled &&
            item.productionStep.workCenter?.code === "DTF_PRINT",
        )
        .map((item) => item.productionStep.workCenterId)
        .filter((id): id is string => !!id),
    ),
  ];
  for (const workCenterId of workCenterIds) {
    const membership = await tx.workCenterMember.findUnique({
      where: {
        workCenterId_userId: { workCenterId, userId: access.userId },
      },
      select: { isActive: true },
    });
    if (!membership?.isActive) {
      forbidden("บัญชีนี้ไม่ได้เป็นสมาชิกของ Work Center DTF");
    }
  }
}

function orderStatusLabel(status: string) {
  return (INTERNAL_STATUS_LABELS as Record<string, string>)[status] ?? status;
}

function assertPrintRunOrdersProducing(items: readonly { order: PrintRunOrderState }[]) {
  const blocked = items.find((item) => item.order.internalStatus !== "PRODUCING");
  if (!blocked) return;
  badRequest(
    `งาน ${blocked.order.orderNumber}: ทำรอบพิมพ์ต่อไม่ได้ — ออเดอร์อยู่สถานะ ${orderStatusLabel(blocked.order.internalStatus)}`,
  );
}

function activeRunBlockedReason(run: {
  status: string;
  items: readonly { order: PrintRunOrderState }[];
}) {
  if (!ACTIVE_RUN_STATUSES.includes(run.status as (typeof ACTIVE_RUN_STATUSES)[number])) {
    return null;
  }
  const blocked = run.items.find((item) => item.order.internalStatus !== "PRODUCING");
  return blocked
    ? `หยุดรอบนี้ — งาน ${blocked.order.orderNumber} อยู่สถานะ ${orderStatusLabel(blocked.order.internalStatus)}`
    : null;
}

export type PrintRunAvailableCommand = "markPrinted" | "cancel" | "complete";

export type PrintRunOperationRevision = {
  itemId: string;
  expectedRevision: number;
};

type PrintRunLifecycleCommandParams = PrintRunAccess & {
  runId: string;
  commandId?: string;
  items?: PrintRunOperationRevision[];
};

type PrintRunLifecycleCommandResult = {
  runId: string;
  status: "PRINTED" | "CANCELLED";
  operations: Array<{
    operationJobId: string;
    operationState: OperationState;
    revision: number;
  }>;
};

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizedLifecycleItems(items: readonly PrintRunOperationRevision[]) {
  return [...items].sort((left, right) => left.itemId.localeCompare(right.itemId));
}

function lifecycleRevisionMap(
  runItems: readonly { id: string }[],
  params: PrintRunLifecycleCommandParams,
) {
  if (!params.commandId || !params.items?.length) {
    badRequest(
      "คำสั่งรอบพิมพ์ Production V2 ต้องระบุ commandId และ revision ของทุกงานในรอบ",
    );
  }
  if (params.commandId.length < 8 || params.commandId.length > 100) {
    badRequest("commandId ของรอบพิมพ์ไม่ถูกต้อง");
  }
  const normalized = normalizedLifecycleItems(params.items);
  if (new Set(normalized.map((item) => item.itemId)).size !== normalized.length) {
    badRequest("รายการ revision ของรอบพิมพ์มีงานซ้ำ");
  }
  if (
    normalized.length !== runItems.length ||
    normalized.some(
      (item, index) =>
        item.itemId !== [...runItems]
          .sort((left, right) => left.id.localeCompare(right.id))[index]?.id,
    )
  ) {
    badRequest("ต้องส่ง revision ให้ครบทุกงานในรอบพิมพ์เดียวกัน");
  }
  if (
    normalized.some(
      (item) =>
        !Number.isSafeInteger(item.expectedRevision) || item.expectedRevision < 0,
    )
  ) {
    badRequest("revision ของ Operation Job ไม่ถูกต้อง");
  }
  return {
    normalized,
    byItemId: new Map(
      normalized.map((item) => [item.itemId, item.expectedRevision] as const),
    ),
  };
}

async function beginPrintRunLifecycleCommand(
  tx: PrismaTx,
  commandType: "markPrintRunPrinted" | "cancelPrintRun",
  params: PrintRunLifecycleCommandParams,
  normalizedItems: readonly PrintRunOperationRevision[],
) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`manufacturing:${params.commandId}`}, 0))::text AS lock_result`;
  const requestHash = hashManufacturingCommand({
    commandType,
    expectedRevision: normalizedItems[0]?.expectedRevision ?? 0,
    actorId: params.userId,
    payload: {
      runId: params.runId,
      items: normalizedItems,
    },
  });
  const existing = await tx.manufacturingCommand.findUnique({
    where: { commandId: params.commandId! },
    select: {
      requestHash: true,
      status: true,
      result: true,
      errorCode: true,
      errorMessage: true,
    },
  });
  let decision: ReturnType<typeof decideManufacturingCommand>;
  try {
    decision = decideManufacturingCommand({ existing, requestHash });
  } catch (error) {
    if (error instanceof ManufacturingDomainError) conflict(error.message);
    throw error;
  }
  if (decision.kind === "REPLAY_SUCCESS") {
    return {
      kind: "REPLAY" as const,
      result: decision.result as PrintRunLifecycleCommandResult,
    };
  }
  if (decision.kind === "REPLAY_FAILURE") {
    conflict(
      decision.errorMessage ??
        "คำสั่งรอบพิมพ์นี้เคยทำไม่สำเร็จ กรุณาสร้าง commandId ใหม่",
    );
  }
  if (decision.kind === "IN_FLIGHT") {
    conflict("คำสั่งรอบพิมพ์นี้กำลังประมวลผล กรุณารอสักครู่");
  }
  await tx.manufacturingCommand.create({
    data: {
      commandId: params.commandId!,
      commandType,
      requestHash,
      actorId: params.userId,
      expectedRevision: normalizedItems[0]?.expectedRevision ?? 0,
      status: "PENDING",
    },
  });
  return { kind: "EXECUTE" as const };
}

async function completePrintRunLifecycleCommand(
  tx: PrismaTx,
  commandId: string,
  result: PrintRunLifecycleCommandResult,
) {
  const jsonResult = asJson(result);
  await tx.manufacturingCommand.update({
    where: { commandId },
    data: {
      status: "SUCCEEDED",
      result: jsonResult,
      completedAt: new Date(),
    },
  });
  return jsonResult as unknown as PrintRunLifecycleCommandResult;
}

type PrintStepReference = {
  id: string;
  productionId: string;
  production: { orderId: string };
};

async function readPrintStepReferences(
  tx: PrismaTx,
  stepIds: readonly string[],
): Promise<PrintStepReference[]> {
  const references = await tx.productionStep.findMany({
    where: { id: { in: [...stepIds] } },
    select: {
      id: true,
      productionId: true,
      production: { select: { orderId: true } },
    },
  });
  const byId = new Map(references.map((reference) => [reference.id, reference]));
  return stepIds.map((stepId) => byId.get(stepId) ?? notFound("ขั้นตอนผลิต", stepId));
}

function samePrintStepMembership(
  left: readonly PrintStepReference[],
  right: readonly PrintStepReference[],
) {
  return left.every((reference, index) => {
    const candidate = right[index];
    return (
      candidate?.id === reference.id &&
      candidate.productionId === reference.productionId &&
      candidate.production.orderId === reference.production.orderId
    );
  });
}

/**
 * Finalizer อาจปิด PACKAGING เก่าที่ไม่ใช่ target DTF จึงต้อง lock ทุก step ของ
 * production ที่แตะ ตาม global order: topology mutex ของ order → steps ทั้งใบ
 * ORDER BY id → productions → orders. รอบหลายออเดอร์จอง mutex ด้วย orderId ที่เรียงแล้ว
 * ก่อนถือ row lock ใดๆ เพื่อกันรอบ A→B ชนกับ B→A.
 */
async function lockProductionChain(tx: PrismaTx, stepIds: readonly string[]) {
  const sortedStepIds = [...new Set(stepIds)].sort();
  const before = await readPrintStepReferences(tx, sortedStepIds);
  const orderIds = [
    ...new Set(before.map((reference) => reference.production.orderId)),
  ].sort();

  for (const orderId of orderIds) {
    await lockProductionTopology(tx, orderId);
  }

  // Snapshot ก่อน mutex ใช้แค่หา scope; ห้ามเชื่อถ้า membership เปลี่ยนระหว่างรอ
  const afterTopology = await readPrintStepReferences(tx, sortedStepIds);
  if (!samePrintStepMembership(before, afterTopology)) {
    conflict("โครงรอบพิมพ์เปลี่ยนจากอีกหน้าจอแล้ว — กรุณาโหลดใหม่");
  }

  const productionIds = [
    ...new Set(afterTopology.map((reference) => reference.productionId)),
  ].sort();
  for (const productionId of productionIds) {
    await tx.$queryRaw`SELECT id FROM production_steps WHERE production_id = ${productionId} ORDER BY id FOR UPDATE`;
  }
  for (const productionId of productionIds) {
    await tx.$queryRaw`SELECT id FROM productions WHERE id = ${productionId} FOR UPDATE`;
  }
  for (const orderId of orderIds) {
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
  }

  const locked = await readPrintStepReferences(tx, sortedStepIds);
  if (!samePrintStepMembership(afterTopology, locked)) {
    conflict("โครงรอบพิมพ์เปลี่ยนจากอีกหน้าจอแล้ว — กรุณาโหลดใหม่");
  }
}

/** Print-run mutations share the production lock order, then serialize the run row itself. */
async function lockPrintRunChain(tx: PrismaTx, runId: string) {
  const reference = await tx.printRun.findUnique({
    where: { id: runId },
    select: { items: { select: { productionStepId: true } } },
  });
  if (!reference) notFound("รอบพิมพ์", runId);
  await lockProductionChain(
    tx,
    reference.items.map((item) => item.productionStepId),
  );
  await tx.$queryRaw`SELECT id FROM print_runs WHERE id = ${runId} FOR UPDATE`;
  const lockedReference = await tx.printRun.findUnique({
    where: { id: runId },
    select: { items: { select: { productionStepId: true } } },
  });
  if (!lockedReference) notFound("รอบพิมพ์", runId);
  const beforeStepIds = reference.items.map((item) => item.productionStepId).sort();
  const lockedStepIds = lockedReference.items.map((item) => item.productionStepId).sort();
  if (JSON.stringify(beforeStepIds) !== JSON.stringify(lockedStepIds)) {
    conflict("สมาชิกรอบพิมพ์เปลี่ยนจากอีกหน้าจอแล้ว — กรุณาโหลดใหม่");
  }
}

const printRunLifecycleSelect = {
  id: true,
  runNumber: true,
  createdById: true,
  status: true,
  items: {
    select: {
      id: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          internalStatus: true,
        },
      },
      productionStep: {
        select: {
          id: true,
          productionId: true,
          operationCode: true,
          operationState: true,
          executionEnabled: true,
          workCenterId: true,
          assignedToId: true,
          qtyPlanned: true,
          qtyGood: true,
          qtyScrap: true,
          qtyRework: true,
          revision: true,
          workCenter: { select: { code: true } },
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
            select: { orderId: true, workOrderState: true },
          },
        },
      },
    },
  },
} satisfies Prisma.PrintRunSelect;

type PrintRunLifecycleRow = Prisma.PrintRunGetPayload<{
  select: typeof printRunLifecycleSelect;
}>;

function v2LifecycleItems(run: PrintRunLifecycleRow) {
  const v2Items = run.items.filter(
    (item) => item.productionStep.executionEnabled,
  );
  if (v2Items.length === 0) return [];
  assertProductionV2ApiEnabled();
  if (
    v2Items.length !== run.items.length ||
    v2Items.some(
      (item) => item.productionStep.workCenter?.code !== "DTF_PRINT",
    )
  ) {
    badRequest("รอบพิมพ์ผสมงานเดิมหรือ Operation Job ที่ไม่ใช่ DTF ไม่ได้");
  }
  return v2Items;
}

function cancelTargetState(
  operation: Pick<
    SpecializedOperation,
    "exceptions" | "operationState" | "qtyGood" | "qtyScrap" | "qtyRework"
  >,
): OperationState {
  if (operation.exceptions.length > 0 || operation.operationState === "BLOCKED") {
    return "BLOCKED";
  }
  if (operation.qtyGood + operation.qtyScrap + operation.qtyRework > 0) {
    return "RUNNING";
  }
  return "READY";
}

// ============================================================
// คิวพิมพ์ฟิล์ม — ขั้น DTF_PRINT ที่ "ไฟล์พร้อม + ยังพิมพ์ไม่ครบ + ไม่ติดรอบอื่น"
// ============================================================

export interface PrintQueueEntry {
  stepId: string;
  // Production V2 ใช้ operationJobId + revision เป็น optimistic concurrency contract.
  // stepId ยังอยู่เพื่อให้หน้า legacy ทำงานเดิมได้ตลอดช่วง rollback window.
  operationJobId: string | null;
  revision: number | null;
  executionEnabled: boolean;
  operationState: OperationState | null;
  productionId: string;
  orderId: string;
  orderNumber: string;
  orderName: string;
  customerName: string;
  dueDate: Date | null;
  qtyDone: number;
  qtyTotal: number; // จำนวนที่ต้องพิมพ์ (qtyTotal ของขั้น หรือยอดรวมออเดอร์)
  qtyGood: number;
  qtyPlanned: number;
  remaining: number;
  quantityLines: Array<{
    id: string;
    scopeKey: string;
    label: string;
    description: string;
    sku: string | null;
    size: string | null;
    color: string | null;
    printPosition: string | null;
    qtyPlanned: number;
    qtyGood: number;
    qtyScrap: number;
    qtyRework: number;
    revision: number;
  }>;
  // แบบอนุมัติล่าสุด — ให้ช่างเห็นลาย+เวอร์ชันบนคิว กันพิมพ์ผิดเวอร์ชัน (UX2 · ไม่มีเงิน)
  design: { versionNumber: number; fileUrl: string; thumbnailUrl: string | null } | null;
}

type PrintLaneStep = {
  id: string;
  stepType: string;
  status: string;
  sortOrder: number;
};

function isCurrentPrintLaneStep(
  stepId: string,
  siblings: readonly PrintLaneStep[],
) {
  // production.create ยอม sortOrder ซ้ำได้ — id เป็น tiebreaker เดียวกันทั้ง queue/mutation
  // ก่อนส่งเข้า helper ที่ sort แบบ stable ด้วย sortOrder เพื่อไม่ให้ DB row order ตัดสินคิว.
  const deterministic = [...siblings].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  );
  return firstPendingStepIdsByLane(deterministic).has(stepId);
}

export async function getPrintQueue(
  prisma: ExtendedPrismaClient,
  access: PrintRunAccess,
): Promise<PrintQueueEntry[]> {
  const ownAssignment = access.canSupervise
    ? null
    : { OR: [{ assignedToId: access.userId }, { assignedToId: null }] };
  const steps = await prisma.productionStep.findMany({
    where: {
      stepType: "DTF_PRINT",
      OR: [
        {
          executionEnabled: false,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          production: { order: { internalStatus: "PRODUCING" } },
          ...(ownAssignment ? { AND: [ownAssignment] } : {}),
        },
        {
          executionEnabled: true,
          operationState: { in: ["READY", "RUNNING"] },
          production: {
            workOrderState: { in: [...ACTIVE_STATION_WORK_ORDER_STATES] },
            order: {
              internalStatus: { in: [...ACTIVE_STATION_ORDER_STATUSES] },
            },
          },
          predecessorLinks: {
            every: { predecessorStep: { operationState: "COMPLETED" } },
          },
          exceptions: {
            none: {
              state: { in: ["OPEN", "ACKNOWLEDGED"] },
              blocksJob: true,
            },
          },
          workCenter: {
            is: {
              code: "DTF_PRINT",
              isActive: true,
              ...(access.canSupervise
                ? {}
                : {
                    members: {
                      some: { userId: access.userId, isActive: true },
                    },
              }),
            },
          },
          AND: [
            ACTIVE_STATION_RESOURCE_WHERE,
            ...(ownAssignment ? [ownAssignment] : []),
          ],
        },
      ],
    },
    select: {
      id: true,
      productionId: true,
      executionEnabled: true,
      operationState: true,
      revision: true,
      qtyGood: true,
      qtyPlanned: true,
      qtyDone: true,
      qtyTotal: true,
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
      workCenter: {
        select: {
          code: true,
          members: {
            where: { userId: access.userId, isActive: true },
            take: 1,
            select: { id: true },
          },
        },
      },
      quantities: {
        orderBy: { scopeKey: "asc" },
        select: {
          id: true,
          scopeKey: true,
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
      printRunItems: {
        where: { printRun: { status: { in: [...ACTIVE_RUN_STATUSES] } } },
        select: { id: true },
      },
      production: {
        select: {
          steps: {
            select: { id: true, stepType: true, status: true, sortOrder: true },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              title: true,
              internalStatus: true,
              deadline: true,
              customer: { select: { name: true } },
              items: { select: { totalQuantity: true } },
              designs: {
                where: { approvalStatus: "APPROVED" },
                orderBy: { versionNumber: "desc" },
                take: 1,
                select: { versionNumber: true, fileUrl: true, thumbnailUrl: true },
              },
            },
          },
        },
      },
    },
  });

  const entries: PrintQueueEntry[] = [];
  for (const s of steps) {
    const order = s.production.order;
    const isV2 = s.executionEnabled === true;
    if (
      isV2 &&
      (!(["READY", "RUNNING"] as OperationState[]).includes(s.operationState) ||
        s.predecessorLinks.some(
          (link) => link.predecessorStep.operationState !== "COMPLETED",
        ) ||
        s.exceptions.length > 0 ||
        s.workCenter?.code !== "DTF_PRINT" ||
        (!access.canSupervise && s.workCenter.members.length === 0))
    ) {
      continue;
    }
    if (!isV2 && !isCurrentPrintLaneStep(s.id, s.production.steps)) continue;
    const qtyDone = isV2 ? s.qtyGood : s.qtyDone;
    const qtyTotal = isV2 ? s.qtyPlanned : s.qtyTotal;
    const slot = printQueueSlotOf({
      inActiveRun: s.printRunItems.length > 0,
      hasApprovedDesign: order.designs.length > 0,
      orderInternalStatus: order.internalStatus,
      qtyDone,
      qtyTotal,
      orderQty: order.items.reduce((sum, it) => sum + it.totalQuantity, 0),
    });
    if (!slot) continue; // ติดรอบ active / ไฟล์ไม่พร้อม / ไม่รู้จำนวน / พิมพ์ครบแล้ว
    entries.push({
      stepId: s.id,
      operationJobId: isV2 ? s.id : null,
      revision: isV2 ? s.revision : null,
      executionEnabled: isV2,
      operationState: isV2 ? s.operationState : null,
      productionId: s.productionId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderName: order.title ?? "",
      customerName: order.customer.name,
      dueDate: order.deadline,
      qtyDone,
      qtyTotal: slot.qtyTotal,
      qtyGood: qtyDone,
      qtyPlanned: slot.qtyTotal,
      remaining: slot.remaining,
      quantityLines: isV2
        ? s.quantities.map((line) => ({ ...line, label: line.description }))
        : [],
      design: order.designs[0] ?? null,
    });
  }

  // เรียงตามกำหนดส่ง — งานไม่มีกำหนดไปท้ายคิว
  entries.sort((a, b) => compareDueDate(a.dueDate, b.dueDate));
  return entries;
}

// ============================================================
// เปิดรอบพิมพ์ — เลือกหลายงานจากคิวรวมเป็นรอบเดียว
// ============================================================

export interface CreatePrintRunParams {
  items: Array<{
    stepId?: string;
    operationJobId?: string;
    expectedRevision?: number;
    qty: number;
  }>;
  commandId?: string;
  workResourceId?: string;
  note?: string;
  userId: string;
  canSupervise: boolean;
}

export async function createPrintRun(prisma: ExtendedPrismaClient, params: CreatePrintRunParams) {
  if (params.items.length === 0) badRequest("ยังไม่ได้เลือกงานเข้ารอบพิมพ์");
  for (const item of params.items) {
    if (!!item.stepId === !!item.operationJobId) {
      badRequest("งานในรอบต้องระบุ stepId หรือ operationJobId อย่างใดอย่างหนึ่ง");
    }
    if (item.operationJobId && item.expectedRevision === undefined) {
      badRequest("คำสั่ง Production V2 ต้องระบุ expectedRevision");
    }
  }
  const hasV2Items = params.items.some((item) => !!item.operationJobId);
  if (hasV2Items) assertProductionV2ApiEnabled();
  if (hasV2Items && !params.commandId) {
    badRequest("คำสั่ง Production V2 ต้องระบุ commandId");
  }
  if (hasV2Items && params.items.some((item) => !item.operationJobId)) {
    badRequest("รอบพิมพ์หนึ่งรอบผสมงานเดิมกับ Operation Job V2 ไม่ได้");
  }
  const stepIds = params.items.map((item) => item.operationJobId ?? item.stepId!);
  if (new Set(stepIds).size !== stepIds.length) badRequest("เลือกงานซ้ำกันในรอบเดียว");

  return prisma.$transaction(async (tx) => {
    // lock + re-read ถึงแถวออเดอร์ก่อนตรวจ — request เก่าจึงเดินต่อไม่ได้หลังอีกจอพัก/ยกเลิกงาน
    await lockProductionChain(tx as PrismaTx, stepIds);

    const steps = await tx.productionStep.findMany({
      where: { id: { in: stepIds } },
      select: {
        id: true,
        stepType: true,
        status: true,
        executionEnabled: true,
        assignedToId: true,
        qtyDone: true,
        qtyTotal: true,
        printRunItems: {
          where: { printRun: { status: { in: [...ACTIVE_RUN_STATUSES] } } },
          select: { id: true },
        },
        production: {
          select: {
            steps: {
              select: { id: true, stepType: true, status: true, sortOrder: true },
            },
            order: {
              select: {
                id: true,
                orderNumber: true,
                internalStatus: true,
                items: { select: { totalQuantity: true } },
                designs: { where: { approvalStatus: "APPROVED" }, take: 1, select: { id: true } },
              },
            },
          },
        },
      },
    });
    const byId = new Map(steps.map((s) => [s.id, s]));

    const prepared: Array<{
      stepId: string;
      orderId: string;
      qty: number;
      seedQtyTotal: number | null;
      operation: SpecializedOperation | null;
    }> = [];
    for (const item of params.items) {
      const targetStepId = item.operationJobId ?? item.stepId!;
      const step = byId.get(targetStepId);
      if (!step) notFound("ขั้นตอนผลิต", targetStepId);
      const order = step.production.order;
      if (!item.operationJobId && step.executionEnabled) {
        badRequest(
          `งาน ${order.orderNumber}: ขั้นนี้เปิดใช้ Production V2 แล้ว — ต้องส่ง operationJobId พร้อม revision`,
        );
      }
      const operation = item.operationJobId
        ? await loadSpecializedOperation(tx as PrismaTx, {
            operationJobId: item.operationJobId,
            expectedRevision: item.expectedRevision!,
            actorId: params.userId,
            canSupervise: params.canSupervise,
            requiredWorkCenterCode: "DTF_PRINT",
            orderId: order.id,
          })
        : null;
      if (!operation && step.stepType !== "DTF_PRINT") {
        badRequest(`งาน ${order.orderNumber}: รอบพิมพ์รับเฉพาะขั้นพิมพ์ฟิล์ม DTF`);
      }
      assertPrintRunOrdersProducing([{ order }]);
      if (
        !operation &&
        !params.canSupervise &&
        step.assignedToId !== null &&
        step.assignedToId !== params.userId
      ) {
        forbidden(`งาน ${order.orderNumber}: ขั้นพิมพ์นี้ถูกมอบหมายให้คนอื่นแล้ว`);
      }
      if (!operation && step.status !== "PENDING" && step.status !== "IN_PROGRESS") {
        badRequest(
          `งาน ${order.orderNumber}: ขั้นพิมพ์ฟิล์มไม่อยู่สถานะที่เข้ารอบได้ (${step.status}) — งานมีปัญหา/ถูกพักให้แก้ที่หน้าใบผลิตก่อน`
        );
      }
      if (!operation && !isCurrentPrintLaneStep(step.id, step.production.steps)) {
        badRequest(
          `งาน ${order.orderNumber}: ยังเข้ารอบพิมพ์ขั้นนี้ไม่ได้ — ทำขั้นก่อนหน้าในสายงานเดียวกันให้เสร็จก่อน`,
        );
      }
      if (step.printRunItems.length > 0) {
        badRequest(`งาน ${order.orderNumber}: อยู่ในรอบพิมพ์อื่นที่ยังไม่จบ`);
      }
      if (!isFileReadyForPrint(order.designs.length > 0, order.internalStatus)) {
        badRequest(`งาน ${order.orderNumber}: แบบยังไม่อนุมัติ — ไฟล์ยังไม่พร้อมพิมพ์`);
      }

      const { seedQtyTotal } = planRunItemQty({
        orderNumber: order.orderNumber,
        stepQtyDone: operation?.qtyGood ?? step.qtyDone,
        stepQtyTotal: operation?.qtyPlanned ?? step.qtyTotal,
        orderQty: order.items.reduce((sum, it) => sum + it.totalQuantity, 0),
        qty: item.qty,
      });
      prepared.push({
        stepId: step.id,
        orderId: order.id,
        qty: item.qty,
        seedQtyTotal: operation ? null : seedQtyTotal,
        operation,
      });
    }

    if (hasV2Items && params.workResourceId) {
      const resource = await tx.workResource.findUnique({
        where: { id: params.workResourceId },
        select: {
          isActive: true,
          state: true,
          workCenter: { select: { code: true } },
        },
      });
      if (
        !resource?.isActive ||
        resource.workCenter.code !== "DTF_PRINT" ||
        ["INACTIVE", "DOWN"].includes(resource.state)
      ) {
        badRequest("เครื่องพิมพ์ DTF ที่เลือกไม่พร้อมใช้งาน");
      }
    }

    const runNumber = await nextDocumentNumber(tx, "PRINT_RUN");
    const run = await tx.printRun.create({
      data: {
        runNumber,
        note: params.note,
        createdById: params.userId,
        ...(hasV2Items
          ? {
              operatorId: params.userId,
              workResourceId: params.workResourceId,
            }
          : {}),
        items: {
          create: prepared.map((p) => ({
            productionStepId: p.stepId,
            orderId: p.orderId,
            qty: p.qty,
          })),
        },
      },
      include: { items: true },
    });

    // งานเข้ารอบ = เริ่มลงมือแล้ว — ขั้น PENDING ขยับเป็นกำลังทำ + seed qtyTotal
    for (const [index, p] of prepared.entries()) {
      if (p.operation) {
        await recordSpecializedOperationEvent(tx as PrismaTx, {
          operation: p.operation,
          commandId: printRunEventCommandId(
            "create",
            params.commandId!,
          ),
          sequence: index,
          actorId: params.userId,
          eventType: "STARTED",
          payload: { printRunId: run.id, printRunItemId: run.items[index]!.id },
        });
        continue;
      }
      await tx.productionStep.update({
        where: { id: p.stepId },
        data: {
          ...(p.seedQtyTotal !== null ? { qtyTotal: p.seedQtyTotal } : {}),
          status: "IN_PROGRESS",
          assignedToId: byId.get(p.stepId)!.assignedToId ?? params.userId,
          startedAt: byId.get(p.stepId)!.status === "PENDING" ? new Date() : undefined,
        },
      });
    }

    await createAuditLog(tx as PrismaTx, {
      userId: params.userId,
      action: "CREATE",
      entityType: "PRINT_RUN",
      entityId: run.id,
      newValue: { runNumber: run.runNumber, items: run.items.length },
    });

    return run;
  });
}

// ============================================================
// จังหวะของรอบ: พิมพ์จบทั้งม้วน → ตัดแยก+ติดป้ายเสร็จ (ปิดขั้นเป็นชุด)
// ============================================================

export async function markPrintRunPrinted(
  prisma: ExtendedPrismaClient,
  params: PrintRunLifecycleCommandParams,
) {
  return prisma.$transaction(async (tx) => {
    await lockPrintRunChain(tx as PrismaTx, params.runId);
    const run = await tx.printRun.findUniqueOrThrow({
      where: { id: params.runId },
      select: printRunLifecycleSelect,
    });
    assertCanManagePrintRun(run, params);
    const v2Items = v2LifecycleItems(run);
    if (v2Items.length > 0) {
      await assertV2PrintRunMembership(tx as PrismaTx, v2Items, params);
      const revisions = lifecycleRevisionMap(v2Items, params);
      const ledger = await beginPrintRunLifecycleCommand(
        tx as PrismaTx,
        "markPrintRunPrinted",
        params,
        revisions.normalized,
      );
      if (ledger.kind === "REPLAY") return ledger.result;

      assertPrintRunOrdersProducing(v2Items);
      if (run.status !== "PRINTING") {
        badRequest("รอบนี้ไม่ได้อยู่สถานะกำลังพิมพ์ — รีเฟรชดูสถานะล่าสุดก่อน");
      }
      const prepared = [] as Array<{
        itemId: string;
        operation: SpecializedOperation;
      }>;
      for (const item of [...v2Items].sort((left, right) =>
        left.productionStep.id.localeCompare(right.productionStep.id),
      )) {
        prepared.push({
          itemId: item.id,
          operation: await loadSpecializedOperation(tx as PrismaTx, {
            operationJobId: item.productionStep.id,
            expectedRevision: revisions.byItemId.get(item.id)!,
            actorId: params.userId,
            canSupervise: params.canSupervise,
            requiredWorkCenterCode: "DTF_PRINT",
            orderId: item.order.id,
            allowedStates: ["RUNNING"],
          }),
        });
      }
      const res = await tx.printRun.updateMany({
        where: { id: params.runId, status: "PRINTING" },
        data: { status: "PRINTED", printedAt: new Date() },
      });
      if (res.count === 0) {
        badRequest("รอบนี้ไม่ได้อยู่สถานะกำลังพิมพ์ — รีเฟรชดูสถานะล่าสุดก่อน");
      }
      const operations = [] as PrintRunLifecycleCommandResult["operations"];
      for (const [sequence, preparedItem] of prepared.entries()) {
        const updated = await recordSpecializedOperationEvent(tx as PrismaTx, {
          operation: preparedItem.operation,
          commandId: printRunEventCommandId("mark-printed", params.commandId!),
          sequence,
          actorId: params.userId,
          eventType: "OUTPUT_REPORTED",
          nextState: "RUNNING",
          payload: {
            action: "PRINT_RUN_MARKED_PRINTED",
            printRunId: run.id,
            printRunItemId: preparedItem.itemId,
            expectedRevision: revisions.byItemId.get(preparedItem.itemId)!,
          },
        });
        operations.push({
          operationJobId: updated.id,
          operationState: updated.operationState,
          revision: updated.revision,
        });
      }
      await createAuditLog(tx as PrismaTx, {
        userId: params.userId,
        action: "UPDATE",
        entityType: "PRINT_RUN",
        entityId: params.runId,
        oldValue: { runNumber: run.runNumber, status: "PRINTING" },
        newValue: { runNumber: run.runNumber, status: "PRINTED" },
      });
      return completePrintRunLifecycleCommand(tx as PrismaTx, params.commandId!, {
        runId: run.id,
        status: "PRINTED",
        operations,
      });
    }

    await assertV2PrintRunMembership(tx as PrismaTx, run.items, params);
    assertPrintRunOrdersProducing(run.items);
    const res = await tx.printRun.updateMany({
      where: { id: params.runId, status: "PRINTING" },
      data: { status: "PRINTED", printedAt: new Date() },
    });
    if (res.count === 0) {
      badRequest("รอบนี้ไม่ได้อยู่สถานะกำลังพิมพ์ — รีเฟรชดูสถานะล่าสุดก่อน");
    }
    await createAuditLog(tx as PrismaTx, {
      userId: params.userId,
      action: "UPDATE",
      entityType: "PRINT_RUN",
      entityId: params.runId,
      oldValue: { runNumber: run.runNumber, status: "PRINTING" },
      newValue: { runNumber: run.runNumber, status: "PRINTED" },
    });
  });
}

export interface CompletePrintRunParams {
  runId: string;
  commandId?: string;
  results?: Array<{
    itemId: string;
    expectedRevision: number;
    qtyGood: number;
    qtyScrap: number;
    qtyReprint: number;
    quantityLines: Array<{
      quantityLineId: string;
      qtyGood: number;
      qtyScrap: number;
    }>;
  }>;
  /** ฟิล์มพิมพ์เผื่อต่องาน (optional) — เข้าคลังฟิล์มพร้อมรีด */
  extras?: Array<{ itemId: string; extraQty: number; label?: string }>;
  userId: string;
  canSupervise: boolean;
}

export async function completePrintRun(
  prisma: ExtendedPrismaClient,
  params: CompletePrintRunParams
) {
  return prisma.$transaction(async (tx) => {
    await lockPrintRunChain(tx as PrismaTx, params.runId);
    const run = await tx.printRun.findUniqueOrThrow({
      where: { id: params.runId },
      include: {
        items: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                title: true,
                customerId: true,
                internalStatus: true,
              },
            },
            productionStep: {
              select: {
                assignedToId: true,
                executionEnabled: true,
                workCenter: { select: { code: true } },
              },
            },
          },
        },
      },
    });
    assertCanManagePrintRun(run, params);
    assertPrintRunOrdersProducing(run.items);
    const v2Items = run.items.filter(
      (item) =>
        item.productionStep.executionEnabled &&
        item.productionStep.workCenter?.code === "DTF_PRINT",
    );
    if (v2Items.length > 0) assertProductionV2ApiEnabled();
    if (v2Items.length > 0 && v2Items.length !== run.items.length) {
      badRequest("รอบพิมพ์ผสมงานเดิมกับ Operation Job V2 ไม่ได้");
    }
    if (v2Items.length > 0 && !params.commandId) {
      badRequest("คำสั่ง Production V2 ต้องระบุ commandId");
    }
    const resultByItem = new Map(
      (params.results ?? []).map((result) => [result.itemId, result] as const),
    );
    if (
      v2Items.length > 0 &&
      (resultByItem.size !== v2Items.length ||
        v2Items.some((item) => !resultByItem.has(item.id)))
    ) {
      badRequest("ต้องรายงาน good/scrap/reprint ให้ครบทุกงานในรอบพิมพ์ V2");
    }
    if (v2Items.length > 0) {
      for (const item of v2Items) {
        const result = resultByItem.get(item.id)!;
        if (result.quantityLines.length === 0) {
          badRequest("ต้องรายงานผลแยกตามสินค้า สี ไซซ์ และจุดพิมพ์");
        }
        if (
          new Set(result.quantityLines.map((line) => line.quantityLineId)).size !==
          result.quantityLines.length
        ) {
          badRequest("quantity line ซ้ำกันในผลรอบพิมพ์");
        }
        const lineTotals = result.quantityLines.reduce(
          (sum, line) => ({
            qtyGood: sum.qtyGood + line.qtyGood,
            qtyScrap: sum.qtyScrap + line.qtyScrap,
          }),
          { qtyGood: 0, qtyScrap: 0 },
        );
        if (
          lineTotals.qtyGood !== result.qtyGood ||
          lineTotals.qtyScrap !== result.qtyScrap
        ) {
          badRequest("ผลรวม quantity line ต้องตรงกับจำนวนฟิล์มดีและเสียของงาน");
        }
      }
    }
    // run row ถูก lock แล้ว: ผ่านจุดตัดแยกได้เฉพาะรอบที่พิมพ์จบ และสองจอกดซ้ำไม่ได้
    const res = await tx.printRun.updateMany({
      where: { id: params.runId, status: "PRINTED" },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    if (res.count === 0) {
      badRequest("รอบนี้ยังไม่ได้กดพิมพ์จบ หรือถูกปิดไปแล้ว — รีเฟรชดูสถานะล่าสุดก่อน");
    }
    const extraByItem = new Map(
      (params.extras ?? []).map((e) => [e.itemId, e] as const)
    );

    const touchedProductions = new Set<string>();
    // เรียงตาม stepId — ลำดับ lock global เดียวกับเปิด/ยกเลิกรอบ (กัน deadlock)
    const sortedItems = [...run.items].sort((a, b) =>
      a.productionStepId.localeCompare(b.productionStepId)
    );
    for (const item of sortedItems) {
      // lockPrintRunChain ถือ lock แถวขั้นทั้งหมดตามลำดับ id ไว้แล้วก่อนอ่านสถานะออเดอร์
      const v2Result = resultByItem.get(item.id);
      if (v2Items.length > 0) {
        if (!v2Result) {
          badRequest("ไม่พบผล good/scrap/reprint ของงานในรอบพิมพ์ V2");
        }
        try {
          assertPrintRunItemResult({ qty: item.qty, ...v2Result });
        } catch (error) {
          if (error instanceof ManufacturingDomainError) {
            badRequest(error.message);
          }
          throw error;
        }
        const operation = await loadSpecializedOperation(tx as PrismaTx, {
          operationJobId: item.productionStepId,
          expectedRevision: v2Result.expectedRevision,
          actorId: params.userId,
          canSupervise: params.canSupervise,
          requiredWorkCenterCode: "DTF_PRINT",
          orderId: item.order.id,
          allowedStates: ["RUNNING"],
        });
        await tx.printRunItem.update({
          where: { id: item.id },
          data: {
            qtyGood: v2Result.qtyGood,
            qtyScrap: v2Result.qtyScrap,
            qtyReprint: v2Result.qtyReprint,
            resultReportedAt: new Date(),
          },
        });
        await recordSpecializedOperationOutput(tx as PrismaTx, {
          operation,
          commandId: printRunEventCommandId(
            "complete",
            params.commandId!,
          ),
          sequence: sortedItems.indexOf(item),
          actorId: params.userId,
          eventType: "OUTPUT_REPORTED",
          delta: {
            qtyGood: v2Result.qtyGood,
            qtyScrap: v2Result.qtyScrap,
            qtyRework: 0,
          },
          quantityLines: v2Result.quantityLines.map((line) => ({
            ...line,
            qtyRework: 0,
          })),
          payload: {
            printRunId: run.id,
            printRunItemId: item.id,
            qtyReprint: v2Result.qtyReprint,
          },
        });
      } else {
      const bumped = await tx.productionStep.update({
        where: { id: item.productionStepId },
        data: { qtyDone: { increment: item.qty } },
        select: { qtyDone: true, qtyTotal: true, productionId: true },
      });
      // รอบ active อื่นที่ยังกินขั้นนี้อยู่ — ยังปิดขั้นไม่ได้ (แบ่งพิมพ์หลายรอบ)
      const openRuns = await tx.printRunItem.count({
        where: {
          productionStepId: item.productionStepId,
          printRunId: { not: run.id },
          printRun: { status: { in: [...ACTIVE_RUN_STATUSES] } },
        },
      });
      await tx.productionStep.update({
        where: { id: item.productionStepId },
        data: shouldCloseStep({ qtyDone: bumped.qtyDone, qtyTotal: bumped.qtyTotal, openRuns })
          ? { status: "COMPLETED", completedAt: new Date() }
          : { status: "IN_PROGRESS" },
      });
      touchedProductions.add(bumped.productionId);
      }

      // ฟิล์มพิมพ์เผื่อ → คลังฟิล์มพร้อมรีด (ป้าย: ลายไหน ของลูกค้าไหน กี่ชิ้น)
      const extra = extraByItem.get(item.id);
      if (extra && extra.extraQty > 0) {
        if (!Number.isInteger(extra.extraQty)) {
          badRequest(`ฟิล์มเผื่อของงาน ${item.order.orderNumber} ต้องเป็นจำนวนเต็ม`);
        }
        await tx.printRunItem.update({
          where: { id: item.id },
          data: { extraQty: extra.extraQty },
        });
        // ผูกฟิล์มกับคลังลายเมื่อระบุได้ไม่กำกวม (งานสั่งซ้ำลายผูกคลังมาแล้ว) —
        // ออเดอร์หลายลาย/ลายยังไม่เข้าคลัง = null (QC ผ่านจะย้อนผูกให้ถ้าไม่กำกวม)
        // ไม่เพิ่มช่องกรอกหน้างาน (มติ batch เดียว)
        const artworkId = await resolveSoleOrderArtworkId(tx as PrismaTx, item.order.id);
        await tx.filmStock.create({
          data: {
            customerId: item.order.customerId,
            orderId: item.order.id,
            printRunId: run.id,
            artworkId,
            label:
              extra.label?.trim() ||
              `ลายงาน ${item.order.orderNumber}${item.order.title ? ` — ${item.order.title}` : ""}`,
            qty: extra.extraQty,
            initialQty: extra.extraQty,
          },
        });
      }
    }

    // rollup กลางตัวเดียวกับ updateStep/outsource — ปิดใบผลิต + ดันออเดอร์เมื่อครบ
    for (const productionId of touchedProductions) {
      await finalizeProductionIfComplete(tx as PrismaTx, {
        productionId,
        changedBy: params.userId,
      });
    }

    await createAuditLog(tx as PrismaTx, {
      userId: params.userId,
      action: "UPDATE",
      entityType: "PRINT_RUN",
      entityId: run.id,
      newValue: { runNumber: run.runNumber, status: "COMPLETED" },
    });

    return run;
  });
}

export async function cancelPrintRun(
  prisma: ExtendedPrismaClient,
  params: PrintRunLifecycleCommandParams,
) {
  return prisma.$transaction(async (tx) => {
    // recovery ยังยอมให้ยกเลิกรอบของงานที่ถูกพัก/ยกเลิก แต่ใช้ lock order เดียวกับ
    // create/mark/complete ก่อนคืนขั้น เพื่อไม่ให้ cancel ถือ run แล้วรอ step สวนทางกัน
    await lockPrintRunChain(tx as PrismaTx, params.runId);
    const run = await tx.printRun.findUniqueOrThrow({
      where: { id: params.runId },
      select: printRunLifecycleSelect,
    });
    assertCanManagePrintRun(run, params);
    const v2Items = v2LifecycleItems(run);
    if (v2Items.length > 0) {
      await assertV2PrintRunMembership(tx as PrismaTx, v2Items, params);
      const revisions = lifecycleRevisionMap(v2Items, params);
      const ledger = await beginPrintRunLifecycleCommand(
        tx as PrismaTx,
        "cancelPrintRun",
        params,
        revisions.normalized,
      );
      if (ledger.kind === "REPLAY") return ledger.result;
      if (run.status !== "PRINTING") {
        badRequest("ยกเลิกได้เฉพาะรอบที่ยังไม่กดพิมพ์จบ");
      }
      for (const item of v2Items) {
        assertExpectedRevision(
          item.productionStep.revision,
          revisions.byItemId.get(item.id)!,
        );
        if (
          !(["READY", "RUNNING", "BLOCKED"] as OperationState[]).includes(
            item.productionStep.operationState,
          )
        ) {
          badRequest("Operation Job ในรอบนี้ไม่อยู่สถานะที่ยกเลิกรอบได้");
        }
      }
      const res = await tx.printRun.updateMany({
        where: { id: params.runId, status: "PRINTING" },
        data: { status: "CANCELLED", completedAt: new Date() },
      });
      if (res.count === 0) {
        badRequest("ยกเลิกได้เฉพาะรอบที่ยังไม่กดพิมพ์จบ");
      }
      const operations = [] as PrintRunLifecycleCommandResult["operations"];
      const sortedItems = [...v2Items].sort((left, right) =>
        left.productionStep.id.localeCompare(right.productionStep.id),
      );
      for (const [sequence, item] of sortedItems.entries()) {
        const fromState = item.productionStep.operationState;
        const otherRuns = await tx.printRunItem.count({
          where: {
            productionStepId: item.productionStep.id,
            printRunId: { not: params.runId },
            printRun: { status: { in: [...ACTIVE_RUN_STATUSES] } },
          },
        });
        const nextState =
          otherRuns > 0
            ? fromState
            : cancelTargetState(item.productionStep);
        const updated = await tx.productionStep.update({
          where: { id: item.productionStep.id },
          data: {
            operationState: nextState,
            status:
              nextState === "BLOCKED"
                ? "ON_HOLD"
                : nextState === "READY"
                  ? "PENDING"
                  : "IN_PROGRESS",
            revision: { increment: 1 },
            ...(nextState === "READY" ? { startedAt: null } : {}),
          },
          select: {
            id: true,
            operationState: true,
            revision: true,
          },
        });
        await tx.operationEvent.create({
          data: {
            productionId: item.productionStep.productionId,
            productionStepId: item.productionStep.id,
            eventType: "CANCELLED",
            commandId: printRunEventCommandId("cancel", params.commandId!),
            sequence,
            actorId: params.userId,
            fromState,
            toState: nextState,
            qtyGoodDelta: 0,
            qtyScrapDelta: 0,
            qtyReworkDelta: 0,
            payload: {
              action: "PRINT_RUN_CANCELLED",
              printRunId: run.id,
              printRunItemId: item.id,
              expectedRevision: revisions.byItemId.get(item.id)!,
            },
          },
        });
        operations.push({
          operationJobId: updated.id,
          operationState: updated.operationState,
          revision: updated.revision,
        });
      }
      await createAuditLog(tx as PrismaTx, {
        userId: params.userId,
        action: "UPDATE",
        entityType: "PRINT_RUN",
        entityId: params.runId,
        oldValue: { runNumber: run.runNumber, status: "PRINTING" },
        newValue: { runNumber: run.runNumber, status: "CANCELLED" },
      });
      return completePrintRunLifecycleCommand(tx as PrismaTx, params.commandId!, {
        runId: run.id,
        status: "CANCELLED",
        operations,
      });
    }

    await assertV2PrintRunMembership(tx as PrismaTx, run.items, params);
    // ยกเลิกได้เฉพาะก่อนพิมพ์จบ — พิมพ์ไปแล้วฟิล์มเกิดขึ้นจริง ต้องเดินต่อให้จบรอบ
    const res = await tx.printRun.updateMany({
      where: { id: params.runId, status: "PRINTING" },
      // completedAt = เวลาจบรอบ (รวมยกเลิก) — list ประวัติ 7 วันกรองจาก field นี้
      data: { status: "CANCELLED", completedAt: new Date() },
    });
    if (res.count === 0) {
      badRequest("ยกเลิกได้เฉพาะรอบที่ยังไม่กดพิมพ์จบ");
    }
    // คืนขั้นที่ยังไม่มีความคืบหน้าจริงกลับเข้าคิว
    const items = await tx.printRunItem.findMany({
      where: { printRunId: params.runId },
      select: { productionStepId: true },
      orderBy: { productionStepId: "asc" }, // ลำดับ lock global เดียวกันทุก path
    });
    for (const item of items) {
      // lockPrintRunChain ถือ step lock ไว้แล้ว; ทาง recovery จึงคืนคิวได้โดยไม่สลับ lock order
      const otherRuns = await tx.printRunItem.count({
        where: {
          productionStepId: item.productionStepId,
          printRunId: { not: params.runId },
          printRun: { status: { in: [...ACTIVE_RUN_STATUSES] } },
        },
      });
      if (otherRuns === 0) {
        await tx.productionStep.updateMany({
          where: { id: item.productionStepId, status: "IN_PROGRESS", qtyDone: 0 },
          data: { status: "PENDING", startedAt: null },
        });
      }
    }
    await createAuditLog(tx as PrismaTx, {
      userId: params.userId,
      action: "UPDATE",
      entityType: "PRINT_RUN",
      entityId: params.runId,
      oldValue: { runNumber: run.runNumber, status: "PRINTING" },
      newValue: { runNumber: run.runNumber, status: "CANCELLED" },
    });
  });
}

// ============================================================
// รายการรอบ — จอช่างพิมพ์ (รอบค้าง) + ประวัติล่าสุด
// ============================================================

export async function listPrintRuns(
  prisma: ExtendedPrismaClient,
  access: PrintRunAccess,
) {
  const runs = await prisma.printRun.findMany({
    where: {
      OR: [
        { status: { in: [...ACTIVE_RUN_STATUSES] } },
        // ประวัติรอบที่จบ/ยกเลิกล่าสุดพอให้ย้อนดู — ไม่ลาก list ยาว
        { completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      runNumber: true,
      status: true,
      note: true,
      printedAt: true,
      completedAt: true,
      createdAt: true,
      createdById: true,
      createdBy: { select: { name: true } },
      items: {
        select: {
          id: true,
          qty: true,
          extraQty: true,
          qtyGood: true,
          qtyScrap: true,
          qtyReprint: true,
          resultReportedAt: true,
          order: {
            select: {
              orderNumber: true,
              title: true,
              deadline: true,
              internalStatus: true,
              designs: {
                where: { approvalStatus: "APPROVED" },
                orderBy: { versionNumber: "desc" },
                take: 1,
                select: { versionNumber: true, fileUrl: true, thumbnailUrl: true },
              },
            },
          },
          productionStep: {
            select: {
              id: true,
              status: true,
              qtyDone: true,
              qtyTotal: true,
              executionEnabled: true,
              operationState: true,
              revision: true,
              qtyGood: true,
              qtyPlanned: true,
              assignedToId: true,
              workCenterId: true,
              workCenter: {
                select: {
                  code: true,
                  isActive: true,
                  members: {
                    where: { userId: access.userId, isActive: true },
                    take: 1,
                    select: { id: true },
                  },
                },
              },
              workResource: {
                select: { isActive: true, state: true },
              },
              production: {
                select: {
                  workOrderState: true,
                  order: { select: { internalStatus: true } },
                },
              },
              exceptions: {
                where: {
                  state: { in: ["OPEN", "ACKNOWLEDGED"] },
                  blocksJob: true,
                },
                select: { id: true },
              },
              quantities: {
                orderBy: { scopeKey: "asc" },
                select: {
                  id: true,
                  scopeKey: true,
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
            },
          },
        },
      },
    },
  });
  return runs.map((run) => {
    const active = ACTIVE_RUN_STATUSES.includes(
      run.status as (typeof ACTIVE_RUN_STATUSES)[number],
    );
    const v2Items = run.items.filter(
      (item) => item.productionStep.executionEnabled,
    );
    const isV2 = v2Items.length > 0;
    const pureV2 = isV2 && v2Items.length === run.items.length;
    const hasCorrectCenter =
      pureV2 &&
      v2Items.every(
        (item) => item.productionStep.workCenter?.code === "DTF_PRINT",
      );
    const canManage = canManagePrintRun(run, access);
    const hasMembership =
      access.canSupervise ||
      v2Items.every(
        (item) => (item.productionStep.workCenter?.members.length ?? 0) > 0,
      );
    const orderBlock = activeRunBlockedReason(run);
    const executionScopeBlock = v2Items
      .map((item) =>
        specializedExecutionScopeBlockedReason(item.productionStep),
      )
      .find((reason): reason is string => Boolean(reason)) ?? null;
    const operationBlock = v2Items.some(
      (item) => item.productionStep.exceptions.length > 0,
    );
    const runningOperations = v2Items.every(
      (item) => item.productionStep.operationState === "RUNNING",
    );
    const cancellableOperations = v2Items.every((item) =>
      (["READY", "RUNNING", "BLOCKED"] as OperationState[]).includes(
        item.productionStep.operationState,
      ),
    );
    let blockedReason: string | null = orderBlock;
    if (active && isV2) {
      if (!pureV2 || !hasCorrectCenter) {
        blockedReason = "รอบนี้มีข้อมูล Operation Job ไม่ตรงกับสถานี DTF";
      } else if (access.canOperate === false) {
        blockedReason = "บัญชีนี้ดูรอบพิมพ์ได้อย่างเดียว";
      } else if (!canManage) {
        blockedReason = "รอบนี้เป็นงานของผู้สร้างหรือผู้รับผิดชอบคนอื่น";
      } else if (!hasMembership) {
        blockedReason = "บัญชีนี้ไม่ได้เป็นสมาชิกของ Work Center DTF";
      } else if (executionScopeBlock) {
        blockedReason = executionScopeBlock;
      } else if (operationBlock) {
        blockedReason = "Operation Job ในรอบนี้มีปัญหาที่บล็อกอยู่";
      } else if (!runningOperations) {
        blockedReason = "Operation Job ในรอบนี้ไม่อยู่สถานะกำลังทำ";
      }
    }

    const availableCommands: PrintRunAvailableCommand[] = [];
    if (
      active &&
      pureV2 &&
      hasCorrectCenter &&
      access.canOperate !== false &&
      canManage &&
      hasMembership
    ) {
      if (run.status === "PRINTING" && cancellableOperations) {
        availableCommands.push("cancel");
      }
      if (
        !orderBlock &&
        !executionScopeBlock &&
        !operationBlock &&
        runningOperations
      ) {
        availableCommands.push(
          run.status === "PRINTING" ? "markPrinted" : "complete",
        );
      }
    }

    return {
      ...run,
      items: run.items.map((item) => {
        const { quantities, workCenter, exceptions, ...productionStep } =
          item.productionStep;
        return {
          ...item,
          productionStep: {
            ...productionStep,
            workCenter: workCenter
              ? { code: workCenter.code }
              : null,
            hasBlockingException: exceptions.length > 0,
            quantityLines: quantities.map((line) => ({
              ...line,
              label: line.description,
            })),
          },
        };
      }),
      blockedReason,
      availableCommands,
    };
  });
}
