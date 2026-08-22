import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";
import type { ExtendedPrismaClient, PrismaTx } from "@/lib/prisma";
import { badRequest, notFound } from "@/server/errors";
import { nextDocumentNumber } from "@/server/services/document-number";
import { executeManufacturingCommand } from "@/server/services/manufacturing-commands";
import {
  assertRoutingConvergesToFinalPack,
  ManufacturingDomainError,
} from "@/server/services/manufacturing-domain";
import { lockOrderRow } from "@/server/services/order-cost";
import { lockProductionTopology } from "@/server/services/production-topology-lock";

type CreateWorkOrderCommand = {
  orderId: string;
  routingVersionId: string;
  commandId: string;
  expectedRevision: number;
  actorId: string;
};

const PRINT_QUANTITY_OPERATIONS = new Set(["DTF_PRINT", "HEAT_PRESS"]);

export function assertCanCreateV2WorkOrder(
  existingProduction: { id: string; workOrderNumber: string | null } | null,
) {
  if (existingProduction) {
    if (!existingProduction.workOrderNumber) {
      badRequest(
        "ออเดอร์นี้มีใบผลิตเดิมอยู่แล้ว จึงเปิดใบสั่งผลิตจากหน้านี้ไม่ได้ ให้หัวหน้าตรวจใบผลิตเดิมก่อน",
      );
    }
    badRequest(
      `ออเดอร์นี้มีใบสั่งผลิต ${existingProduction.workOrderNumber} แล้ว จึงเปิดใบซ้ำไม่ได้`,
    );
  }
}

function legacyStepType(
  operationCode: string,
  hasCustomerGarments: boolean,
): Prisma.ProductionStepCreateManyInput["stepType"] {
  if (operationCode === "PREP") {
    return hasCustomerGarments ? "GARMENT_RECEIVE" : "GARMENT_PICK";
  }
  if (operationCode === "DTF_PRINT") return "DTF_PRINT";
  if (operationCode === "HEAT_PRESS") return "HEAT_PRESS";
  return "CUSTOM";
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function getManufacturingCreationContext(
  prisma: ExtendedPrismaClient,
  orderId: string,
) {
  const [order, routingVersions] = await Promise.all([
    prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        title: true,
        deadline: true,
        internalStatus: true,
        customer: { select: { name: true } },
        productions: {
          select: { id: true, workOrderNumber: true, workOrderState: true },
        },
      },
    }),
    prisma.routingVersion.findMany({
      where: {
        state: "RELEASED",
        routing: { isActive: true },
        operations: { some: {} },
      },
      orderBy: [{ routing: { name: "asc" } }, { versionNumber: "desc" }],
      select: {
        id: true,
        versionNumber: true,
        releasedAt: true,
        routing: { select: { id: true, code: true, name: true, description: true } },
        operations: {
          orderBy: [{ sequence: "asc" }, { id: "asc" }],
          select: {
            id: true,
            operationCode: true,
            name: true,
            executionMode: true,
            phase: true,
            workCenter: { select: { id: true, code: true, name: true } },
          },
        },
      },
    }),
  ]);
  if (!order) notFound("ออเดอร์", orderId);
  return {
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      title: order.title,
      customerName: order.customer.name,
      deadline: order.deadline,
      internalStatus: order.internalStatus,
    },
    existingWorkOrders: order.productions,
    routingVersions,
  };
}

