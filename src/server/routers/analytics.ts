import { z } from "zod";
import { router, protectedProcedure, requirePermission } from "../trpc";
import { hasPermission } from "@/lib/permissions";
import { getStartOfMonth, getStartOfLastMonth, getMonthRange } from "@/lib/date-utils";
import { aggToNumber } from "@/server/services/money";
import { getOwnerPulse } from "@/server/services/owner-pulse";

// PERM3: default ตรงชุดเดิมเป๊ะ + override รายคน
const adminOnly = requirePermission("view_admin_reports");
const ownerOrAccountant = requirePermission("see_finance");

// ป้ายชนิดงานพิมพ์ (ไทย) — printType เป็น String อิสระ ไม่ใช่ enum
const PRINT_LABELS: Record<string, string> = {
  DTF: "DTF",
  DTG: "DTG",
  SILK_SCREEN: "สกรีน",
  SUBLIMATION: "ซับ",
  HEAT_TRANSFER: "รีดร้อน",
  EMBROIDERY: "ปัก",
};

export const analyticsRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const startOfMonth = getStartOfMonth();
    const startOfLastMonth = getStartOfLastMonth();

    // ตัวเลขเงิน (รายได้/ลูกหนี้/top spender) เห็นเฉพาะฝั่งบริหาร-บัญชีตาราง RBAC §7
    // ส่วน ops counts เปิดทุก role — หน้า dashboard เป็นหน้าแรกของทุกคน
    const canSeeFinance = hasPermission(ctx.userRole, ctx.permissionOverrides, "see_finance");

    const [
      totalCustomers,
      newCustomersThisMonth,
      activeOrders,
      completedThisMonth,
      ordersByStatus,
      recentOrders,
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
      // ออเดอร์ล่าสุด (เปิดทุก role — ยอดเงิน gate ตอน return) · ตัด DRAFT/CANCELLED
      ctx.prisma.order.findMany({
        where: { internalStatus: { notIn: ["DRAFT", "CANCELLED"] } },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          orderNumber: true,
          title: true,
          deadline: true,
          totalAmount: true,
          customerStatus: true,
          internalStatus: true,
          customer: { select: { name: true, company: true } },
          items: { select: { prints: { select: { printType: true } } } },
        },
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

      // ผล aggregate ไม่ผ่าน result extension — ต้องแปลง Decimal → number ที่นี่
      const revThisMonth = aggToNumber(revenueThisMonth._sum.totalAmount);
      const revLastMonth = aggToNumber(revenueLastMonth._sum.totalAmount);
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
      recentOrders: recentOrders.map((o) => {
        // ชนิดงานพิมพ์ของออเดอร์ — มีหลายชนิด = "ผสม" · ไม่มีลาย = ไม่โชว์ป้าย
        const types = new Set<string>();
        for (const it of o.items) for (const p of it.prints) types.add(p.printType);
        const printLabel =
          types.size === 0
            ? null
            : types.size === 1
              ? PRINT_LABELS[[...types][0]] ?? [...types][0]
              : "ผสม";
        return {
          id: o.id,
          orderNumber: o.orderNumber,
          title: o.title,
          deadline: o.deadline,
          customerName: o.customer.company || o.customer.name,
          customerStatus: o.customerStatus,
          internalStatus: o.internalStatus,
          printLabel,
          // ยอดเงินเห็นเฉพาะฝั่งบริหาร-บัญชี (เหมือน revenue/topCustomers)
          totalAmount: canSeeFinance ? o.totalAmount : null,
        };
      }),
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
          revenue: aggToNumber(revenue._sum.totalAmount),
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

  // 5 ตัวเลขเจ้าของ — "จอเช้า 10 วินาที" (FLOW-REDESIGN ก้อน 2)
  // service กลางจงใจ: MCP เฟสแรก (ก้อน 5) ใช้ตัวเลขชุดเดียวกันนี้
  ownerPulse: protectedProcedure.use(adminOnly).query(({ ctx }) => getOwnerPulse(ctx.prisma)),
});
