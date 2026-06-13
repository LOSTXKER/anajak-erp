import { z } from "zod";
import { Prisma } from "@prisma/client";
import { router, protectedProcedure, requireRole } from "../trpc";
import { createAuditLog } from "@/server/helpers";
import { notFound, badRequest } from "@/server/errors";
import { nextDocumentNumber, withDocNumberRetry } from "@/server/services/document-number";
import {
  RECEIVABLE_TYPES,
  outstandingOf,
  buildAgingReport,
  loadAgingInvoices,
} from "@/server/services/receivables";
import { aggToNumber } from "@/server/services/money";
import type { PrismaTx } from "@/lib/prisma";

// ใบวางบิล + รายงานลูกหนี้ — เอกสาร/รายงานการเงิน = บัญชี + ระดับบริหาร (ชุดเดียวกับ billing)
const billingStaff = requireRole("OWNER", "MANAGER", "ACCOUNTANT");

// ล็อกแถวใบแจ้งหนี้ทุกใบที่จะขึ้นใบวางบิล — กันสองใบวางบิลแย่งใบเดียวกัน/เงินเข้าระหว่างสร้าง
// ORDER BY id ให้ทุก request ไล่ lock ลำดับเดียวกัน — สอง request ใบซ้อนกันจะรอคิว ไม่ deadlock
async function lockInvoiceRows(tx: PrismaTx, invoiceIds: string[]) {
  await tx.$queryRaw`SELECT id FROM invoices WHERE id IN (${Prisma.join(invoiceIds)}) ORDER BY id FOR UPDATE`;
}

