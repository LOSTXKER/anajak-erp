import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../trpc";
import { getCustomerStatus } from "@/lib/order-status";
import { createAuditLog } from "@/server/helpers";
import { byIdInput } from "@/server/schemas";
import { badRequest } from "@/server/errors";
import { nextDocumentNumber, withDocNumberRetry } from "@/server/services/document-number";
import { computeQuotationTotals } from "@/server/services/pricing";
import { D, round2, moneyInput } from "@/server/services/money";
import { assertSalesWithinCreditLimit } from "@/server/services/receivables";

const salesUp = requireRole("OWNER", "MANAGER", "SALES");

const quotationItemSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  quantity: z.number().min(1),
  unit: z.string().default("ชิ้น"),
  unitPrice: z.number().min(0),
  notes: z.string().optional(),
});

export const quotationRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        customerId: z.string().optional(),
        page: z.number().default(1),
        limit: z.number().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      if (input.search) {
        where.OR = [
          { quotationNumber: { contains: input.search, mode: "insensitive" } },
          { title: { contains: input.search, mode: "insensitive" } },
          { customer: { name: { contains: input.search, mode: "insensitive" } } },
        ];
      }
      if (input.status) where.status = input.status;
      if (input.customerId) where.customerId = input.customerId;

      const [quotations, total] = await Promise.all([
        ctx.prisma.quotation.findMany({
          where,
          include: {
            customer: { select: { id: true, name: true, company: true } },
            createdBy: { select: { id: true, name: true } },
            _count: { select: { items: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        ctx.prisma.quotation.count({ where }),
      ]);

      return { quotations, total, pages: Math.ceil(total / input.limit) };
    }),

  getById: protectedProcedure
    .input(byIdInput)
    .query(async ({ ctx, input }) => {
      return ctx.prisma.quotation.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          customer: true,
          createdBy: { select: { id: true, name: true } },
          items: { orderBy: { sortOrder: "asc" } },
          order: { select: { id: true, orderNumber: true } },
        },
      });
    }),

  create: protectedProcedure
    .use(salesUp)
    .input(
      z.object({
        customerId: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
        validUntil: z.string(),
        terms: z.string().optional(),
        discount: z.number().min(0).default(0),
        tax: z.number().min(0).default(0),
        notes: z.string().optional(),
        items: z.array(quotationItemSchema).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { items, ...data } = input;

      const totals = computeQuotationTotals({
        items,
        discount: data.discount,
        tax: data.tax,
      });

      // เลขใบเสนอราคารันต่อเนื่อง — สร้างใน transaction เดียวกับเอกสารเสมอ
      const quotation = await withDocNumberRetry(() =>
        ctx.prisma.$transaction(async (tx) => {
          const created = await tx.quotation.create({
            data: {
              quotationNumber: await nextDocumentNumber(tx, "QUOTATION"),
              customerId: data.customerId,
              createdById: ctx.userId,
              title: data.title,
              description: data.description,
              validUntil: new Date(data.validUntil),
              terms: data.terms,
              subtotal: totals.subtotal,
              discount: moneyInput(data.discount).toNumber(),
              tax: moneyInput(data.tax).toNumber(),
              totalAmount: totals.totalAmount,
              notes: data.notes,
              items: {
                create: items.map((item, index) => ({
                  sortOrder: index,
                  name: item.name,
                  description: item.description,
                  quantity: item.quantity,
                  unit: item.unit,
                  unitPrice: item.unitPrice,
                  totalPrice: totals.lineTotals[index],
                  notes: item.notes,
                })),
              },
            },
            include: { items: true, customer: { select: { name: true } } },
          });

          await createAuditLog(tx, {
            userId: ctx.userId,
            action: "CREATE",
            entityType: "QUOTATION",
            entityId: created.id,
            newValue: {
              quotationNumber: created.quotationNumber,
              title: created.title,
              totalAmount: created.totalAmount,
            },
          });

          return created;
        })
      );

      return quotation;
    }),

  update: protectedProcedure
    .use(salesUp)
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        validUntil: z.string().optional(),
        terms: z.string().optional(),
        discount: z.number().min(0).optional(),
        tax: z.number().min(0).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // discount/tax เปลี่ยน → ยอดรวมต้องคำนวณใหม่ผ่านสูตรกลางเสมอ (เดิมเขียนตรง ยอดค้าง)
      let totalsData: Record<string, number> = {};
      if (data.discount !== undefined || data.tax !== undefined) {
        const existing = await ctx.prisma.quotation.findUniqueOrThrow({
          where: { id },
          include: { items: true },
        });
        const totals = computeQuotationTotals({
          items: existing.items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice })),
          discount: data.discount ?? existing.discount,
          tax: data.tax ?? existing.tax,
        });
        totalsData = { subtotal: totals.subtotal, totalAmount: totals.totalAmount };
      }

      return ctx.prisma.quotation.update({
        where: { id },
        data: {
          ...data,
          ...totalsData,
          validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        },
      });
    }),

  updateStatus: protectedProcedure
    .use(salesUp)
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"]),
        rejectedReason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, unknown> = { status: input.status };

      if (input.status === "SENT") updateData.sentAt = new Date();
      if (input.status === "ACCEPTED") updateData.acceptedAt = new Date();
      if (input.status === "REJECTED") {
        updateData.rejectedAt = new Date();
        updateData.rejectedReason = input.rejectedReason;
      }

      return ctx.prisma.quotation.update({
        where: { id: input.id },
        data: updateData,
      });
    }),

  convertToOrder: protectedProcedure
    .use(salesUp)
    .input(byIdInput)
    .mutation(async ({ ctx, input }) => {
      const quotation = await ctx.prisma.quotation.findUniqueOrThrow({
        where: { id: input.id },
        include: { items: true },
      });

      if (quotation.status !== "ACCEPTED") {
        badRequest("ใบเสนอราคาต้องได้รับการอนุมัติก่อนแปลงเป็นออเดอร์");
      }

      // แปลงเป็นออเดอร์ = เกิดออเดอร์ CONFIRMED ทันที — ด่านวงเงินเดียวกับการยืนยันออเดอร์
      await assertSalesWithinCreditLimit(ctx.prisma, {
        userRole: ctx.userRole,
        customerId: quotation.customerId,
        additionalAmount: quotation.totalAmount,
        actionLabel: "แปลงเป็นออเดอร์",
      });

      const customerStatus = getCustomerStatus("CONFIRMED");

      // ใบเสนอราคาเก็บภาษีเป็น "บาท" แต่ order ใช้อัตรา % — แปลงอัตรากลับจากยอดจริง
      // ไม่งั้น order เกิดมาขัดสูตร A (totalAmount รวมภาษีแต่ taxRate=0) แล้วพอแก้รายการ
      // ครั้งแรก ระบบ recompute ด้วย taxRate=0 → เงินภาษีหายเงียบ
      const taxBase = D(quotation.subtotal).minus(quotation.discount);
      const derivedTaxRate =
        quotation.tax > 0 && taxBase.gt(0)
          ? round2(D(quotation.tax).div(taxBase).times(100))
          : D(0);

      return withDocNumberRetry(() =>
        ctx.prisma.$transaction(async (tx) => {
          const orderNumber = await nextDocumentNumber(tx, "ORDER");
          const order = await tx.order.create({
          data: {
            orderNumber,
            orderType: "CUSTOM",
            channel: "LINE",
            customerId: quotation.customerId,
            createdById: ctx.userId,
            customerStatus,
            internalStatus: "CONFIRMED",
            title: quotation.title,
            description: quotation.description,
            discount: quotation.discount,
            subtotalItems: quotation.subtotal,
            taxRate: derivedTaxRate.toNumber(),
            taxAmount: quotation.tax,
            totalAmount: quotation.totalAmount,
            items: {
              create: quotation.items.map((item, index) => ({
                sortOrder: index,
                description: item.name,
                totalQuantity: item.quantity,
                subtotal: item.totalPrice,
                products: {
                  create: [{
                    sortOrder: 0,
                    productType: "OTHER",
                    description: item.name + (item.description ? ` - ${item.description}` : ""),
                    baseUnitPrice: item.unitPrice,
                    totalQuantity: item.quantity,
                    subtotal: item.totalPrice,
                    variants: {
                      create: [{ size: "FREE", quantity: item.quantity }],
                    },
                  }],
                },
              })),
            },
          },
        });

        await tx.quotation.update({
          where: { id: input.id },
          data: { orderId: order.id, status: "CONVERTED" },
        });

        await tx.customer.update({
          where: { id: quotation.customerId },
          data: { totalOrders: { increment: 1 }, lastOrderAt: new Date() },
        });

        return order;
        })
      );
    }),
});
