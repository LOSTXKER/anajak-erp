import type { ExtendedPrismaClient, PrismaTx } from "@/lib/prisma";
import { canQuotationTransition, quotationStatusLabel } from "@/lib/quotation-status";
import { badRequest } from "@/server/errors";
import { createAuditLog } from "@/server/helpers";
import { moneyInput } from "@/server/services/money";
import { computeQuotationTotals } from "@/server/services/pricing";
import { isQuotationExpired, newConfirmToken } from "@/server/services/quotation-confirm";

export interface QuotationDraftItemInput {
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  notes?: string;
}

export interface UpdateQuotationDraftInput {
  id: string;
  title: string;
  description?: string;
  validUntil: Date;
  terms?: string;
  discount: number;
  tax: number;
  notes?: string;
  items: QuotationDraftItemInput[];
}

async function lockQuotationRow(tx: PrismaTx, quotationId: string) {
  await tx.$queryRaw`SELECT id FROM quotations WHERE id = ${quotationId} FOR UPDATE`;
}

/**
 * บันทึกหัวใบ + รายการ + ยอดใหม่ใน transaction เดียว
 *
 * ใบที่ลูกค้าถือลิงก์อยู่ต้องนิ่ง จึงล็อกแถวและตรวจ DRAFT หลังได้ lock แล้วเสมอ
 * การลบรายการเก่า/สร้างใหม่/อัปเดตยอด/เขียน audit จะ rollback พร้อมกันทั้งหมดเมื่อจุดใดพัง
 */
export async function updateQuotationDraft(
  prisma: ExtendedPrismaClient,
  params: UpdateQuotationDraftInput & { userId: string }
) {
  return prisma.$transaction(async (tx) => {
    await lockQuotationRow(tx, params.id);

    const existing = await tx.quotation.findUniqueOrThrow({
      where: { id: params.id },
      select: {
        status: true,
        title: true,
        validUntil: true,
        discount: true,
        tax: true,
        totalAmount: true,
        _count: { select: { items: true } },
      },
    });

    if (existing.status !== "DRAFT") {
      badRequest(
        'แก้ใบเสนอได้เฉพาะฉบับร่าง — ใบที่ส่งแล้วให้กด "ดึงกลับเป็นร่าง" ก่อน'
      );
    }

    const totals = computeQuotationTotals({
      items: params.items,
      discount: params.discount,
      tax: params.tax,
    });

    await tx.quotationItem.deleteMany({ where: { quotationId: params.id } });
    const updated = await tx.quotation.update({
      where: { id: params.id },
      data: {
        title: params.title,
        description: params.description ?? null,
        validUntil: params.validUntil,
        terms: params.terms ?? null,
        subtotal: totals.subtotal,
        discount: moneyInput(params.discount).toNumber(),
        tax: moneyInput(params.tax).toNumber(),
        totalAmount: totals.totalAmount,
        notes: params.notes ?? null,
        items: {
          create: params.items.map((item, index) => ({
            sortOrder: index,
            name: item.name,
            description: item.description ?? null,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: moneyInput(item.unitPrice).toNumber(),
            totalPrice: totals.lineTotals[index],
            notes: item.notes ?? null,
          })),
        },
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });

    await createAuditLog(tx, {
      userId: params.userId,
      action: "UPDATE",
      entityType: "QUOTATION",
      entityId: params.id,
      oldValue: {
        title: existing.title,
        validUntil: existing.validUntil,
        discount: existing.discount,
        tax: existing.tax,
        totalAmount: existing.totalAmount,
        itemCount: existing._count.items,
      },
      newValue: {
        title: params.title,
        validUntil: params.validUntil,
        discount: moneyInput(params.discount).toNumber(),
        tax: moneyInput(params.tax).toNumber(),
        totalAmount: totals.totalAmount,
        itemCount: params.items.length,
      },
      reason: "บันทึกหัวใบและรายการใบเสนอพร้อมกัน",
    });

    return updated;
  });
}

export function quotationSharePath(token: string): string {
  return `/quote/${token}`;
}

/**
 * เตรียมใบเสนอให้แชร์ใน action เดียว: DRAFT → SENT + token + audit
 * ถ้าใบถูกส่งแล้วจะคืน token เดิม หรือเติม token ให้โดยไม่เปลี่ยนความหมายสถานะ
 */
export async function prepareQuotationShare(
  prisma: ExtendedPrismaClient,
  params: { id: string; userId: string; expectedStatus?: string }
) {
  return prisma.$transaction(async (tx) => {
    await lockQuotationRow(tx, params.id);

    const existing = await tx.quotation.findUniqueOrThrow({
      where: { id: params.id },
      select: {
        status: true,
        validUntil: true,
        sentAt: true,
        confirmToken: true,
      },
    });

    if (params.expectedStatus && existing.status !== params.expectedStatus) {
      badRequest(
        `สถานะใบเสนอเปลี่ยนเป็น "${quotationStatusLabel(existing.status)}" แล้ว — รีเฟรชหน้าเพื่อดูข้อมูลล่าสุดก่อนแชร์`
      );
    }

    if (existing.status !== "DRAFT" && existing.status !== "SENT") {
      badRequest(
        `เตรียมลิงก์แชร์จากสถานะ "${quotationStatusLabel(existing.status)}" ไม่ได้ — ดึงกลับเป็นร่างก่อนแก้และแชร์ใหม่`
      );
    }

    if (existing.status === "DRAFT" && !canQuotationTransition(existing.status, "SENT")) {
      badRequest("ใบเสนอนี้เปลี่ยนเป็นสถานะส่งแล้วไม่ได้");
    }

    if (isQuotationExpired(existing.validUntil)) {
      badRequest('ใบเสนอนี้หมดอายุแล้ว — แก้วันที่ "ใช้ได้ถึง" ก่อนคัดลอก/แชร์');
    }

    if (existing.status === "SENT" && existing.confirmToken) {
      return {
        status: "SENT" as const,
        token: existing.confirmToken,
        sharePath: quotationSharePath(existing.confirmToken),
      };
    }

    const token = existing.confirmToken ?? newConfirmToken();
    const updated = await tx.quotation.updateMany({
      where: { id: params.id, status: existing.status },
      data: {
        status: "SENT",
        sentAt: existing.sentAt ?? new Date(),
        confirmToken: token,
      },
    });
    if (updated.count === 0) {
      badRequest("สถานะใบเสนอเพิ่งถูกเปลี่ยนโดยคนอื่น — รีเฟรชหน้าแล้วลองใหม่");
    }

    await createAuditLog(tx, {
      userId: params.userId,
      action: "UPDATE",
      entityType: "QUOTATION",
      entityId: params.id,
      oldValue: { status: existing.status, hasShareToken: !!existing.confirmToken },
      newValue: { status: "SENT", hasShareToken: true },
      reason: "เตรียมลิงก์คัดลอก/แชร์ใบเสนอ",
    });

    return { status: "SENT" as const, token, sharePath: quotationSharePath(token) };
  });
}