export const billingNoteRouter = router({
  // ใบแจ้งหนี้ที่วางบิลได้ของลูกค้า: ลูกหนี้ค้างชำระที่ยังไม่อยู่บนใบวางบิลที่ใช้งานอยู่
  // + ยอดใบลดหนี้สุทธิของลูกค้า (UI เตือน — ใบลดหนี้ยังไม่ถูกหักจากยอดค้างอัตโนมัติ)
  eligibleInvoices: protectedProcedure
    .use(billingStaff)
    .input(z.object({ customerId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [invoices, creditNotes] = await Promise.all([
        ctx.prisma.invoice.findMany({
          where: {
            customerId: input.customerId,
            isVoided: false,
            type: { in: [...RECEIVABLE_TYPES] },
            paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] },
          },
          include: {
            payments: { select: { amount: true, whtAmount: true } },
            order: { select: { orderNumber: true, title: true } },
            billingNoteItems: {
              where: { billingNote: { isVoided: false } },
              select: { id: true },
            },
          },
          orderBy: { createdAt: "asc" },
        }),
        ctx.prisma.invoice.aggregate({
          _sum: { totalAmount: true },
          where: { customerId: input.customerId, type: "CREDIT_NOTE", isVoided: false },
        }),
      ]);

      return {
        invoices: invoices
          .filter((inv) => inv.billingNoteItems.length === 0)
          .map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            type: inv.type,
            createdAt: inv.createdAt,
            dueDate: inv.dueDate,
            totalAmount: inv.totalAmount,
            outstanding: outstandingOf(inv).toNumber(),
            orderNumber: inv.order.orderNumber,
            orderTitle: inv.order.title,
          }))
          .filter((inv) => inv.outstanding > 0),
        creditNoteTotal: aggToNumber(creditNotes._sum.totalAmount),
      };
    }),

  create: protectedProcedure
    .use(billingStaff)
    .input(
      z.object({
        customerId: z.string(),
        invoiceIds: z.array(z.string()).min(1, "เลือกใบแจ้งหนี้อย่างน้อย 1 ใบ"),
        dueDate: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const customer = await ctx.prisma.customer.findUnique({
        where: { id: input.customerId },
        select: { id: true },
      });
      if (!customer) notFound("ลูกค้า", input.customerId);

      const note = await withDocNumberRetry(() =>
        ctx.prisma.$transaction(async (tx) => {
          await lockInvoiceRows(tx, input.invoiceIds);

          const invoices = await tx.invoice.findMany({
            where: { id: { in: input.invoiceIds } },
            include: {
              payments: { select: { amount: true, whtAmount: true } },
              billingNoteItems: {
                where: { billingNote: { isVoided: false } },
                select: { id: true },
              },
            },
          });
          if (invoices.length !== input.invoiceIds.length) {
            badRequest("มีใบแจ้งหนี้ที่ไม่พบในระบบ");
          }

          // validate ใต้ lock ทุกใบ: ของลูกค้ารายนี้ · เป็นลูกหนี้ · ยังไม่ void ·
          // ไม่อยู่บนใบวางบิลอื่นที่ใช้งานอยู่ · ยังมียอดคงเหลือ
          const items: { invoiceId: string; amount: Prisma.Decimal }[] = [];
          for (const inv of invoices) {
            if (inv.customerId !== input.customerId) {
              badRequest(`${inv.invoiceNumber} ไม่ใช่ใบแจ้งหนี้ของลูกค้ารายนี้`);
            }
            if (inv.isVoided || !(RECEIVABLE_TYPES as readonly string[]).includes(inv.type)) {
              badRequest(`${inv.invoiceNumber} ไม่ใช่ใบแจ้งหนี้ที่วางบิลได้`);
            }
            if (inv.billingNoteItems.length > 0) {
              badRequest(`${inv.invoiceNumber} อยู่บนใบวางบิลอื่นที่ยังใช้งานอยู่`);
            }
            const outstanding = outstandingOf(inv);
            if (outstanding.lte(0)) {
              badRequest(`${inv.invoiceNumber} ไม่มียอดคงเหลือแล้ว`);
            }
            items.push({ invoiceId: inv.id, amount: outstanding });
          }
          const totalAmount = items.reduce((sum, i) => sum.plus(i.amount), new Prisma.Decimal(0));

          const created = await tx.billingNote.create({
            data: {
              billingNoteNumber: await nextDocumentNumber(tx, "BILLING_NOTE"),
              customerId: input.customerId,
              dueDate: input.dueDate ? new Date(input.dueDate) : null,
              totalAmount: totalAmount.toNumber(),
              notes: input.notes,
              items: {
                create: items.map((i) => ({
                  invoiceId: i.invoiceId,
                  amount: i.amount.toNumber(),
                })),
              },
            },
          });

          await createAuditLog(tx, {
            userId: ctx.userId,
            action: "CREATE",
            entityType: "BILLING_NOTE",
            entityId: created.id,
            newValue: {
              billingNoteNumber: created.billingNoteNumber,
              totalAmount: created.totalAmount,
              invoiceCount: items.length,
            },
          });

          return created;
        })
      );

      return note;
    }),

  list: protectedProcedure
    .use(billingStaff)
    .input(
      z.object({
        search: z.string().optional(),
        page: z.number().default(1),
        limit: z.number().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.BillingNoteWhereInput = input.search
        ? {
            OR: [
              { billingNoteNumber: { contains: input.search, mode: "insensitive" } },
              { customer: { name: { contains: input.search, mode: "insensitive" } } },
              { customer: { company: { contains: input.search, mode: "insensitive" } } },
            ],
          }
        : {};

      const [notes, total] = await Promise.all([
        ctx.prisma.billingNote.findMany({
          where,
          include: {
            customer: { select: { name: true, company: true } },
            _count: { select: { items: true } },
            // ยอดบนใบเป็น snapshot ณ วันวางบิล — ดึงใบลูกมาคิด "คงเหลือจริง" สดให้หน้า list
            items: {
              select: {
                invoice: {
                  select: {
                    type: true,
                    totalAmount: true,
                    isVoided: true,
                    payments: { select: { amount: true, whtAmount: true } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        ctx.prisma.billingNote.count({ where }),
      ]);

      return {
        notes: notes.map(({ items, ...note }) => ({
          ...note,
          currentOutstanding: items
            .reduce(
              (sum, item) =>
                item.invoice.isVoided ? sum : sum.plus(outstandingOf(item.invoice)),
              new Prisma.Decimal(0)
            )
            .toNumber(),
        })),
        total,
        pages: Math.ceil(total / input.limit),
      };
    }),

  // ยกเลิก-ออกใหม่เท่านั้น ห้ามลบ — ใบแจ้งหนี้ในใบที่ยกเลิกกลับมาวางบิลใหม่ได้
  void: protectedProcedure
    .use(billingStaff)
    .input(
      z.object({
        id: z.string(),
        reason: z.string().min(1, "กรุณาระบุเหตุผลในการยกเลิก"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const note = await ctx.prisma.billingNote.findUniqueOrThrow({
        where: { id: input.id },
      });
      if (note.isVoided) {
        badRequest("ใบวางบิลนี้ถูกยกเลิกไปแล้ว");
      }

      const updated = await ctx.prisma.billingNote.update({
        where: { id: input.id },
        data: { isVoided: true, voidedReason: input.reason },
      });

      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "VOID",
        entityType: "BILLING_NOTE",
        entityId: input.id,
        reason: input.reason,
        newValue: { voided: true },
      });

      return updated;
    }),

  // รายงานลูกหนี้แยกถังอายุหนี้ — นิยามยอดค้าง/เลยกำหนดชุดเดียวกับ overdue sweep
  aging: protectedProcedure.use(billingStaff).query(async ({ ctx }) => {
    const invoices = await loadAgingInvoices(ctx.prisma);
    return buildAgingReport(invoices);
  }),
});
