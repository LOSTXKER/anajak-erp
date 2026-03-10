import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { byIdInput } from "@/server/schemas";
import { createAuditLog } from "@/server/helpers";

export const deliveryRouter = router({
  getByOrderId: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.delivery.findMany({
        where: { orderId: input.orderId },
        orderBy: { createdAt: "desc" },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        orderId: z.string(),
        recipientName: z.string().min(1),
        phone: z.string().min(1),
        address: z.string().min(1),
        subDistrict: z.string().optional(),
        district: z.string().optional(),
        province: z.string().optional(),
        postalCode: z.string().optional(),
        shippingMethod: z.string(),
        shippingCost: z.number().default(0),
        isPaid: z.boolean().default(false),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const delivery = await ctx.prisma.delivery.create({ data: input });

      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "CREATE",
        entityType: "DELIVERY",
        entityId: delivery.id,
        newValue: { orderId: input.orderId, shippingMethod: input.shippingMethod },
      });

      return delivery;
    }),

  update: protectedProcedure
    .input(
      byIdInput.extend({
        recipientName: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        subDistrict: z.string().optional(),
        district: z.string().optional(),
        province: z.string().optional(),
        postalCode: z.string().optional(),
        shippingMethod: z.string().optional(),
        trackingNumber: z.string().optional(),
        shippingCost: z.number().optional(),
        isPaid: z.boolean().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.delivery.update({ where: { id }, data });
    }),

  updateStatus: protectedProcedure
    .input(
      byIdInput.extend({
        status: z.enum(["PENDING", "PREPARING", "SHIPPED", "DELIVERED", "RETURNED"]),
        trackingNumber: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, unknown> = { status: input.status };

      if (input.status === "SHIPPED") {
        updateData.shippedAt = new Date();
        if (input.trackingNumber) updateData.trackingNumber = input.trackingNumber;
      }
      if (input.status === "DELIVERED") {
        updateData.deliveredAt = new Date();
      }

      const delivery = await ctx.prisma.delivery.update({
        where: { id: input.id },
        data: updateData,
      });

      // Also update order tracking number if provided
      if (input.trackingNumber) {
        await ctx.prisma.order.update({
          where: { id: delivery.orderId },
          data: { trackingNumber: input.trackingNumber },
        });
      }

      return delivery;
    }),

  delete: protectedProcedure
    .input(byIdInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.delivery.delete({ where: { id: input.id } });
    }),
});
