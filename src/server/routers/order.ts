import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { generateOrderNumber } from "@/lib/utils";
import { getCustomerStatus, getInitialStatus, isValidTransition } from "@/lib/order-status";
import { calculateItemSubtotal, calculateTotalQuantity } from "@/lib/pricing";

// ============================================================
// SCHEMAS
// ============================================================

const variantSchema = z.object({
  size: z.string(),
  color: z.string().optional(),
  quantity: z.number().min(1),
});

const printSchema = z.object({
  position: z.string(),
  printType: z.string(),
  colorCount: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  designNote: z.string().optional(),
  unitPrice: z.number().min(0),
});

const addonSchema = z.object({
  addonType: z.string(),
  name: z.string(),
  description: z.string().optional(),
  pricingType: z.enum(["PER_PIECE", "PER_ORDER"]),
  unitPrice: z.number().min(0),
  quantity: z.number().optional(),
  notes: z.string().optional(),
});

const orderItemSchema = z.object({
  productType: z.string(),
  description: z.string(),
  material: z.string().optional(),
  baseUnitPrice: z.number().min(0),
  variants: z.array(variantSchema).min(1),
  prints: z.array(printSchema).default([]),
  addons: z.array(addonSchema).default([]),
  notes: z.string().optional(),
});

const orderFeeSchema = z.object({
  feeType: z.string(),
  name: z.string(),
  description: z.string().optional(),
  amount: z.number().min(0),
  notes: z.string().optional(),
});

// ============================================================
// ROUTER
// ============================================================

