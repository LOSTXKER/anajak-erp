import { z } from "zod";
import type { Role } from "@prisma/client";
import { router, protectedProcedure, requirePermission } from "../trpc";
import { hasPermission } from "@/lib/permissions";
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

function printRunAccess(ctx: {
  userId: string;
  userRole: Role;
  permissionOverrides?: unknown;
}) {
  return {
    userId: ctx.userId,
    canOperate: hasPermission(
      ctx.userRole,
      ctx.permissionOverrides,
      "manage_production",
    ),
    canSupervise: hasPermission(
      ctx.userRole,
      ctx.permissionOverrides,
      "supervise_operations",
    ),
  };
}

const lifecycleCommandInput = z
  .object({
    runId: z.string().min(1),
    commandId: z.string().trim().min(8).max(100).optional(),
    items: z
      .array(
        z.object({
          itemId: z.string().min(1),
          expectedRevision: z.number().int().nonnegative(),
        }),
      )
      .min(1)
      .max(200)
      .optional(),
  })
  .superRefine((value, refinement) => {
    if (Boolean(value.commandId) === Boolean(value.items?.length)) return;
    refinement.addIssue({
      code: "custom",
      path: value.commandId ? ["items"] : ["commandId"],
      message:
        "คำสั่ง Production V2 ต้องระบุ commandId และ revision ของทุกงานในรอบพร้อมกัน",
    });
  });

export const printRunRouter = router({
  // อ่านเปิดทุก role (ไม่มีข้อมูลเงิน — sidebar ไม่ gate ตาม role: แอดมิน/ขายดูคิวได้
  // ตอบลูกค้าว่างานถึงไหน) · mutation = ทีมผลิตเท่านั้น

  /** คิวพิมพ์ฟิล์ม — งานไฟล์พร้อม เรียงตามกำหนดส่ง */
  queue: protectedProcedure.query(({ ctx }) =>
    getPrintQueue(ctx.prisma, printRunAccess(ctx)),
  ),

  /** รอบค้าง + ประวัติ 7 วัน */
  list: protectedProcedure.query(({ ctx }) =>
    listPrintRuns(ctx.prisma, printRunAccess(ctx)),
  ),

  /** เปิดรอบพิมพ์จากหลายงานในคิว */
  create: protectedProcedure
    .use(productionTeam)
    .input(
      z.object({
        items: z
          .array(
            z.object({
              stepId: z.string().optional(),
              operationJobId: z.string().optional(),
              expectedRevision: z.number().int().nonnegative().optional(),
              qty: z.number().int().positive(),
            }).superRefine((value, refinement) => {
              if (!!value.stepId === !!value.operationJobId) {
                refinement.addIssue({
                  code: "custom",
                  path: ["operationJobId"],
                  message: "ต้องระบุ stepId หรือ operationJobId อย่างใดอย่างหนึ่ง",
                });
              }
              if (value.operationJobId && value.expectedRevision === undefined) {
                refinement.addIssue({
                  code: "custom",
                  path: ["expectedRevision"],
                  message: "Production V2 ต้องระบุ expectedRevision",
                });
              }
            }),
          )
          .min(1, "เลือกอย่างน้อย 1 งาน"),
        commandId: z.string().trim().min(8).max(100).optional(),
        workResourceId: z.string().optional(),
        note: z.string().max(500).optional(),
      }).superRefine((value, refinement) => {
        if (value.items.some((item) => item.operationJobId) && !value.commandId) {
          refinement.addIssue({
            code: "custom",
            path: ["commandId"],
            message: "Production V2 ต้องระบุ commandId",
          });
        }
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createPrintRun(ctx.prisma, { ...input, ...printRunAccess(ctx) });
    }),

  /** พิมพ์จบทั้งม้วน — รอตัดแยก+ติดป้าย */
  markPrinted: protectedProcedure
    .use(productionTeam)
    .input(lifecycleCommandInput)
    .mutation(async ({ ctx, input }) => {
      await markPrintRunPrinted(ctx.prisma, {
        ...input,
        ...printRunAccess(ctx),
      });
      return { ok: true };
    }),

  /** ตัดแยก+ติดป้ายเสร็จ — ปิดขั้น DTF_PRINT เป็นชุด · ฟิล์มเผื่อเข้าคลัง */
  complete: protectedProcedure
    .use(productionTeam)
    .input(
      z.object({
        runId: z.string(),
        commandId: z.string().trim().min(8).max(100).optional(),
        results: z
          .array(
            z.object({
              itemId: z.string(),
              expectedRevision: z.number().int().nonnegative(),
              qtyGood: z.number().int().nonnegative(),
              qtyScrap: z.number().int().nonnegative(),
              qtyReprint: z.number().int().nonnegative(),
              quantityLines: z
                .array(
                  z.object({
                    quantityLineId: z.string().min(1),
                    qtyGood: z.number().int().nonnegative(),
                    qtyScrap: z.number().int().nonnegative(),
                  }),
                )
                .min(1)
                .max(200),
            }),
          )
          .optional(),
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
      await completePrintRun(ctx.prisma, { ...input, ...printRunAccess(ctx) });
      return { ok: true };
    }),

  /** ยกเลิกรอบ (ก่อนพิมพ์จบเท่านั้น) — งานคืนกลับคิว */
  cancel: protectedProcedure
    .use(productionTeam)
    .input(lifecycleCommandInput)
    .mutation(async ({ ctx, input }) => {
      await cancelPrintRun(ctx.prisma, {
        ...input,
        ...printRunAccess(ctx),
      });
      return { ok: true };
    }),
});
