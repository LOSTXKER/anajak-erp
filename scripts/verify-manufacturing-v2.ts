/**
 * Destructive-by-design smoke test for a disposable Production V2 database.
 * The target must contain the explicit sentinel below; normal demo/shared/live
 * databases fail closed before any command is executed.
 */
import { prisma } from "../src/lib/prisma";
import {
  getManufacturingControlList,
  getManufacturingStationDispatch,
  getManufacturingStationJob,
} from "../src/server/services/manufacturing-read-model";
import {
  releaseManufacturingWorkOrder,
  reportManufacturingOutput,
  startManufacturingOperation,
} from "../src/server/services/manufacturing-commands";
import { createManufacturingWorkOrder } from "../src/server/services/manufacturing-work-order";

const SENTINEL_KEY = "production_v2_verify_disposable";
const VERIFY_TOKEN = "VERIFY-PRODUCTION-V2-DISPOSABLE";

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function commandId(label: string) {
  return `verify-v2-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function findForbiddenMoneyKeys(value: unknown, path = "root"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findForbiddenMoneyKeys(item, `${path}[${index}]`),
    );
  }
  if (!value || typeof value !== "object") return [];
  const forbidden = new Set([
    "price",
    "unitPrice",
    "cost",
    "unitCost",
    "totalCost",
    "subtotal",
    "totalAmount",
    "discount",
    "tax",
    "taxAmount",
  ]);
  return Object.entries(value).flatMap(([key, child]) => [
    ...(forbidden.has(key) ? [`${path}.${key}`] : []),
    ...findForbiddenMoneyKeys(child, `${path}.${key}`),
  ]);
}

async function main() {
  if (process.env.PRODUCTION_V2_VERIFY_TOKEN !== VERIFY_TOKEN) {
    throw new Error("Production V2 verify ถูกปิด: token ไม่ตรง");
  }
  const sentinel = await prisma.setting.findUnique({ where: { key: SENTINEL_KEY } });
  if (sentinel?.value !== "true") {
    throw new Error("Production V2 verify ถูกปิด: target ไม่มี disposable sentinel");
  }

  const supervisorAccess = {
    actorId: "demo-user-supervisor",
    canOperate: true,
    canSupervise: true,
  };
  const operatorAccess = {
    actorId: "demo-user-press",
    canOperate: true,
    canSupervise: false,
  };

  const creationOrder = await prisma.order.findFirst({
    where: {
      productions: { none: { workOrderNumber: { not: null } } },
      items: { some: { products: { some: { variants: { some: { quantity: { gt: 0 } } } } } } },
      designs: { some: {} },
    },
    orderBy: { id: "asc" },
    select: { id: true, internalStatus: true },
  });
  const routingVersion = await prisma.routingVersion.findFirst({
    where: { state: "RELEASED", operations: { some: {} } },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  check(creationOrder && routingVersion, "fixture ต้องมีออเดอร์และ routing สำหรับเปิดใบสั่งผลิต");
  await prisma.$transaction([
    prisma.designVersion.updateMany({
      where: { orderId: creationOrder.id },
      data: { approvalStatus: "APPROVED", approvedAt: new Date() },
    }),
    prisma.order.update({
      where: { id: creationOrder.id },
      data: { internalStatus: "DESIGN_APPROVED" },
    }),
  ]);
  const createId = commandId("create-work-order");
  const createInput = {
    orderId: creationOrder.id,
    routingVersionId: routingVersion.id,
    commandId: createId,
    expectedRevision: 0,
    actorId: supervisorAccess.actorId,
  };
  const createdWorkOrder = await createManufacturingWorkOrder(prisma, createInput);
  const replayedWorkOrder = await createManufacturingWorkOrder(prisma, createInput);
  check(createdWorkOrder.id === replayedWorkOrder.id, "retry create ต้องคืนใบสั่งผลิตเดิม");
  const createdDetail = await prisma.production.findUniqueOrThrow({
    where: { id: createdWorkOrder.id },
    select: {
      revision: true,
      completionOwnerStepId: true,
      routingSnapshot: true,
      instructionSnapshot: true,
      approvedMockupSnapshot: true,
      steps: {
        where: { executionEnabled: true },
        select: { id: true, quantities: { select: { id: true } } },
      },
    },
  });
  check(
    createdDetail.routingSnapshot &&
      createdDetail.instructionSnapshot &&
      createdDetail.approvedMockupSnapshot,
    "ใบสั่งผลิตใหม่ต้องเก็บ routing, instruction และ approved mockup snapshot",
  );
  check(
    createdDetail.steps.length > 0 && createdDetail.steps.every((step) => step.quantities.length > 0),
    "ใบสั่งผลิตใหม่ต้องสร้าง Operation Job และ quantity line",
  );
  check(
    createdDetail.completionOwnerStepId &&
      createdDetail.steps.some(
        (step) => step.id === createdDetail.completionOwnerStepId,
      ),
    "ใบสั่งผลิตใหม่ต้องกำหนด completion owner ตอนสร้าง",
  );
  const ownerOrder = await prisma.order.findUniqueOrThrow({
    where: { id: creationOrder.id },
    select: { productionCompletionOwnerId: true },
  });
  check(
    ownerOrder.productionCompletionOwnerId === createdWorkOrder.id,
    "ออเดอร์ต้องชี้ completion owner เดียวกับใบสั่งผลิต",
  );
  let secondWorkOrderRejected = false;
  try {
    await createManufacturingWorkOrder(prisma, {
      ...createInput,
      commandId: commandId("create-work-order-second"),
    });
  } catch (error) {
    secondWorkOrderRejected =
      error instanceof Error && error.message.includes("ใบที่สอง");
  }
  check(
    secondWorkOrderRejected,
    "ต้องปฏิเสธ V2 Work Order ใบที่สองก่อนมี quantity allocation",
  );
  const releasedWorkOrder = await releaseManufacturingWorkOrder(prisma, {
    workOrderId: createdWorkOrder.id,
    commandId: commandId("release-work-order"),
    expectedRevision: createdDetail.revision,
    actorId: supervisorAccess.actorId,
  });
  check(releasedWorkOrder.workOrderState === "RELEASED", "ใบสั่งผลิตใหม่ต้อง Release ได้");
  const releasedOrder = await prisma.order.findUniqueOrThrow({
    where: { id: creationOrder.id },
    select: { internalStatus: true },
  });
  check(releasedOrder.internalStatus === "PRODUCING", "Release ต้องเดินสถานะออเดอร์ผ่าน service กลาง");

  const raceJob = await prisma.productionStep.findUniqueOrThrow({
    where: { id: "demo-step-heat-press-heat" },
    select: {
      revision: true,
      operationState: true,
      qtyGood: true,
      qtyScrap: true,
      quantities: {
        where: { qtyGood: { lt: 5 } },
        orderBy: { id: "asc" },
        select: {
          id: true,
          revision: true,
          qtyPlanned: true,
          qtyGood: true,
        },
      },
    },
  });
  check(raceJob.operationState === "READY", "fixture สำหรับ concurrency ต้อง READY");
  const raceInputs = [
    {
      operationJobId: "demo-step-heat-press-heat",
      commandId: commandId("race-a"),
      expectedRevision: raceJob.revision,
      actorId: operatorAccess.actorId,
      access: operatorAccess,
    },
    {
      operationJobId: "demo-step-heat-press-heat",
      commandId: commandId("race-b"),
      expectedRevision: raceJob.revision,
      actorId: operatorAccess.actorId,
      access: operatorAccess,
    },
  ] as const;
  const raceResults = await Promise.allSettled(
    raceInputs.map(({ access, ...input }) =>
      startManufacturingOperation(prisma, input, access),
    ),
  );
  check(
    raceResults.filter((result) => result.status === "fulfilled").length === 1 &&
      raceResults.filter((result) => result.status === "rejected").length === 1,
    "สองคน start revision เดียวกันต้องสำเร็จเพียงคนเดียว",
  );
  const winnerIndex = raceResults.findIndex(
    (result) => result.status === "fulfilled",
  );
  check(winnerIndex >= 0, "ต้องพบคำสั่ง start ที่สำเร็จ");
  const winner = raceResults[winnerIndex];
  check(winner?.status === "fulfilled", "ผล start ที่เลือกต้องสำเร็จ");
  const { access: winnerAccess, ...winnerInput } = raceInputs[winnerIndex]!;
  const replayedStart = await startManufacturingOperation(
    prisma,
    winnerInput,
    winnerAccess,
  );
  check(winner.value.id === replayedStart.id, "retry start ต้อง replay ผลเดิม");
  check(
    (await prisma.operationEvent.count({ where: { commandId: winnerInput.commandId } })) === 1,
    "retry start ต้องสร้าง event ครั้งเดียว",
  );

  const outputLine = raceJob.quantities.find(
    (line) => line.qtyPlanned - line.qtyGood >= 5,
  );
  check(outputLine, "fixture output ต้องมี quantity line เหลืออย่างน้อย 5 ตัว");
  const reportId = commandId("output-retry");
  const reportInput = {
    operationJobId: "demo-step-heat-press-heat",
    commandId: reportId,
    expectedRevision: winner.value.revision,
    actorId: operatorAccess.actorId,
    qtyGood: 5,
    qtyScrap: 0,
    qtyRework: 0,
    quantityLines: [
      {
        quantityLineId: outputLine.id,
        expectedRevision: outputLine.revision,
        qtyGood: 5,
        qtyScrap: 0,
        qtyRework: 0,
      },
    ],
  };
  await reportManufacturingOutput(prisma, reportInput, operatorAccess);
  await reportManufacturingOutput(prisma, reportInput, operatorAccess);
  const afterRetry = await prisma.productionStep.findUniqueOrThrow({
    where: { id: reportInput.operationJobId },
    select: { qtyGood: true, qtyScrap: true },
  });
  check(
    afterRetry.qtyGood === raceJob.qtyGood + 5 &&
      afterRetry.qtyScrap === raceJob.qtyScrap,
    "retry output ต้องเพิ่มจำนวนเพียงครั้งเดียว",
  );
  check(
    (await prisma.operationEvent.count({ where: { commandId: reportId } })) === 1,
    "retry output ต้องสร้าง event ครั้งเดียว",
  );

  const stationJob = await getManufacturingStationJob(
    prisma,
    "demo-step-heat-press-heat",
    operatorAccess,
  );
  check(stationJob, "ต้องอ่าน Station job ได้");
  const moneyKeys = findForbiddenMoneyKeys(stationJob);
  check(
    moneyKeys.length === 0,
    `Station DTO มีข้อมูลเงินต้องห้าม: ${moneyKeys.join(", ")}`,
  );

  const seenWorkOrders = new Set<string>();
  let controlCursor: string | undefined;
  let previousRank = -1;
  const rank: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
  do {
    const page = await getManufacturingControlList(
      prisma,
      { sort: "priority", limit: 3, cursor: controlCursor },
      supervisorAccess,
    );
    for (const item of page.items) {
      check(!seenWorkOrders.has(item.id), "controlList pagination มีแถวซ้ำ");
      seenWorkOrders.add(item.id);
      const currentRank = rank[item.order.priority] ?? 4;
      check(currentRank >= previousRank, "controlList priority เรียงผิดลำดับธุรกิจ");
      previousRank = currentRank;
    }
    controlCursor = page.nextCursor ?? undefined;
  } while (controlCursor);

  const seenStationJobs = new Set<string>();
  let stationCursor: string | undefined;
  do {
    const page = await getManufacturingStationDispatch(
      prisma,
      { workCenterCode: "PREP", limit: 2, cursor: stationCursor },
      supervisorAccess,
    );
    check(page, "ต้องอ่าน PREP dispatch ได้");
    for (const job of page.queue) {
      check(!seenStationJobs.has(job.operation.id), "Station pagination มีงานซ้ำ");
      seenStationJobs.add(job.operation.id);
    }
    stationCursor = page.nextCursor ?? undefined;
  } while (stationCursor);

  console.log(
    `Production V2 command smoke ผ่าน: workOrders=${seenWorkOrders.size} prepQueue=${seenStationJobs.size}`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