export const orderRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        orderType: z.enum(["READY_MADE", "CUSTOM"]).optional(),
        channel: z.string().optional(),
        customerStatus: z.string().optional(),
        internalStatus: z.string().optional(),
        customerId: z.string().optional(),
        page: z.number().default(1),
        limit: z.number().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      if (input.search) {
        where.OR = [
          { orderNumber: { contains: input.search, mode: "insensitive" } },
          { title: { contains: input.search, mode: "insensitive" } },
          { customer: { name: { contains: input.search, mode: "insensitive" } } },
          { externalOrderId: { contains: input.search, mode: "insensitive" } },
        ];
      }

      if (input.orderType) where.orderType = input.orderType;
      if (input.channel) where.channel = input.channel;
      if (input.customerStatus) where.customerStatus = input.customerStatus;
      if (input.internalStatus) where.internalStatus = input.internalStatus;
      if (input.customerId) where.customerId = input.customerId;

      const [orders, total] = await Promise.all([
        ctx.prisma.order.findMany({
          where,
          include: {
            customer: { select: { id: true, name: true, company: true } },
            _count: { select: { items: true, designs: true, deliveries: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        ctx.prisma.order.count({ where }),
      ]);

      return { orders, total, pages: Math.ceil(total / input.limit) };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.order.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          customer: true,
          brandProfile: true,
          createdBy: { select: { id: true, name: true } },
          items: {
            orderBy: { sortOrder: "asc" },
            include: {
              variants: { orderBy: { size: "asc" } },
              prints: { orderBy: { position: "asc" } },
              addons: true,
            },
          },
          fees: { orderBy: { createdAt: "asc" } },
          revisions: { orderBy: { createdAt: "desc" } },
          designs: { orderBy: { versionNumber: "desc" } },
          productions: {
            include: {
              steps: {
                orderBy: { sortOrder: "asc" },
                include: {
                  assignedTo: { select: { id: true, name: true } },
                  outsourceOrder: { include: { vendor: true } },
                },
              },
            },
          },
          invoices: {
            orderBy: { createdAt: "desc" },
            include: { payments: true },
          },
          deliveries: { orderBy: { createdAt: "desc" } },
          costEntries: { orderBy: { createdAt: "desc" } },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        orderType: z.enum(["READY_MADE", "CUSTOM"]).default("CUSTOM"),
        channel: z.enum(["SHOPEE", "LAZADA", "TIKTOK", "LINE", "WALK_IN", "PHONE", "WEBSITE"]).default("LINE"),
        customerId: z.string(),
        brandProfileId: z.string().optional(),
        title: z.string().min(1, "กรุณากรอกชื่อออเดอร์"),
        description: z.string().optional(),
        deadline: z.string().optional(),
        notes: z.string().optional(),
        externalOrderId: z.string().optional(),
        platformFee: z.number().optional(),
        discount: z.number().default(0),
        discountReason: z.string().optional(),
        items: z.array(orderItemSchema).min(1, "กรุณาเพิ่มรายการอย่างน้อย 1 รายการ"),
        fees: z.array(orderFeeSchema).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { items, fees, ...orderData } = input;

      // Calculate pricing for each item
      const itemsWithCalc = items.map((item, index) => {
        const totalQuantity = calculateTotalQuantity(item.variants);
        const subtotal = calculateItemSubtotal({
          baseUnitPrice: item.baseUnitPrice,
          totalQuantity,
          prints: item.prints,
          addons: item.addons,
        });
        return { ...item, totalQuantity, subtotal, sortOrder: index };
      });

      const subtotalItems = itemsWithCalc.reduce((sum, i) => sum + i.subtotal, 0);
      const subtotalFees = fees.reduce((sum, f) => sum + f.amount, 0);
      const totalAmount = subtotalItems + subtotalFees - (input.discount || 0);

      const initialStatus = getInitialStatus(input.orderType);
      const customerStatus = getCustomerStatus(initialStatus);

      const order = await ctx.prisma.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          orderType: orderData.orderType,
          channel: orderData.channel,
          customerId: orderData.customerId,
          brandProfileId: orderData.brandProfileId,
          createdById: ctx.userId,
          customerStatus,
          internalStatus: initialStatus,
          title: orderData.title,
          description: orderData.description,
          deadline: orderData.deadline ? new Date(orderData.deadline) : null,
          notes: orderData.notes,
          externalOrderId: orderData.externalOrderId,
          platformFee: orderData.platformFee,
          discount: orderData.discount || 0,
          discountReason: orderData.discountReason,
          subtotalItems,
          subtotalFees,
          totalAmount: Math.max(0, totalAmount),
          items: {
            create: itemsWithCalc.map((item) => ({
              sortOrder: item.sortOrder,
              productType: item.productType,
              description: item.description,
              material: item.material,
              baseUnitPrice: item.baseUnitPrice,
              totalQuantity: item.totalQuantity,
              subtotal: item.subtotal,
              notes: item.notes,
              variants: {
                create: item.variants.map((v) => ({
                  size: v.size,
                  color: v.color,
                  quantity: v.quantity,
                })),
              },
              prints: {
                create: item.prints.map((p) => ({
                  position: p.position,
                  printType: p.printType,
                  colorCount: p.colorCount,
                  width: p.width,
                  height: p.height,
                  designNote: p.designNote,
                  unitPrice: p.unitPrice,
                })),
              },
              addons: {
                create: item.addons.map((a) => ({
                  addonType: a.addonType,
                  name: a.name,
                  description: a.description,
                  pricingType: a.pricingType,
                  unitPrice: a.unitPrice,
                  quantity: a.quantity,
                  notes: a.notes,
                })),
              },
            })),
          },
          fees: {
            create: fees.map((f) => ({
              feeType: f.feeType,
              name: f.name,
              description: f.description,
              amount: f.amount,
              notes: f.notes,
            })),
          },
        },
        include: {
          customer: { select: { name: true } },
          items: { include: { variants: true, prints: true, addons: true } },
          fees: true,
        },
      });

      // Update customer stats
      await ctx.prisma.customer.update({
        where: { id: input.customerId },
        data: {
          totalOrders: { increment: 1 },
          lastOrderAt: new Date(),
        },
      });

      // Audit log
      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "CREATE",
          entityType: "ORDER",
          entityId: order.id,
          newValue: JSON.parse(
            JSON.stringify({
              orderNumber: order.orderNumber,
              orderType: order.orderType,
              channel: order.channel,
              title: order.title,
              totalAmount: order.totalAmount,
            })
          ),
        },
      });

      return order;
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        internalStatus: z.enum([
          "INQUIRY", "QUOTATION", "CONFIRMED", "DESIGN_PENDING", "DESIGNING",
          "AWAITING_APPROVAL", "DESIGN_APPROVED", "PRODUCTION_QUEUE", "PRODUCING",
          "QUALITY_CHECK", "PACKING", "READY_TO_SHIP", "SHIPPED", "COMPLETED", "CANCELLED",
        ]),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const old = await ctx.prisma.order.findUniqueOrThrow({
        where: { id: input.id },
      });

      // Validate transition
      if (!isValidTransition(old.orderType, old.internalStatus, input.internalStatus)) {
        throw new Error(
          `ไม่สามารถเปลี่ยนสถานะจาก ${old.internalStatus} เป็น ${input.internalStatus} ได้`
        );
      }

      const newCustomerStatus = getCustomerStatus(input.internalStatus);

      const updateData: Record<string, unknown> = {
        internalStatus: input.internalStatus,
        customerStatus: newCustomerStatus,
      };

      if (input.internalStatus === "COMPLETED") {
        updateData.completedAt = new Date();
      }
      if (input.internalStatus === "CANCELLED") {
        updateData.cancelledAt = new Date();
        updateData.cancelledReason = input.reason;
      }

      const order = await ctx.prisma.order.update({
        where: { id: input.id },
        data: updateData,
      });

      // Record revision
      const revisionCount = await ctx.prisma.orderRevision.count({ where: { orderId: input.id } });
      await ctx.prisma.orderRevision.create({
        data: {
          orderId: input.id,
          version: revisionCount + 1,
          changedBy: ctx.userId,
          changeType: "STATUS",
          description: `เปลี่ยนสถานะจาก ${old.internalStatus} เป็น ${input.internalStatus}`,
          oldValue: old.internalStatus,
          newValue: input.internalStatus,
        },
      });

      // Audit log
      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "UPDATE",
          entityType: "ORDER",
          entityId: input.id,
          oldValue: { internalStatus: old.internalStatus, customerStatus: old.customerStatus },
          newValue: { internalStatus: input.internalStatus, customerStatus: newCustomerStatus },
          reason: input.reason,
        },
      });

      return order;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        deadline: z.string().optional(),
        discount: z.number().optional(),
        discountReason: z.string().optional(),
        notes: z.string().optional(),
        externalOrderId: z.string().optional(),
        trackingNumber: z.string().optional(),
        platformFee: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const order = await ctx.prisma.order.update({
        where: { id },
        data: {
          ...data,
          deadline: data.deadline ? new Date(data.deadline) : undefined,
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "UPDATE",
          entityType: "ORDER",
          entityId: id,
          newValue: JSON.parse(JSON.stringify(data)),
        },
      });

      return order;
    }),

  updateItems: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        items: z.array(orderItemSchema).min(1, "กรุณาเพิ่มรายการอย่างน้อย 1 รายการ"),
        discount: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.prisma.order.findUniqueOrThrow({
        where: { id: input.id },
        include: { fees: true },
      });

      // Block editing once production has started
      const blockedStatuses = [
        "PRODUCING", "QUALITY_CHECK", "PACKING", "READY_TO_SHIP",
        "SHIPPED", "COMPLETED", "CANCELLED",
      ];
      if (blockedStatuses.includes(order.internalStatus)) {
        throw new Error("ไม่สามารถแก้ไขรายการได้เมื่อเริ่มผลิตแล้ว");
      }

      // Calculate pricing
      const itemsWithCalc = input.items.map((item, index) => {
        const totalQuantity = calculateTotalQuantity(item.variants);
        const subtotal = calculateItemSubtotal({
          baseUnitPrice: item.baseUnitPrice,
          totalQuantity,
          prints: item.prints,
          addons: item.addons,
        });
        return { ...item, totalQuantity, subtotal, sortOrder: index };
      });

      const subtotalItems = itemsWithCalc.reduce((sum, i) => sum + i.subtotal, 0);
      const subtotalFees = order.fees.reduce((sum, f) => sum + f.amount, 0);
      const totalAmount = subtotalItems + subtotalFees - (input.discount || 0);

      // Use transaction: delete old items → create new → update pricing
      const updatedOrder = await ctx.prisma.$transaction(async (tx) => {
        // Delete old items (cascades to variants, prints, addons)
        await tx.orderItem.deleteMany({ where: { orderId: input.id } });

        // Create new items
        for (const item of itemsWithCalc) {
          await tx.orderItem.create({
            data: {
              orderId: input.id,
              sortOrder: item.sortOrder,
              productType: item.productType,
              description: item.description,
              material: item.material,
              baseUnitPrice: item.baseUnitPrice,
              totalQuantity: item.totalQuantity,
              subtotal: item.subtotal,
              notes: item.notes,
              variants: {
                create: item.variants.map((v) => ({
                  size: v.size,
                  color: v.color,
                  quantity: v.quantity,
                })),
              },
              prints: {
                create: item.prints.map((p) => ({
                  position: p.position,
                  printType: p.printType,
                  colorCount: p.colorCount,
                  width: p.width,
                  height: p.height,
                  designNote: p.designNote,
                  unitPrice: p.unitPrice,
                })),
              },
              addons: {
                create: item.addons.map((a) => ({
                  addonType: a.addonType,
                  name: a.name,
                  description: a.description,
                  pricingType: a.pricingType,
                  unitPrice: a.unitPrice,
                  quantity: a.quantity,
                  notes: a.notes,
                })),
              },
            },
          });
        }

        // Update order pricing
        return tx.order.update({
          where: { id: input.id },
          data: {
            subtotalItems,
            subtotalFees,
            discount: input.discount || 0,
            totalAmount: Math.max(0, totalAmount),
          },
        });
      });

      // Record revision
      const revisionCount = await ctx.prisma.orderRevision.count({ where: { orderId: input.id } });
      await ctx.prisma.orderRevision.create({
        data: {
          orderId: input.id,
          version: revisionCount + 1,
          changedBy: ctx.userId,
          changeType: "ITEMS",
          description: `แก้ไขรายการสินค้า (${input.items.length} รายการ)`,
          oldValue: JSON.stringify({ subtotalItems: order.subtotalItems, totalAmount: order.totalAmount }),
          newValue: JSON.stringify({ subtotalItems, totalAmount: Math.max(0, totalAmount) }),
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "UPDATE",
          entityType: "ORDER",
          entityId: input.id,
          newValue: { action: "updateItems", itemCount: input.items.length, totalAmount: Math.max(0, totalAmount) },
        },
      });

      return updatedOrder;
    }),

  updateFees: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        fees: z.array(orderFeeSchema).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.prisma.order.findUniqueOrThrow({
        where: { id: input.id },
      });

      const subtotalFees = input.fees.reduce((sum, f) => sum + f.amount, 0);
      const totalAmount = order.subtotalItems + subtotalFees - order.discount;

      const updatedOrder = await ctx.prisma.$transaction(async (tx) => {
        await tx.orderFee.deleteMany({ where: { orderId: input.id } });

        for (const fee of input.fees) {
          await tx.orderFee.create({
            data: {
              orderId: input.id,
              feeType: fee.feeType,
              name: fee.name,
              description: fee.description,
              amount: fee.amount,
              notes: fee.notes,
            },
          });
        }

        return tx.order.update({
          where: { id: input.id },
          data: {
            subtotalFees,
            totalAmount: Math.max(0, totalAmount),
          },
        });
      });

      const revisionCount = await ctx.prisma.orderRevision.count({ where: { orderId: input.id } });
      await ctx.prisma.orderRevision.create({
        data: {
          orderId: input.id,
          version: revisionCount + 1,
          changedBy: ctx.userId,
          changeType: "FEES",
          description: `แก้ไขค่าธรรมเนียม (${input.fees.length} รายการ)`,
          oldValue: JSON.stringify({ subtotalFees: order.subtotalFees }),
          newValue: JSON.stringify({ subtotalFees }),
        },
      });

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "UPDATE",
          entityType: "ORDER",
          entityId: input.id,
          newValue: { action: "updateFees", feeCount: input.fees.length, subtotalFees },
        },
      });

      return updatedOrder;
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, active, completedThisMonth, totalRevenue] = await Promise.all([
      ctx.prisma.order.count(),
      ctx.prisma.order.count({
        where: {
          internalStatus: {
            notIn: ["COMPLETED", "CANCELLED"],
          },
        },
      }),
      ctx.prisma.order.count({
        where: {
          internalStatus: "COMPLETED",
          completedAt: { gte: startOfMonth },
        },
      }),
      ctx.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          internalStatus: { not: "CANCELLED" },
          createdAt: { gte: startOfMonth },
        },
      }),
    ]);

    return {
      total,
      active,
      completedThisMonth,
      revenueThisMonth: totalRevenue._sum.totalAmount ?? 0,
    };
  }),
});
