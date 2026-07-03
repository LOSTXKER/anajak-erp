import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireRole } from "../trpc";
import { getCustomerStatus } from "@/lib/order-status";
import { createAuditLog } from "@/server/helpers";
import { byIdInput } from "@/server/schemas";
import { badRequest } from "@/server/errors";
import { nextDocumentNumber, withDocNumberRetry } from "@/server/services/document-number";
import { computeQuotationTotals } from "@/server/services/pricing";
import { D, round2, moneyInput } from "@/server/services/money";
import { assertSalesWithinCreditLimit } from "@/server/services/receivables";
import { assertOrderTotalCoversBilled } from "@/server/services/payment-plan";
import { transitionOrder, addOrderRevision } from "@/server/services/order-status";
import { syncOrderStockReservation } from "@/server/services/stock-reservation";
// นิยาม "หมดอายุ" อยู่ที่ service เดียว (กัน drift กับลิงก์ยืนยันใบเสนอ ก้อน 4)
import { isQuotationExpired } from "@/server/services/quotation-confirm";
// เส้นทางสถานะใบเสนอ — validate ทุกการเปลี่ยน (Gate A3 · audit 2026-07-02)
import { canQuotationTransition, quotationStatusLabel } from "@/lib/quotation-status";

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
      // sweep ขี้เกียจ: ใบที่ส่งแล้วเลยอายุ → EXPIRED ตอนเปิดหน้า list (ไม่ต้องรอ cron —
      // ใบหมดอายุต้องไม่โชว์เป็น "ส่งแล้ว" ค้างให้คนเข้าใจผิดว่ายังยืนราคา · audit ข้อ 12)
      await ctx.prisma.quotation.updateMany({
        // validUntil เก็บเป็นเที่ยงคืนของวันนั้น — ใบยังใช้ได้ทั้งวัน validUntil
        // จึง sweep เฉพาะที่พ้นวันนั้นมาแล้วเต็มวัน (กันหมดอายุก่อนเวลาเพราะ timezone)
        where: { status: "SENT", validUntil: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        data: { status: "EXPIRED" },
      });

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
        // ออกใบเสนอ "จากออเดอร์" — ผูกกันตั้งแต่เกิด ตอนลูกค้าตกลงจะยืนยันออเดอร์เดิม
        // ไม่สร้างออเดอร์ซ้ำ (audit ข้อ 8 BLOCKER)
        orderId: z.string().optional(),
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

      // ผูกออเดอร์ได้เฉพาะออเดอร์ของลูกค้ารายเดียวกัน + ยังอยู่ช่วงเสนอราคา (ร่าง/สอบถาม)
      if (data.orderId) {
        const order = await ctx.prisma.order.findUniqueOrThrow({
          where: { id: data.orderId },
          select: { customerId: true, internalStatus: true, orderNumber: true },
        });
        if (order.customerId !== data.customerId) {
          badRequest("ออเดอร์ที่ผูกไม่ใช่ของลูกค้ารายนี้");
        }
        if (!["DRAFT", "INQUIRY"].includes(order.internalStatus)) {
          badRequest("ออกใบเสนอผูกออเดอร์ได้เฉพาะออเดอร์ที่ยังเป็นร่าง/สอบถาม");
        }
      }

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
              orderId: data.orderId,
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
              orderId: data.orderId ?? null,
            },
          });

          // ออเดอร์ที่ถูกผูกต้องมีรอยเท้า — เปิดหน้าออเดอร์แล้วรู้ว่ามีใบเสนอออกไปแล้ว
          if (data.orderId) {
            await addOrderRevision(tx, {
              orderId: data.orderId,
              changedBy: ctx.userId,
              changeType: "QUOTATION",
              description: `ออกใบเสนอราคา ${created.quotationNumber}`,
            });
          }

          return created;
        })
      );

      return quotation;
    }),

  // แก้รายการใบเสนอ — เฉพาะฉบับร่าง (ส่งแล้วต้องดึงกลับเป็นร่างก่อน ราคาที่ลูกค้าเห็นห้ามขยับเงียบ)
  // เดิมไม่มี endpoint แก้ items เลย พิมพ์ผิดต้องทิ้งทั้งใบ (audit ข้อ 11)
  updateItems: protectedProcedure
    .use(salesUp)
    .input(
      z.object({
        id: z.string(),
        items: z.array(quotationItemSchema).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.$transaction(async (tx) => {
        // ล็อกแถวก่อนเช็คสถานะ — check-then-act ใน tx ยังหลุดได้ถ้าสถานะขยับระหว่างทาง
        // (เช่น อีกจอกด "ส่งให้ลูกค้า" พร้อมกัน) — pattern เดียวกับ lockInvoiceRow ฝั่ง billing
        await tx.$queryRaw`SELECT id FROM quotations WHERE id = ${input.id} FOR UPDATE`;
        const existing = await tx.quotation.findUniqueOrThrow({
          where: { id: input.id },
          select: { status: true, discount: true, tax: true },
        });
        if (existing.status !== "DRAFT") {
          badRequest(
            'แก้รายการได้เฉพาะใบเสนอฉบับร่าง — ใบที่ส่งแล้วให้กดเปลี่ยนสถานะกลับเป็น "ฉบับร่าง" ก่อน'
          );
        }

        const totals = computeQuotationTotals({
          items: input.items,
          discount: existing.discount,
          tax: existing.tax,
        });

        await tx.quotationItem.deleteMany({ where: { quotationId: input.id } });
        const updated = await tx.quotation.update({
          where: { id: input.id },
          data: {
            subtotal: totals.subtotal,
            totalAmount: totals.totalAmount,
            items: {
              create: input.items.map((item, index) => ({
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
          include: { items: true },
        });

        await createAuditLog(tx, {
          userId: ctx.userId,
          action: "UPDATE",
          entityType: "QUOTATION",
          entityId: input.id,
          newValue: { itemCount: input.items.length, totalAmount: updated.totalAmount },
          reason: "แก้รายการใบเสนอ (ฉบับร่าง)",
        });

        return updated;
      });
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

      const existing = await ctx.prisma.quotation.findUniqueOrThrow({
        where: { id },
        include: { items: true },
      });
      // ราคา/เงื่อนไขที่ลูกค้าถือลิงก์ยืนยันอยู่ต้องนิ่ง — แก้ได้เฉพาะร่าง (Gate A3:
      // เดิมแก้ discount/tax ได้ทุกสถานะรวม SENT/CONVERTED = แก้ราคาใต้มือลูกค้าเงียบๆ)
      if (existing.status !== "DRAFT") {
        badRequest(
          'แก้ใบเสนอได้เฉพาะฉบับร่าง — ใบที่ส่งแล้วให้กด "ดึงกลับเป็นร่าง" ก่อน'
        );
      }

      // discount/tax เปลี่ยน → ยอดรวมต้องคำนวณใหม่ผ่านสูตรกลางเสมอ (เดิมเขียนตรง ยอดค้าง)
      let totalsData: Record<string, number> = {};
      if (data.discount !== undefined || data.tax !== undefined) {
        const totals = computeQuotationTotals({
          items: existing.items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice })),
          discount: data.discount ?? existing.discount,
          tax: data.tax ?? existing.tax,
        });
        totalsData = { subtotal: totals.subtotal, totalAmount: totals.totalAmount };
      }

      // ผูกเงื่อนไข DRAFT ตอนเขียน — ปิด race ที่เช็คผ่านแล้วสถานะเพิ่งขยับ (เขียนแบบ
      // conditional เหมือน updateStatus ด้านล่าง — check-then-act เฉยๆ ยังมีช่อง)
      const res = await ctx.prisma.quotation.updateMany({
        where: { id, status: "DRAFT" },
        data: {
          ...data,
          ...totalsData,
          validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        },
      });
      if (res.count === 0) {
        badRequest("ใบเสนอเพิ่งถูกเปลี่ยนสถานะ — รีเฟรชหน้าแล้วลองใหม่");
      }
      return ctx.prisma.quotation.findUniqueOrThrow({ where: { id } });
    }),

  updateStatus: protectedProcedure
    .use(salesUp)
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"]),
        rejectedReason: z.string().optional(),
        // สถานะที่จอผู้กดเห็นตอนกดปุ่ม — ถ้าของจริงขยับไปแล้ว (เช่น ลูกค้าเพิ่งกดยืนยัน
        // ผ่านลิงก์) ห้ามทำต่อเงียบ ให้คนตัดสินใหม่จากข้อมูลสด
        expectedStatus: z
          .enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED"])
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.quotation.findUniqueOrThrow({
        where: { id: input.id },
        select: { status: true, validUntil: true },
      });

      if (input.expectedStatus && existing.status !== input.expectedStatus) {
        badRequest(
          `สถานะใบเสนอเปลี่ยนเป็น "${quotationStatusLabel(existing.status)}" แล้ว — รีเฟรชหน้าเพื่อดูข้อมูลล่าสุดก่อนทำรายการ`
        );
      }

      // กดซ้ำ/สองแท็บยิงสถานะเดิม = no-op (ไม่ error ให้งง)
      if (existing.status === input.status) {
        return ctx.prisma.quotation.findUniqueOrThrow({ where: { id: input.id } });
      }

      // เส้นทางสถานะบังคับที่ server (Gate A3) — เดิมเขียนตรง: CONVERTED ถูกดึงกลับ
      // ACCEPTED แล้วกด convert ซ้ำ = ออเดอร์ซ้อนได้
      if (!canQuotationTransition(existing.status, input.status)) {
        badRequest(
          `เปลี่ยนสถานะใบเสนอจาก "${quotationStatusLabel(existing.status)}" เป็น "${quotationStatusLabel(input.status)}" ไม่ได้` +
            (existing.status === "CONVERTED"
              ? " — ใบนี้แปลงเป็นออเดอร์แล้ว แก้ไขที่ออเดอร์แทน"
              : "")
        );
      }

      // ใบหมดอายุ: รับเป็น "ตกลง" หรือส่งซ้ำไม่ได้ — ราคายืนถึงแค่ validUntil
      // ต้องแก้วันที่ (ยืนราคาใหม่) ก่อน ไม่งั้นส่งปุ๊บโดน sweep ดีดกลับ EXPIRED ทันที
      if (
        (input.status === "ACCEPTED" || input.status === "SENT") &&
        isQuotationExpired(existing.validUntil)
      ) {
        badRequest(
          "ใบเสนอนี้หมดอายุแล้ว — แก้วันที่ \"ใช้ได้ถึง\" (ยืนราคาใหม่) ก่อนส่ง/บันทึกว่าลูกค้าตกลง"
        );
      }

      const updateData: Record<string, unknown> = { status: input.status };
      if (input.status === "SENT") updateData.sentAt = new Date();
      if (input.status === "ACCEPTED") updateData.acceptedAt = new Date();
      if (input.status === "REJECTED") {
        updateData.rejectedAt = new Date();
        updateData.rejectedReason = input.rejectedReason;
        // ใบที่เคยตกลงแล้วถูกปฏิเสธ — ล้างรอย "ตกลงเมื่อ" ไม่ให้ค้างคู่กัน
        updateData.acceptedAt = null;
      }
      // ดึงกลับร่าง = ล้างรอยตัดสิน+รอยส่งเดิมทั้งหมด — sentAt เป็นด่านของ file route
      // (เปิด PDF) และการนับ "ส่งแล้ว" บนลิงก์สถานะลูกค้า ใบร่างที่กำลังแก้ราคาห้ามหลุด
      if (input.status === "DRAFT") {
        updateData.sentAt = null;
        updateData.acceptedAt = null;
        updateData.rejectedAt = null;
        updateData.rejectedReason = null;
      }

      // เขียนแบบมีเงื่อนไขสถานะเดิม — สองจอกดพร้อมกัน คนแพ้ race ได้ error ชัด ไม่เขียนทับ
      const res = await ctx.prisma.quotation.updateMany({
        where: { id: input.id, status: existing.status },
        data: updateData,
      });
      if (res.count === 0) {
        badRequest("สถานะใบเสนอเพิ่งถูกเปลี่ยนโดยคนอื่น — รีเฟรชหน้าแล้วลองใหม่");
      }

      return ctx.prisma.quotation.findUniqueOrThrow({ where: { id: input.id } });
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
      // ราคายืนถึงแค่ validUntil — แปลงหลังหมดอายุต้องยืนราคาใหม่ก่อน (audit ข้อ 12)
      if (isQuotationExpired(quotation.validUntil)) {
        badRequest(
          "ใบเสนอนี้หมดอายุแล้ว — แก้วันที่ \"ใช้ได้ถึง\" (ยืนราคาใหม่) ก่อนแปลงเป็นออเดอร์"
        );
      }

      // ออเดอร์ที่ผูกไว้ (ถ้ามี) — ตกลงแล้วยืนยัน "ใบเดิม" ไม่สร้างซ้ำ (audit ข้อ 8 BLOCKER:
      // เดิมเส้นทาง เปิดงาน→ออกใบเสนอ→แปลง ได้ออเดอร์ 2 ใบ + สถิติลูกค้านับซ้ำ)
      const linkedOrder = quotation.orderId
        ? await ctx.prisma.order.findUnique({
            where: { id: quotation.orderId },
            include: { items: { select: { id: true } } },
          })
        : null;

      // เทอมชำระต้องไหลตาม ไม่งั้นด่าน "เรียกมัดจำก่อนเริ่มงาน" โดนข้ามเงียบ (audit ข้อ 9)
      const customer = await ctx.prisma.customer.findUniqueOrThrow({
        where: { id: quotation.customerId },
        select: { defaultPaymentTerms: true },
      });

      // ด่านวงเงินเดียวกับการยืนยันออเดอร์ — ใช้ยอดที่จะผูกพันจริง
      // (ออเดอร์ผูกที่มีรายการแล้ว = ยอดออเดอร์ · นอกนั้น = ยอดใบเสนอ)
      const commitAmount =
        linkedOrder && linkedOrder.items.length > 0
          ? linkedOrder.totalAmount
          : quotation.totalAmount;
      await assertSalesWithinCreditLimit(ctx.prisma, {
        userRole: ctx.userRole,
        customerId: quotation.customerId,
        additionalAmount: commitAmount,
        actionLabel: "แปลงเป็นออเดอร์",
      });

      // ใบเสนอราคาเก็บภาษีเป็น "บาท" แต่ order ใช้อัตรา % — แปลงอัตรากลับจากยอดจริง
      // ไม่งั้น order เกิดมาขัดสูตร A (totalAmount รวมภาษีแต่ taxRate=0) แล้วพอแก้รายการ
      // ครั้งแรก ระบบ recompute ด้วย taxRate=0 → เงินภาษีหายเงียบ
      const taxBase = D(quotation.subtotal).minus(quotation.discount);
      const derivedTaxRate =
        quotation.tax > 0 && taxBase.gt(0)
          ? round2(D(quotation.tax).div(taxBase).times(100))
          : D(0);

      // โครงรายการจากใบเสนอ (ใช้ทั้งเส้นสร้างใหม่ และเส้นเติมออเดอร์ผูกที่ยังไม่มีรายการ)
      const skeletonItems = quotation.items.map((item, index) => ({
        sortOrder: index,
        // รายการจากใบเสนอถูกบีบจนไม่เหลือโครงลายพิมพ์ — ระบุภาษีชัดเป็นจ้างทำของ
        // (งานใบเสนอเกือบทั้งหมดคืองานพิมพ์ · กัน updateItems derive เป็นขายสินค้าเงียบๆ)
        taxLineType: "HIRE_OF_WORK" as const,
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
      }));

      const convertedOrder = await withDocNumberRetry(() =>
        ctx.prisma.$transaction(async (tx) => {
          // กันกดแปลงซ้ำ/สองจอพร้อมกัน — flip สถานะแบบมีเงื่อนไขใน tx คนช้าเจอ error
          // ไม่ใช่ได้ออเดอร์คู่ (audit ข้อ 13)
          const flipped = await tx.quotation.updateMany({
            where: { id: input.id, status: "ACCEPTED" },
            data: { status: "CONVERTED" },
          });
          if (flipped.count === 0) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "ใบเสนอนี้ถูกแปลงเป็นออเดอร์ไปแล้ว — รีเฟรชเพื่อดูออเดอร์",
            });
          }

          // ----- เส้นทางออเดอร์ผูก: ยืนยันใบเดิม -----
          if (linkedOrder) {
            // ออเดอร์ยังไม่มีรายการ → เติมโครงจากใบเสนอ + ยอด/ภาษีตามใบเสนอ
            if (linkedOrder.items.length === 0) {
              // เพดานขาที่สอง (B9): ออเดอร์เปิดเบา (fees ล้วน) ออกบิลได้ก่อนแปลง —
              // ยอดใบเสนอที่ต่อรองลงต้องไม่ต่ำกว่าบิลที่ออกแล้ว (review B9 จับช่องนี้)
              await assertOrderTotalCoversBilled(tx, {
                orderId: linkedOrder.id,
                newTotal: quotation.totalAmount,
              });
              await tx.order.update({
                where: { id: linkedOrder.id },
                data: {
                  title: linkedOrder.title || quotation.title,
                  discount: quotation.discount,
                  subtotalItems: quotation.subtotal,
                  taxRate: derivedTaxRate.toNumber(),
                  taxAmount: quotation.tax,
                  totalAmount: quotation.totalAmount,
                  paymentTerms: linkedOrder.paymentTerms ?? customer.defaultPaymentTerms,
                  items: { create: skeletonItems },
                },
              });
            }
            // ยืนยันผ่าน state machine (DRAFT ต้องผ่าน INQUIRY ก่อน — สองก้าว valid ทั้งคู่)
            if (linkedOrder.internalStatus === "DRAFT") {
              await transitionOrder(tx, {
                orderId: linkedOrder.id,
                to: "INQUIRY",
                changedBy: ctx.userId,
              });
            }
            await transitionOrder(tx, {
              orderId: linkedOrder.id,
              to: "CONFIRMED",
              changedBy: ctx.userId,
              revision: {
                changeType: "STATUS",
                description: `ลูกค้าตกลงตามใบเสนอ ${quotation.quotationNumber} — ยืนยันออเดอร์`,
              },
            });
            // ไม่ increment totalOrders — ออเดอร์ใบนี้ถูกนับตอนเปิดแล้ว (กันสถิตินับซ้ำ)
            await tx.customer.update({
              where: { id: quotation.customerId },
              data: { lastOrderAt: new Date() },
            });

            return tx.order.findUniqueOrThrow({ where: { id: linkedOrder.id } });
          }

          // ----- เส้นทางเดิม: ใบเสนอลอย (ไม่ผูกออเดอร์) → สร้างออเดอร์ใหม่ -----
          const orderNumber = await nextDocumentNumber(tx, "ORDER");
          const order = await tx.order.create({
            data: {
              orderNumber,
              orderType: "CUSTOM",
              channel: "LINE",
              customerId: quotation.customerId,
              createdById: ctx.userId,
              customerStatus: getCustomerStatus("CONFIRMED"),
              internalStatus: "CONFIRMED",
              title: quotation.title,
              description: quotation.description,
              discount: quotation.discount,
              subtotalItems: quotation.subtotal,
              taxRate: derivedTaxRate.toNumber(),
              taxAmount: quotation.tax,
              totalAmount: quotation.totalAmount,
              paymentTerms: customer.defaultPaymentTerms,
              notes:
                "สร้างจากใบเสนอ — รายการยังเป็นโครงจากใบเสนอ (ไม่มีไซส์/ลายจริง) แก้รายการก่อนเข้าผลิต",
              items: { create: skeletonItems },
            },
          });

          await tx.quotation.update({
            where: { id: input.id },
            data: { orderId: order.id },
          });

          await tx.customer.update({
            where: { id: quotation.customerId },
            data: { totalOrders: { increment: 1 }, lastOrderAt: new Date() },
          });

          await addOrderRevision(tx, {
            orderId: order.id,
            changedBy: ctx.userId,
            changeType: "STATUS",
            description: `สร้างจากใบเสนอ ${quotation.quotationNumber} (ลูกค้าตกลง)`,
          });

          return order;
        })
      );

      // ออเดอร์ยืนยันแล้ว → จองของจากสต๊อค (นอก tx · ไม่ block — ใบเสนอที่ผูกออเดอร์ซึ่งมี
      // รายการหยิบสต๊อคจริงต้องถูกจอง · ออเดอร์โครงจากใบเสนอลอยไม่มีของสต๊อค = no-op)
      await syncOrderStockReservation(ctx.prisma, {
        orderId: convertedOrder.id,
        changedBy: ctx.userId,
      });

      return convertedOrder;
    }),
});
