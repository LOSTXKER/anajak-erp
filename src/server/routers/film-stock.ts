import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../trpc";
import { badRequest } from "@/server/errors";
import { createAuditLog } from "@/server/helpers";

// คลังฟิล์มพร้อมรีด (FLOW-REDESIGN ก้อน 2) — ฟิล์มพิมพ์เผื่อจากรอบพิมพ์
// "ลายไหน ของลูกค้าไหน เหลือกี่ชิ้น" · ลูกค้าสั่งซ้ำเช็คก่อน รีดได้เลยไม่ต้องพิมพ์ใหม่
// อ่านได้ทุก role (ขายใช้เช็คตอนรับงานซ้ำ) · หยิบใช้ = ทีมผลิต
const productionTeam = requireRole("OWNER", "MANAGER", "PRODUCTION_STAFF");

export const filmStockRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          search: z.string().max(100).optional(),
          customerId: z.string().optional(),
          includeEmpty: z.boolean().default(false),
        })
        .optional()
    )
    .query(({ ctx, input }) => {
      const search = input?.search?.trim();
      return ctx.prisma.filmStock.findMany({
        where: {
          ...(input?.includeEmpty ? {} : { qty: { gt: 0 } }),
          ...(input?.customerId ? { customerId: input.customerId } : {}),
          ...(search
            ? {
                OR: [
                  { label: { contains: search, mode: "insensitive" } },
                  { customer: { name: { contains: search, mode: "insensitive" } } },
                  { order: { orderNumber: { contains: search, mode: "insensitive" } } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          customer: { select: { id: true, name: true } },
          order: { select: { id: true, orderNumber: true } },
          printRun: { select: { runNumber: true } },
        },
      });
    }),

  /** หยิบใช้/ตัดทิ้ง — ลดจำนวนคงเหลือ (กันติดลบด้วย conditional update) */
  consume: protectedProcedure
    .use(productionTeam)
    .input(
      z.object({
        id: z.string(),
        qty: z.number().int().positive(),
        note: z.string().max(300).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const res = await ctx.prisma.filmStock.updateMany({
        where: { id: input.id, qty: { gte: input.qty } },
        data: { qty: { decrement: input.qty } },
      });
      if (res.count === 0) {
        badRequest("จำนวนคงเหลือไม่พอ — รีเฟรชดูยอดล่าสุดก่อน");
      }
      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "FILM_STOCK",
        entityId: input.id,
        newValue: { consumed: input.qty, note: input.note ?? null },
      });
      return { ok: true };
    }),
});
