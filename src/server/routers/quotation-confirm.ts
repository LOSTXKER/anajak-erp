import { z } from "zod";
import { router, protectedProcedure, publicProcedure, requireRole } from "../trpc";
import { createAuditLog } from "@/server/helpers";
import { notFound, badRequest } from "@/server/errors";
import {
  newConfirmToken,
  getQuotationByConfirmToken,
  acceptQuotationByToken,
  rejectQuotationByToken,
} from "@/server/services/quotation-confirm";

// ลิงก์ยืนยันใบเสนอราคาให้ลูกค้า (FLOW-REDESIGN ก้อน 4 — ขอบลูกค้า)
// staff สร้างลิงก์ (protected · เฉพาะใบที่ส่งแล้ว) · ลูกค้าเปิดดู/ยืนยัน/ขอแก้ (public ถือ token)
const salesUp = requireRole("OWNER", "MANAGER", "SALES");

export const quotationConfirmRouter = router({
  // staff สร้าง/รีเฟรช ลิงก์ยืนยัน — เฉพาะใบที่ "ส่งให้ลูกค้าแล้ว" (ราคายืนแล้ว) · ออก token ใหม่
  // เสมอ (ลิงก์เก่าตายทันที)
  generateLink: protectedProcedure
    .use(salesUp)
    .input(z.object({ quotationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const q = await ctx.prisma.quotation.findUnique({
        where: { id: input.quotationId },
        select: { id: true, status: true },
      });
      if (!q) notFound("ใบเสนอราคา", input.quotationId);
      // ออกลิงก์ได้เฉพาะใบที่ส่งแล้ว — DRAFT ราคายังร่าง ห้ามให้ลูกค้ายืนยัน
      if (q.status !== "SENT") {
        badRequest('สร้างลิงก์ยืนยันได้เฉพาะใบที่ "ส่งให้ลูกค้า" แล้ว');
      }

      const token = newConfirmToken();
      await ctx.prisma.quotation.update({
        where: { id: input.quotationId },
        data: { confirmToken: token },
      });
      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "QUOTATION",
        entityId: input.quotationId,
        reason: "สร้างลิงก์ยืนยันใบเสนอให้ลูกค้า",
      });
      return { token };
    }),

  // หน้าใบเสนอใช้เช็คว่ามีลิงก์อยู่แล้วไหม (ก่อนคัดลอก/สร้างใหม่)
  // gate salesUp เท่ากับ generateLink — confirmToken คือ bearer secret ของ accept/reject (public)
  // ปล่อยให้ทุก role อ่านได้ = role อื่นเอา token ไปกดแทนลูกค้าได้ (review MAJOR — เลียน design.ts)
  getLink: protectedProcedure
    .use(salesUp)
    .input(z.object({ quotationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const q = await ctx.prisma.quotation.findUnique({
        where: { id: input.quotationId },
        select: { confirmToken: true, status: true },
      });
      return { token: q?.confirmToken ?? null, status: q?.status ?? null };
    }),

  // ── ฝั่งลูกค้า (public — ถือ token) ──
  getQuote: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      return getQuotationByConfirmToken(ctx.prisma, input.token);
    }),

  accept: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return acceptQuotationByToken(ctx.prisma, input.token);
    }),

  reject: publicProcedure
    .input(z.object({ token: z.string(), reason: z.string().max(1000).optional() }))
    .mutation(async ({ ctx, input }) => {
      return rejectQuotationByToken(ctx.prisma, input.token, input.reason);
    }),
});
