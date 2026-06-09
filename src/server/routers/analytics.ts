import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../trpc";
import { getStartOfMonth, getStartOfLastMonth, getMonthRange } from "@/lib/date-utils";

const adminOnly = requireRole("OWNER", "MANAGER");
const ownerOrAccountant = requireRole("OWNER", "MANAGER", "ACCOUNTANT");

export const analyticsRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const startOfMonth = getStartOfMonth();
    const startOfLastMonth = getStartOfLastMonth();

    // ตัวเลขเงิน (รายได้/ลูกหนี้/top spender) เห็นเฉพาะฝั่งบริหาร-บัญชีตาราง RBAC §7
    // ส่วน ops counts เปิดทุก role — หน้า dashboard เป็นหน้าแรกของทุกคน
    const canSeeFinance =
      ctx.userRole === "OWNER" ||
      ctx.userRole === "MANAGER" ||
      ctx.userRole === "ACCOUNTANT";

    const [
      totalCustomers,
      newCustomersThisMonth,
      activeOrders,
      completedThisMonth,
      ordersByStatus,
    ] = await Promise.all([
      ctx.prisma.customer.count(),
      ctx.prisma.customer.count({ where: { createdAt: { gte: startOfMonth } } }),
      ctx.prisma.order.count({
        where: { internalStatus: { notIn: ["COMPLETED", "CANCELLED"] } },
      }),
      ctx.prisma.order.count({
        where: { internalStatus: "COMPLETED", completedAt: { gte: startOfMonth } },
      }),
      ctx.prisma.order.groupBy({
        by: ["internalStatus"],
        _count: { id: true },
      }),
    ]);

    let finance: {
      revenueThisMonth: number;
      revenueChange: number;
      overdueInvoices: number;
      topCustomers: {
        id: string;
        name: string;
        company: string | null;
        totalSpent: number;
        totalOrders: number;
      }[];
    } | null = null;

    if (canSeeFinance) {
      const [revenueThisMonth, revenueLastMonth, overdueInvoices, topCustomers] =
        await Promise.all([
          ctx.prisma.order.aggregate({
            _sum: { totalAmount: true },
            where: { createdAt: { gte: startOfMonth }, internalStatus: { not: "CANCELLED" } },
          }),
          ctx.prisma.order.aggregate({
            _sum: { totalAmount: true },
            where: {
              createdAt: { gte: startOfLastMonth, lt: startOfMonth },
              internalStatus: { not: "CANCELLED" },
            },
          }),
          ctx.prisma.invoice.count({
            where: { paymentStatus: "OVERDUE", isVoided: false },
          }),
          ctx.prisma.customer.findMany({
            orderBy: { totalSpent: "desc" },
            take: 5,
            select: { id: true, name: true, company: true, totalSpent: true, totalOrders: true },
          }),
        ]);

      const revThisMonth = revenueThisMonth._sum.totalAmount ?? 0;
      const revLastMonth = revenueLastMonth._sum.totalAmount ?? 0;
      finance = {
        revenueThisMonth: revThisMonth,
        revenueChange:
          revLastMonth > 0
            ? ((revThisMonth - revLastMonth) / revLastMonth) * 100
            : 0,
        overdueInvoices,
        topCustomers,
      };
    }

    return {
      totalCustomers,
      newCustomersThisMonth,
      activeOrders,
      completedThisMonth,
      revenueThisMonth: finance?.revenueThisMonth ?? null,
      revenueChange: finance?.revenueChange ?? null,
      overdueInvoices: finance?.overdueInvoices ?? null,
      topCustomers: finance?.topCustomers ?? null,
      ordersByStatus: ordersByStatus.map((item) => ({
        status: item.internalStatus,
        count: item._count.id,
      })),
    };
  }),

  revenueByMonth: protectedProcedure
    .use(ownerOrAccountant)
    .input(z.object({ months: z.number().default(6) }))
    .query(async ({ ctx, input }) => {
      const results = [];

      for (let i = input.months - 1; i >= 0; i--) {
        const { start, end } = getMonthRange(i);

        const revenue = await ctx.prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: {
            createdAt: { gte: start, lt: end },
            internalStatus: { not: "CANCELLED" },
          },
        });

        const orderCount = await ctx.prisma.order.count({
          where: {
            createdAt: { gte: start, lt: end },
            internalStatus: { not: "CANCELLED" },
          },
        });

        results.push({
          month: start.toLocaleDateString("th-TH", { month: "short", year: "2-digit" }),
          revenue: revenue._sum.totalAmount ?? 0,
          orders: orderCount,
        });
      }

      return results;
    }),

  auditLog: protectedProcedure
    .use(adminOnly)
    .input(
      z.object({
        entityType: z.string().optional(),
        userId: z.string().optional(),
        page: z.number().default(1),
        limit: z.number().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input.entityType) where.entityType = input.entityType;
      if (input.userId) where.userId = input.userId;

      const [logs, total] = await Promise.all([
        ctx.prisma.auditLog.findMany({
          where,
          include: { user: { select: { name: true, role: true } } },
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        ctx.prisma.auditLog.count({ where }),
      ]);

      return { logs, total, pages: Math.ceil(total / input.limit) };
    }),
});
