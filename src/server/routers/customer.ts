import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requirePermission } from "../trpc";
import { createAuditLog } from "@/server/helpers";
import { byIdInput } from "@/server/schemas";
import { getStartOfMonth } from "@/lib/date-utils";
import { PAYMENT_TERMS_VALUES } from "@/lib/payment-terms";
import { normalizePhone } from "@/lib/phone";
import { creditExposureForCustomer } from "@/server/services/receivables";
import { hasPermission } from "@/lib/permissions";

// PERM3: default = OWNER/MANAGER/ACCOUNTANT/SALES เดิมเป๊ะ + override รายคน
const customerEditors = requirePermission("manage_customers");

export const customerRouter = router({
  // สถานะวงเงินเครดิต: ภาระหนี้รวม (ใบค้างชำระ + งานผูกพันยังไม่วางบิล) เทียบ creditLimit
  // ใช้ตอนสร้าง/ยืนยันออเดอร์ + หน้า detail ลูกค้า — เฉพาะกลุ่มเห็นเงินฝั่งขาย
  // (⑦ เบสเคาะ 2026-07-06: เดิมเปิดทุก role — ช่างเห็นวงเงิน/ภาระหนี้ลูกค้าได้)
  creditStatus: protectedProcedure
    .use(customerEditors)
    .input(z.object({ customerId: z.string() }))
    .query(async ({ ctx, input }) => {
      const customer = await ctx.prisma.customer.findUniqueOrThrow({
        where: { id: input.customerId },
        select: { creditLimit: true },
      });
      const exposure = await creditExposureForCustomer(ctx.prisma, input.customerId);
      return {
        creditLimit: customer.creditLimit,
        ...exposure,
        available:
          customer.creditLimit != null ? customer.creditLimit - exposure.exposure : null,
      };
    }),

  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        segment: z.string().optional(),
        page: z.number().default(1),
        limit: z.number().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { company: { contains: input.search, mode: "insensitive" } },
          { phone: { contains: input.search } },
          { email: { contains: input.search, mode: "insensitive" } },
          { lineId: { contains: input.search, mode: "insensitive" } },
        ];
      }

      if (input.segment) {
        where.segment = input.segment;
      }

      const [customers, total] = await Promise.all([
        ctx.prisma.customer.findMany({
          where,
          include: { _count: { select: { orders: true } } },
          orderBy: { updatedAt: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        ctx.prisma.customer.count({ where }),
      ]);

      // ⑦ (เบสเคาะ 2026-07-06): ยอดซื้อสะสม/วงเงิน = เงินฝั่งขาย — ช่าง/กราฟิกไม่เห็น
      // (null ไม่ใช่ 0 — 0 อ่านเป็น "ไม่เคยซื้อ" ได้ · pattern เดียวกับ analytics.dashboard)
      const seesMoney = hasPermission(ctx.userRole, ctx.permissionOverrides, "see_order_money");
      const sanitized = seesMoney
        ? customers
        : customers.map((c) => ({ ...c, totalSpent: null, creditLimit: null }));

      return { customers: sanitized, total, pages: Math.ceil(total / input.limit) };
    }),

  getById: protectedProcedure
    .input(byIdInput)
    .query(async ({ ctx, input }) => {
      const customer = await ctx.prisma.customer.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          orders: { orderBy: { createdAt: "desc" }, take: 10 },
          brandProfiles: true,
          communicationLogs: {
            orderBy: { createdAt: "desc" },
            take: 20,
            include: { user: { select: { name: true } } },
          },
          _count: { select: { orders: true, invoices: true } },
        },
      });
      // ⑦ (เบสเคาะ 2026-07-06): ช่าง/กราฟิกใช้หน้า detail ได้ (ที่อยู่/แบรนด์/ประวัติคุย)
      // แต่เงินฝั่งขายต้องไม่เห็น — ยอดสะสม/วงเงิน/มูลค่าออเดอร์ย้อนหลัง
      // ทุน/กำไรบนออเดอร์ย้อนหลัง = finance เท่านั้น (RBAC §7 — SALES ก็ห้าม · review จับ)
      const seesCost = hasPermission(ctx.userRole, ctx.permissionOverrides, "see_finance");
      const costGated = {
        ...customer,
        orders: customer.orders.map((o) => ({
          ...o,
          totalCost: seesCost ? o.totalCost : 0,
          profitMargin: seesCost ? o.profitMargin : null,
        })),
      };
      if (hasPermission(ctx.userRole, ctx.permissionOverrides, "see_order_money")) return costGated;
      return {
        ...costGated,
        totalSpent: null,
        creditLimit: null,
        orders: costGated.orders.map((o) => ({
          ...o,
          subtotalItems: null,
          subtotalFees: null,
          discount: null,
          taxAmount: null,
          totalAmount: null,
          totalCost: null,
          profitMargin: null,
          platformFee: null,
        })),
      };
    }),

  create: protectedProcedure
    .use(customerEditors)
    .input(
      z.object({
        name: z.string().min(1, "กรุณากรอกชื่อลูกค้า"),
        company: z.string().optional(),
        email: z.string().email("อีเมลไม่ถูกต้อง").optional().or(z.literal("")),
        // เบอร์ normalize ที่ทางเข้า server ทุกทาง — กันซ้ำ/ค้นไม่เจอเพราะ format ต่างกัน
        phone: z
          .string()
          .optional()
          .transform((v) => (v ? normalizePhone(v) : v)),
        lineId: z.string().optional(),
        address: z.string().optional(),
        taxId: z.string().optional(),
        customerType: z.enum(["INDIVIDUAL", "CORPORATE"]).default("INDIVIDUAL"),
        branchNumber: z.string().optional(),
        segment: z.enum(["VIP", "REGULAR", "NEW", "INACTIVE", "WHOLESALE", "RETAIL"]).default("NEW"),
        notes: z.string().optional(),
        tags: z.array(z.string()).default([]),
        // Billing address
        billingAddress: z.string().optional(),
        billingSubDistrict: z.string().optional(),
        billingDistrict: z.string().optional(),
        billingProvince: z.string().optional(),
        billingPostalCode: z.string().optional(),
        // Credit management
        creditLimit: z.number().optional(),
        defaultPaymentTerms: z.enum(PAYMENT_TERMS_VALUES).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // วงเงินเครดิต = การตัดสินใจความเสี่ยง — SALES ตั้งเองไม่ได้
      if (ctx.userRole === "SALES" && input.creditLimit !== undefined) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "ฝ่ายขายตั้งวงเงินเครดิตเองไม่ได้ — ให้ผู้จัดการ/บัญชีกำหนด",
        });
      }
      const customer = await ctx.prisma.customer.create({
        data: {
          ...input,
          email: input.email || null,
        },
      });

      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "CREATE",
        entityType: "CUSTOMER",
        entityId: customer.id,
        newValue: JSON.parse(JSON.stringify(input)),
      });

      return customer;
    }),

  update: protectedProcedure
    .use(customerEditors)
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        company: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        phone: z
          .string()
          .optional()
          .transform((v) => (v ? normalizePhone(v) : v)),
        lineId: z.string().optional(),
        address: z.string().optional(),
        taxId: z.string().optional(),
        customerType: z.enum(["INDIVIDUAL", "CORPORATE"]).optional(),
        branchNumber: z.string().nullable().optional(),
        segment: z.enum(["VIP", "REGULAR", "NEW", "INACTIVE", "WHOLESALE", "RETAIL"]).optional(),
        notes: z.string().optional(),
        tags: z.array(z.string()).optional(),
        // Billing address
        billingAddress: z.string().nullable().optional(),
        billingSubDistrict: z.string().nullable().optional(),
        billingDistrict: z.string().nullable().optional(),
        billingProvince: z.string().nullable().optional(),
        billingPostalCode: z.string().nullable().optional(),
        // Credit management
        creditLimit: z.number().nullable().optional(),
        defaultPaymentTerms: z.enum(PAYMENT_TERMS_VALUES).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const old = await ctx.prisma.customer.findUniqueOrThrow({ where: { id } });

      // วงเงินเครดิต = การตัดสินใจความเสี่ยง — SALES แก้เองไม่ได้
      if (
        ctx.userRole === "SALES" &&
        data.creditLimit !== undefined &&
        data.creditLimit !== old.creditLimit
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "ฝ่ายขายแก้วงเงินเครดิตเองไม่ได้ — ให้ผู้จัดการ/บัญชีกำหนด",
        });
      }

      const customer = await ctx.prisma.customer.update({
        where: { id },
        data: {
          ...data,
          email: data.email || null,
        },
      });

      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "CUSTOMER",
        entityId: id,
        oldValue: JSON.parse(JSON.stringify(old)),
        newValue: JSON.parse(JSON.stringify(data)),
      });

      return customer;
    }),

  addCommunicationLog: protectedProcedure
    .use(customerEditors)
    .input(
      z.object({
        customerId: z.string(),
        channel: z.string(),
        subject: z.string().optional(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.communicationLog.create({
        data: {
          ...input,
          userId: ctx.userId,
        },
      });
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const [total, newThisMonth, vip, inactive] = await Promise.all([
      ctx.prisma.customer.count(),
      ctx.prisma.customer.count({
        where: {
          createdAt: {
            gte: getStartOfMonth(),
          },
        },
      }),
      ctx.prisma.customer.count({ where: { segment: "VIP" } }),
      ctx.prisma.customer.count({ where: { segment: "INACTIVE" } }),
    ]);

    return { total, newThisMonth, vip, inactive };
  }),
});
