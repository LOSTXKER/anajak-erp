// ลิงก์ยืนยันใบเสนอราคาให้ลูกค้า (FLOW-REDESIGN ก้อน 4 — ขอบลูกค้า)
//
// ลูกค้าเปิดผ่าน token ไม่ต้อง login → เห็นใบเสนอ "ของตัวเอง" (รายการ+ราคาเต็ม — ลูกค้าตกลง
// ราคานี้ จึงต้องเห็นราคาต่อหน่วย/ส่วนลด/ภาษี/ยอดรวม) → กด "ยืนยัน" หรือ "ขอแก้ไข+เหตุผล"
//
// **มติเบส (2026-06-13)**: ยืนยัน = แค่ปั๊ม ACCEPTED + เด้งกระดิ่งทีม → พนักงานกด "แปลงเป็น
// ออเดอร์" เองในระบบ (เช็คเครดิต+ดูความเหมาะสมก่อน · กันลูกค้าเจอ error เครดิตบนหน้า public)
//
// **กฎเหล็กกันรั่ว**: payload public ห้ามคืน notes ภายใน/createdBy/orderId/cost — select แคบ
// ต่างจากหน้าสถานะ (ก้อน 4 portal) ตรงที่ "ราคาแยกโชว์ได้" เพราะนี่คือใบที่ลูกค้ากำลังตกลงราคา

import { randomBytes } from "crypto";
import { TRPCError } from "@trpc/server";
import { createNotification } from "@/server/helpers";
import type { ExtendedPrismaClient, PrismaTx } from "@/lib/prisma";

// ใบเสนอหมดอายุ = พ้นสิ้นวันไทยของ validUntil (นิยามเดียวกับ overdue ของบิล)
// อยู่ที่นี่ (services) เป็นแหล่งเดียว — quotation router import ไปใช้ (กันสูตรหมดอายุ drift)
export function isQuotationExpired(validUntil: Date): boolean {
  const endOfDay = new Date(validUntil);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay < new Date();
}

export function newConfirmToken(): string {
  return randomBytes(32).toString("hex");
}

const num = (d: unknown): number => Number(d ?? 0);

/** ผลตัดสินใบเสนอจากลูกค้า → กระดิ่งทีมขาย (ลูกค้ากดเองนอกเวลางานได้ ทีมต้องรู้จากกระดิ่ง) */
async function notifyQuoteDecision(
  tx: PrismaTx,
  params: {
    quotationId: string;
    quotationNumber: string;
    title: string;
    accepted: boolean;
    reason?: string | null;
  }
) {
  // ขาย/แอดมินถือความสัมพันธ์ลูกค้า · เจ้าของ/ผู้จัดการเห็นภาพรวม (กราฟิกไม่เกี่ยวเรื่องราคา)
  const team = await tx.user.findMany({
    where: { role: { in: ["OWNER", "MANAGER", "SALES"] }, isActive: true },
    select: { id: true },
  });
  for (const member of team) {
    await createNotification(tx, {
      userId: member.id,
      type: "ORDER",
      title: params.accepted
        ? `ลูกค้ายืนยันใบเสนอ ${params.quotationNumber}`
        : `ลูกค้าขอแก้ไข/ปฏิเสธใบเสนอ ${params.quotationNumber}`,
      message: params.reason || params.title,
      link: `/quotations/${params.quotationId}`,
      entityType: "QUOTATION",
      entityId: params.quotationId,
    });
  }
}

/** คืนใบเสนอจาก confirmToken (public-safe) — โชว์ราคาเต็ม แต่กัน notes/orderId/createdBy ภายใน */
export async function getQuotationByConfirmToken(
  prisma: Pick<PrismaTx, "quotation">,
  token: string
) {
  const q = await prisma.quotation.findUnique({
    where: { confirmToken: token },
    select: {
      quotationNumber: true,
      status: true,
      title: true,
      description: true,
      terms: true,
      validUntil: true,
      subtotal: true,
      discount: true,
      tax: true,
      totalAmount: true,
      createdAt: true,
      customer: { select: { name: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          name: true,
          description: true,
          quantity: true,
          unit: true,
          unitPrice: true,
          totalPrice: true,
        },
      },
    },
  });

  if (!q) {
    throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบลิงก์ใบเสนอนี้" });
  }
  // DRAFT = ราคายังร่าง/ถูกดึงกลับมาแก้ — ห้ามโชว์ผ่านลิงก์ (กันราคาที่ยังไม่ยืนรั่ว)
  // (generateLink บังคับ SENT อยู่แล้ว · แต่ staff ดึงกลับเป็น DRAFT เพื่อแก้ได้ ลิงก์เก่ายังชี้อยู่)
  if (q.status === "DRAFT") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "ใบเสนอนี้กำลังปรับปรุงราคา กรุณาติดต่อร้าน",
    });
  }

  return {
    quotationNumber: q.quotationNumber,
    status: q.status,
    title: q.title,
    description: q.description,
    terms: q.terms,
    customerName: q.customer.name,
    validUntil: q.validUntil,
    isExpired: isQuotationExpired(q.validUntil),
    subtotal: num(q.subtotal),
    discount: num(q.discount),
    tax: num(q.tax),
    totalAmount: num(q.totalAmount),
    items: q.items.map((it) => ({
      name: it.name,
      description: it.description,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: num(it.unitPrice),
      totalPrice: num(it.totalPrice),
    })),
  };
}

