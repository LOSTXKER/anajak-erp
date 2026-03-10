import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../trpc";
import { generateInvoiceNumber } from "@/lib/utils";
import { createAuditLog } from "@/server/helpers";
import { getStartOfMonth } from "@/lib/date-utils";
import { notFound, badRequest } from "@/server/errors";

const ownerOrAccountant = requireRole("OWNER", "MANAGER", "ACCOUNTANT");

export const billingRouter = router({
  listByOrder: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.invoice.findMany({
        where: { orderId: input.orderId },
        include: { payments: true },
        orderBy: { createdAt: "desc" },
      });
    }),

  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        type: z.string().optional(),
        page: z.number().default(1),
        limit: z.number().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      if (input.search) {
        where.OR = [
          { invoiceNumber: { contains: input.search, mode: "insensitive" } },
          { customer: { name: { contains: input.search, mode: "insensitive" } } },
        ];
      }
      if (input.status) where.paymentStatus = input.status;
      if (input.type) where.type = input.type;

      const [invoices, total] = await Promise.all([
        ctx.prisma.invoice.findMany({
          where,
          include: {
            order: { select: { orderNumber: true, title: true } },
            customer: { select: { name: true, company: true } },
            payments: true,
          },
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        ctx.prisma.invoice.count({ where }),
      ]);

      return { invoices, total, pages: Math.ceil(total / input.limit) };
    }),

  create: protectedProcedure
    .use(ownerOrAccountant)
    .input(
      z.object({
        orderId: z.string(),
        customerId: z.string(),
        type: z.enum([
          "QUOTATION", "DEPOSIT_INVOICE", "FINAL_INVOICE",
          "RECEIPT", "CREDIT_NOTE", "DEBIT_NOTE",
        ]),
        amount: z.number().min(0),
        discount: z.number().default(0),
        tax: z.number().default(0),
        dueDate: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.prisma.order.findUnique({
        where: { id: input.orderId },
        select: { id: true, customerId: true, totalAmount: true },
      });
      if (!order) {
        notFound("ออเดอร์", input.orderId);
      }
      if (order.customerId !== input.customerId) {
        badRequest("ลูกค้าไม่ตรงกับออเดอร์");
      }

      const totalAmount = input.amount - input.discount + input.tax;

      const invoice = await ctx.prisma.invoice.create({
        data: {
          invoiceNumber: generateInvoiceNumber(input.type),
          orderId: input.orderId,
          customerId: input.customerId,
          type: input.type,
          amount: input.amount,
          discount: input.discount,
          tax: input.tax,
          totalAmount,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          notes: input.notes,
        },
      });

      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "CREATE",
        entityType: "INVOICE",
        entityId: invoice.id,
        newValue: { invoiceNumber: invoice.invoiceNumber, type: input.type, totalAmount },
      });

      return invoice;
    }),

  recordPayment: protectedProcedure
    .use(ownerOrAccountant)
    .input(
      z.object({
        invoiceId: z.string(),
        amount: z.number().min(0),
        method: z.string(),
        reference: z.string().optional(),
        evidenceUrl: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.prisma.invoice.findUniqueOrThrow({
        where: { id: input.invoiceId },
        include: { payments: true },
      });

      if (invoice.isVoided) {
        badRequest("ไม่สามารถบันทึกการชำระเงินสำหรับใบแจ้งหนี้ที่ถูกยกเลิกแล้ว");
      }

      const previouslyPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
      const remaining = invoice.totalAmount - previouslyPaid;

      if (input.amount > remaining + 0.01) {
        badRequest(`จำนวนเงินเกินยอดคงเหลือ (เหลือ ${remaining.toFixed(2)} บาท)`);
      }

      const payment = await ctx.prisma.payment.create({
        data: input,
      });

      const totalPaid = previouslyPaid + input.amount;
      let paymentStatus: "PARTIALLY_PAID" | "PAID" = "PARTIALLY_PAID";
      if (totalPaid >= invoice.totalAmount - 0.01) {
        paymentStatus = "PAID";
      }

      await ctx.prisma.invoice.update({
        where: { id: input.invoiceId },
        data: {
          paymentStatus,
          paidAt: paymentStatus === "PAID" ? new Date() : null,
        },
      });

      await ctx.prisma.customer.update({
        where: { id: invoice.customerId },
        data: { totalSpent: { increment: input.amount } },
      });

      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "CREATE",
        entityType: "PAYMENT",
        entityId: payment.id,
        newValue: { invoiceId: input.invoiceId, amount: input.amount, method: input.method },
      });

      return payment;
    }),

  voidInvoice: protectedProcedure
    .use(ownerOrAccountant)
    .input(
      z.object({
        invoiceId: z.string(),
        reason: z.string().min(1, "กรุณาระบุเหตุผลในการยกเลิก"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.prisma.invoice.findUniqueOrThrow({
        where: { id: input.invoiceId },
        include: { payments: true },
      });

      const totalPaidOnInvoice = invoice.payments.reduce((sum, p) => sum + p.amount, 0);

      const updatedInvoice = await ctx.prisma.invoice.update({
        where: { id: input.invoiceId },
        data: {
          isVoided: true,
          voidedReason: input.reason,
          paymentStatus: "VOIDED",
        },
      });

      if (totalPaidOnInvoice > 0) {
        await ctx.prisma.customer.update({
          where: { id: invoice.customerId },
          data: { totalSpent: { decrement: totalPaidOnInvoice } },
        });
      }

      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "VOID",
        entityType: "INVOICE",
        entityId: input.invoiceId,
        reason: input.reason,
        newValue: { voided: true, refundedAmount: totalPaidOnInvoice },
      });

      return updatedInvoice;
    }),

  recordRefund: protectedProcedure
    .use(ownerOrAccountant)
    .input(
      z.object({
        invoiceId: z.string(),
        amount: z.number().min(0.01, "จำนวนเงินคืนต้องมากกว่า 0"),
        method: z.string(),
        reference: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.prisma.invoice.findUniqueOrThrow({
        where: { id: input.invoiceId },
        include: { payments: true },
      });

      const totalPaid = invoice.payments
        .filter((p) => p.amount > 0)
        .reduce((sum, p) => sum + p.amount, 0);
      const totalRefunded = invoice.payments
        .filter((p) => p.amount < 0)
        .reduce((sum, p) => sum + Math.abs(p.amount), 0);
      const refundable = totalPaid - totalRefunded;

      if (input.amount > refundable + 0.01) {
        badRequest(`จำนวนเงินคืนเกินยอดที่สามารถคืนได้ (คืนได้สูงสุด ${refundable.toFixed(2)} บาท)`);
      }

      const payment = await ctx.prisma.payment.create({
        data: {
          invoiceId: input.invoiceId,
          amount: -input.amount,
          method: input.method,
          reference: input.reference,
          notes: input.notes ? `[คืนเงิน] ${input.notes}` : "[คืนเงิน]",
        },
      });

      const netPaid = totalPaid - totalRefunded - input.amount;
      let paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" = "UNPAID";
      if (netPaid >= invoice.totalAmount - 0.01) {
        paymentStatus = "PAID";
      } else if (netPaid > 0.01) {
        paymentStatus = "PARTIALLY_PAID";
      }

      await ctx.prisma.invoice.update({
        where: { id: input.invoiceId },
        data: {
          paymentStatus,
          paidAt: paymentStatus === "PAID" ? invoice.paidAt : null,
        },
      });

      await ctx.prisma.customer.update({
        where: { id: invoice.customerId },
        data: { totalSpent: { decrement: input.amount } },
      });

      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "CREATE",
        entityType: "PAYMENT",
        entityId: payment.id,
        newValue: { invoiceId: input.invoiceId, refundAmount: input.amount, method: input.method },
      });

      return payment;
    }),

  markOverdue: protectedProcedure
    .mutation(async ({ ctx }) => {
      const result = await ctx.prisma.invoice.updateMany({
        where: {
          paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] },
          isVoided: false,
          dueDate: { lt: new Date() },
        },
        data: { paymentStatus: "OVERDUE" },
      });
      return { updated: result.count };
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const startOfMonth = getStartOfMonth();

    const [totalUnpaid, overdueCount, revenueThisMonth, paidThisMonth] = await Promise.all([
      ctx.prisma.invoice.aggregate({
        _sum: { totalAmount: true },
        where: { paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] }, isVoided: false },
      }),
      ctx.prisma.invoice.count({
        where: { paymentStatus: "OVERDUE", isVoided: false },
      }),
      ctx.prisma.invoice.aggregate({
        _sum: { totalAmount: true },
        where: { createdAt: { gte: startOfMonth }, isVoided: false },
      }),
      ctx.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { createdAt: { gte: startOfMonth } },
      }),
    ]);

    return {
      totalUnpaid: totalUnpaid._sum.totalAmount ?? 0,
      overdueCount,
      revenueThisMonth: revenueThisMonth._sum.totalAmount ?? 0,
      paidThisMonth: paidThisMonth._sum.amount ?? 0,
    };
  }),
});
