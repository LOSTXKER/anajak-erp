/* สูตรขั้นงาน — router เป็นแค่ผิว ตรรกะอยู่ที่ services/routing-template.ts
   สิทธิ์: อ่านได้ทุกคนที่ล็อกอิน (หน้าอื่นต้องใช้รายชื่อขั้น) · แก้ได้เฉพาะคนตั้งค่าระบบ */

import { z } from "zod";
import { router, protectedProcedure, requirePermission } from "../trpc";
import { byIdInput } from "@/server/schemas";
import {
  createDraftFromVersion,
  discardDraft,
  getRoutingVersion,
  listRoutings,
  releaseRoutingVersion,
  saveDraftOperations,
} from "@/server/services/routing-template";

const settingsManager = requirePermission("manage_settings");

const operationInput = z.object({
  code: z
    .string()
    .trim()
    .min(1, "ต้องมีรหัสขั้น")
    .max(40)
    .regex(/^[A-Z0-9_]+$/, "รหัสขั้นใช้ได้เฉพาะ A-Z 0-9 และ _"),
  name: z.string().trim().min(1, "ต้องมีชื่อขั้น").max(120),
  sequence: z.number().int().min(0),
  phase: z.enum(["PREPARATION", "MANUFACTURING", "OUTSOURCE", "QUALITY", "PACKING"]),
  executionMode: z.enum(["IN_HOUSE", "OUTSOURCE"]),
  workCenterId: z.string().nullable(),
  standardMinutes: z.number().int().min(0).nullable(),
});

export const routingRouter = router({
  list: protectedProcedure.query(({ ctx }) => listRoutings(ctx.prisma)),

  version: protectedProcedure
    .input(byIdInput)
    .query(({ ctx, input }) => getRoutingVersion(ctx.prisma, input.id)),

  /** ศูนย์งานที่เลือกได้ตอนตั้งขั้น — master data ชุดเดียวกับที่จอสถานีใช้ */
  workCenters: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.workCenter.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true },
    }),
  ),

  createDraft: protectedProcedure
    .use(settingsManager)
    .input(byIdInput)
    .mutation(({ ctx, input }) => createDraftFromVersion(ctx.prisma, input.id)),

  saveDraft: protectedProcedure
    .use(settingsManager)
    .input(
      z.object({
        versionId: z.string(),
        operations: z.array(operationInput).min(1, "สูตรต้องมีอย่างน้อยหนึ่งขั้นงาน"),
        dependencies: z.array(z.tuple([z.string(), z.string()])),
      }),
    )
    .mutation(({ ctx, input }) =>
      saveDraftOperations(ctx.prisma, input.versionId, {
        operations: input.operations,
        dependencies: input.dependencies,
      }),
    ),

  release: protectedProcedure
    .use(settingsManager)
    .input(byIdInput)
    .mutation(({ ctx, input }) =>
      releaseRoutingVersion(ctx.prisma, input.id, ctx.userId),
    ),

  discardDraft: protectedProcedure
    .use(settingsManager)
    .input(byIdInput)
    .mutation(async ({ ctx, input }) => {
      await discardDraft(ctx.prisma, input.id);
      return { ok: true };
    }),
});
