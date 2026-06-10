import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireRole } from "../trpc";
import { getCustomerStatus, getInitialStatus } from "@/lib/order-status";
import { createAuditLog } from "@/server/helpers";
import { byIdInput } from "@/server/schemas";
import { getStartOfMonth } from "@/lib/date-utils";
import { badRequest } from "@/server/errors";
import { nextDocumentNumber } from "@/server/services/document-number";
import { priceOrderItems, computeOrderTotals, type PricedItem } from "@/server/services/pricing";
import { transitionOrder } from "@/server/services/order-status";
import { aggToNumber, D } from "@/server/services/money";
import { PAYMENT_TERMS_VALUES } from "@/lib/payment-terms";
import {
  assertSalesWithinCreditLimit,
  UNCOMMITTED_STATUSES,
} from "@/server/services/receivables";
import type { InternalStatus, OrderType, TaxLineType } from "@prisma/client";

// สร้าง/แก้ออเดอร์+เงินในใบ = งานขายขึ้นไปตามตาราง RBAC §7
const salesUp = requireRole("OWNER", "MANAGER", "SALES");
const orderOps = requireRole("OWNER", "MANAGER", "SALES", "PRODUCTION_STAFF");

// PRODUCTION_STAFF เปลี่ยนได้เฉพาะสถานะฝั่งผลิต-จัดส่ง — ปิดงาน/ยกเลิก/ฝั่งขาย-ออกแบบไม่ได้
const PRODUCTION_STAFF_STATUSES: InternalStatus[] = [
  "PRODUCING",
  "QUALITY_CHECK",
  "PACKING",
  "READY_TO_SHIP",
  "SHIPPED",
];

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
  printSize: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  designNote: z.string().optional(),
  designImageUrl: z.string().optional(),
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

const orderItemProductSchema = z.object({
  productId: z.string().optional(),
  productType: z.string(),
  description: z.string(),
  material: z.string().optional(),
  baseUnitPrice: z.number().min(0),
  discount: z.number().min(0).default(0),
  packagingOptionId: z.string().optional(),
  variants: z.array(variantSchema).min(1),
  itemSource: z.enum(["FROM_STOCK", "CUSTOM_MADE", "CUSTOMER_PROVIDED"]).optional(),
  fabricType: z.string().optional(),
  fabricWeight: z.string().optional(),
  fabricColor: z.string().optional(),
  processingType: z.enum(["PRINT_ONLY", "CUT_AND_SEW_PRINT", "CUT_AND_SEW_ONLY", "PACK_ONLY", "FULL_PRODUCTION"]).optional(),
  patternId: z.string().optional(),
  collarType: z.string().optional(),
  sleeveType: z.string().optional(),
  bodyFit: z.string().optional(),
  patternFileUrl: z.string().optional(),
  patternNote: z.string().optional(),
  garmentCondition: z.string().optional(),
  receivedInspected: z.boolean().optional(),
  receiveNote: z.string().optional(),
});

const orderItemSchema = z.object({
  description: z.string().optional(),
  notes: z.string().optional(),
  products: z.array(orderItemProductSchema).min(1),
  prints: z.array(printSchema).default([]),
  addons: z.array(addonSchema).default([]),
});

const orderFeeSchema = z.object({
  feeType: z.string(),
  name: z.string(),
  description: z.string().optional(),
  amount: z.number().min(0),
  notes: z.string().optional(),
});

// ============================================================
// HELPERS
// ============================================================

// shape ของ item ที่ผ่าน priceOrderItems แล้ว (มี totalQuantity/subtotal/sortOrder ครบ)
type ItemWithCalc = PricedItem<z.infer<typeof orderItemSchema>>;

// tax-point ต่อ "รายการ" ตามเนื้องานจริง (ไม่เหมารวมทั้งใบ — ออเดอร์ผสมเสื้อเปล่า+งานพิมพ์
// มีสองชนิดภาษีในใบเดียวได้): มีลายพิมพ์ = จ้างทำของ · เสื้อเปล่า = ขายสินค้า
const taxLineTypeForItem = (item: { prints: unknown[] }): TaxLineType =>
  item.prints.length > 0 ? "HIRE_OF_WORK" : "GOODS";

