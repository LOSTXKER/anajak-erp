import type { PrismaClient } from "@prisma/client";

type AuditLogAction = "CREATE" | "UPDATE" | "DELETE" | "VOID";

interface AuditLogParams {
  userId: string | null;
  action: AuditLogAction;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
}

type PrismaLike = Pick<PrismaClient, "auditLog"> | { auditLog: PrismaClient["auditLog"] };

export async function createAuditLog(
  prismaOrTx: PrismaLike,
  params: AuditLogParams
) {
  const sanitize = (v: unknown) =>
    v !== undefined ? JSON.parse(JSON.stringify(v)) : undefined;

  await prismaOrTx.auditLog.create({
    data: {
      userId: params.userId ?? "system",
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      oldValue: sanitize(params.oldValue),
      newValue: sanitize(params.newValue),
      reason: params.reason,
    },
  });
}

interface DesignApprovalParams {
  design: {
    orderId: string;
    versionNumber: number;
  };
  approved: boolean;
  comment?: string | null;
  changedBy: string;
  descriptionPrefix: string;
}

export async function processDesignApproval(
  prisma: PrismaClient,
  params: DesignApprovalParams
) {
  const { design, approved, comment, changedBy, descriptionPrefix } = params;

  if (approved) {
    await prisma.order.update({
      where: { id: design.orderId },
      data: { internalStatus: "DESIGN_APPROVED", customerStatus: "PREPARING" },
    });
  } else {
    await prisma.order.update({
      where: { id: design.orderId },
      data: { internalStatus: "DESIGNING", customerStatus: "PREPARING" },
    });
  }

  const revisionCount = await prisma.orderRevision.count({
    where: { orderId: design.orderId },
  });

  await prisma.orderRevision.create({
    data: {
      orderId: design.orderId,
      version: revisionCount + 1,
      changedBy,
      changeType: "DESIGN",
      description: approved
        ? `${descriptionPrefix}อนุมัติแบบ v${design.versionNumber}`
        : `${descriptionPrefix}ขอแก้ไขแบบ v${design.versionNumber}: ${comment ?? ""}`,
    },
  });
}

export async function createNotification(
  prisma: Pick<PrismaClient, "notification">,
  data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    entityType?: string;
    entityId?: string;
  }
) {
  return prisma.notification.create({ data });
}
