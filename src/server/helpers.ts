import type { PrismaClient } from "@prisma/client";
import type { PrismaTx } from "@/lib/prisma";

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

// PrismaTx ครอบทั้ง extended client เต็มตัวและ tx ภายใน $transaction (client เต็มมี member ครบกว่า)
type PrismaLike = PrismaTx;

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

// processDesignApproval ย้ายไป src/server/services/order-status.ts —
// ผลตัดสินแบบต้องเปลี่ยนสถานะผ่าน transitionOrder (validate + revision) ใน transaction เสมอ

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
