import type { InternalStatus } from "@prisma/client";
import { getCustomerStatus, isValidTransition, forwardPath } from "@/lib/order-status";
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

// เดินสถานะออเดอร์ "ไปข้างหน้า" ตามเส้นทางของชนิดงาน ทีละก้าวที่ valid จนถึงเป้าหมาย
// ใช้เมื่อเหตุการณ์ในโมดูล (ผลิตครบ/ส่งของ) ควรดันสถานะออเดอร์เอง — ไปข้างหน้าเท่านั้น ไม่ดึงถอย
// onlyFrom: ดันเฉพาะเมื่อสถานะปัจจุบันอยู่ในชุดนี้ (กันดันจากจุดที่ไม่ควร เช่น ออเดอร์ยังผลิตไม่เสร็จ)
// idempotent: เลยเป้าหมาย/ไม่อยู่ในเส้นทาง = no-op · ทุกก้าวยังผ่าน isValidTransition เหมือนกดเอง
export async function advanceOrderForward(
  tx: PrismaTx,
  params: {
    orderId: string;
    target: InternalStatus;
    changedBy: string;
    onlyFrom?: InternalStatus[];
    reason?: string;
  }
) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: params.orderId },
    select: { orderType: true, internalStatus: true },
  });
  const path = forwardPath(order.orderType, order.internalStatus, params.target, params.onlyFrom);
  for (const next of path) {
    const result = await transitionOrder(tx, {
      orderId: params.orderId,
      to: next,
      changedBy: params.changedBy,
      reason: params.reason,
    });
    // ถูกแย่งเปลี่ยนสถานะกลางทาง → หยุด ไม่ดันทับของคนอื่น
    if (!result.changed) break;
  }
  return { advanced: path.length > 0 };
}

// ปิดใบผลิตเมื่อทุกขั้นเสร็จ + ดันออเดอร์ "กำลังผลิต" → "ตรวจคุณภาพ" อัตโนมัติ
// rollup เดียวที่ใช้ร่วมกันทั้ง production.updateStep และ outsource QC ผ่าน (ไม่ซ้ำตรรกะ 2 ที่)
// ดันออเดอร์เฉพาะตอนยัง PRODUCING — ไม่แตะออเดอร์ที่เลยขั้นไปแล้ว/ปิดงานแล้ว · คืน true ถ้าเพิ่งปิดรอบนี้
export async function finalizeProductionIfComplete(
  tx: PrismaTx,
  params: { productionId: string; changedBy: string }
) {
  const steps = await tx.productionStep.findMany({
    where: { productionId: params.productionId },
    select: { status: true },
  });
  if (steps.length === 0 || !steps.every((s) => s.status === "COMPLETED")) {
    return false;
  }

  const production = await tx.production.update({
    where: { id: params.productionId },
    data: { status: "COMPLETED", endDate: new Date() },
    select: { orderId: true },
  });

  // ดันออเดอร์เฉพาะเมื่อ "ทุกใบผลิต" ของออเดอร์เสร็จ — ออเดอร์มีได้หลายใบผลิต
  // (ใบหนึ่งเสร็จแต่ยังมีใบอื่นค้าง = ยังไม่ควรเด้งเข้า QC)
  const openProductions = await tx.production.count({
    where: { orderId: production.orderId, status: { not: "COMPLETED" } },
  });
  if (openProductions === 0) {
    await advanceOrderForward(tx, {
      orderId: production.orderId,
      target: "QUALITY_CHECK",
      changedBy: params.changedBy,
      onlyFrom: ["PRODUCING"],
    });
  }

  return true;
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
