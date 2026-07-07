import { z } from "zod";
import { router, protectedProcedure, requireRole, requirePermission } from "../trpc";
import { calculateProfitMargin } from "@/lib/pricing";
import { byIdInput } from "@/server/schemas";
// lock+recalc อยู่ที่ service กลาง — production/outsource ที่เขียน costEntry ใช้ชุดเดียวกัน
import { lockOrderRow, recalcOrderCost } from "@/server/services/order-cost";

const accountantUp = requirePermission("manage_costs");
// ลบต้นทุน [OWNER, ACCOUNTANT] — ชุดไม่ตรง catalog ไหนพอดี จงใจคง requireRole (จุด "คงเช็คเดิม")
const ownerOrAccountant = requireRole("OWNER", "ACCOUNTANT");

export const costRouter = router({
  listByOrder: protectedProcedure
    .use(accountantUp)
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [entries, order] = await Promise.all([
        ctx.prisma.costEntry.findMany({
          where: { orderId: input.orderId },
          include: { createdBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        }),
        ctx.prisma.order.findUniqueOrThrow({
          where: { id: input.orderId },
          select: { totalAmount: true, totalCost: true, profitMargin: true },
        }),
      ]);

      const totalCost = entries.reduce((sum, e) => sum + e.amount, 0);
      const byCategory = entries.reduce(
        (acc, e) => {
          acc[e.category] = (acc[e.category] || 0) + e.amount;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        entries,
        totalCost,
        byCategory,
        revenue: order.totalAmount,
        profitMargin: calculateProfitMargin(order.totalAmount, totalCost),
      };
    }),

  create: protectedProcedure
    .use(accountantUp)
    .input(
      z.object({
        orderId: z.string(),
        category: z.string(),
        name: z.string().min(1),
        description: z.string().optional(),
        amount: z.number().min(0),
        quantity: z.number().optional(),
        unitCost: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // การเงินหลายขั้น = $transaction เสมอ (Gate A4 — เดิมเขียน 3 ขั้นแยก พังกลางทาง
      // หรือชนกัน = totalCost บนออเดอร์เพี้ยน)
      return ctx.prisma.$transaction(async (tx) => {
        await lockOrderRow(tx, input.orderId);
        const entry = await tx.costEntry.create({
          data: {
            ...input,
            createdById: ctx.userId,
          },
        });
        await recalcOrderCost(tx, input.orderId);
        return entry;
      });
    }),

  update: protectedProcedure
    .use(accountantUp)
    .input(
      z.object({
        id: z.string(),
        category: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        amount: z.number().optional(),
        quantity: z.number().optional(),
        unitCost: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.$transaction(async (tx) => {
        const existing = await tx.costEntry.findUniqueOrThrow({
          where: { id },
          select: { orderId: true },
        });
        await lockOrderRow(tx, existing.orderId);
        const entry = await tx.costEntry.update({ where: { id }, data });
        await recalcOrderCost(tx, existing.orderId);
        return entry;
      });
    }),

  delete: protectedProcedure
    .use(ownerOrAccountant)
    .input(byIdInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.$transaction(async (tx) => {
        const existing = await tx.costEntry.findUniqueOrThrow({
          where: { id: input.id },
          select: { orderId: true },
        });
        await lockOrderRow(tx, existing.orderId);
        const entry = await tx.costEntry.delete({ where: { id: input.id } });
        await recalcOrderCost(tx, existing.orderId);
        return entry;
      });
    }),
});
