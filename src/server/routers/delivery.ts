import { z } from "zod";
import { router, protectedProcedure, requirePermission } from "../trpc";
import { byIdInput } from "@/server/schemas";
import { badRequest } from "@/server/errors";
import { createAuditLog, createNotification } from "@/server/helpers";
import { advanceOrderForward } from "@/server/services/order-status";
import { lockOrderRow } from "@/server/services/order-cost";
import {
  assertOrderPackingReadyToShip,
  assertV2FinalPackReadyToShip,
  findPackingOverflow,
  getOrderPackingEvidence,
  packingEvidenceFromOrder,
  unallocatedDeliveryLinesFromFinalPack,
} from "@/server/services/packing-readiness";
import { hasPermission } from "@/lib/permissions";
import { normalizePhone } from "@/lib/phone";
import { addressLine, optionalAddressLine, optionalPostalCode } from "@/lib/address-schema";
import { isValidDeliveryTransition, type DeliveryStatus } from "@/lib/delivery-status";
import { DELIVERY_STATUS_LABELS } from "@/lib/status-config";

// Production V2 แยก “แพ็กที่ Station” ออกจาก “สร้างขนส่ง/เลขพัสดุ/ส่งของ”
// ชัดเจน: ฝ่ายผลิตใช้ manufacturing commands เท่านั้น ส่วน writer ใบส่งเป็นงานออฟฟิศ
const shippingOffice = requirePermission("ship_orders");
const managerUp = requirePermission("supervise_operations");

