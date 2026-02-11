import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { generateQuotationNumber, generateOrderNumber } from "@/lib/utils";
import { getInitialStatus, getCustomerStatus } from "@/lib/order-status";

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
    .input(z.object({ id: z.string() }))
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
    .input(
      z.object({
        customerId: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
        validUntil: z.string(),
        terms: z.string().optional(),
        discount: z.number().default(0),
        tax: z.number().default(0),
        notes: z.string().optional(),
        items: z.array(quotationItemSchema).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { items, ...data } = input;

      const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const totalAmount = subtotal - data.discount + data.tax;

      const quotation = await ctx.prisma.quotation.create({
        data: {
          quotationNumber: generateQuotationNumber(),
          customerId: data.customerId,
          createdById: ctx.userId,
          title: data.title,
          description: data.description,
          validUntil: new Date(data.validUntil),
          terms: data.terms,
          subtotal,
          discount: data.discount,
          tax: data.tax,
          totalAmount: Math.max(0, totalAmount),
          notes: data.notes,
          items: {
            create: items.map((item, index) => ({
              sortOrder: index,
              name: item.name,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice,
              notes: item.notes,
            })),
          },
        },
        include: { items: true, customer: { select: { name: true } } },
      });

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "CREATE",
          entityType: "QUOTATION",
          entityId: quotation.id,
          newValue: JSON.parse(JSON.stringify({ quotationNumber: quotation.quotationNumber, title: quotation.title, totalAmount: quotation.totalAmount })),
        },
      });

      return quotation;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        validUntil: z.string().optional(),
        terms: z.string().optional(),
        discount: z.number().optional(),
        tax: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.quotation.update({
        where: { id },
        data: {
          ...data,
          validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        },
      });
    }),

  updateStatus: protectedProcedure
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
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const quotation = await ctx.prisma.quotation.findUniqueOrThrow({
        where: { id: input.id },
        include: { items: true },
      });

      if (quotation.status !== "ACCEPTED") {
        throw new Error("ใบเสนอราคาต้องได้รับการอนุมัติก่อนแปลงเป็นออเดอร์");
      }

      const initialStatus = getInitialStatus("CUSTOM");
      const customerStatus = getCustomerStatus(initialStatus);

      // Create order from quotation
      const order = await ctx.prisma.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          orderType: "CUSTOM",
          channel: "LINE",
          customerId: quotation.customerId,
          createdById: ctx.userId,
          customerStatus,
          internalStatus: "CONFIRMED", // skip INQUIRY/QUOTATION since we already have the quotation
          title: quotation.title,
          description: quotation.description,
          discount: quotation.discount,
          subtotalItems: quotation.subtotal,
          totalAmount: quotation.totalAmount,
          items: {
            create: quotation.items.map((item, index) => ({
              sortOrder: index,
              productType: "OTHER",
              description: item.name + (item.description ? ` - ${item.description}` : ""),
              baseUnitPrice: item.unitPrice,
              totalQuantity: item.quantity,
              subtotal: item.totalPrice,
              variants: {
                create: [{ size: "FREE", quantity: item.quantity }],
              },
            })),
          },
        },
      });

      // Link quotation to order
      await ctx.prisma.quotation.update({
        where: { id: input.id },
        data: { orderId: order.id, status: "CONVERTED" },
      });

      // Update customer stats
      await ctx.prisma.customer.update({
        where: { id: quotation.customerId },
        data: { totalOrders: { increment: 1 }, lastOrderAt: new Date() },
      });

      return order;
    }),
});