// ชนิดออเดอร์ derive จากเนื้อรายการ — ผู้ใช้ไม่ต้องเลือกเองอีกต่อไป:
// มีรายการและไม่มีลายพิมพ์เลย = สำเร็จรูป (เกิดมา CONFIRMED ข้ามขั้นตีราคา/ออกแบบ)
// นอกนั้น (มีพิมพ์ หรือยังไม่มีรายการ) = งานสั่งทำ (เริ่ม INQUIRY เดินตามจริง)
const deriveOrderType = (items: { prints: unknown[] }[]): OrderType =>
  items.length > 0 && items.every((it) => it.prints.length === 0) ? "READY_MADE" : "CUSTOM";

function buildItemCreateData(item: ItemWithCalc, taxLineType: TaxLineType) {
  return {
    sortOrder: item.sortOrder,
    description: item.description || "",
    totalQuantity: item.totalQuantity,
    subtotal: item.subtotal,
    taxLineType,
    notes: item.notes,
    products: {
      create: item.products.map((p) => ({
        sortOrder: p.sortOrder,
        productId: p.productId || undefined,
        productType: p.productType,
        description: p.description,
        material: p.material,
        baseUnitPrice: p.baseUnitPrice,
        discount: p.discount || 0,
        totalQuantity: p.totalQuantity,
        subtotal: p.subtotal,
        itemSource: p.itemSource,
        packagingOptionId: p.packagingOptionId || undefined,
        fabricType: p.fabricType,
        fabricWeight: p.fabricWeight,
        fabricColor: p.fabricColor,
        processingType: p.processingType,
        patternId: p.patternId,
        collarType: p.collarType,
        sleeveType: p.sleeveType,
        bodyFit: p.bodyFit,
        patternFileUrl: p.patternFileUrl,
        patternNote: p.patternNote,
        garmentCondition: p.garmentCondition,
        receivedInspected: p.receivedInspected ?? false,
        receiveNote: p.receiveNote,
        variants: {
          create: p.variants.map((v) => ({
            size: v.size,
            color: v.color,
            quantity: v.quantity,
          })),
        },
      })),
    },
    prints: {
      create: item.prints.map((pr) => ({
        position: pr.position,
        printType: pr.printType,
        colorCount: pr.colorCount,
        printSize: pr.printSize,
        width: pr.width,
        height: pr.height,
        designNote: pr.designNote,
        designImageUrl: pr.designImageUrl,
        unitPrice: pr.unitPrice,
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
  };
}

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
        createdAfter: z.string().optional(),
        createdBefore: z.string().optional(),
        sortBy: z.enum(["createdAt", "totalAmount", "orderNumber"]).optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
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

      if (input.createdAfter || input.createdBefore) {
        const createdAtFilter: Record<string, Date> = {};
        if (input.createdAfter) createdAtFilter.gte = new Date(input.createdAfter);
        if (input.createdBefore) {
          const end = new Date(input.createdBefore);
          end.setHours(23, 59, 59, 999);
          createdAtFilter.lte = end;
        }
        where.createdAt = createdAtFilter;
      }

      const orderBy: Record<string, string> = {
        [input.sortBy ?? "createdAt"]: input.sortOrder ?? "desc",
      };

      const [orders, total] = await Promise.all([
        ctx.prisma.order.findMany({
          where,
          include: {
            customer: { select: { id: true, name: true, company: true } },
            _count: { select: { items: true, designs: true, deliveries: true } },
            invoices: {
              where: { isVoided: false },
              select: { totalAmount: true, paymentStatus: true },
            },
          },
          orderBy,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        ctx.prisma.order.count({ where }),
      ]);

      const ordersWithPayment = orders.map((order) => {
        const invoices = order.invoices;
        let paymentLabel: "paid" | "unpaid" | "partial" | "none" = "none";
        if (invoices.length > 0) {
          const allPaid = invoices.every((inv) => inv.paymentStatus === "PAID");
          const anyPaid = invoices.some((inv) => inv.paymentStatus === "PAID" || inv.paymentStatus === "PARTIALLY_PAID");
          if (allPaid) paymentLabel = "paid";
          else if (anyPaid) paymentLabel = "partial";
          else paymentLabel = "unpaid";
        }
        return {
          ...order,
          paymentLabel,
          invoicedTotal: invoices.reduce((s, inv) => s + inv.totalAmount, 0),
        };
      });

      return { orders: ordersWithPayment, total, pages: Math.ceil(total / input.limit) };
    }),

  getById: protectedProcedure
    .input(byIdInput)
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
              products: {
                orderBy: { sortOrder: "asc" },
                include: {
                  variants: { orderBy: { size: "asc" } },
                  product: {
                    include: {
                      variants: {
                        where: { isActive: true },
                        select: { id: true, size: true, color: true, stock: true, totalStock: true },
                      },
                    },
                  },
                  packagingOption: true,
                  pattern: true,
                },
              },
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
                  outsourceOrders: {
                    orderBy: { createdAt: "desc" },
                    include: { vendor: true },
                  },
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
    .use(salesUp)
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
        platformFee: z.number().min(0).optional(),
        discount: z.number().min(0).default(0),
        discountReason: z.string().optional(),
        isDraft: z.boolean().default(false),
        isQuickInquiry: z.boolean().default(false),
        priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
        paymentTerms: z.enum(PAYMENT_TERMS_VALUES).optional(),
        poNumber: z.string().optional(),
        taxRate: z.number().min(0).max(100).default(0),
        estimatedQuantity: z.number().int().min(1).optional(),
        shippingAddress: z.object({
          recipientName: z.string(),
          phone: z.string(),
          address: z.string(),
          subDistrict: z.string().optional(),
          district: z.string().optional(),
          province: z.string().optional(),
          postalCode: z.string().optional(),
        }).optional(),
        // Items can be empty for INQUIRY/DRAFT (Quick Inquiry mode)
        items: z.array(orderItemSchema).default([]),
        fees: z.array(orderFeeSchema).default([]),
        // Reference images uploaded during creation
        referenceImages: z.array(z.object({
          fileUrl: z.string(),
          fileName: z.string(),
          fileSize: z.number().optional(),
          printPosition: z.string().optional(), // FRONT, BACK, SLEEVE_L, etc.
        })).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { items, fees, shippingAddress, referenceImages, ...orderData } = input;

      // ชนิดออเดอร์ derive จากเนื้อรายการเสมอ — input.orderType/isQuickInquiry คงไว้
      // เพื่อ backward compat แต่ไม่ใช้ตัดสินแล้ว (ฟอร์มใหม่เป็นโหมดเดียว เปิดเบาได้
      // โดยไม่มีรายการ = เริ่มเป็นการสอบถาม แล้วเติมที่หน้าออเดอร์)
      const derivedType = deriveOrderType(items);
      orderData.orderType = derivedType;

      const itemsWithCalc = priceOrderItems(items);
      // สูตร A (services/pricing — สูตรเดียวทุก mutation): platformFee ไม่เข้ายอด/ฐาน VAT
      const totals = computeOrderTotals({
        itemSubtotals: itemsWithCalc.map((i) => i.subtotal),
        feeAmounts: fees.map((f) => f.amount),
        discount: input.discount || 0,
        taxRate: input.taxRate,
      });

      // เช็คสต๊อกเฉพาะรายการที่หยิบจากสต๊อก (มี productId) — ไม่ผูกกับชนิดออเดอร์อีกต่อไป
      // ออเดอร์งานพิมพ์ที่ใช้เสื้อจากสต๊อกก็ต้องเช็คเหมือนกัน
      if (!input.isDraft) {
        const allProducts = items.flatMap((item) => item.products).filter((p) => p.productId);
        if (allProducts.length > 0) {
          const productIds = [...new Set(allProducts.map((p) => p.productId).filter((id): id is string => !!id))];
          const dbProducts = await ctx.prisma.product.findMany({
            where: { id: { in: productIds } },
            include: { variants: true },
          });
          const stockErrors: string[] = [];
          for (const prod of allProducts) {
            const dbProd = dbProducts.find((p) => p.id === prod.productId);
            if (!dbProd) continue;
            for (const variant of prod.variants) {
              const pv = dbProd.variants.find((v) => v.size === variant.size && (!variant.color || v.color === variant.color));
              if (pv) {
                const available = pv.totalStock || pv.stock;
                if (variant.quantity > available) {
                  stockErrors.push(`${dbProd.name} (${variant.size}${variant.color ? `/${variant.color}` : ""}): ต้องการ ${variant.quantity} แต่มี ${available}`);
                }
              }
            }
          }
          if (stockErrors.length > 0) {
            badRequest(`สินค้าในสต็อกไม่เพียงพอ:\n${stockErrors.join("\n")}`);
          }
        }
      }

      // ร่าง → DRAFT · ไม่มีรายการ (เปิดเบา/สอบถาม) → INQUIRY · มีรายการ → ตามชนิดที่ derive
      // (สำเร็จรูปล้วน = CONFIRMED ทันที · มีงานพิมพ์ = INQUIRY รอตีราคา/ยืนยัน)
      const initialStatus = input.isDraft
        ? ("DRAFT" as const)
        : items.length === 0
          ? ("INQUIRY" as const)
          : getInitialStatus(derivedType);
      const customerStatus = getCustomerStatus(initialStatus);

      // READY_MADE เกิดมาเป็น CONFIRMED ทันที — ต้องผ่านด่านวงเงินเดียวกับตอนยืนยันออเดอร์
      if (initialStatus === "CONFIRMED") {
        await assertSalesWithinCreditLimit(ctx.prisma, {
          userRole: ctx.userRole,
          customerId: orderData.customerId,
          additionalAmount: totals.totalAmount,
          actionLabel: "สร้างออเดอร์",
        });
      }

      // Use $transaction to ensure atomicity: order + customer stats + audit log
      // Retry up to 3 times on unique constraint violation (order number collision)
      const MAX_RETRIES = 3;
      let lastError: unknown = null;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const result = await ctx.prisma.$transaction(async (tx) => {
            // เลขออเดอร์รันต่อเนื่องจาก DocumentSequence — ต้องอยู่ใน transaction เดียวกับ create
            const orderNumber = await nextDocumentNumber(tx, "ORDER");

            const order = await tx.order.create({
              data: {
                orderNumber,
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
                discount: totals.discount,
                discountReason: orderData.discountReason,
                priority: orderData.priority,
                paymentTerms: orderData.paymentTerms,
                poNumber: orderData.poNumber,
                estimatedQuantity: orderData.estimatedQuantity,
                taxRate: orderData.taxRate,
                taxAmount: totals.taxAmount,
                subtotalItems: totals.subtotalItems,
                subtotalFees: totals.subtotalFees,
                totalAmount: totals.totalAmount,
                ...(shippingAddress && {
                  shippingRecipientName: shippingAddress.recipientName,
                  shippingPhone: shippingAddress.phone,
                  shippingAddress: shippingAddress.address,
                  shippingSubDistrict: shippingAddress.subDistrict,
                  shippingDistrict: shippingAddress.district,
                  shippingProvince: shippingAddress.province,
                  shippingPostalCode: shippingAddress.postalCode,
                }),
                items: {
                  create: itemsWithCalc.map((item) =>
                    buildItemCreateData(item, taxLineTypeForItem(item))
                  ),
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
                items: { include: { products: { include: { variants: true } }, prints: true, addons: true } },
                fees: true,
              },
            });

            // แนบรูปอ้างอิงในก้อนเดียว — transaction นี้ถือ lock แถว sequence อยู่
            // ยิงทีละรูปจะลาก lock ยาวตามจำนวนรูป
            if (referenceImages.length > 0) {
              await tx.attachment.createMany({
                data: referenceImages.map((img) => ({
                  entityType: "ORDER",
                  entityId: order.id,
                  fileName: img.fileName,
                  fileUrl: img.fileUrl,
                  fileType: img.fileName.split(".").pop()?.toLowerCase() ?? "unknown",
                  fileSize: img.fileSize ?? 0,
                  category: "REFERENCE_IMAGE",
                  printPosition: img.printPosition,
                  uploadedById: ctx.userId,
                })),
              });
            }

            // Update customer stats (inside same transaction)
            await tx.customer.update({
              where: { id: input.customerId },
              data: {
                totalOrders: { increment: 1 },
                lastOrderAt: new Date(),
              },
            });

            // Audit log (inside same transaction)
            await createAuditLog(tx, {
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
                  isDraft: input.isDraft,
                })
              ),
            });

            return order;
          });

          return result;
        } catch (error: unknown) {
          lastError = error;
          // Retry on unique constraint violation (P2002 = Prisma unique constraint error)
          const isPrismaUniqueError =
            error instanceof Error &&
            "code" in error &&
            (error as { code: string }).code === "P2002";
          if (!isPrismaUniqueError) {
            throw error; // Not a unique constraint error, rethrow
          }
          // Otherwise retry with next attempt
        }
      }

      throw lastError || new Error("ไม่สามารถสร้างเลขออเดอร์ได้ กรุณาลองอีกครั้ง");
    }),

  updateStatus: protectedProcedure
    .use(orderOps)
    .input(
      z.object({
        id: z.string(),
        internalStatus: z.enum([
          "DRAFT", "INQUIRY", "QUOTATION", "CONFIRMED", "DESIGN_PENDING", "DESIGNING",
          "AWAITING_APPROVAL", "DESIGN_APPROVED", "PRODUCTION_QUEUE", "PRODUCING",
          "QUALITY_CHECK", "PACKING", "READY_TO_SHIP", "SHIPPED", "COMPLETED", "CANCELLED", "ON_HOLD",
        ]),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const old = await ctx.prisma.order.findUniqueOrThrow({
        where: { id: input.id },
      });

      if (ctx.userRole === "PRODUCTION_STAFF") {
        // อนุญาตถอยงานกลับคิวผลิตด้วย (PRODUCING → PRODUCTION_QUEUE)
        // แต่ไม่ใส่ PRODUCTION_QUEUE ในลิสต์หลัก — กันสิทธิ์เกินไปถึง
        // handoff ฝั่งขาย/ออกแบบ (CONFIRMED/DESIGN_APPROVED → PRODUCTION_QUEUE)
        const allowed =
          PRODUCTION_STAFF_STATUSES.includes(input.internalStatus) ||
          (input.internalStatus === "PRODUCTION_QUEUE" &&
            old.internalStatus === "PRODUCING");
        if (!allowed) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "ฝ่ายผลิตเปลี่ยนได้เฉพาะสถานะฝั่งผลิต-จัดส่งเท่านั้น",
          });
        }
      }

      // ยืนยันออเดอร์ = ผูกพันวงเงิน — เฉพาะข้ามจากสถานะยังไม่ผูกพันเท่านั้น
      // (ปลดพัก ON_HOLD → CONFIRMED ยอดใบนี้ถูกนับใน exposure อยู่แล้ว เช็คอีกรอบ = นับซ้ำ)
      if (
        input.internalStatus === "CONFIRMED" &&
        (UNCOMMITTED_STATUSES as readonly string[]).includes(old.internalStatus)
      ) {
        // ฟอร์มใหม่เปิดงานเบาได้ (ไม่มีรายการ) — ด่านนี้กันออเดอร์เปล่า/ยอดเดาไหลเข้าโซ่บิล
        const itemCount = await ctx.prisma.orderItem.count({ where: { orderId: input.id } });
        if (itemCount === 0) {
          badRequest(
            'ยืนยันออเดอร์ไม่ได้ — ยังไม่มีรายการสินค้า/ราคา กด "แก้ไขรายการ" ใส่ของและตีราคาก่อน'
          );
        }
        await assertSalesWithinCreditLimit(ctx.prisma, {
          userRole: ctx.userRole,
          customerId: old.customerId,
          additionalAmount: old.totalAmount,
          actionLabel: "ยืนยันออเดอร์",
        });
      }

      // ปิดงานต้องวางบิลครบก่อน — ธุรกิจเครดิตเทอม ปิดออเดอร์ที่ยังไม่วางบิล = หนี้หล่นเงียบ
      // นับแบบเดียวกับ exposure: max(ใบแจ้งหนี้ D+F, ใบเสร็จ) — งานขายสดออกแต่ใบเสร็จก็ผ่าน
      // (เก็บเงินจริงตามเทอมได้หลังปิดงาน — ลูกหนี้/aging ตามต่อให้)
      if (input.internalStatus === "COMPLETED" && old.totalAmount > 0) {
        const invoices = await ctx.prisma.invoice.findMany({
          where: { orderId: input.id, isVoided: false },
          select: { type: true, totalAmount: true },
        });
        const sumOf = (types: string[]) =>
          invoices
            .filter((inv) => types.includes(inv.type))
            .reduce((s, inv) => s.plus(inv.totalAmount), D(0));
        const billed = sumOf(["DEPOSIT_INVOICE", "FINAL_INVOICE"]);
        const receipted = sumOf(["RECEIPT"]);
        const handled = billed.gt(receipted) ? billed : receipted;
        if (handled.lt(old.totalAmount)) {
          badRequest(
            `ปิดงานไม่ได้ — วางบิล/ออกใบเสร็จแล้ว ${handled.toFixed(2)} จากยอดออเดอร์ ${old.totalAmount.toFixed(2)} บาท · วางบิลส่วนที่เหลือก่อน (ถ้ายอดงานจริงเปลี่ยน ให้แก้ "ส่วนลด" ให้ยอดตรงก่อนปิด — รายการสินค้าแก้ไม่ได้แล้วหลังเริ่มผลิต)`
          );
        }
      }

      // เปลี่ยนสถานะผ่าน service กลางเท่านั้น (validate + กัน race + revision ในตัว)
      const order = await ctx.prisma.$transaction(async (tx) => {
        await transitionOrder(tx, {
          orderId: input.id,
          to: input.internalStatus,
          changedBy: ctx.userId,
          reason: input.reason,
        });
        return tx.order.findUniqueOrThrow({ where: { id: input.id } });
      });

      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "ORDER",
        entityId: input.id,
        oldValue: { internalStatus: old.internalStatus, customerStatus: old.customerStatus },
        newValue: { internalStatus: order.internalStatus, customerStatus: order.customerStatus },
        reason: input.reason,
      });

      return order;
    }),

  update: protectedProcedure
    .use(salesUp)
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        deadline: z.string().optional(),
        discount: z.number().min(0).optional(),
        discountReason: z.string().optional(),
        notes: z.string().optional(),
        externalOrderId: z.string().optional(),
        trackingNumber: z.string().optional(),
        platformFee: z.number().min(0).optional(),
        priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
        // nullable = ล้างกลับเป็น "ไม่ระบุ" ได้ · เทอมขับยอดบิล/วันครบกำหนด จึงนับเป็น field เงิน
        paymentTerms: z.enum(PAYMENT_TERMS_VALUES).nullable().optional(),
        poNumber: z.string().nullable().optional(),
        estimatedQuantity: z.number().int().min(1).nullable().optional(),
        taxRate: z.number().min(0).max(100).optional(),
        shippingRecipientName: z.string().optional(),
        shippingPhone: z.string().optional(),
        shippingAddress: z.string().optional(),
        shippingSubDistrict: z.string().optional(),
        shippingDistrict: z.string().optional(),
        shippingProvince: z.string().optional(),
        shippingPostalCode: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const currentOrder = await ctx.prisma.order.findUniqueOrThrow({ where: { id } });

      // ออเดอร์เสร็จสิ้น/ยกเลิกแล้ว — field เงินแตะไม่ได้อีก (ข้อมูลที่เหลือ เช่น notes/tracking ยังแก้ได้)
      const touchesMoney =
        data.discount !== undefined ||
        data.discountReason !== undefined ||
        data.platformFee !== undefined ||
        data.taxRate !== undefined ||
        data.paymentTerms !== undefined;
      if (
        touchesMoney &&
        (currentOrder.internalStatus === "COMPLETED" || currentOrder.internalStatus === "CANCELLED")
      ) {
        badRequest("ออเดอร์ที่เสร็จสิ้นหรือยกเลิกแล้ว แก้ไขข้อมูลการเงินไม่ได้");
      }

      // discount/taxRate เปลี่ยน → คำนวณยอดใหม่ด้วยสูตรกลาง
      // (เดิม recalc ด้วย discount เก่าแม้ request ส่ง discount ใหม่มา — ยอดเพี้ยน)
      let taxUpdateData: Record<string, unknown> = {};
      if (data.taxRate !== undefined || data.discount !== undefined) {
        const totals = computeOrderTotals({
          itemSubtotals: [currentOrder.subtotalItems],
          feeAmounts: [currentOrder.subtotalFees],
          discount: data.discount ?? currentOrder.discount,
          taxRate: data.taxRate ?? currentOrder.taxRate,
        });
        taxUpdateData = {
          discount: totals.discount,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
        };
      }

      const order = await ctx.prisma.order.update({
        where: { id },
        data: {
          ...data,
          ...taxUpdateData,
          deadline: data.deadline ? new Date(data.deadline) : undefined,
        },
      });

      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "ORDER",
        entityId: id,
        newValue: JSON.parse(JSON.stringify(data)),
      });

      return order;
    }),

  updateItems: protectedProcedure
    .use(salesUp)
    .input(
      z.object({
        id: z.string(),
        items: z.array(orderItemSchema).min(1, "กรุณาเพิ่มรายการอย่างน้อย 1 รายการ"),
        discount: z.number().min(0).default(0),
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
        badRequest("ไม่สามารถแก้ไขรายการได้เมื่อเริ่มผลิตแล้ว");
      }

      const itemsWithCalc = priceOrderItems(input.items);
      // สูตร A — platformFee ไม่เข้ายอด/ฐาน VAT (สูตรเดิมของ mutation นี้เคยบวก = บั๊กยอดแกว่ง)
      const totals = computeOrderTotals({
        itemSubtotals: itemsWithCalc.map((i) => i.subtotal),
        feeAmounts: order.fees.map((f) => f.amount),
        discount: input.discount || 0,
        taxRate: order.taxRate,
      });

      // Use transaction: delete old items → create new → update pricing
      const updatedOrder = await ctx.prisma.$transaction(async (tx) => {
        // Delete old items (cascades to variants, prints, addons)
        await tx.orderItem.deleteMany({ where: { orderId: input.id } });

        for (const item of itemsWithCalc) {
          await tx.orderItem.create({
            data: {
              orderId: input.id,
              ...buildItemCreateData(item, taxLineTypeForItem(item)),
            },
          });
        }

        // ชนิดออเดอร์ตามเนื้อรายการล่าสุด — re-derive เฉพาะช่วงร่าง/สอบถาม
        // (หลังจากนั้นออเดอร์เดินบนเส้นทางของชนิดเดิมแล้ว เปลี่ยนกลางทาง = transition พัง)
        const rederiveType = ["DRAFT", "INQUIRY"].includes(order.internalStatus)
          ? deriveOrderType(input.items)
          : undefined;

        return tx.order.update({
          where: { id: input.id },
          data: {
            subtotalItems: totals.subtotalItems,
            subtotalFees: totals.subtotalFees,
            discount: totals.discount,
            taxAmount: totals.taxAmount,
            totalAmount: totals.totalAmount,
            // มีรายการจริงแล้ว (mutation นี้บังคับ ≥1) — จำนวนคาดคะเนตอนเปิดเบาหมดหน้าที่
            estimatedQuantity: null,
            ...(rederiveType ? { orderType: rederiveType } : {}),
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
          newValue: JSON.stringify({ subtotalItems: totals.subtotalItems, totalAmount: totals.totalAmount }),
        },
      });

      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "ORDER",
        entityId: input.id,
        newValue: { action: "updateItems", itemCount: input.items.length, totalAmount: totals.totalAmount },
      });

      return updatedOrder;
    }),

  updateFees: protectedProcedure
    .use(salesUp)
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

      // ออเดอร์เสร็จสิ้น/ยกเลิกแล้ว — แก้ค่าธรรมเนียม (= แก้ยอดเงิน) ไม่ได้
      if (order.internalStatus === "COMPLETED" || order.internalStatus === "CANCELLED") {
        badRequest("ออเดอร์ที่เสร็จสิ้นหรือยกเลิกแล้ว แก้ไขค่าธรรมเนียมไม่ได้");
      }

      // สูตร A — platformFee ไม่เข้ายอด/ฐาน VAT (สูตรเดิมของ mutation นี้เคยบวก = บั๊กยอดแกว่ง)
      const totals = computeOrderTotals({
        itemSubtotals: [order.subtotalItems],
        feeAmounts: input.fees.map((f) => f.amount),
        discount: order.discount,
        taxRate: order.taxRate,
      });

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
            subtotalFees: totals.subtotalFees,
            taxAmount: totals.taxAmount,
            totalAmount: totals.totalAmount,
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
          newValue: JSON.stringify({ subtotalFees: totals.subtotalFees }),
        },
      });

      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "ORDER",
        entityId: input.id,
        newValue: { action: "updateFees", feeCount: input.fees.length, subtotalFees: totals.subtotalFees },
      });

      return updatedOrder;
    }),

  updateReceiveTracking: protectedProcedure
    .use(orderOps)
    .input(
      z.object({
        orderItemProductId: z.string(),
        garmentCondition: z.string().optional(),
        receivedInspected: z.boolean(),
        receiveNote: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const product = await ctx.prisma.orderItemProduct.findUniqueOrThrow({
        where: { id: input.orderItemProductId },
        select: { orderItem: { select: { orderId: true } } },
      });

      const updated = await ctx.prisma.orderItemProduct.update({
        where: { id: input.orderItemProductId },
        data: {
          garmentCondition: input.garmentCondition || null,
          receivedInspected: input.receivedInspected,
          receiveNote: input.receiveNote || null,
        },
      });

      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "ORDER",
        entityId: product.orderItem.orderId,
        newValue: { action: "updateReceiveTracking", orderItemProductId: input.orderItemProductId, receivedInspected: input.receivedInspected },
      });

      return updated;
    }),

  duplicate: protectedProcedure
    .use(salesUp)
    .input(byIdInput)
    .mutation(async ({ ctx, input }) => {
      const original = await ctx.prisma.order.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          items: {
            include: { products: { include: { variants: true } }, prints: true, addons: true },
          },
          fees: true,
        },
      });

      const MAX_RETRIES = 3;
      let lastError: unknown = null;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const result = await ctx.prisma.$transaction(async (tx) => {
            const orderNumber = await nextDocumentNumber(tx, "ORDER");

            const newOrder = await tx.order.create({
              data: {
                orderNumber,
                orderType: original.orderType,
                channel: original.channel,
                customerId: original.customerId,
                brandProfileId: original.brandProfileId,
                createdById: ctx.userId,
                customerStatus: "ORDER_RECEIVED",
                internalStatus: "DRAFT",
                title: `[สำเนา] ${original.title}`,
                description: original.description,
                priority: original.priority,
                paymentTerms: original.paymentTerms,
                taxRate: original.taxRate,
                discount: original.discount,
                discountReason: original.discountReason,
                subtotalItems: original.subtotalItems,
                subtotalFees: original.subtotalFees,
                taxAmount: original.taxAmount,
                totalAmount: original.totalAmount,
                items: {
                  create: original.items.map((item, index) => {
                    const data = buildItemCreateData({
                      ...item,
                      sortOrder: index,
                      description: item.description ?? undefined,
                      notes: item.notes ?? undefined,
                      products: item.products.map((p, pIdx) => ({
                        ...p,
                        sortOrder: pIdx,
                        productId: p.productId ?? undefined,
                        packagingOptionId: p.packagingOptionId ?? undefined,
                        patternId: p.patternId ?? undefined,
                        discount: p.discount || 0,
                      })),
                      prints: item.prints,
                      addons: item.addons,
                    } as ItemWithCalc, taxLineTypeForItem(item));
                    // Reset receive tracking for duplicated orders
                    data.products.create = data.products.create.map((p) => ({
                      ...p,
                      receivedInspected: false,
                      receiveNote: undefined,
                    }));
                    return data;
                  }),
                },
                fees: {
                  create: original.fees.map((f) => ({
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
                items: { include: { products: { include: { variants: true } }, prints: true, addons: true } },
                fees: true,
              },
            });

            await createAuditLog(tx, {
              userId: ctx.userId,
              action: "CREATE",
              entityType: "ORDER",
              entityId: newOrder.id,
              newValue: {
                orderNumber: newOrder.orderNumber,
                duplicatedFrom: original.orderNumber,
                title: newOrder.title,
              },
            });

            return newOrder;
          });

          return result;
        } catch (error: unknown) {
          lastError = error;
          const isPrismaUniqueError =
            error instanceof Error &&
            "code" in error &&
            (error as { code: string }).code === "P2002";
          if (!isPrismaUniqueError) {
            throw error;
          }
        }
      }

      throw lastError || new Error("ไม่สามารถสร้างเลขออเดอร์ได้ กรุณาลองอีกครั้ง");
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const startOfMonth = getStartOfMonth();

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
      revenueThisMonth: aggToNumber(totalRevenue._sum.totalAmount),
    };
  }),
});
