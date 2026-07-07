import { TRPCError } from "@trpc/server";
import type { PrismaTx } from "@/lib/prisma";

type AuditLogAction = "CREATE" | "UPDATE" | "DELETE" | "VOID" | "EXPORT";

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

// PERM follow-up: invariant "ระบบต้องเหลือเจ้าของ (OWNER) ที่ใช้งานอยู่อย่างน้อย 1 คน" —
// ด่านกันพลาดชั้นสุดท้ายก่อนลด role/ปิดบัญชี OWNER ที่ยัง active
// (ปกติถึงจุดนี้ยาก: คนสั่งต้องเป็น OWNER ที่ active เอง + แก้ role/ปิดบัญชีตัวเองถูก block แล้ว
//  เหลือช่องแคบอย่างสอง OWNER ลดสิทธิ์กันเองพร้อมกัน — เช็ค count ปิดเคสทั่วไปพอ
//  race ระดับมิลลิวินาทีจริงยอมรับ ไม่ล็อกแถวให้ซับซ้อน · ทีม 5 คน แก้คืนได้ที่ DB)
export async function assertAnotherActiveOwner(
  prismaOrTx: PrismaLike,
  excludeUserId: string,
  message: string
): Promise<void> {
  const others = await prismaOrTx.user.count({
    where: { role: "OWNER", isActive: true, id: { not: excludeUserId } },
  });
  if (others === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message });
  }
}

// processDesignApproval ย้ายไป src/server/services/order-status.ts —
// ผลตัดสินแบบต้องเปลี่ยนสถานะผ่าน transitionOrder (validate + revision) ใน transaction เสมอ

export async function createNotification(
  prisma: Pick<PrismaTx, "notification">,
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
