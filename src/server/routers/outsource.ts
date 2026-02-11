import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const outsourceRouter = router({
  // Vendors
  listVendors: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        capability: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { isActive: true };
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { contactName: { contains: input.search, mode: "insensitive" } },
        ];
      }
      if (input.capability) {
        where.capabilities = { has: input.capability };
      }

      return ctx.prisma.vendor.findMany({
        where,
        include: { _count: { select: { outsourceOrders: true } } },
        orderBy: { name: "asc" },
      });
    }),

  createVendor: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        contactName: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        lineId: z.string().optional(),
        address: z.string().optional(),
        capabilities: z.array(z.string()).default([]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const vendor = await ctx.prisma.vendor.create({ data: input });

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "CREATE",
          entityType: "VENDOR",
          entityId: vendor.id,
          newValue: { name: vendor.name },
        },
      });

      return vendor;
    }),

  // Outsource Orders
  listOrders: protectedProcedure
    .input(
      z.object({
        status: z.string().optional(),
        vendorId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input.status) where.status = input.status;
      if (input.vendorId) where.vendorId = input.vendorId;

      return ctx.prisma.outsourceOrder.findMany({
        where,
        include: {
          vendor: { select: { name: true } },
          productionStep: {
            include: {
              production: {
                include: {
                  order: {
                    select: { orderNumber: true, title: true, customer: { select: { name: true } } },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  createOrder: protectedProcedure
    .input(
      z.object({
        productionStepId: z.string(),
        vendorId: z.string(),
        description: z.string(),
        quantity: z.number().min(1),
        unitCost: z.number().min(0),
        expectedBackAt: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.prisma.outsourceOrder.create({
        data: {
          ...input,
          totalCost: input.quantity * input.unitCost,
          expectedBackAt: input.expectedBackAt ? new Date(input.expectedBackAt) : null,
        },
      });

      // Update step status
      await ctx.prisma.productionStep.update({
        where: { id: input.productionStepId },
        data: { status: "IN_PROGRESS" },
      });

      await ctx.prisma.auditLog.create({
        data: {
          userId: ctx.userId,
          action: "CREATE",
          entityType: "OUTSOURCE_ORDER",
          entityId: order.id,
          newValue: { vendorId: input.vendorId, totalCost: order.totalCost },
        },
      });

      return order;
    }),

  updateOrderStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["DRAFT", "SENT", "IN_PROGRESS", "COMPLETED", "RECEIVED_BACK", "QC_PASSED", "QC_FAILED"]),
        qcPassed: z.boolean().optional(),
        qcNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updateData: Record<string, unknown> = { status: data.status };

      if (data.status === "SENT") updateData.sentAt = new Date();
      if (data.status === "RECEIVED_BACK") updateData.receivedAt = new Date();
      if (data.qcPassed !== undefined) updateData.qcPassed = data.qcPassed;
      if (data.qcNotes) updateData.qcNotes = data.qcNotes;

      const order = await ctx.prisma.outsourceOrder.update({
        where: { id },
        data: updateData,
      });

      // If QC passed, complete the production step
      if (data.status === "QC_PASSED") {
        await ctx.prisma.productionStep.update({
          where: { id: order.productionStepId },
          data: { status: "COMPLETED", qcPassed: true, completedAt: new Date() },
        });
      }

      return order;
    }),
});
