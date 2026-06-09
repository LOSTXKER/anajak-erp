import type { InternalStatus } from "@prisma/client";
import { getCustomerStatus, isValidTransition } from "@/lib/order-status";
import { badRequest, conflict } from "@/server/errors";
import type { PrismaTx } from "@/lib/prisma";

// จุดเดียวที่อนุญาตให้เปลี่ยน internalStatus ของออเดอร์ (นอกจากสถานะเริ่มต้นตอน create)
// - validate ผ่าน isValidTransition เสมอ — ห้าม set ตรงจาก router ใดๆ
// - เขียนแบบมีเงื่อนไขสถานะเดิม (updateMany where) กันสองคนเปลี่ยนพร้อมกัน
// - สถานะเดิม = เป้าหมาย → no-op (idempotent เช่น อัปโหลดแบบซ้ำตอนยัง DESIGNING)
// - บันทึก OrderRevision ทุกครั้งที่เปลี่ยนจริง (caller เป็นคนเขียน audit log เอง)

interface TransitionParams {
  orderId: string;
  to: InternalStatus;
  changedBy: string; // user id หรือป้ายข้อความ เช่น "ลูกค้า"
  reason?: string;
  // override ข้อความ revision (เช่น งานออกแบบอยากบันทึกเป็น changeType DESIGN)
  revision?: { changeType: string; description: string };
}

export async function addOrderRevision(
  tx: PrismaTx,
  data: {
    orderId: string;
    changedBy: string;
    changeType: string;
    description: string;
    oldValue?: string;
    newValue?: string;
  }
) {
  const revisionCount = await tx.orderRevision.count({ where: { orderId: data.orderId } });
  return tx.orderRevision.create({
    data: { ...data, version: revisionCount + 1 },
  });
}

export async function transitionOrder(tx: PrismaTx, params: TransitionParams) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: params.orderId },
    select: { orderType: true, internalStatus: true },
  });

  if (order.internalStatus === params.to) {
    return { changed: false as const, from: order.internalStatus };
  }

  if (!isValidTransition(order.orderType, order.internalStatus, params.to)) {
    badRequest(`ไม่สามารถเปลี่ยนสถานะจาก ${order.internalStatus} เป็น ${params.to} ได้`);
  }

  const data: {
    internalStatus: InternalStatus;
    customerStatus: ReturnType<typeof getCustomerStatus>;
    completedAt?: Date;
    cancelledAt?: Date;
    cancelledReason?: string | null;
  } = {
    internalStatus: params.to,
    customerStatus: getCustomerStatus(params.to),
  };
  if (params.to === "COMPLETED") data.completedAt = new Date();
  if (params.to === "CANCELLED") {
    data.cancelledAt = new Date();
    data.cancelledReason = params.reason ?? null;
  }

  const updated = await tx.order.updateMany({
    where: { id: params.orderId, internalStatus: order.internalStatus },
    data,
  });
  if (updated.count === 0) {
    conflict("สถานะออเดอร์เพิ่งถูกเปลี่ยนโดยคนอื่น กรุณารีเฟรชแล้วลองใหม่");
  }

  await addOrderRevision(tx, {
    orderId: params.orderId,
    changedBy: params.changedBy,
    changeType: params.revision?.changeType ?? "STATUS",
    description:
      params.revision?.description ??
      `เปลี่ยนสถานะจาก ${order.internalStatus} เป็น ${params.to}`,
    oldValue: order.internalStatus,
    newValue: params.to,
  });

  return { changed: true as const, from: order.internalStatus };
}

// ผลตัดสินแบบ (อนุมัติ/ขอแก้) → สถานะออเดอร์ + revision — ใช้ทั้งฝั่งพนักงานและลูกค้าผ่าน token
// ต้องเรียกใน transaction เดียวกับการเขียนผลตัดสินบน DesignVersion
export async function processDesignApproval(
  tx: PrismaTx,
  params: {
    design: { orderId: string; versionNumber: number };
    approved: boolean;
    comment?: string | null;
    changedBy: string;
    descriptionPrefix: string;
  }
) {
  const { design, approved, comment, changedBy, descriptionPrefix } = params;
  const description = approved
    ? `${descriptionPrefix}อนุมัติแบบ v${design.versionNumber}`
    : `${descriptionPrefix}ขอแก้ไขแบบ v${design.versionNumber}: ${comment ?? ""}`;

  const result = await transitionOrder(tx, {
    orderId: design.orderId,
    to: approved ? "DESIGN_APPROVED" : "DESIGNING",
    changedBy,
    revision: { changeType: "DESIGN", description },
  });

  // ขอแก้ตอนสถานะ DESIGNING อยู่แล้ว = สถานะไม่ขยับ แต่ผลตัดสินต้องมี revision เสมอ
  if (!result.changed) {
    await addOrderRevision(tx, {
      orderId: design.orderId,
      changedBy,
      changeType: "DESIGN",
      description,
    });
  }
}