const deliveryCreateResultSelect = {
  id: true,
  orderId: true,
  recipientName: true,
  phone: true,
  address: true,
  subDistrict: true,
  district: true,
  province: true,
  postalCode: true,
  shippingMethod: true,
  trackingNumber: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

// B4 (เบสเคาะ 2026-07-06): ของออกจากโรงงานได้เฉพาะงานที่เลย QC มาแล้ว — เดิม UI ซ่อน
// ปุ่มไว้แต่ยิง API ตรงสร้าง/ส่งใบส่งได้ตั้งแต่ยังไม่นับของ (review B4 จับเป็นหนี้ PARTIAL)
// COMPLETED อยู่ในลิสต์: เคสของตีกลับหลังปิดงาน ต้องเปิดใบส่งรอบใหม่ได้
const POST_QC_ORDER_STATUSES: readonly string[] = [
  "PACKING",
  "READY_TO_SHIP",
  "SHIPPED",
  "COMPLETED",
];

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
            select: {
              status: true,
              lines: { select: { description: true, size: true, color: true, qty: true } },
            },
          },
        },
      });
      const evidence = packingEvidenceFromOrder(order);
      const lines = evidence.lines.map(
        ({ description, size, color, ordered, packed, remaining }) => ({
          description,
          size,
          color,
          ordered,
          packed,
          remaining,
        }),
      );

      return {
        orderNumber: order.orderNumber,
        blindShip: order.blindShip,
        blindShipSenderName: order.blindShipSenderName,
        customerName: order.customer.company || order.customer.name,
        lines,
        totalRemaining: evidence.totalRemaining,
      };
    }),

  create: protectedProcedure
    .use(shippingOffice)
    .input(
      z.object({
        orderId: z.string(),
        // ที่อยู่บนใบส่ง = ที่อยู่ที่ของจะไปจริง — บังคับ 3 ช่องแรกเหมือนเดิม
        // + ด่านความยาว/ไปรษณีย์ชุดเดียวกับ order (เบสสั่ง 2026-08-12) · เบอร์ normalize
        recipientName: addressLine(120).min(1, "กรุณาระบุชื่อผู้รับ"),
        phone: z
          .string()
          .trim()
          .min(1, "กรุณาระบุเบอร์ผู้รับ")
          .max(30)
          .transform((v) => normalizePhone(v)),
        address: addressLine(300).min(1, "กรุณาระบุที่อยู่"),
        subDistrict: optionalAddressLine(120),
        district: optionalAddressLine(120),
        province: optionalAddressLine(120),
        postalCode: optionalPostalCode,
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
      const canHandleDeliveryMoney = hasPermission(
        ctx.userRole,
        ctx.permissionOverrides,
        "see_order_money",
      );
      if (!canHandleDeliveryMoney && (input.shippingCost !== 0 || input.isPaid)) {
        badRequest("ฝ่ายผลิตบันทึกค่าจัดส่ง/สถานะชำระเงินไม่ได้");
      }
      const {
        saveAsCustomerAddress,
        lines: requestedLines,
        ...deliveryData
      } = input;

      return ctx.prisma.$transaction(async (tx) => {
        // ล็อกก่อนอ่านสถานะ/ยอดแพ็ค: สร้างใบส่งพร้อมกับกดพร้อมส่งหรือสร้างอีกกล่อง
        // ต้องเห็นหลักฐานก้อนเดียวกัน และใบส่งเปล่าก็เป็น evidence สำหรับงานไม่มี variant
        await lockOrderRow(tx, input.orderId);
        const order = await tx.order.findUniqueOrThrow({
          where: { id: input.orderId },
          select: {
            internalStatus: true,
            items: {
              select: {
                products: {
                  select: {
                    description: true,
                    variants: {
                      select: { size: true, color: true, quantity: true },
                    },
                  },
                },
              },
            },
            deliveries: {
              select: {
                status: true,
                lines: { select: { description: true, size: true, color: true, qty: true } },
              },
            },
          },
        });
        if (!POST_QC_ORDER_STATUSES.includes(order.internalStatus)) {
          badRequest(
            "ออเดอร์ยังไม่ผ่านตรวจ QC/ยังไม่ถึงขั้นแพ็ค — สร้างใบส่งไม่ได้ (นับ QC แล้วเดินสถานะเข้าแพ็คก่อน)"
          );
        }

        // V2 ใช้ Final Pack ledger เป็นหลักฐานแพ็กจริง ส่วน Delivery เป็นการจัดสรร
        // ของที่แพ็กแล้วไปยังรอบส่งเท่านั้น. ถ้าหน้าเก่าไม่ส่ง lines มา ให้เติมยอด
        // ที่ยังไม่ได้จัดลงใบส่งจาก ledger โดยไม่ให้ผู้ใช้นับซ้ำอีกบ้านหนึ่ง.
        const packingEvidence = packingEvidenceFromOrder(order);
        const finalPackLedger = await assertV2FinalPackReadyToShip(
          tx,
          input.orderId,
        );
        const lines =
          finalPackLedger && requestedLines.length === 0
            ? unallocatedDeliveryLinesFromFinalPack(
                finalPackLedger,
                packingEvidence,
              )
            : requestedLines;
        if (finalPackLedger && lines.length === 0) {
          badRequest(
            "ยอด Final Pack ถูกจัดลงใบส่งครบแล้ว — ไม่มีสินค้าเหลือสำหรับใบส่งใหม่",
          );
        }

        // กันแพ็คเกินยอดงานต่อไซส์ด้วย count/key ชุดเดียวกับ packContext และด่านพร้อมส่ง
        if (lines.length > 0) {
          const overflow = findPackingOverflow(
            packingEvidence,
            lines,
          );
          if (overflow) {
            const label =
              [overflow.line.size, overflow.line.color].filter(Boolean).join("/") ||
              overflow.line.description;
            badRequest(
              `แพ็คเกินยอดงาน: ${label} สั่ง ${overflow.ordered} ตัว อยู่ในใบส่งแล้ว ${overflow.alreadyPacked} — รอบนี้ใส่ได้อีกไม่เกิน ${overflow.remaining}`
            );
          }
        }

        const delivery = await tx.delivery.create({
          data: { ...deliveryData, lines: { create: lines } },
          select: deliveryCreateResultSelect,
        });

        // จงใจให้เฉพาะ role ออฟฟิศที่สร้างใบส่งได้เขียนผ่านช่องนี้ — ผู้ประสานงาน
        // เป็นคนได้ที่อยู่มา · ขอบเขตแคบ: **เติมเฉพาะตอนโปรไฟล์ยังว่าง** · มี audit เต็ม
        //
        // เดิมช่องนี้ทับที่อยู่เดิมได้เสมอ (เบสสั่งปิด 2026-08-12): customer.address คือที่อยู่
        // สำรองบนใบกำกับภาษี/ใบเสนอราคา/ใบวางบิล (`billingAddress || address`) → ที่อยู่
        // ปลายทางของรอบส่งเดียว (ลูกค้าของลูกค้า / ไซต์งานชั่วคราว) ไหลไปโผล่บนเอกสารภาษี
        // ใบถัดไปโดยไม่มีใครรู้ · เปลี่ยนที่อยู่ประจำต้องทำที่หน้าลูกค้าซึ่งเห็นผลกระทบครบ
        if (saveAsCustomerAddress) {
          const order = await tx.order.findUniqueOrThrow({
            where: { id: input.orderId },
            select: { customerId: true, customer: { select: { address: true, phone: true } } },
          });
          const fillAddress = !order.customer.address?.trim();
          const fillPhone = !order.customer.phone;
          const fullAddress = [
            input.address,
            input.subDistrict,
            input.district,
            input.province,
            input.postalCode,
          ]
            .filter(Boolean)
            .join(" ");
          // ทั้งสองช่องมีของอยู่แล้ว = ไม่มีอะไรต้องเติม (UI ปิดช่องไว้แล้ว — นี่คือด่าน server)
          if (fillAddress || fillPhone) {
            await tx.customer.update({
              where: { id: order.customerId },
              data: {
                ...(fillAddress ? { address: fullAddress } : {}),
                // เบอร์เติมเฉพาะตอนโปรไฟล์ยังว่าง — ไม่ทับเบอร์หลักด้วยเบอร์ผู้รับของ
                ...(fillPhone ? { phone: normalizePhone(input.phone) } : {}),
              },
            });
            // แตะข้อมูลหลักลูกค้า = ต้องมี oldValue ให้ตรวจย้อน/กู้ได้ (pattern เดียวกับ customer.update)
            await createAuditLog(tx, {
              userId: ctx.userId,
              action: "UPDATE",
              entityType: "CUSTOMER",
              entityId: order.customerId,
              oldValue: { address: order.customer.address, phone: order.customer.phone },
              newValue: {
                ...(fillAddress ? { address: fullAddress } : {}),
                ...(fillPhone ? { phone: input.phone } : {}),
              },
              reason: `เติมจากใบจัดส่ง ${delivery.id} (โปรไฟล์ยังว่าง)`,
            });
          }
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
    .use(shippingOffice)
    .input(
      byIdInput.extend({
        recipientName: optionalAddressLine(120),
        phone: z
          .string()
          .trim()
          .max(30)
          .optional()
          .transform((v) => (v ? normalizePhone(v) : v)),
        address: optionalAddressLine(300),
        subDistrict: optionalAddressLine(120),
        district: optionalAddressLine(120),
        province: optionalAddressLine(120),
        postalCode: optionalPostalCode,
        shippingMethod: z.string().optional(),
        trackingNumber: z.string().optional(),
        shippingCost: z.number().optional(),
        isPaid: z.boolean().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const canHandleDeliveryMoney = hasPermission(
        ctx.userRole,
        ctx.permissionOverrides,
        "see_order_money",
      );
      if (
        !canHandleDeliveryMoney &&
        (data.shippingCost !== undefined || data.isPaid !== undefined)
      ) {
        badRequest("ฝ่ายผลิตแก้ค่าจัดส่ง/สถานะชำระเงินไม่ได้");
      }
      // แก้ใบส่งของต้องทิ้งร่องรอย (เบสสั่ง 2026-08-12) — เดิม update ตรงไม่มี audit เลย
      // ต่างจาก create ที่มีครบ · ที่อยู่/เลขพัสดุบนใบที่ส่งออกไปแล้วถูกแก้ได้เงียบๆ
      // แล้วไล่ไม่ได้ว่าใครแก้ตอนไหน (ของไปผิดบ้าน = ต้องสืบย้อนได้)
      return ctx.prisma.$transaction(async (tx) => {
        const before = await tx.delivery.findUniqueOrThrow({
          where: { id },
          select: {
            recipientName: true,
            phone: true,
            address: true,
            subDistrict: true,
            district: true,
            province: true,
            postalCode: true,
            shippingMethod: true,
            trackingNumber: true,
            shippingCost: true,
            isPaid: true,
            notes: true,
            status: true,
          },
        });

        const updated = await tx.delivery.update({ where: { id }, data });

        // เก็บเฉพาะช่องที่เปลี่ยนจริง — log ทั้งใบทุกครั้งอ่านไม่ออกว่าอะไรขยับ
        const changed = Object.entries(data).filter(
          ([k, v]) => v !== undefined && String(before[k as keyof typeof before] ?? "") !== String(v ?? "")
        );
        if (changed.length > 0) {
          await createAuditLog(tx, {
            userId: ctx.userId,
            action: "UPDATE",
            entityType: "DELIVERY",
            entityId: id,
            oldValue: Object.fromEntries(
              changed.map(([k]) => [k, before[k as keyof typeof before]])
            ),
            newValue: Object.fromEntries(changed),
            // ส่งของออกไปแล้วยังแก้ได้ (ของจริงมีเคสแก้เลขพัสดุ/ที่อยู่ตามที่ขนส่งแจ้ง)
            // แต่ต้องอ่านออกจาก log ว่าแก้ตอนใบอยู่สถานะไหน
            reason: `แก้ใบจัดส่งขณะสถานะ ${before.status}`,
          });
        }

        return updated;
      });
    }),

  updateStatus: protectedProcedure
    .use(shippingOffice)
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
        if (statusChanged) {
          // ใช้ lock ลำดับเดียวกับสร้างใบส่ง/กดพร้อมส่ง เพื่อไม่ให้ RETURNED แทรกหลังอ่าน evidence
          await lockOrderRow(tx, current.orderId);
        }
        // ด่าน B4 ขาส่ง: ของออกจริง (SHIPPED/DELIVERED) ได้เฉพาะออเดอร์ที่เลย QC —
        // กันเคสออเดอร์ถูกถอยกลับไปแก้งานแล้วยังกดส่งใบเดิมออก
        // ยกเว้น SHIPPED→DELIVERED: ของออกไปแล้วจริง การบันทึก "ถึงแล้ว" เป็นการจดตาม
        // ความจริง — ห้าม block แม้ออเดอร์ถูกถอยกลับไปแก้งานระหว่างทาง (review จับ)
        if (
          statusChanged &&
          (input.status === "SHIPPED" ||
            (input.status === "DELIVERED" && fromStatus !== "SHIPPED"))
        ) {
          const orderStatusRow = await tx.order.findUniqueOrThrow({
            where: { id: current.orderId },
            select: { internalStatus: true },
          });
          if (!POST_QC_ORDER_STATUSES.includes(orderStatusRow.internalStatus)) {
            badRequest(
              "ออเดอร์ยังไม่ผ่านตรวจ QC/ถูกถอยกลับไปแก้งาน — ส่งของได้เมื่อออเดอร์กลับถึงขั้นแพ็ค/พร้อมส่ง"
            );
          }
          const finalPackLedger = await assertV2FinalPackReadyToShip(
            tx,
            current.orderId,
          );
          if (finalPackLedger) {
            const currentLineCount = await tx.deliveryLine.count({
              where: { deliveryId: input.id },
            });
            if (currentLineCount === 0) {
              const packingEvidence = await getOrderPackingEvidence(
                tx,
                current.orderId,
              );
              const lines = unallocatedDeliveryLinesFromFinalPack(
                finalPackLedger,
                packingEvidence,
              );
              if (lines.length === 0) {
                badRequest(
                  "ใบส่งนี้ยังไม่มีรายการสินค้า และยอด Final Pack ถูกจัดลงใบส่งอื่นครบแล้ว",
                );
              }
              await tx.deliveryLine.createMany({
                data: lines.map((line) => ({
                  deliveryId: input.id,
                  description: line.description,
                  size: line.size ?? null,
                  color: line.color ?? null,
                  qty: line.qty,
                })),
              });
            }
          }
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

        // READY_TO_SHIP ต้องมีหลักฐานแพ็คครบคงอยู่เสมอ: ตีกลับใบเดียวได้เมื่อยังมี
        // ใบอื่นที่นับครบแทนเท่านั้น ไม่งั้น rollback การเปลี่ยนใบส่งทั้งก้อน
        if (statusChanged && input.status === "RETURNED") {
          const orderState = await tx.order.findUniqueOrThrow({
            where: { id: delivery.orderId },
            select: { internalStatus: true },
          });
          if (orderState.internalStatus === "READY_TO_SHIP") {
            await assertOrderPackingReadyToShip(tx, delivery.orderId);
          }
        }

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
          // ใช้ evidence ต่อไซส์/สีชุดเดียวกับด่านพร้อมส่ง — ของแถมจึงนับแทนไซส์ที่ขาดไม่ได้
          const evidence = await getOrderPackingEvidence(tx, delivery.orderId);
          if (pendingSiblings === 0 && evidence.isReadyToShip) {
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
      return ctx.prisma.$transaction(async (tx) => {
        const current = await tx.delivery.findUniqueOrThrow({
          where: { id: input.id },
          select: { orderId: true },
        });
        await lockOrderRow(tx, current.orderId);
        const deleted = await tx.delivery.delete({ where: { id: input.id } });
        const orderState = await tx.order.findUniqueOrThrow({
          where: { id: current.orderId },
          select: { internalStatus: true },
        });
        if (orderState.internalStatus === "READY_TO_SHIP") {
          await assertOrderPackingReadyToShip(tx, current.orderId);
        }
        return deleted;
      });
    }),
});
