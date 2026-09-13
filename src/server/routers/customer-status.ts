import { z } from "zod";
import { router, protectedProcedure, publicProcedure, requirePermission } from "../trpc";
import { createAuditLog } from "@/server/helpers";
import { notFound } from "@/server/errors";
import {
  newStatusToken,
  statusTokenExpiry,
  getOrderStatusByToken,
} from "@/server/services/customer-status";

// ลิงก์สถานะออเดอร์ให้ลูกค้า (FLOW-REDESIGN ก้อน 4 — portal ขั้น 1)
// staff สร้างลิงก์ (protected) · ลูกค้าเปิดดูสถานะ (public ถือ token)
const salesUp = requirePermission("create_sales_docs");

export const customerStatusRouter = router({
  // staff สร้าง/รีเฟรช ลิงก์สถานะ — ออก token ใหม่เสมอ (ลิงก์เก่าตายทันที)
  generateLink: protectedProcedure
    .use(salesUp)
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.prisma.order.findUnique({
        where: { id: input.orderId },
        select: { id: true },
      });
      if (!order) notFound("ออเดอร์", input.orderId);

      const token = newStatusToken();
      const expiresAt = statusTokenExpiry();
      await ctx.prisma.order.update({
        where: { id: input.orderId },
        data: { statusToken: token, statusTokenExpiresAt: expiresAt },
      });
      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "ORDER",
        entityId: input.orderId,
        reason: "สร้างลิงก์สถานะให้ลูกค้า",
      });
      return { token, expiresAt };
    }),

  // หน้าออเดอร์ใช้เช็คว่ามีลิงก์อยู่แล้วไหม (ก่อนคัดลอก/สร้างใหม่)
  getLink: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const order = await ctx.prisma.order.findUnique({
        where: { id: input.orderId },
        select: { statusToken: true, statusTokenExpiresAt: true },
      });
      return {
        token: order?.statusToken ?? null,
        expiresAt: order?.statusTokenExpiresAt ?? null,
      };
    }),

  // ── ฝั่งลูกค้า (public — ถือ token) ──
  getStatus: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      return getOrderStatusByToken(ctx.prisma, input.token);
    }),
});
