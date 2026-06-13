import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { runFilePreflight } from "@/server/services/preflight";

// preflight ไฟล์งานพิมพ์ DTF (FLOW-REDESIGN ก้อน 4)
// run = ตรวจไฟล์ (เรียกอัตโนมัติตอนอัป) · getByUrls = อ่านผลมาโชว์บนการ์ดไฟล์
export const preflightRouter = router({
  run: protectedProcedure
    .input(
      z.object({
        fileUrl: z.string(),
        printWidthCm: z.number().positive().optional(),
        printHeightCm: z.number().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return runFilePreflight(ctx.prisma, input);
    }),

  getByUrls: protectedProcedure
    .input(z.object({ fileUrls: z.array(z.string()).max(50) }))
    .query(async ({ ctx, input }) => {
      if (input.fileUrls.length === 0) return [];
      const rows = await ctx.prisma.filePreflight.findMany({
        where: { fileUrl: { in: input.fileUrls } },
        select: {
          fileUrl: true,
          verdict: true,
          format: true,
          width: true,
          height: true,
          hasAlpha: true,
          summary: true,
          warnings: true,
          model: true,
          updatedAt: true,
        },
      });
      return rows.map((r) => ({
        ...r,
        warnings: Array.isArray(r.warnings) ? (r.warnings as string[]) : [],
      }));
    }),
});
