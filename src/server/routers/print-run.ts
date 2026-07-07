import { z } from "zod";
import { router, protectedProcedure, requirePermission } from "../trpc";
import { createAuditLog } from "@/server/helpers";
import {
  getPrintQueue,
  createPrintRun,
  markPrintRunPrinted,
  completePrintRun,
  cancelPrintRun,
  listPrintRuns,
} from "@/server/services/print-run";

// จอช่างพิมพ์ DTF — staff กดเองได้ทั้ง flow (เร็วหน้างานสำคัญกว่า — มติเดียวกับผ่านรวด)
const productionTeam = requirePermission("manage_production");

export const printRunRouter = router({
  // อ่านเปิดทุก role (ไม่มีข้อมูลเงิน — sidebar ไม่ gate ตาม role: แอดมิน/ขายดูคิวได้
  // ตอบลูกค้าว่างานถึงไหน) · mutation = ทีมผลิตเท่านั้น

  /** คิวพิมพ์ฟิล์ม — งานไฟล์พร้อม เรียงตามกำหนดส่ง */
  queue: protectedProcedure.query(({ ctx }) => getPrintQueue(ctx.prisma)),

  /** รอบค้าง + ประวัติ 7 วัน */
  list: protectedProcedure.query(({ ctx }) => listPrintRuns(ctx.prisma)),

  /** เปิดรอบพิมพ์จากหลายงานในคิว */
  create: protectedProcedure
    .use(productionTeam)
    .input(
      z.object({
        items: z
          .array(z.object({ stepId: z.string(), qty: z.number().int().positive() }))
          .min(1, "เลือกอย่างน้อย 1 งาน"),
        note: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const run = await createPrintRun(ctx.prisma, { ...input, userId: ctx.userId });
      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "CREATE",
        entityType: "PRINT_RUN",
        entityId: run.id,
        newValue: { runNumber: run.runNumber, items: run.items.length },
      });
      return run;
    }),

  /** พิมพ์จบทั้งม้วน — รอตัดแยก+ติดป้าย */
  markPrinted: protectedProcedure
    .use(productionTeam)
    .input(z.object({ runId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await markPrintRunPrinted(ctx.prisma, input.runId);
      return { ok: true };
    }),

  /** ตัดแยก+ติดป้ายเสร็จ — ปิดขั้น DTF_PRINT เป็นชุด · ฟิล์มเผื่อเข้าคลัง */
  complete: protectedProcedure
    .use(productionTeam)
    .input(
      z.object({
        runId: z.string(),
        extras: z
          .array(
            z.object({
              itemId: z.string(),
              extraQty: z.number().int().min(0),
              label: z.string().max(200).optional(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const run = await completePrintRun(ctx.prisma, { ...input, userId: ctx.userId });
      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "PRINT_RUN",
        entityId: run.id,
        newValue: { runNumber: run.runNumber, status: "COMPLETED" },
      });
      return { ok: true };
    }),

  /** ยกเลิกรอบ (ก่อนพิมพ์จบเท่านั้น) — งานคืนกลับคิว */
  cancel: protectedProcedure
    .use(productionTeam)
    .input(z.object({ runId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await cancelPrintRun(ctx.prisma, input.runId);
      return { ok: true };
    }),
});
