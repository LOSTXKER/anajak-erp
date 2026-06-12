import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../trpc";
import { createAuditLog } from "@/server/helpers";
import { notFound } from "@/server/errors";

// ทะเบียนหัก ณ ที่จ่ายขารับ (50ทวิ) — แถวเกิดอัตโนมัติตอนบันทึกรับเงินที่มี whtAmount
// งานของบัญชี: ตามหนังสือรับรองจากลูกค้า (ไม่มีใบ = เครดิตภาษี 3% หายฟรี) + export ให้นักบัญชี
const billingStaff = requireRole("OWNER", "MANAGER", "ACCOUNTANT");

export const whtRouter = router({
  list: protectedProcedure
    .use(billingStaff)
    .input(
      z
        .object({
          received: z.boolean().optional(), // undefined = ทั้งหมด
          search: z.string().max(100).optional(),
          from: z.date().optional(),
          to: z.date().optional(),
        })
        .optional()
    )
    .query(({ ctx, input }) => {
      const search = input?.search?.trim();
      return ctx.prisma.whtCertificate.findMany({
        where: {
          ...(input?.received !== undefined ? { received: input.received } : {}),
          ...(input?.from || input?.to
            ? { createdAt: { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lte: input.to } : {}) } }
            : {}),
          ...(search
            ? {
                OR: [
                  { customer: { name: { contains: search, mode: "insensitive" } } },
                  { invoice: { invoiceNumber: { contains: search, mode: "insensitive" } } },
                  { certNumber: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 500, // export CSV ใช้แถวที่โหลด — เพดานสูงพอสำหรับทะเบียนทั้งปีของโรงงานนี้
        include: {
          customer: { select: { id: true, name: true, taxId: true } },
          // isVoided — แถวของบิลที่ถูกยกเลิก (ใบ 50ทวิ ที่รับแล้วคงไว้เป็นหลักฐาน) ต้องดูออก
          invoice: { select: { id: true, invoiceNumber: true, orderId: true, isVoided: true } },
          payment: { select: { createdAt: true, amount: true } },
        },
      });
    }),

  /** ได้หนังสือรับรองจากลูกค้าแล้ว — กรอกเลขที่/วันที่/แนบสแกน */
  markReceived: protectedProcedure
    .use(billingStaff)
    .input(
      z.object({
        id: z.string(),
        certNumber: z.string().max(100).optional(),
        certDate: z.date().optional(),
        fileUrl: z.string().optional(),
        notes: z.string().max(300).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.whtCertificate.findUnique({ where: { id: input.id } });
      if (!existing) notFound("รายการหัก ณ ที่จ่าย", input.id);
      const updated = await ctx.prisma.whtCertificate.update({
        where: { id: input.id },
        data: {
          received: true,
          receivedAt: existing.receivedAt ?? new Date(),
          certNumber: input.certNumber ?? existing.certNumber,
          certDate: input.certDate ?? existing.certDate,
          fileUrl: input.fileUrl ?? existing.fileUrl,
          notes: input.notes ?? existing.notes,
        },
      });
      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "WHT_CERTIFICATE",
        entityId: input.id,
        newValue: { received: true, certNumber: updated.certNumber },
      });
      return updated;
    }),

  /** สรุปหัวทะเบียน — ยอดรอใบ/ได้ใบแล้ว (โชว์หัวหน้า + ใช้ตามทวง) */
  stats: protectedProcedure.use(billingStaff).query(async ({ ctx }) => {
    const [pending, receivedAgg, pendingAgg] = await Promise.all([
      ctx.prisma.whtCertificate.count({ where: { received: false } }),
      ctx.prisma.whtCertificate.aggregate({ where: { received: true }, _sum: { amount: true } }),
      ctx.prisma.whtCertificate.aggregate({ where: { received: false }, _sum: { amount: true } }),
    ]);
    return {
      pendingCount: pending,
      pendingAmount: Number(pendingAgg._sum.amount ?? 0),
      receivedAmount: Number(receivedAgg._sum.amount ?? 0),
    };
  }),
});
