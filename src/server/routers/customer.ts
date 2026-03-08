import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { createAuditLog } from "@/server/helpers";
import { byIdInput } from "@/server/schemas";
import { getStartOfMonth } from "@/lib/date-utils";

export const customerRouter = router({
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

      return { customers, total, pages: Math.ceil(total / input.limit) };
    }),

  getById: protectedProcedure
    .input(byIdInput)
    .query(async ({ ctx, input }) => {
      return ctx.prisma.customer.findUniqueOrThrow({
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
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "กรุณากรอกชื่อลูกค้า"),
        company: z.string().optional(),
        email: z.string().email("อีเมลไม่ถูกต้อง").optional().or(z.literal("")),
        phone: z.string().optional(),
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
        defaultPaymentTerms: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
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
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        company: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional(),
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
        defaultPaymentTerms: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const old = await ctx.prisma.customer.findUniqueOrThrow({ where: { id } });

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
