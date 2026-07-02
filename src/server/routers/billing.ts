import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../trpc";
import { fileUrlSchema } from "@/server/schemas";
import { createAuditLog } from "@/server/helpers";
import { getStartOfMonth } from "@/lib/date-utils";
import { notFound, badRequest } from "@/server/errors";
import { D, aggToNumber, moneyInput, round2 } from "@/server/services/money";
import { nextDocumentNumber, withDocNumberRetry } from "@/server/services/document-number";
import {
  remainingBillable,
  dueDateFromTerms,
  suggestInvoice,
} from "@/server/services/payment-plan";
import { sweepOverdueInvoices, maybeSweepOverdue } from "@/server/services/overdue";
import {
  RECEIVABLE_TYPES,
  creditedOf,
  paymentStatusForSettled,
} from "@/server/services/receivables";
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

// ล็อกแถวออเดอร์ก่อนเช็คเพดานวางบิล — สอง request เปิดบิลออเดอร์เดียวกันพร้อมกัน
// ต้องเห็นยอดบิลของกันและกัน ไม่งั้น sum แล้วเขียนทับทะลุเพดานได้
async function lockOrderRow(tx: PrismaTx, orderId: string) {
  await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
}

export const billingRouter = router({
  // บิล+ยอดรับชำระของออเดอร์ — จำกัดกลุ่มที่เห็นเงินฝั่งขาย (Gate A2: เดิมเปิดทุก role
  // ทำให้การซ่อน payments ใน order.getById ไร้ผล เพราะการ์ดบิลดึงทางนี้ได้เต็ม)
  listByOrder: protectedProcedure
    .use(requireRole("OWNER", "MANAGER", "ACCOUNTANT", "SALES"))
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.invoice.findMany({
        where: { orderId: input.orderId },
        include: {
          payments: true,
          // ใบลดหนี้ที่อ้างใบนี้ — client ต้องหักตอนโชว์ "ค้าง"/prefill บันทึกรับเงิน
          // (ไม่งั้น prefill เกินยอดจริง กดแล้วโดน server ปฏิเสธ)
          adjustments: { select: { type: true, totalAmount: true, isVoided: true } },
        },
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
        // QUOTATION ไม่รับ — ใบเสนอราคามีระบบ Quotation แยก ไม่ควรกินเลขบิล
        type: z.enum([
          "DEPOSIT_INVOICE", "FINAL_INVOICE",
          "RECEIPT", "CREDIT_NOTE", "DEBIT_NOTE",
        ]),
        amount: z.number().min(0),
        discount: z.number().min(0).default(0),
        tax: z.number().min(0).default(0),
        dueDate: z.string().optional(),
        notes: z.string().optional(),
        // ใบลดหนี้/เพิ่มหนี้ต้องอ้างใบเดิม + เหตุผล (ม.86/10 + ป.80/2542 — Gate B1)
        originalInvoiceId: z.string().optional(),
        adjustmentReason: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.prisma.order.findUnique({
        where: { id: input.orderId },
        select: { id: true, customerId: true, totalAmount: true, paymentTerms: true },
      });
      if (!order) {
        notFound("ออเดอร์", input.orderId);
      }
      if (order.customerId !== input.customerId) {
        badRequest("ลูกค้าไม่ตรงกับออเดอร์");
      }

      const isAdjustment = input.type === "CREDIT_NOTE" || input.type === "DEBIT_NOTE";
      if (isAdjustment && (!input.originalInvoiceId || !input.adjustmentReason?.trim())) {
        badRequest(
          "ใบลดหนี้/ใบเพิ่มหนี้ต้องอ้างอิงใบกำกับ/ใบแจ้งหนี้เดิมพร้อมเหตุผล (ม.86/10)"
        );
      }

      const amount = moneyInput(input.amount);
      const discount = moneyInput(input.discount);
      const tax = moneyInput(input.tax);
      const totalAmount = amount.minus(discount).plus(tax);
      if (totalAmount.lt(0)) {
        badRequest("ส่วนลดเกินยอดบิล — ยอดรวมติดลบไม่ได้");
      }

      // วันครบกำหนดมีความหมายเฉพาะใบเรียกเก็บ — ใบเสร็จ/ใบลดหนี้ไม่มีสถานะ "ค้างชำระ"
      // (เก็บ dueDate ไว้ = โดน sweep OVERDUE ปลอมถาวร) · ไม่กรอก → เครดิตเทอมตั้งให้เอง
      const dueDate =
        input.type === "RECEIPT" || input.type === "CREDIT_NOTE"
          ? null
          : input.dueDate
            ? new Date(input.dueDate)
            : input.type === "DEPOSIT_INVOICE" || input.type === "FINAL_INVOICE"
              ? dueDateFromTerms(order.paymentTerms)
              : null;

      // เลขบิลรันต่อเนื่อง — สร้างใน transaction เดียวกับบิลเสมอ
      const invoice = await withDocNumberRetry(() =>
        ctx.prisma.$transaction(async (tx) => {
          // เพดานวางบิล: ใบแจ้งหนี้ (มัดจำ+ส่วนที่เหลือ) รวมกันห้ามเกินยอดออเดอร์ ·
          // ใบเสร็จนับแยกอีกกอง (+ใบเพิ่มหนี้ −ใบลดหนี้) · ลดหนี้/เพิ่มหนี้ไม่จำกัด
          // ทั้งยอดออเดอร์และบิลเดิมต้องอ่านใต้ lock — snapshot นอก tx อาจ stale ถ้ามีคนแก้ยอดพร้อมกัน
          await lockOrderRow(tx, order.id);
          const lockedOrder = await tx.order.findUniqueOrThrow({
            where: { id: order.id },
            select: { totalAmount: true },
          });
          const existingRaw = await tx.invoice.findMany({
            where: { orderId: order.id },
            select: {
              type: true,
              totalAmount: true,
              isVoided: true,
              originalInvoice: { select: { type: true } },
            },
          });
          // เพดานใบเสร็จต้องรู้ว่า CN แต่ละใบอ้างใบชนิดไหน (ดู comment ใน remainingBillable)
          const existing = existingRaw.map((inv) => ({
            ...inv,
            originalInvoiceType: inv.originalInvoice?.type ?? null,
          }));
          const remaining = remainingBillable(lockedOrder.totalAmount, existing, input.type);
          if (remaining !== null && totalAmount.gt(remaining)) {
            badRequest(
              `ยอดบิลเกินยอดออเดอร์ — วางบิลได้อีกไม่เกิน ${remaining.toFixed(2)} บาท`
            );
          }

          // ใบลดหนี้/เพิ่มหนี้: validate ใบเดิมใต้ lock — ออเดอร์เดียวกัน · ยังไม่ void ·
          // เป็นใบต้นทาง (ไม่อ้าง CN/DN ต่อกัน) · ยอดลดรวมห้ามเกินมูลค่าใบเดิม (ม.86/10)
          let original: {
            id: string;
            invoiceNumber: string;
            orderId: string;
            type: string;
            isVoided: boolean;
            totalAmount: number;
            paymentStatus: string;
            payments: { amount: number; whtAmount: number }[];
            adjustments: { type: string; totalAmount: number; isVoided: boolean }[];
          } | null = null;
          if (isAdjustment && input.originalInvoiceId) {
            await lockInvoiceRow(tx, input.originalInvoiceId);
            original = await tx.invoice.findUnique({
              where: { id: input.originalInvoiceId },
              include: {
                payments: { select: { amount: true, whtAmount: true } },
                adjustments: { select: { type: true, totalAmount: true, isVoided: true } },
              },
            });
            if (!original) notFound("ใบที่อ้างอิง", input.originalInvoiceId);
            if (original.orderId !== order.id) {
              badRequest("ใบที่อ้างอิงต้องอยู่ในออเดอร์เดียวกัน");
            }
            if (original.isVoided) {
              badRequest(`${original.invoiceNumber} ถูกยกเลิกแล้ว — อ้างอิงใบที่ใช้งานอยู่เท่านั้น`);
            }
            // whitelist ใบต้นทาง — ห้ามอ้าง CN/DN ต่อกัน + ห้าม type อื่น (เช่น QUOTATION legacy)
            if (!["DEPOSIT_INVOICE", "FINAL_INVOICE", "RECEIPT"].includes(original.type)) {
              badRequest("ใบที่อ้างอิงต้องเป็นใบกำกับ/ใบแจ้งหนี้ต้นทาง (มัดจำ/เก็บเงิน/ใบเสร็จ)");
            }
            if (input.type === "CREDIT_NOTE") {
              const creditable = D(original.totalAmount).minus(creditedOf(original));
              if (totalAmount.gt(creditable)) {
                badRequest(
                  `ยอดลดหนี้เกินมูลค่าคงเหลือของ ${original.invoiceNumber} (ลดได้อีกไม่เกิน ${creditable.toFixed(2)} บาท)`
                );
              }
            }
          }

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
              dueDate,
              notes: input.notes,
              originalInvoiceId: isAdjustment ? input.originalInvoiceId : null,
              adjustmentReason: isAdjustment ? input.adjustmentReason?.trim() : null,
            },
          });

          // ใบลดหนี้เคลียร์ยอดใบเดิมเหมือนเงินรับ — สถานะใบเดิมต้องขยับตามยอดคงเหลือจริง
          // (ไม่งั้นใบที่ลดจนหมดยังโดนทวง/OVERDUE ปลอม — หนี้ PROGRESS ข้อ 1)
          // เฉพาะใบเรียกเก็บ: CN อ้างใบเสร็จ = ลดหนี้หลังรับเงิน (คู่กับบันทึกคืนเงิน) —
          // ใบเสร็จค้าง UNPAID โดย design ห้าม flip สถานะ
          if (
            input.type === "CREDIT_NOTE" &&
            original &&
            original.type !== "RECEIPT" &&
            totalAmount.gt(0)
          ) {
            const paid = original.payments.reduce(
              (sum, p) => sum.plus(p.amount).plus(p.whtAmount),
              D(0)
            );
            const settled = paid.plus(creditedOf(original)).plus(totalAmount);
            let newStatus: string = paymentStatusForSettled(settled, D(original.totalAmount));
            // ยังค้างและเลยกำหนดอยู่ → คง OVERDUE (ไม่หลุดจากคิวตามหนี้แล้วโดนกระดิ่งซ้ำ)
            if (newStatus !== "PAID" && original.paymentStatus === "OVERDUE") {
              newStatus = "OVERDUE";
            }
            if (newStatus !== original.paymentStatus) {
              await tx.invoice.update({
                where: { id: original.id },
                data: {
                  paymentStatus: newStatus as "PAID" | "PARTIALLY_PAID" | "UNPAID" | "OVERDUE",
                  // สมมาตร recordPayment: PAID = ประทับเวลา · ยังค้าง = ล้าง
                  paidAt: newStatus === "PAID" ? new Date() : null,
                },
              });
            }
          }

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

  // ยอดบิลแนะนำตามเงื่อนไขชำระของออเดอร์ — UI ใช้ prefill dialog สร้างบิล
  // (ไม่ระบุ type = ให้เลือกชนิดให้ด้วย เช่น เทอมมัดจำที่ยังไม่มีใบมัดจำ → DEPOSIT_INVOICE)
  suggest: protectedProcedure
    .use(billingStaff)
    .input(
      z.object({
        orderId: z.string(),
        type: z
          .enum(["DEPOSIT_INVOICE", "FINAL_INVOICE", "RECEIPT", "CREDIT_NOTE", "DEBIT_NOTE"])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const order = await ctx.prisma.order.findUnique({
        where: { id: input.orderId },
        select: { paymentTerms: true, totalAmount: true, taxRate: true },
      });
      if (!order) {
        notFound("ออเดอร์", input.orderId);
      }
      const invoicesRaw = await ctx.prisma.invoice.findMany({
        where: { orderId: input.orderId },
        select: {
          type: true,
          totalAmount: true,
          isVoided: true,
          originalInvoice: { select: { type: true } },
        },
      });
      const invoices = invoicesRaw.map((inv) => ({
        ...inv,
        originalInvoiceType: inv.originalInvoice?.type ?? null,
      }));
      return {
        ...suggestInvoice({ order, invoices, type: input.type }),
        paymentTerms: order.paymentTerms,
      };
    }),

  recordPayment: protectedProcedure
    .use(moneyRecorder)
    .input(
      z
        .object({
          invoiceId: z.string(),
          // เงินสด 0 ได้เมื่อมี WHT — เคสจริง: บันทึกเงินโอน 97% ไปก่อน ใบ 50ทวิ
          // ตามมาทีหลัง ต้องเคลียร์ 3% ที่เหลือด้วย WHT ล้วนได้ (ไม่งั้นค้างผีถาวร)
          amount: z.number().min(0),
          method: z.string(),
          reference: z.string().optional(),
          evidenceUrl: fileUrlSchema.optional(),
          notes: z.string().optional(),
          // ลูกค้านิติบุคคลหัก ณ ที่จ่าย 3% ค่าจ้างทำของ — รับเงินสด 97% + เครดิตภาษี 3%
          // ยอดเคลียร์บิล = amount + whtAmount · เกิดแถวทะเบียน 50ทวิ อัตโนมัติ
          whtAmount: z.number().min(0).default(0),
          whtCertNumber: z.string().max(100).optional(),
          whtCertDate: z.date().optional(),
        })
        .refine((v) => v.amount + (v.whtAmount ?? 0) >= 0.01, {
          message: "ยอดเงิน+ภาษีหัก ณ ที่จ่ายต้องมากกว่า 0",
          path: ["amount"],
        })
    )
    .mutation(async ({ ctx, input }) => {
      const amount = moneyInput(input.amount);
      const wht = moneyInput(input.whtAmount ?? 0);

      return ctx.prisma.$transaction(async (tx) => {
        await lockInvoiceRow(tx, input.invoiceId);

        const invoice = await tx.invoice.findUniqueOrThrow({
          where: { id: input.invoiceId },
          include: {
            payments: true,
            adjustments: { select: { type: true, totalAmount: true, isVoided: true } },
          },
        });

        if (invoice.isVoided) {
          badRequest("ไม่สามารถบันทึกการชำระเงินสำหรับใบแจ้งหนี้ที่ถูกยกเลิกแล้ว");
        }

        // Gate A1 (audit 2026-07-02): เงินก้อนเดียวห้ามลงซ้ำสองใบ (เดิมลงได้ทั้ง INV+REC
        // → totalSpent/รับชำระเดือนนับ ×2) — แต่ "ขายสดออกใบเสร็จตรง" (ไม่มีใบเรียกเก็บ)
        // เป็น flow ที่ระบบรองรับ ต้องบันทึกเงินบนใบเสร็จได้ ไม่งั้นเงินสดหายจากระบบ
        if (invoice.type === "CREDIT_NOTE") {
          badRequest("ใบลดหนี้เป็นเงินฝั่งคืนลูกค้า — บันทึกรับเงินบนใบลดหนี้ไม่ได้");
        }
        if (invoice.type === "RECEIPT") {
          const receivableCount = await tx.invoice.count({
            where: {
              orderId: invoice.orderId,
              isVoided: false,
              type: { in: [...RECEIVABLE_TYPES] },
            },
          });
          if (receivableCount > 0) {
            badRequest(
              "ออเดอร์นี้มีใบแจ้งหนี้/ใบเพิ่มหนี้อยู่ — บันทึกรับเงินที่ใบนั้นแทน (ใบเสร็จเป็นเอกสารปลายทาง กันยอดนับซ้ำ)"
            );
          }
        }

        // ยอดที่เคลียร์บิลแล้ว = เงินสด + ภาษีที่ถูกหัก + ใบลดหนี้ที่อ้างใบนี้
        // (กันบิลค้างผี 3% โดน sweep ปลอม + กันรับเงินเกินส่วนที่ลดหนี้ไปแล้ว — Gate B1)
        const previouslyPaid = invoice.payments.reduce(
          (sum, p) => sum.plus(p.amount).plus(p.whtAmount),
          D(0)
        );
        const previouslySettled = previouslyPaid.plus(creditedOf(invoice));
        const total = D(invoice.totalAmount);
        const remaining = total.minus(previouslySettled);
        const settled = amount.plus(wht);

        if (settled.gt(remaining)) {
          badRequest(`จำนวนเงิน+ภาษีหัก ณ ที่จ่ายเกินยอดคงเหลือ (เหลือ ${remaining.toFixed(2)} บาท)`);
        }

        const payment = await tx.payment.create({
          data: {
            invoiceId: input.invoiceId,
            amount: amount.toNumber(),
            whtAmount: wht.toNumber(),
            method: input.method,
            reference: input.reference,
            evidenceUrl: input.evidenceUrl,
            notes: input.notes,
          },
        });

        // ทะเบียน 50ทวิ — ฐานโดยนัยจากอัตรามาตรฐาน 3% (จ้างทำของ): base = ยอดหัก ÷ 3%
        // ตรงหนังสือรับรองจริงทั้งเคสจ่ายครั้งเดียว/หลายงวด/บันทึก WHT ตามหลัง (97 ก่อน 3 ทีหลัง)
        // — ใบฐาน 100 หัก 3: ได้ฐาน 100 เสมอ ไม่ขึ้นกับว่าบันทึกกี่ครั้ง · cap ที่ฐานใบ
        // (ลูกค้าหักอัตราอื่น ฐานจะถูก cap แล้ว ratePct สะท้อนอัตราจริง)
        if (wht.gt(0)) {
          const fullBase = total.minus(invoice.tax);
          const impliedBase = round2(wht.times(100).div(3));
          const base = impliedBase.gt(fullBase) && fullBase.gt(0) ? fullBase : impliedBase;
          await tx.whtCertificate.create({
            data: {
              paymentId: payment.id,
              invoiceId: invoice.id,
              customerId: invoice.customerId,
              baseAmount: base.toNumber(),
              ratePct: base.gt(0) ? round2(wht.div(base).times(100)).toNumber() : 3,
              amount: wht.toNumber(),
              certNumber: input.whtCertNumber,
              certDate: input.whtCertDate,
              // กรอกเลขที่ใบมาด้วย = ได้หนังสือรับรองตัวจริงแล้ว
              received: !!input.whtCertNumber,
              receivedAt: input.whtCertNumber ? new Date() : null,
            },
          });
        }

        const totalSettled = previouslySettled.plus(settled);
        const paymentStatus = totalSettled.gte(total)
          ? ("PAID" as const)
          : ("PARTIALLY_PAID" as const);

        await tx.invoice.update({
          where: { id: input.invoiceId },
          data: {
            paymentStatus,
            paidAt: paymentStatus === "PAID" ? new Date() : null,
          },
        });

        // ยอดซื้อสะสมลูกค้า = มูลค่าที่ชำระบิล (รวมส่วนภาษีที่หักแทนเรา)
        await tx.customer.update({
          where: { id: invoice.customerId },
          data: { totalSpent: { increment: settled.toNumber() } },
        });

        await createAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entityType: "PAYMENT",
          entityId: payment.id,
          newValue: {
            invoiceId: input.invoiceId,
            amount: amount.toNumber(),
            whtAmount: wht.toNumber(),
            method: input.method,
          },
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
          include: {
            payments: true,
            billingNoteItems: {
              where: { billingNote: { isVoided: false } },
              select: { billingNote: { select: { billingNoteNumber: true } } },
            },
            adjustments: {
              where: { isVoided: false },
              select: { invoiceNumber: true },
            },
          },
        });

        // กัน void ซ้ำ — เดิมกดซ้ำได้ ทำให้ totalSpent ของลูกค้าโดนหักสองรอบ
        if (invoice.isVoided) {
          badRequest("ใบแจ้งหนี้นี้ถูกยกเลิกไปแล้ว");
        }
        // ใบที่อยู่บนใบวางบิลที่ใช้งานอยู่ — ยอดบนใบวางบิลจะค้างผี ต้องยกเลิกใบวางบิลก่อน
        if (invoice.billingNoteItems.length > 0) {
          badRequest(
            `ใบนี้อยู่บนใบวางบิล ${invoice.billingNoteItems[0].billingNote.billingNoteNumber} — ยกเลิกใบวางบิลก่อน`
          );
        }
        // ใบที่มีใบลดหนี้/เพิ่มหนี้อ้างอยู่ — void แล้วใบอ้างอิงจะชี้เอกสารตาย (ม.86/10
        // ใบลดหนี้ต้องอ้างใบกำกับที่ใช้งานจริง) ต้องยกเลิกใบลูกก่อนตามลำดับ
        if (invoice.adjustments.length > 0) {
          badRequest(
            `มีใบลดหนี้/เพิ่มหนี้อ้างอิงใบนี้อยู่ (${invoice.adjustments.map((a) => a.invoiceNumber).join(", ")}) — ยกเลิกใบเหล่านั้นก่อน`
          );
        }

        // ยอดสุทธิที่เคลียร์บิลแล้ว (รวมรายการคืนเงินติดลบ + ภาษีหัก ณ ที่จ่าย) —
        // ต้องสมมาตรกับ recordPayment ที่ increment ด้วย amount+whtAmount
        // ไม่งั้น void บิลที่มี WHT แล้ว totalSpent ค้างเกินจริงส่วน 3% ถาวร
        const netPaid = invoice.payments.reduce(
          (sum, p) => sum.plus(p.amount).plus(p.whtAmount),
          D(0)
        );

        const updatedInvoice = await tx.invoice.update({
          where: { id: input.invoiceId },
          data: {
            isVoided: true,
            voidedReason: input.reason,
            paymentStatus: "VOIDED",
          },
        });

        // ทะเบียน 50ทวิ ของบิลที่ยกเลิก: ใบที่ยังไม่ได้รับ = ธุรกรรมล้มแล้ว ไม่ต้องตามทวง
        // ลบทิ้งกันทะเบียน/ยอดรอใบบวมผี · ใบที่รับแล้ว = ลูกค้านำส่งสรรพากรไปแล้วจริง
        // คงไว้เป็นหลักฐาน + ประทับเหตุไว้ในหมายเหตุ
        const paymentIds = invoice.payments.map((p) => p.id);
        if (paymentIds.length > 0) {
          await tx.whtCertificate.deleteMany({
            where: { paymentId: { in: paymentIds }, received: false },
          });
          const keptCerts = await tx.whtCertificate.findMany({
            where: { paymentId: { in: paymentIds } },
            select: { id: true, notes: true },
          });
          for (const cert of keptCerts) {
            await tx.whtCertificate.update({
              where: { id: cert.id },
              data: {
                notes: `${cert.notes ? `${cert.notes} · ` : ""}[บิลถูกยกเลิก: ${input.reason}]`,
              },
            });
          }
        }

        if (netPaid.gt(0)) {
          await tx.customer.update({
            where: { id: invoice.customerId },
            data: { totalSpent: { decrement: netPaid.toNumber() } },
          });
        }

        // void ใบลดหนี้ = ยอดที่เคยหักให้ใบเดิมหายไป — คำนวณสถานะใบเดิมใหม่จากของจริง
        // (PAID ที่เคลียร์ด้วย CN อาจถอยกลับ PARTIALLY_PAID/UNPAID · sweep รอบถัดไป
        // mark OVERDUE เองถ้าเลยกำหนด)
        if (invoice.type === "CREDIT_NOTE" && invoice.originalInvoiceId) {
          await lockInvoiceRow(tx, invoice.originalInvoiceId);
          const original = await tx.invoice.findUnique({
            where: { id: invoice.originalInvoiceId },
            include: {
              payments: { select: { amount: true, whtAmount: true } },
              // ใบที่เพิ่ง void ด้านบนจะถูกกรองออกเอง (isVoided = true แล้ว)
              adjustments: { select: { type: true, totalAmount: true, isVoided: true } },
            },
          });
          if (original && !original.isVoided && original.type !== "RECEIPT") {
            const paid = original.payments.reduce(
              (sum, p) => sum.plus(p.amount).plus(p.whtAmount),
              D(0)
            );
            const settled = paid.plus(creditedOf(original));
            let newStatus: string = paymentStatusForSettled(settled, D(original.totalAmount));
            // ใบเดิมค้าง OVERDUE อยู่ก่อนแล้ว → คงไว้ (sweep ไม่ต้อง re-mark/แจ้งซ้ำ)
            if (newStatus !== "PAID" && original.paymentStatus === "OVERDUE") {
              newStatus = "OVERDUE";
            }
            if (newStatus !== original.paymentStatus) {
              await tx.invoice.update({
                where: { id: original.id },
                data: {
                  paymentStatus: newStatus as "PAID" | "PARTIALLY_PAID" | "UNPAID" | "OVERDUE",
                  paidAt: newStatus === "PAID" ? original.paidAt : null,
                },
              });
            }
          }
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
          include: {
            payments: true,
            adjustments: { select: { type: true, totalAmount: true, isVoided: true } },
          },
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
          // ยอดเคลียร์บิล = เงินสดสุทธิ + WHT + ใบลดหนี้ที่อ้างใบนี้ (นิยามเดียวกับ
          // recordPayment/ออก CN — ไม่งั้นใบที่เคลียร์ด้วยเงิน+CN ถอยเป็นค้างผีหลังคืนเงิน)
          const totalWht = invoice.payments.reduce((sum, p) => sum.plus(p.whtAmount), D(0));
          const netPaid = refundable.minus(amount).plus(totalWht);
          const settled = netPaid.plus(creditedOf(invoice));
          const total = D(invoice.totalAmount);
          const paymentStatus = total.gt(0)
            ? paymentStatusForSettled(settled, total)
            : settled.gt(0)
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
      const result = await sweepOverdueInvoices(ctx.prisma);
      return { updated: result.marked };
    }),

  stats: protectedProcedure.use(billingStaff).query(async ({ ctx }) => {
    // กวาดบิลเลยกำหนดแบบ throttle (≤ ทุก 6 ชม.) — หน้า /billing เปิดทุกวันโดยทีมการเงิน
    // ทำให้ OVERDUE ทำงานจริงบนเครื่องที่ยังไม่ได้ตั้ง cron (deploy แล้วมี /api/cron/overdue เสริม)
    await maybeSweepOverdue(ctx.prisma);

    const startOfMonth = getStartOfMonth();

    // ยอดค้าง/รายได้นับเฉพาะใบแจ้งหนี้ (มัดจำ+ส่วนที่เหลือ) + ใบเพิ่มหนี้ −ใบลดหนี้ —
    // ใบเสร็จคือเอกสารรับเงินของบิลเดียวกัน นับด้วยจะซ้ำสองเท่า · OVERDUE ยังเป็นยอดค้างอยู่
    const [totalUnpaid, overdueCount, revenueThisMonth, creditThisMonth, paidThisMonth] =
      await Promise.all([
        ctx.prisma.invoice.aggregate({
          _sum: { totalAmount: true },
          where: {
            type: { in: ["DEPOSIT_INVOICE", "FINAL_INVOICE", "DEBIT_NOTE"] },
            paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] },
            isVoided: false,
          },
        }),
        ctx.prisma.invoice.count({
          where: { paymentStatus: "OVERDUE", isVoided: false },
        }),
        ctx.prisma.invoice.aggregate({
          _sum: { totalAmount: true },
          where: {
            type: { in: ["DEPOSIT_INVOICE", "FINAL_INVOICE", "DEBIT_NOTE"] },
            createdAt: { gte: startOfMonth },
            isVoided: false,
          },
        }),
        ctx.prisma.invoice.aggregate({
          _sum: { totalAmount: true },
          where: {
            type: "CREDIT_NOTE",
            createdAt: { gte: startOfMonth },
            isVoided: false,
          },
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
      revenueThisMonth:
        aggToNumber(revenueThisMonth._sum.totalAmount) -
        aggToNumber(creditThisMonth._sum.totalAmount),
      paidThisMonth: aggToNumber(paidThisMonth._sum.amount),
    };
  }),
});
