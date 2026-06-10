import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../trpc";
import { byIdInput } from "@/server/schemas";
import { createAuditLog } from "@/server/helpers";

const salesOrProduction = requireRole("OWNER", "MANAGER", "SALES", "PRODUCTION_STAFF");
const managerUp = requireRole("OWNER", "MANAGER");

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
    .use(salesOrProduction)
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
        // ที่อยู่จัดส่งไหลกลับโปรไฟล์ลูกค้า — ข้อมูลลูกค้าแชทมาทีหลัง เก็บ ณ จุดที่ได้มา
        saveAsCustomerAddress: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { saveAsCustomerAddress, ...deliveryData } = input;

      return ctx.prisma.$transaction(async (tx) => {
        const delivery = await tx.delivery.create({ data: deliveryData });

        // จงใจให้ทุก role ที่สร้างใบส่งได้ (รวมฝ่ายผลิตที่แพ็คของ) เขียนผ่านช่องนี้ —
        // คนแพ็คคือคนที่ได้ที่อยู่มา · ขอบเขตแคบ: address + phone-เฉพาะตอนว่าง · มี audit เต็ม
        if (saveAsCustomerAddress) {
          const order = await tx.order.findUniqueOrThrow({
            where: { id: input.orderId },
            select: { customerId: true, customer: { select: { address: true, phone: true } } },
          });
          const fullAddress = [
            input.address,
            input.subDistrict,
            input.district,
            input.province,
            input.postalCode,
          ]
            .filter(Boolean)
            .join(" ");
          const fillPhone = !order.customer.phone;
          await tx.customer.update({
            where: { id: order.customerId },
            data: {
              address: fullAddress,
              // เบอร์เติมเฉพาะตอนโปรไฟล์ยังว่าง — ไม่ทับเบอร์หลักด้วยเบอร์ผู้รับของ
              ...(fillPhone ? { phone: input.phone } : {}),
            },
          });
          // ทับข้อมูลหลักลูกค้า = ต้องมี oldValue ให้ตรวจย้อน/กู้ได้ (pattern เดียวกับ customer.update)
          await createAuditLog(tx, {
            userId: ctx.userId,
            action: "UPDATE",
            entityType: "CUSTOMER",
            entityId: order.customerId,
            oldValue: { address: order.customer.address, phone: order.customer.phone },
            newValue: { address: fullAddress, ...(fillPhone ? { phone: input.phone } : {}) },
            reason: `บันทึกจากใบจัดส่ง ${delivery.id}`,
          });
        }

        await createAuditLog(tx, {
          userId: ctx.userId,
          action: "CREATE",
          entityType: "DELIVERY",
          entityId: delivery.id,
          newValue: {
            orderId: input.orderId,
            shippingMethod: input.shippingMethod,
            savedAsCustomerAddress: saveAsCustomerAddress,
          },
        });

        return delivery;
      });
    }),

  update: protectedProcedure
    .use(salesOrProduction)
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
    .use(salesOrProduction)
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
    .use(managerUp)
    .input(byIdInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.delivery.delete({ where: { id: input.id } });
    }),
});
