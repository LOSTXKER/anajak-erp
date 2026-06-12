import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../trpc";
import { createAuditLog } from "@/server/helpers";
import { getQcContext, createQcRecord } from "@/server/services/qc";
import { QC_DEFECT_REASONS } from "@/lib/qc";

// ตรวจนับ QC = งานหน้างานทีมผลิต (staff นับเองได้ — เร็วหน้างานสำคัญกว่า มติเดียวกับผ่านรวด)
const productionTeam = requireRole("OWNER", "MANAGER", "PRODUCTION_STAFF");

export const qcRouter = router({
  /** บริบทก่อนตรวจ — ยอดคาดต่อไซส์ + ลาย + เสื้อสำรอง (ไม่มีเงิน เปิดทุก role) */
  context: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(({ ctx, input }) => getQcContext(ctx.prisma, input.orderId)),

  listByOrder: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.prisma.qcRecord.findMany({
        where: { orderId: input.orderId },
        orderBy: { checkedAt: "desc" },
        include: {
          checkedBy: { select: { name: true } },
          defects: true,
        },
      })
    ),

  create: protectedProcedure
    .use(productionTeam)
    .input(
      z.object({
        orderId: z.string(),
        qtyGood: z.number().int().min(0),
        defects: z
          .array(
            z.object({
              qty: z.number().int().positive(),
              size: z.string().max(50).optional(),
              color: z.string().max(50).optional(),
              printLabel: z.string().max(200).optional(),
              reason: z.enum(QC_DEFECT_REASONS),
              photoUrls: z.array(z.string()).max(10).default([]),
              note: z.string().max(300).optional(),
            })
          )
          .max(50)
          .default([]),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await createQcRecord(ctx.prisma, { ...input, userId: ctx.userId });
      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "CREATE",
        entityType: "QC_RECORD",
        entityId: result.record.id,
        newValue: { orderId: input.orderId, qtyGood: input.qtyGood, qtyDefect: result.qtyDefect },
      });
      return result;
    }),
});
