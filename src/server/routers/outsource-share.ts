import { z } from "zod";
import { router, protectedProcedure, publicProcedure, requirePermission } from "../trpc";
import { createAuditLog } from "@/server/helpers";
import { notFound } from "@/server/errors";
import {
  newShareToken,
  shareTokenExpiry,
  getOutsourceShareByToken,
} from "@/server/services/outsource-share";

// ลิงก์ใบงานให้ร้านนอก (Gate B14 — LINE-friendly)
// staff สร้างลิงก์ (protected · ทีมผลิตขึ้นไป ตรง updateOrderStatus) · ร้านเปิดดู (public ถือ token)
const productionUp = requirePermission("manage_production");

export const outsourceShareRouter = router({
  // staff สร้าง/รีเฟรช ลิงก์ใบงาน — ออก token ใหม่เสมอ (ลิงก์เก่าตายทันที)
  generateLink: protectedProcedure
    .use(productionUp)
    .input(z.object({ outsourceOrderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.outsourceOrder.findUnique({
        where: { id: input.outsourceOrderId },
        select: { id: true },
      });
      if (!job) notFound("ใบงานร้านนอก", input.outsourceOrderId);

      const token = newShareToken();
      const expiresAt = shareTokenExpiry();
      await ctx.prisma.outsourceOrder.update({
        where: { id: input.outsourceOrderId },
        data: { shareToken: token, shareTokenExpiresAt: expiresAt },
      });
      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "OUTSOURCE_ORDER",
        entityId: input.outsourceOrderId,
        reason: "สร้างลิงก์ใบงานให้ร้านนอก",
      });
      return { token, expiresAt };
    }),

  // dialog แชร์ใช้เช็คว่ามีลิงก์อยู่แล้วไหม (ก่อนคัดลอก/สร้างใหม่)
  // gate เท่า generateLink — ไม่งั้น role อื่นดึง token ที่ active ไปประกอบลิงก์ public แจกต่อได้
  getLink: protectedProcedure
    .use(productionUp)
    .input(z.object({ outsourceOrderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.prisma.outsourceOrder.findUnique({
        where: { id: input.outsourceOrderId },
        select: { shareToken: true, shareTokenExpiresAt: true },
      });
      return {
        token: job?.shareToken ?? null,
        expiresAt: job?.shareTokenExpiresAt ?? null,
      };
    }),

  // ── ฝั่งร้านนอก (public — ถือ token) ──
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      return getOutsourceShareByToken(ctx.prisma, input.token);
    }),
});
