import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../trpc";
import { byIdInput } from "@/server/schemas";
import { badRequest } from "@/server/errors";
import { createAuditLog, createNotification } from "@/server/helpers";
import { advanceOrderForward } from "@/server/services/order-status";
import { normalizePhone } from "@/lib/phone";
import { isValidDeliveryTransition, type DeliveryStatus } from "@/lib/delivery-status";
import { DELIVERY_STATUS_LABELS } from "@/lib/status-config";

const salesOrProduction = requireRole("OWNER", "MANAGER", "SALES", "PRODUCTION_STAFF");
const managerUp = requireRole("OWNER", "MANAGER");

// คีย์รวมยอดต่อแถวนับ — แพ็ค/เหลือเทียบกันที่ ไซส์+สี (description ไว้โชว์)
const packKey = (size?: string | null, color?: string | null) =>
  `${(size ?? "").trim().toLowerCase()}|${(color ?? "").trim().toLowerCase()}`;

export const deliveryRouter = router({
  getByOrderId: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.delivery.findMany({
        where: { orderId: input.orderId },
        orderBy: { createdAt: "desc" },
        include: { lines: true },
      });
    }),

  // บริบทก่อนแพ็ค (FLOW-REDESIGN ก้อน 3) — นับยืนยันต่อไซส์: เหลือแพ็คเท่าไหร่ต่อแถว
  // (ยอดงาน − ที่อยู่ในใบส่งแล้ว ไม่นับใบตีกลับ) + ธง blind ship เด่นๆ ให้จอแพ็ค
  packContext: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const order = await ctx.prisma.order.findUniqueOrThrow({
        where: { id: input.orderId },
        select: {
          orderNumber: true,
          blindShip: true,
          blindShipSenderName: true,
          customer: { select: { name: true, company: true } },
          items: {
            select: {
              products: {
                select: {
                  description: true,
                  variants: { select: { size: true, color: true, quantity: true } },
                },
              },
            },
          },
          deliveries: {
            where: { status: { not: "RETURNED" } },
            select: { lines: { select: { size: true, color: true, qty: true } } },
          },
        },
      });

      const packed = new Map<string, number>();
      for (const d of order.deliveries) {
        for (const l of d.lines) {
          const k = packKey(l.size, l.color);
          packed.set(k, (packed.get(k) ?? 0) + l.qty);
        }
      }

      // รวมยอดสั่งต่อ ไซส์+สี (ออเดอร์มีหลายสินค้าไซส์ซ้ำได้ — ยุบเป็นแถวเดียว)
      const byKey = new Map<
        string,
        { description: string; size: string | null; color: string | null; ordered: number }
      >();
      for (const it of order.items) {
        for (const p of it.products) {
          for (const v of p.variants) {
            if (v.quantity <= 0) continue;
            const k = packKey(v.size, v.color);
            const row = byKey.get(k);
            if (row) row.ordered += v.quantity;
            else byKey.set(k, { description: p.description, size: v.size, color: v.color, ordered: v.quantity });
          }
        }
      }

      const lines = [...byKey.entries()].map(([k, row]) => ({
        ...row,
        packed: packed.get(k) ?? 0,
        remaining: Math.max(0, row.ordered - (packed.get(k) ?? 0)),
      }));

      return {
        orderNumber: order.orderNumber,
        blindShip: order.blindShip,
        blindShipSenderName: order.blindShipSenderName,
        customerName: order.customer.company || order.customer.name,
        lines,
        totalRemaining: lines.reduce((s, l) => s + l.remaining, 0),
      };
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
        // แพ็คนับยืนยันต่อไซส์ (ก้อน 3) — รายการต่อกล่อง บอกได้ว่ารอบนี้ส่งอะไรบ้าง
        // optional เพื่อไม่หักใบส่งแบบเดิม แต่ UI ใหม่ส่งมาเสมอ
        lines: z
          .array(
            z.object({
              description: z.string().max(200),
              size: z.string().max(50).optional(),
              color: z.string().max(50).optional(),
              qty: z.number().int().positive(),
            })
          )
          .max(100)
          .default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { saveAsCustomerAddress, lines, ...deliveryData } = input;

      return ctx.prisma.$transaction(async (tx) => {
        // กันแพ็คเกินยอดงานต่อไซส์ — lock แถวออเดอร์กันสองใบส่งนับพร้อมกัน
        if (lines.length > 0) {
          await tx.$queryRaw`SELECT id FROM orders WHERE id = ${input.orderId} FOR UPDATE`;
          const order = await tx.order.findUniqueOrThrow({
            where: { id: input.orderId },
            select: {
              items: {
                select: {
                  products: { select: { variants: { select: { size: true, color: true, quantity: true } } } },
                },
              },
              deliveries: {
                where: { status: { not: "RETURNED" } },
                select: { lines: { select: { size: true, color: true, qty: true } } },
              },
            },
          });
          const ordered = new Map<string, number>();
          for (const it of order.items)
            for (const p of it.products)
              for (const v of p.variants) {
                const k = packKey(v.size, v.color);
                ordered.set(k, (ordered.get(k) ?? 0) + v.quantity);
              }
          const packed = new Map<string, number>();
          for (const d of order.deliveries)
            for (const l of d.lines) {
              const k = packKey(l.size, l.color);
              packed.set(k, (packed.get(k) ?? 0) + l.qty);
            }
          for (const line of lines) {
            const k = packKey(line.size, line.color);
            const max = ordered.get(k);
            // แถวที่ไม่ตรงกับไซส์ในออเดอร์ (เช่น ของแถม/รายการพิเศษ) — ไม่กั้น แค่บันทึก
            if (max === undefined) continue;
            const already = packed.get(k) ?? 0;
            if (already + line.qty > max) {
              const label = [line.size, line.color].filter(Boolean).join("/") || line.description;
              badRequest(
                `แพ็คเกินยอดงาน: ${label} สั่ง ${max} ตัว อยู่ในใบส่งแล้ว ${already} — รอบนี้ใส่ได้อีกไม่เกิน ${Math.max(0, max - already)}`
              );
            }
            packed.set(k, already + line.qty);
          }
        }

        const delivery = await tx.delivery.create({
          data: { ...deliveryData, lines: { create: lines } },
        });

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
              ...(fillPhone ? { phone: normalizePhone(input.phone) } : {}),
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
      // B13: เขียนเลขพัสดุ "ทุกสถานะ" ที่ส่งมา — เดิมเขียนเฉพาะ block SHIPPED กรอกตอน
      // PREPARING หายเงียบ (delivery record ไม่เก็บ ทั้งที่ order.trackingNumber เขียนอยู่แล้ว)
      if (input.trackingNumber) updateData.trackingNumber = input.trackingNumber;

      // อัปเดตใบส่ง + เลขพัสดุ + ดันสถานะออเดอร์ = ก้อนเดียวกัน
      return ctx.prisma.$transaction(async (tx) => {
        // B13 state machine (เลียน outsource): อ่านสถานะเดิม → validate transition →
        // conditional write (updateMany where {id, status เดิม}) — สองจอเปลี่ยนสถานะใบเดียวกัน
        // พร้อมกัน คนช้า count=0 เจอ error ไม่ใช่เขียนทับ (validate เฉยๆ ไม่พอ กัน race)
        const current = await tx.delivery.findUniqueOrThrow({
          where: { id: input.id },
          select: { status: true, orderId: true },
        });
        const fromStatus = current.status as DeliveryStatus;
        const statusChanged = fromStatus !== input.status;
        if (!isValidDeliveryTransition(fromStatus, input.status)) {
          badRequest(
            `ใบส่งสถานะ "${DELIVERY_STATUS_LABELS[fromStatus] ?? fromStatus}" เปลี่ยนเป็น "${DELIVERY_STATUS_LABELS[input.status] ?? input.status}" ไม่ได้ — เดินทีละขั้น`
          );
        }
        // timestamp ตั้งเฉพาะตอน "เปลี่ยนสถานะจริง" มา SHIPPED/DELIVERED — self แก้เลขพัสดุ
        // (SHIPPED→SHIPPED) ต้องไม่ทับวันส่งเดิมเป็นวันนี้ (review B13 จับ · gate เหมือน side effect)
        if (statusChanged && input.status === "SHIPPED") updateData.shippedAt = new Date();
        if (statusChanged && input.status === "DELIVERED") updateData.deliveredAt = new Date();
        const written = await tx.delivery.updateMany({
          where: { id: input.id, status: current.status },
          data: updateData,
        });
        if (written.count === 0) {
          badRequest("มีคนอัปเดตใบส่งนี้ไปก่อนหน้านี้พอดี — รีเฟรชแล้วดูสถานะล่าสุดก่อน");
        }
        const delivery = await tx.delivery.findUniqueOrThrow({ where: { id: input.id } });

        // Also update order tracking number if provided
        if (input.trackingNumber) {
          await tx.order.update({
            where: { id: delivery.orderId },
            data: { trackingNumber: input.trackingNumber },
          });
        }

        // ── side effect เฉพาะตอน "สถานะเปลี่ยนจริง" (กด self เพื่อแก้เลขพัสดุ ไม่ดันออเดอร์/
        //    ไม่ยิงกระดิ่งซ้ำ — เดิมไม่มี guard นี้ RETURNED→RETURNED จะเตือนผู้จัดการซ้ำ) ──
        // ส่งของแล้ว → ดันออเดอร์เป็น "จัดส่งแล้ว" — เฉพาะตอนแพ็ค/พร้อมส่ง (ไม่กระโดดข้าม QC)
        // และเฉพาะเมื่อ "ทุกใบส่ง" ออกแล้ว — แบ่งส่งหลายกล่อง กล่องแรกออกห้ามเด้งทั้งใบ
        // (pattern เดียวกับ openProductions ใน finalizeProductionIfComplete · RETURNED ไม่นับค้าง)
        // จงใจไม่ปิดงานเอง: "เสร็จสิ้น" มีด่านบังคับวางบิลครบ ปล่อยให้คนกดปิดเอง
        if (statusChanged && (input.status === "SHIPPED" || input.status === "DELIVERED")) {
          const pendingSiblings = await tx.delivery.count({
            where: {
              orderId: delivery.orderId,
              status: { in: ["PENDING", "PREPARING"] },
            },
          });
          // แบ่งส่งแบบนับยืนยัน (ก้อน 3): เมื่อใบส่งของออเดอร์นี้มีรายการต่อกล่อง
          // ต้องส่งครบ "จำนวนตัว" ด้วย — กล่องแรกออกก่อนสร้างใบที่เหลือ ห้ามประกาศ
          // ทั้งออเดอร์ว่าส่งแล้ว (ใบส่งแบบเก่าไม่มีรายการ = นับจากจำนวนใบเหมือนเดิม)
          let qtyComplete = true;
          const shippedLines = await tx.deliveryLine.aggregate({
            where: { delivery: { orderId: delivery.orderId, status: { not: "RETURNED" } } },
            _sum: { qty: true },
          });
          const shippedQty = shippedLines._sum.qty ?? 0;
          if (shippedQty > 0) {
            const orderItems = await tx.orderItem.aggregate({
              where: { orderId: delivery.orderId },
              _sum: { totalQuantity: true },
            });
            const orderedQty = orderItems._sum.totalQuantity ?? 0;
            qtyComplete = orderedQty === 0 || shippedQty >= orderedQty;
          }
          if (pendingSiblings === 0 && qtyComplete) {
            await advanceOrderForward(tx, {
              orderId: delivery.orderId,
              target: "SHIPPED",
              changedBy: ctx.userId,
              onlyFrom: ["PACKING", "READY_TO_SHIP"],
            });
          }
        }

        // ของตีกลับ = งานด่วนที่ต้องมีคนตัดสิน (ซ่อม/ส่งใหม่/ลดหนี้) — กระดิ่งหาผู้จัดการทันที
        // ห้ามจบเงียบ (audit ข้อ 24 · ถอยออเดอร์กลับ QC ทำผ่านปุ่มสถานะ โดยผู้จัดการ+เหตุผล)
        if (statusChanged && input.status === "RETURNED") {
          const order = await tx.order.findUniqueOrThrow({
            where: { id: delivery.orderId },
            select: { id: true, orderNumber: true, title: true },
          });
          const managers = await tx.user.findMany({
            where: { role: { in: ["OWNER", "MANAGER"] }, isActive: true },
            select: { id: true },
          });
          for (const m of managers) {
            await createNotification(tx, {
              userId: m.id,
              type: "ORDER",
              title: `ของถูกตีกลับ — ${order.orderNumber}`,
              message: `${order.title} · ตัดสินใจ: ซ่อม/ส่งใหม่/ลดหนี้ (ถอยสถานะกลับตรวจ QC ได้จากหน้าออเดอร์)`,
              link: `/orders/${order.id}`,
              entityType: "ORDER",
              entityId: order.id,
            });
          }
        }

        return delivery;
      });
    }),

  delete: protectedProcedure
    .use(managerUp)
    .input(byIdInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.delivery.delete({ where: { id: input.id } });
    }),
});
