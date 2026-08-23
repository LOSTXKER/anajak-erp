import { z } from "zod";
import { router, protectedProcedure, requirePermission } from "../trpc";
import { fileUrlArraySchema } from "@/server/schemas";
import { getQcContext, createQcRecord } from "@/server/services/qc";
import { QC_DEFECT_REASONS } from "@/lib/qc";
import { hasPermission } from "@/lib/permissions";

// ตรวจนับ QC = งานหน้างานทีมผลิต (staff นับเองได้ — เร็วหน้างานสำคัญกว่า มติเดียวกับผ่านรวด)
const productionTeam = requirePermission("manage_production");

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
        idempotencyKey: z.string().min(8).max(100),
        operationJobId: z.string().optional(),
        expectedRevision: z.number().int().nonnegative().optional(),
        qtyGood: z.number().int().min(0),
        quantityLines: z.array(z.object({
          quantityLineId: z.string().min(1),
          qtyGood: z.number().int().nonnegative(),
        })).max(200).optional(),
        defects: z
          .array(
            z.object({
              quantityLineId: z.string().min(1).optional(),
              qty: z.number().int().positive(),
              size: z.string().max(50).optional(),
              color: z.string().max(50).optional(),
              printLabel: z.string().max(200).optional(),
              reason: z.enum(QC_DEFECT_REASONS),
              photoUrls: fileUrlArraySchema.max(10).default([]),
              note: z.string().max(300).optional(),
              disposition: z.enum(["HOLD", "REWORK", "SCRAP"]).optional(),
            })
          )
          .max(50)
          .default([]),
        notes: z.string().max(500).optional(),
      }).superRefine((value, refinement) => {
        if (value.operationJobId && value.expectedRevision === undefined) {
          refinement.addIssue({
            code: "custom",
            path: ["expectedRevision"],
            message: "Production V2 ต้องระบุ expectedRevision",
          });
        }
        if (
          value.operationJobId &&
          value.defects.some((defect) => !defect.disposition)
        ) {
          refinement.addIssue({
            code: "custom",
            path: ["defects"],
            message: "ของที่ไม่ผ่าน QC ต้องเลือก Hold, Rework หรือ Scrap ทุกบรรทัด",
          });
        }
        if (
          value.operationJobId &&
          value.qtyGood > 0 &&
          (!value.quantityLines?.length ||
            value.quantityLines.reduce((sum, line) => sum + line.qtyGood, 0) !==
              value.qtyGood)
        ) {
          refinement.addIssue({
            code: "custom",
            path: ["quantityLines"],
            message: "QC V2 ต้องแจกจำนวนดีลง quantity line ให้ตรงกับยอดรวม",
          });
        }
        if (
          value.operationJobId &&
          value.defects.some((defect) => !defect.quantityLineId)
        ) {
          refinement.addIssue({
            code: "custom",
            path: ["defects"],
            message: "QC V2 ต้องระบุ quantity line ของของเสียทุกบรรทัด",
          });
        }
      })
    )
    .mutation(({ ctx, input }) =>
      createQcRecord(ctx.prisma, {
        ...input,
        userId: ctx.userId,
        canSupervise: hasPermission(
          ctx.userRole,
          ctx.permissionOverrides,
          "supervise_operations",
        ),
      })
    ),
});
