import { z } from "zod";
import { router, protectedProcedure, requirePermission } from "../trpc";
import { getProductionMetrics, METRIC_MONTHS } from "@/server/services/production-metrics";
import { hasPermission } from "@/lib/permissions";
import { getStartOfMonth, getStartOfLastMonth, getMonthRange, dateRangeFilter } from "@/lib/date-utils";
import { aggToNumber } from "@/server/services/money";
import { getOwnerPulse } from "@/server/services/owner-pulse";
import { getHomeOverview } from "@/server/services/home-overview";
import { printLabelOf, PRINT_LABELS } from "@/lib/print-labels";
import { BANGKOK_TZ } from "@/lib/utils";
import { customerDisplayName } from "@/lib/customer-name";

// PERM3: default ตรงชุดเดิมเป๊ะ + override รายคน
const adminOnly = requirePermission("view_admin_reports");
const ownerOrAccountant = requirePermission("see_finance");


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
      inHouseDtfProducing,
      outsourceProducing,
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
          deadline: true,
          totalAmount: true,
          customerStatus: true,
          internalStatus: true,
          customer: { select: { name: true, company: true } },
          items: { select: { prints: { select: { printType: true } } } },
          productions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              steps: {
                where: { status: { in: ["IN_PROGRESS", "PENDING"] } },
                orderBy: { sortOrder: "asc" },
                take: 1,
                select: { assignedTo: { select: { name: true } } },
              },
            },
          },
        },
      }),
      // แยกกำลังผลิตตามความจริงโรงงาน: DTF ทำเอง · เทคนิคอื่นเป็นงานร้านนอก
      // งานผสมถูกนับทั้งสองเลน เพราะใช้กำลังการผลิตทั้งสองฝั่งจริง
      ctx.prisma.order.count({
        where: {
          internalStatus: "PRODUCING",
          items: { some: { prints: { some: { printType: "DTF" } } } },
        },
      }),
      ctx.prisma.order.count({
        where: {
          internalStatus: "PRODUCING",
          items: {
            some: { prints: { some: { printType: { not: "DTF" } } } },
          },
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
      productionRouteCounts: {
        inHouseDtf: inHouseDtfProducing,
        outsource: outsourceProducing,
      },
      recentOrders: recentOrders.map((o) => {
        // ชนิดงานพิมพ์ของออเดอร์ — มีหลายชนิด = "ผสม" · ไม่มีลาย = ไม่โชว์ป้าย
        const types = new Set<string>();
        for (const it of o.items) for (const p of it.prints) types.add(p.printType);
        const printLabel = printLabelOf(types);
        return {
          id: o.id,
          orderNumber: o.orderNumber,
          deadline: o.deadline,
          customerName: customerDisplayName(o.customer),
          customerStatus: o.customerStatus,
          internalStatus: o.internalStatus,
          printLabel,
          productionRoutes: {
            inHouseDtf: types.has("DTF"),
            outsource: [...types].some((type) => type !== "DTF"),
          },
          assigneeName: o.productions[0]?.steps[0]?.assignedTo?.name ?? null,
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
      // เดิม: loop await aggregate+count ทีละเดือน = 12 query เรียงแถวต่อการเปิดหน้า
      // → _count รวมใน aggregate เดียว (เงื่อนไข where เดิมเป๊ะ) + ยิงทุกเดือนพร้อมกัน
      // ลำดับผลคงเดิม: เดือนเก่า → ใหม่ (perf audit 2026-07-07)
      const monthOffsets = Array.from({ length: input.months }, (_, idx) => input.months - 1 - idx);
      return Promise.all(
        monthOffsets.map(async (i) => {
          const { start, end } = getMonthRange(i);
          const agg = await ctx.prisma.order.aggregate({
            _sum: { totalAmount: true },
            _count: true,
            where: {
              createdAt: { gte: start, lt: end },
              internalStatus: { not: "CANCELLED" },
            },
          });
          return {
            // ป้ายต้องอ่านขอบเดือนด้วยเวลาไทยเหมือนถังข้อมูล — ไม่ปัก timeZone บน Vercel (UTC)
            // start คือ 17:00 UTC ของวันสิ้นเดือนก่อน ป้ายจะกลายเป็นเดือนก่อนหน้าทั้งแถว
            month: start.toLocaleDateString("th-TH", {
              month: "short",
              year: "2-digit",
              timeZone: BANGKOK_TZ,
            }),
            revenue: aggToNumber(agg._sum.totalAmount),
            orders: agg._count,
          };
        })
      );
    }),

  /** สัดส่วนงานที่ทำ แยกตามชนิดงานพิมพ์ (การ์ด "งานที่ขายดี" ในหน้ารายงาน · ต้นแบบ 2026-09-16)
   *  นับจำนวนตัวจากรายการในออเดอร์ที่เปิดในช่วงที่ขอ ไม่รวมออเดอร์ที่ยกเลิก */
  printTypeMix: protectedProcedure
    .input(z.object({ months: z.number().default(6) }))
    .query(async ({ ctx, input }) => {
      const since = getMonthRange(input.months - 1).start;
      const prints = await ctx.prisma.orderItemPrint.findMany({
        where: {
          orderItem: { order: { createdAt: { gte: since }, internalStatus: { not: "CANCELLED" } } },
        },
        select: { printType: true, orderItem: { select: { totalQuantity: true } } },
      });

      const byType = new Map<string, number>();
      for (const print of prints) {
        byType.set(print.printType, (byType.get(print.printType) ?? 0) + print.orderItem.totalQuantity);
      }
      const total = [...byType.values()].reduce((sum, qty) => sum + qty, 0);
      const rows = [...byType.entries()]
        .map(([type, quantity]) => ({
          type,
          label: PRINT_LABELS[type] ?? type,
          quantity,
          share: total > 0 ? Math.round((quantity / total) * 100) : 0,
        }))
        .sort((a, b) => b.quantity - a.quantity);

      return { rows, total };
    }),

  auditLog: protectedProcedure
    .use(adminOnly)
    .input(
      z.object({
        entityType: z.string().optional(),
        userId: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        page: z.number().default(1),
        limit: z.number().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input.entityType) where.entityType = input.entityType;
      if (input.userId) where.userId = input.userId;
      const createdAt = dateRangeFilter(input.from, input.to);
      if (createdAt) where.createdAt = createdAt;

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

  // หน้าแรกรื้อใหม่ 2026-09-14: ผังโรงงาน + สุขภาพ · กำหนดส่ง 7 วัน · ออเดอร์ที่กำลังเดิน · เงินที่ต้องตาม
  // ตัวเลขผลิตเปิดทุกคนที่เข้าหน้าแรกได้ (หัวหน้า/เจ้าของ) · เงิน gate ด้วย see_finance ชุดเดียวกับ dashboard
  homeOverview: protectedProcedure.query(({ ctx }) =>
    getHomeOverview(ctx.prisma, {
      canSeeFinance: hasPermission(ctx.userRole, ctx.permissionOverrides, "see_finance"),
    }),
  ),

  // ตัวชี้วัดการผลิต (MFG1–3 · 2026-09-16) — อ่านอย่างเดียว ไม่มีเงิน · สูตรอยู่ services/production-metrics.ts
  productionMetrics: protectedProcedure
    .input(z.object({ monthIndex: z.number().int().min(0).max(METRIC_MONTHS - 1) }))
    .query(({ ctx, input }) => getProductionMetrics(ctx.prisma, { monthIndex: input.monthIndex })),
});
