import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireRole } from "../trpc";
import { byIdInput, fileUrlSchema } from "@/server/schemas";
import { notFound } from "@/server/errors";
import { createAuditLog } from "@/server/helpers";

// คลังลายต่อลูกค้า (ก้อน 4 ชิ้น 2) — ลายเข้าคลังเองตอน QC ผ่าน (services/artwork.ts)
// router นี้ = อ่าน + เพิ่มมือ (ลายเก่าก่อนมีระบบ) + แก้สเปก · ไม่มี delete — ปิด isActive แทน
// (มีออเดอร์เก่า/ฟิล์มอ้างอยู่) · ไม่มีช่องเงิน (มติ 2026-06-12 — ราคาท่าพิมพ์อยู่ ServiceCatalog)
const artworkCreate = requireRole("OWNER", "MANAGER", "DESIGNER", "SALES");
const designerUp = requireRole("OWNER", "MANAGER", "DESIGNER");

// .nullable() ทุกตัว — null = เคลียร์ค่ากลับเป็น "ยังไม่รู้" (ให้ gap badge เตือนได้)
// undefined = ไม่แตะ (Prisma ข้าม field undefined)
const artworkSpecFields = {
  position: z.string().max(50).nullable().optional(),
  printType: z.string().max(50).nullable().optional(),
  printSize: z.string().max(50).nullable().optional(),
  widthCm: z.number().positive().nullable().optional(),
  heightCm: z.number().positive().nullable().optional(),
  colorCount: z.number().int().positive().nullable().optional(),
  heatTempC: z.number().int().positive().max(400).nullable().optional(),
  heatPressSec: z.number().int().positive().max(600).nullable().optional(),
  heatPressure: z.string().max(50).nullable().optional(),
  specNotes: z.string().max(500).nullable().optional(),
};

export const artworkRouter = router({
  /** คลังลายของลูกค้า + ใช้ไปกี่ออเดอร์ + ฟิล์มค้างต่อลาย (หน้า /customers/[id]) */
  listByCustomer: protectedProcedure
    .input(z.object({ customerId: z.string() }))
    .query(async ({ ctx, input }) => {
      const artworks = await ctx.prisma.customerArtwork.findMany({
        where: { customerId: input.customerId },
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      });
      if (artworks.length === 0) return [];
      const ids = artworks.map((a) => a.id);

      // นับ "ใช้ไปกี่ออเดอร์" สดจาก relation (distinct order) + หาออเดอร์ล่าสุดไว้สั่งซ้ำ
      // ตัด DRAFT/CANCELLED — "ใช้ไป" = งานจริง ไม่ใช่สำเนาค้าง/ใบยกเลิก (ไม่งั้นปุ่ม
      // สั่งซ้ำจะ duplicate สำเนาของสำเนา/ชุบใบที่ยกเลิกเพราะแบบมีปัญหา)
      const prints = await ctx.prisma.orderItemPrint.findMany({
        where: {
          artworkId: { in: ids },
          orderItem: { order: { internalStatus: { notIn: ["DRAFT", "CANCELLED"] } } },
        },
        select: {
          artworkId: true,
          orderItem: {
            select: {
              order: { select: { id: true, orderNumber: true, createdAt: true } },
            },
          },
        },
      });
      const usage = new Map<
        string,
        { orderIds: Set<string>; latest: { id: string; orderNumber: string; createdAt: Date } | null }
      >();
      for (const p of prints) {
        if (!p.artworkId) continue;
        const u = usage.get(p.artworkId) ?? { orderIds: new Set<string>(), latest: null };
        const order = p.orderItem.order;
        u.orderIds.add(order.id);
        if (!u.latest || order.createdAt > u.latest.createdAt) u.latest = order;
        usage.set(p.artworkId, u);
      }

      const films = await ctx.prisma.filmStock.groupBy({
        by: ["artworkId"],
        where: { artworkId: { in: ids }, qty: { gt: 0 } },
        _sum: { qty: true },
      });
      const filmByArtwork = new Map(films.map((f) => [f.artworkId, f._sum.qty ?? 0]));

      return artworks.map((a) => ({
        ...a,
        usedOrderCount: usage.get(a.id)?.orderIds.size ?? 0,
        latestOrder: usage.get(a.id)?.latest ?? null,
        filmQty: filmByArtwork.get(a.id) ?? 0,
      }));
    }),

  /** ตัวนับเบาสำหรับป้ายเตือนตอนเลือกลูกค้าในฟอร์มเปิดงาน — count ล้วน ไม่ลากแถว */
  customerSummary: protectedProcedure
    .input(z.object({ customerId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [filmCount, artworkCount] = await Promise.all([
        ctx.prisma.filmStock.count({
          where: { customerId: input.customerId, qty: { gt: 0 } },
        }),
        ctx.prisma.customerArtwork.count({
          where: { customerId: input.customerId, isActive: true },
        }),
      ]);
      return { filmCount, artworkCount };
    }),

  /** เพิ่มลายมือ — ลายเก่าก่อนมีระบบ/ลายที่ยังไม่เคยเข้าออเดอร์ */
  create: protectedProcedure
    .use(artworkCreate)
    .input(
      z.object({
        customerId: z.string(),
        name: z.string().min(1).max(200),
        imageUrl: fileUrlSchema.optional(),
        printFileUrl: fileUrlSchema.optional(),
        ...artworkSpecFields,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const customer = await ctx.prisma.customer.findUnique({
        where: { id: input.customerId },
        select: { id: true },
      });
      if (!customer) notFound("ลูกค้า", input.customerId);
      try {
        return await ctx.prisma.customerArtwork.create({ data: input });
      } catch (e) {
        if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "รูปลายนี้อยู่ในคลังของลูกค้ารายนี้แล้ว",
          });
        }
        throw e;
      }
    }),

  /** แก้ชื่อ/สเปก/สถานะ — สเปกรีดคือความรู้ฝั่งผลิต/กราฟิก */
  update: protectedProcedure
    .use(designerUp)
    .input(
      byIdInput.extend({
        name: z.string().min(1).max(200).optional(),
        imageUrl: fileUrlSchema.optional(),
        printFileUrl: fileUrlSchema.optional(),
        isActive: z.boolean().optional(),
        ...artworkSpecFields,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      let updated;
      try {
        updated = await ctx.prisma.customerArtwork.update({ where: { id }, data });
      } catch (e) {
        if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "รูปลายนี้อยู่ในคลังของลูกค้ารายนี้แล้ว",
          });
        }
        throw e;
      }
      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "CUSTOMER_ARTWORK",
        entityId: id,
        newValue: data,
      });
      return updated;
    }),
});
