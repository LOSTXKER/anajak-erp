import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../trpc";
import { createAuditLog } from "@/server/helpers";
import { getStartOfMonth } from "@/lib/date-utils";
import { notFound, badRequest } from "@/server/errors";
import { D, aggToNumber, moneyInput } from "@/server/services/money";
import { nextDocumentNumber, withDocNumberRetry } from "@/server/services/document-number";
import type { PrismaTx } from "@/lib/prisma";

// เปิดบิล/จัดการสถานะบิล — บัญชี + ระดับบริหาร
const billingStaff = requireRole("OWNER", "MANAGER", "ACCOUNTANT");
// บันทึกเงินเข้า-ออกจริง (รับชำระ/ยกเลิกบิล/คืนเงิน) — แคบสุดตามตาราง RBAC §7
const moneyRecorder = requireRole("OWNER", "ACCOUNTANT");

// ล็อกแถวบิลก่อนอ่าน/คำนวณยอด — กันสอง request บันทึกเงินบนบิลเดียวกันพร้อมกัน
// (อ่าน payments → เช็คยอดคงเหลือ → เขียน ไม่ atomic ถ้าไม่ล็อก) · เรียกใน transaction เท่านั้น
async function lockInvoiceRow(tx: PrismaTx, invoiceId: string) {
  await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId} FOR UPDATE`;
}

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
    .use(billingStaff)
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
    .use(billingStaff)
    .input(
      z.object({
        orderId: z.string(),
        customerId: z.string(),
        type: z.enum([
          "QUOTATION", "DEPOSIT_INVOICE", "FINAL_INVOICE",
          "RECEIPT", "CREDIT_NOTE", "DEBIT_NOTE",
        ]),
        amount: z.number().min(0),
        discount: z.number().min(0).default(0),
        tax: z.number().min(0).default(0),
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

      const amount = moneyInput(input.amount);
      const discount = moneyInput(input.discount);
      const tax = moneyInput(input.tax);
      const totalAmount = amount.minus(discount).plus(tax);
      if (totalAmount.lt(0)) {
        badRequest("ส่วนลดเกินยอดบิล — ยอดรวมติดลบไม่ได้");
      }

      // เลขบิลรันต่อเนื่อง — สร้างใน transaction เดียวกับบิลเสมอ
      const invoice = await withDocNumberRetry(() =>
        ctx.prisma.$transaction(async (tx) => {
          const created = await tx.invoice.create({
            data: {
              invoiceNumber: await nextDocumentNumber(tx, input.type),
              orderId: input.orderId,
              customerId: input.customerId,
              type: input.type,
              amount: amount.toNumber(),
              discount: discount.toNumber(),
              tax: tax.toNumber(),
              totalAmount: totalAmount.toNumber(),
              dueDate: input.dueDate ? new Date(input.dueDate) : null,
              notes: input.notes,
            },
          });

          await createAuditLog(tx, {
            userId: ctx.userId,
            action: "CREATE",
            entityType: "INVOICE",
            entityId: created.id,
            newValue: {
              invoiceNumber: created.invoiceNumber,
              type: input.type,
              totalAmount: created.totalAmount,
            },
          });

          return created;
        })
      );

      return invoice;
    }),

  recordPayment: protectedProcedure
    .use(moneyRecorder)
    .input(
      z.object({
        invoiceId: z.string(),
        amount: z.number().min(0.01, "จำนวนเงินต้องมากกว่า 0"),
        method: z.string(),
        reference: z.string().optional(),
        evidenceUrl: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const amount = moneyInput(input.amount);

      return ctx.prisma.$transaction(async (tx) => {
        await lockInvoiceRow(tx, input.invoiceId);

        const invoice = await tx.invoice.findUniqueOrThrow({
          where: { id: input.invoiceId },
          include: { payments: true },
        });

        if (invoice.isVoided) {
          badRequest("ไม่สามารถบันทึกการชำระเงินสำหรับใบแจ้งหนี้ที่ถูกยกเลิกแล้ว");
        }

        const previouslyPaid = invoice.payments.reduce((sum, p) => sum.plus(p.amount), D(0));
        const total = D(invoice.totalAmount);
        const remaining = total.minus(previouslyPaid);

        if (amount.gt(remaining)) {
          badRequest(`จำนวนเงินเกินยอดคงเหลือ (เหลือ ${remaining.toFixed(2)} บาท)`);
        }

        const payment = await tx.payment.create({
          data: { ...input, amount: amount.toNumber() },
        });

        const totalPaid = previouslyPaid.plus(amount);
        const paymentStatus = totalPaid.gte(total) ? ("PAID" as const) : ("PARTIALLY_PAID" as const);

        await tx.invoice.update({
          where: { id: input.invoiceId },
          data: {
            paymentStatus,
            paidAt: paymentStatus === "PAID" ? new Date() : null,
          },
        });

        await tx.customer.update({
          where: { id: invoice.customerId },
          data: { totalSpent: { increment: amount.toNumber() } },
        });

        await createAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entityType: "PAYMENT",
          entityId: payment.id,
          newValue: { invoiceId: input.invoiceId, amount: amount.toNumber(), method: input.method },
        });

        return payment;
      });
    }),

  voidInvoice: protectedProcedure
    .use(moneyRecorder)
    .input(
      z.object({
        invoiceId: z.string(),
        reason: z.string().min(1, "กรุณาระบุเหตุผลในการยกเลิก"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.$transaction(async (tx) => {
        await lockInvoiceRow(tx, input.invoiceId);

        const invoice = await tx.invoice.findUniqueOrThrow({
          where: { id: input.invoiceId },
          include: { payments: true },
        });

        // กัน void ซ้ำ — เดิมกดซ้ำได้ ทำให้ totalSpent ของลูกค้าโดนหักสองรอบ
        if (invoice.isVoided) {
          badRequest("ใบแจ้งหนี้นี้ถูกยกเลิกไปแล้ว");
        }

        // ยอดสุทธิที่รับมาแล้วบนบิลนี้ (รวมรายการคืนเงินที่ติดลบ)
        const netPaid = invoice.payments.reduce((sum, p) => sum.plus(p.amount), D(0));

        const updatedInvoice = await tx.invoice.update({
          where: { id: input.invoiceId },
          data: {
            isVoided: true,
            voidedReason: input.reason,
            paymentStatus: "VOIDED",
          },
        });

        if (netPaid.gt(0)) {
          await tx.customer.update({
            where: { id: invoice.customerId },
            data: { totalSpent: { decrement: netPaid.toNumber() } },
          });
        }

        await createAuditLog(tx, {
          userId: ctx.userId,
          action: "VOID",
          entityType: "INVOICE",
          entityId: input.invoiceId,
          reason: input.reason,
          newValue: { voided: true, refundedAmount: netPaid.toNumber() },
        });

        return updatedInvoice;
      });
    }),

  recordRefund: protectedProcedure
    .use(moneyRecorder)
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
      const amount = moneyInput(input.amount);

      return ctx.prisma.$transaction(async (tx) => {
        await lockInvoiceRow(tx, input.invoiceId);

        const invoice = await tx.invoice.findUniqueOrThrow({
          where: { id: input.invoiceId },
          include: { payments: true },
        });

        const totalPaid = invoice.payments
          .filter((p) => p.amount > 0)
          .reduce((sum, p) => sum.plus(p.amount), D(0));
        const totalRefunded = invoice.payments
          .filter((p) => p.amount < 0)
          .reduce((sum, p) => sum.plus(D(p.amount).abs()), D(0));
        const refundable = totalPaid.minus(totalRefunded);

        if (amount.gt(refundable)) {
          badRequest(`จำนวนเงินคืนเกินยอดที่สามารถคืนได้ (คืนได้สูงสุด ${refundable.toFixed(2)} บาท)`);
        }

        const payment = await tx.payment.create({
          data: {
            invoiceId: input.invoiceId,
            amount: amount.negated().toNumber(),
            method: input.method,
            reference: input.reference,
            notes: input.notes ? `[คืนเงิน] ${input.notes}` : "[คืนเงิน]",
          },
        });

        // บิลที่ถูก void แล้ว ต้องคงสถานะ VOIDED — เดิม refund แล้วสถานะเด้งกลับเป็น UNPAID/PAID
        if (!invoice.isVoided) {
          const netPaid = refundable.minus(amount);
          const total = D(invoice.totalAmount);
          const paymentStatus = netPaid.gte(total) && total.gt(0)
            ? ("PAID" as const)
            : netPaid.gt(0)
              ? ("PARTIALLY_PAID" as const)
              : ("UNPAID" as const);

          await tx.invoice.update({
            where: { id: input.invoiceId },
            data: {
              paymentStatus,
              paidAt: paymentStatus === "PAID" ? invoice.paidAt : null,
            },
          });
        }

        // บิลที่ void แล้ว voidInvoice หัก totalSpent เท่ายอดรับสุทธิไปแล้วทั้งก้อน —
        // refund หลัง void ห้ามหักซ้ำ (เดิมเส้นทาง จ่าย→void→refund ทำ totalSpent ติดลบเต็มยอดบิล)
        if (!invoice.isVoided) {
          await tx.customer.update({
            where: { id: invoice.customerId },
            data: { totalSpent: { decrement: amount.toNumber() } },
          });
        }

        await createAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entityType: "PAYMENT",
          entityId: payment.id,
          newValue: { invoiceId: input.invoiceId, refundAmount: amount.toNumber(), method: input.method },
        });

        return payment;
      });
    }),

  markOverdue: protectedProcedure
    .use(billingStaff)
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

  stats: protectedProcedure.use(billingStaff).query(async ({ ctx }) => {
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

    // ผล aggregate ไม่ผ่าน result extension — ต้องแปลง Decimal → number ที่นี่
    return {
      totalUnpaid: aggToNumber(totalUnpaid._sum.totalAmount),
      overdueCount,
      revenueThisMonth: aggToNumber(revenueThisMonth._sum.totalAmount),
      paidThisMonth: aggToNumber(paidThisMonth._sum.amount),
    };
  }),
});