async function createWorkOrderInTransaction(
  tx: PrismaTx,
  input: CreateWorkOrderCommand,
) {
  await lockProductionTopology(tx, input.orderId);
  await lockOrderRow(tx, input.orderId);

  const order = await tx.order.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      orderNumber: true,
      title: true,
      deadline: true,
      internalStatus: true,
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          prints: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              position: true,
              printType: true,
              printSize: true,
              width: true,
              height: true,
            },
          },
          products: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              description: true,
              itemSource: true,
              product: { select: { sku: true } },
              variants: {
                orderBy: [{ color: "asc" }, { size: "asc" }, { id: "asc" }],
                select: { id: true, size: true, color: true, quantity: true },
              },
            },
          },
        },
      },
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
            select: { fileUrl: true, thumbnailUrl: true, position: true, caption: true },
          },
        },
      },
    },
  });
  if (!order) notFound("ออเดอร์", input.orderId);
  if (!["DESIGN_APPROVED", "PRODUCTION_QUEUE", "PRODUCING"].includes(order.internalStatus)) {
    badRequest("ออเดอร์ยังไม่อยู่ในช่วงที่เปิดใบสั่งผลิตได้");
  }

  const existingProduction = await tx.production.findFirst({
    where: { orderId: order.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, workOrderNumber: true },
  });
  assertCanCreateV2WorkOrder(existingProduction);

  const routingVersion = await tx.routingVersion.findUnique({
    where: { id: input.routingVersionId },
    select: {
      id: true,
      versionNumber: true,
      state: true,
      releasedAt: true,
      routing: { select: { id: true, code: true, name: true } },
      operations: {
        orderBy: [{ sequence: "asc" }, { id: "asc" }],
        select: {
          id: true,
          operationCode: true,
          name: true,
          sequence: true,
          executionMode: true,
          phase: true,
          workCenterId: true,
          standardMinutes: true,
          instructions: true,
          referenceTemplate: true,
          successorLinks: {
            select: {
              id: true,
              predecessorOperationId: true,
              successorOperationId: true,
            },
          },
        },
      },
    },
  });
  if (!routingVersion || routingVersion.state !== "RELEASED") {
    badRequest("Routing version นี้ยังไม่ถูก Release");
  }
  if (routingVersion.operations.length === 0) badRequest("Routing นี้ยังไม่มีขั้นงาน");
  if (routingVersion.operations.some((operation) => !operation.workCenterId)) {
    badRequest("Routing ทุกขั้นต้องระบุศูนย์งานก่อนเปิดใบสั่งผลิต");
  }
  const routingDependencies = routingVersion.operations.flatMap(
    (operation) => operation.successorLinks,
  );
  let completionOwnerRoutingId: string;
  try {
    completionOwnerRoutingId = assertRoutingConvergesToFinalPack(
      routingVersion.operations,
      routingDependencies.map((dependency) => ({
        predecessorOperationId: dependency.predecessorOperationId,
        successorOperationId: dependency.successorOperationId,
      })),
    );
  } catch (error) {
    if (error instanceof ManufacturingDomainError) badRequest(error.message);
    throw error;
  }

  const productScopes = order.items.flatMap((item) =>
    item.products.flatMap((product) =>
      product.variants
        .filter((variant) => variant.quantity > 0)
        .map((variant) => ({ item, product, variant })),
    ),
  );
  if (productScopes.length === 0) {
    badRequest("ออเดอร์ยังไม่มีสินค้า สี ไซซ์ และจำนวนสำหรับเปิดใบสั่งผลิต");
  }

  const approvedMockup = order.designs[0] ?? null;
  if (!approvedMockup) {
    badRequest(
      "ยังไม่มีแบบอนุมัติล่าสุด จึงเปิดใบสั่งผลิตไม่ได้ ให้หัวหน้าตรวจแบบก่อน",
    );
  }
  const productionId = randomUUID();
  const workOrderNumber = await nextDocumentNumber(tx, "WORK_ORDER");
  const routingSnapshot = {
    routing: routingVersion.routing,
    versionId: routingVersion.id,
    versionNumber: routingVersion.versionNumber,
    releasedAt: routingVersion.releasedAt,
    operations: routingVersion.operations.map((operation) => ({
      id: operation.id,
      code: operation.operationCode,
      name: operation.name,
      sequence: operation.sequence,
      executionMode: operation.executionMode,
      phase: operation.phase,
      workCenterId: operation.workCenterId,
      standardMinutes: operation.standardMinutes,
    })),
    dependencies: routingDependencies,
  };
  const instructionSnapshot = {
    operations: routingVersion.operations.map((operation) => ({
      code: operation.operationCode,
      name: operation.name,
      instructions: operation.instructions,
      referenceTemplate: operation.referenceTemplate,
    })),
  };
  const approvedMockupSnapshot = {
    designId: approvedMockup.id,
    versionNumber: approvedMockup.versionNumber,
    fileUrl: approvedMockup.fileUrl,
    thumbnailUrl: approvedMockup.thumbnailUrl,
    approvedAt: approvedMockup.approvedAt,
    files: approvedMockup.files,
  };

  await tx.production.create({
    data: {
      id: productionId,
      orderId: order.id,
      workOrderNumber,
      workOrderState: "DRAFT",
      routingVersionId: routingVersion.id,
      routingSnapshot: json(routingSnapshot),
      instructionSnapshot: json(instructionSnapshot),
      approvedMockupSnapshot: json(approvedMockupSnapshot),
      plannedEndAt: order.deadline,
      status: "PENDING",
    },
  });

  const operationIds = new Map<string, string>();
  const hasCustomerGarments = productScopes.some(
    ({ product }) => product.itemSource === "CUSTOMER_PROVIDED",
  );
  for (const [index, operation] of routingVersion.operations.entries()) {
    const operationId = randomUUID();
    operationIds.set(operation.id, operationId);
    const hasPrintScopes =
      PRINT_QUANTITY_OPERATIONS.has(operation.operationCode) &&
      order.items.some((item) => item.prints.length > 0);
    const quantityScopes = productScopes.flatMap(({ item, product, variant }) => {
      const prints = hasPrintScopes ? item.prints : [null];
      return prints.map((print) => ({ item, product, variant, print }));
    });
    const plannedQty = quantityScopes.reduce(
      (sum, scope) => sum + scope.variant.quantity,
      0,
    );
    await tx.productionStep.create({
      data: {
        id: operationId,
        productionId,
        stepType: legacyStepType(operation.operationCode, hasCustomerGarments),
        customStepName: operation.name,
        status: "PENDING",
        sortOrder: operation.sequence || index + 1,
        operationCode: operation.operationCode,
        operationName: operation.name,
        operationState: "PLANNED",
        executionMode: operation.executionMode,
        operationPhase: operation.phase,
        workCenterId: operation.workCenterId,
        routingOperationId: operation.id,
        dispatchSequence: operation.sequence || index + 1,
        standardMinutes: operation.standardMinutes,
        qtyPlanned: plannedQty,
        qtyTotal: plannedQty,
        executionEnabled: true,
        instructionSnapshot: operation.instructions ?? undefined,
        referenceSnapshot: json({
          routingOperationId: operation.id,
          approvedMockup: approvedMockupSnapshot,
        }),
      },
    });

    await tx.operationQuantity.createMany({
      data: quantityScopes.map(({ item, product, variant, print }) => ({
        id: randomUUID(),
        productionId,
        productionStepId: operationId,
        scopeKey: [product.id, variant.id, print?.id ?? "NO_PRINT"].join(":"),
        scopeKind:
          operation.operationCode === "FINAL_PACK"
            ? "PACK_LINE"
            : print
              ? "VARIANT_PRINT_POSITION"
              : "VARIANT",
        sourceOrderItemId: item.id,
        sourceOrderItemProductId: product.id,
        sourceOrderItemVariantId: variant.id,
        sourceOrderItemPrintId: print?.id ?? null,
        description: product.description,
        sku: product.product?.sku ?? null,
        size: variant.size,
        color: variant.color,
        printPosition: print?.position ?? null,
        qtyPlanned: variant.quantity,
        referenceSnapshot: json({
          description: product.description,
          sku: product.product?.sku ?? null,
          size: variant.size,
          color: variant.color,
          quantity: variant.quantity,
          print: print
            ? {
                position: print.position,
                printType: print.printType,
                printSize: print.printSize,
                width: print.width,
                height: print.height,
              }
            : null,
        }),
      })),
    });

    await tx.operationEvent.create({
      data: {
        productionId,
        productionStepId: operationId,
        eventType: "CREATED",
        commandId: input.commandId,
        sequence: index + 1,
        actorId: input.actorId,
        toState: "PLANNED",
      },
    });
  }

  await tx.operationJobDependency.createMany({
    data: routingDependencies.map((dependency) => ({
      id: randomUUID(),
      predecessorStepId: operationIds.get(dependency.predecessorOperationId)!,
      successorStepId: operationIds.get(dependency.successorOperationId)!,
      sourceRoutingDependencyId: dependency.id,
    })),
  });
  const completionOwnerStepId = operationIds.get(completionOwnerRoutingId);
  if (!completionOwnerStepId) {
    badRequest("ไม่พบขั้น Final Pack สำหรับกำหนดเจ้าของการปิดงาน");
  }
  await tx.production.update({
    where: { id: productionId },
    data: { completionOwnerStepId },
  });
  const ownerClaim = await tx.order.updateMany({
    where: {
      id: order.id,
      productionCompletionOwnerId: null,
    },
    data: { productionCompletionOwnerId: productionId },
  });
  if (ownerClaim.count !== 1) {
    badRequest(
      "ออเดอร์นี้มีเจ้าของการปิดงานแล้ว — กรุณารีเฟรชก่อนเปิดใบสั่งผลิต",
    );
  }
  await tx.operationEvent.create({
    data: {
      productionId,
      eventType: "CREATED",
      commandId: input.commandId,
      sequence: 0,
      actorId: input.actorId,
      toState: "DRAFT",
    },
  });
  await tx.manufacturingReferenceSnapshot.create({
    data: {
      productionId,
      kind: "APPROVED_MOCKUP",
      sourceEntityType: "DesignVersion",
      sourceEntityId: approvedMockup.id,
      contentHash: `${approvedMockup.id}:v${approvedMockup.versionNumber}`,
      payload: json(approvedMockupSnapshot),
    },
  });

  return {
    productionId,
    result: {
      id: productionId,
      workOrderNumber,
      workOrderState: "DRAFT" as const,
      revision: 0,
    },
  };
}

export function createManufacturingWorkOrder(
  prisma: ExtendedPrismaClient,
  input: CreateWorkOrderCommand,
) {
  if (input.expectedRevision !== 0) {
    badRequest("การเปิดใบสั่งผลิตใหม่ต้องเริ่มจาก revision 0");
  }
  return executeManufacturingCommand(
    prisma,
    "createWorkOrder",
    input,
    (tx) => createWorkOrderInTransaction(tx, input),
  );
}