/** ลูกค้ายืนยันใบเสนอผ่านลิงก์ — SENT → ACCEPTED (race-safe) + กระดิ่งทีม */
export async function acceptQuotationByToken(prisma: ExtendedPrismaClient, token: string) {
  const q = await prisma.quotation.findUnique({
    where: { confirmToken: token },
    select: { id: true, status: true, validUntil: true, quotationNumber: true, title: true },
  });
  if (!q) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบลิงก์ใบเสนอนี้" });
  if (q.status === "ACCEPTED" || q.status === "CONVERTED") {
    throw new TRPCError({ code: "CONFLICT", message: "ใบเสนอนี้ได้รับการยืนยันไปแล้ว" });
  }
  if (q.status !== "SENT") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "ใบเสนอนี้ไม่อยู่ในสถานะที่ยืนยันได้ กรุณาติดต่อร้าน",
    });
  }
  // ราคายืนถึงแค่ validUntil — หมดอายุต้องให้ร้านยืนราคาใหม่ก่อน (เลียน guard updateStatus)
  if (isQuotationExpired(q.validUntil)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "ใบเสนอนี้หมดอายุแล้ว กรุณาติดต่อร้านเพื่อขอใบเสนอใหม่",
    });
  }

  return prisma.$transaction(async (tx) => {
    // flip แบบมีเงื่อนไข — กันลูกค้ากดสองที/สองแท็บพร้อมกัน (race) คนช้าเจอ CONFLICT
    const flipped = await tx.quotation.updateMany({
      where: { confirmToken: token, status: "SENT" },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    if (flipped.count === 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "ใบเสนอนี้ถูกตัดสินไปแล้ว กรุณารีเฟรชหน้า",
      });
    }
    await notifyQuoteDecision(tx, {
      quotationId: q.id,
      quotationNumber: q.quotationNumber,
      title: q.title,
      accepted: true,
    });
    return { status: "ACCEPTED" as const };
  });
}

/** ลูกค้าขอแก้ไข/ปฏิเสธใบเสนอผ่านลิงก์ — SENT → REJECTED + เก็บเหตุผล + กระดิ่งทีม */
export async function rejectQuotationByToken(
  prisma: ExtendedPrismaClient,
  token: string,
  reason?: string
) {
  const q = await prisma.quotation.findUnique({
    where: { confirmToken: token },
    select: { id: true, status: true, quotationNumber: true, title: true },
  });
  if (!q) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบลิงก์ใบเสนอนี้" });
  if (q.status === "CONVERTED") {
    throw new TRPCError({ code: "CONFLICT", message: "ใบเสนอนี้ถูกแปลงเป็นออเดอร์ไปแล้ว" });
  }
  if (q.status !== "SENT") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "ใบเสนอนี้ถูกตัดสินไปแล้ว กรุณาติดต่อร้าน",
    });
  }

  return prisma.$transaction(async (tx) => {
    const flipped = await tx.quotation.updateMany({
      where: { confirmToken: token, status: "SENT" },
      data: { status: "REJECTED", rejectedAt: new Date(), rejectedReason: reason || null },
    });
    if (flipped.count === 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "ใบเสนอนี้ถูกตัดสินไปแล้ว กรุณารีเฟรชหน้า",
      });
    }
    await notifyQuoteDecision(tx, {
      quotationId: q.id,
      quotationNumber: q.quotationNumber,
      title: q.title,
      accepted: false,
      reason,
    });
    return { status: "REJECTED" as const };
  });
}
