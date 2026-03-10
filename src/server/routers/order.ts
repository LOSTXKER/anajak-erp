import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { generateOrderNumber } from "@/lib/utils";
import { getCustomerStatus, getInitialStatus, isValidTransition } from "@/lib/order-status";
import { calculateTotalQuantity } from "@/lib/pricing";
import { createAuditLog } from "@/server/helpers";
import { byIdInput } from "@/server/schemas";
import { getStartOfMonth } from "@/lib/date-utils";

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
        isDraft: z.boolean().default(false),
        isQuickInquiry: z.boolean().default(false),
        priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
        paymentTerms: z.string().optional(),
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

      // For non-draft, non-inquiry orders: require at least 1 item
      if (!input.isDraft && !input.isQuickInquiry && items.length === 0) {
        throw new Error("กรุณาเพิ่มรายการอย่างน้อย 1 รายการ");
      }

      // Calculate pricing for each item (may be empty for inquiry)
      const itemsWithCalc = items.map((item, index) => {
        const productsCalc = item.products.map((p, pIdx) => {
          const totalQuantity = calculateTotalQuantity(p.variants);
          const netPrice = p.baseUnitPrice - (p.discount || 0);
          const subtotal = totalQuantity * Math.max(0, netPrice);
          return { ...p, totalQuantity, subtotal, sortOrder: pIdx };
        });
        const itemTotalQty = productsCalc.reduce((s, p) => s + p.totalQuantity, 0);
        const productsCost = productsCalc.reduce((s, p) => s + p.subtotal, 0);
        const printsCost = itemTotalQty * item.prints.reduce((s, p) => s + p.unitPrice, 0);
        const addonsCost = item.addons.reduce((s, a) => {
          if (a.pricingType === "PER_PIECE") return s + (a.quantity ?? itemTotalQty) * a.unitPrice;
          return s + a.unitPrice;
        }, 0);
        const subtotal = productsCost + printsCost + addonsCost;
        return { ...item, products: productsCalc, totalQuantity: itemTotalQty, subtotal, sortOrder: index };
      });

      const subtotalItems = itemsWithCalc.reduce((sum, i) => sum + i.subtotal, 0);
      const subtotalFees = fees.reduce((sum, f) => sum + f.amount, 0);
      const subtotalBeforeTax = subtotalItems + subtotalFees - (input.discount || 0);
      const taxAmount = input.taxRate > 0 ? subtotalBeforeTax * (input.taxRate / 100) : 0;
      const totalAmount = subtotalBeforeTax + taxAmount;

      // Stock availability check for READY_MADE orders
      if (input.orderType === "READY_MADE" && !input.isDraft) {
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
            throw new Error(`สินค้าในสต็อกไม่เพียงพอ:\n${stockErrors.join("\n")}`);
          }
        }
      }

      // Quick inquiry always starts at INQUIRY, draft at DRAFT, otherwise default
      const initialStatus = input.isDraft
        ? "DRAFT" as const
        : input.isQuickInquiry
          ? "INQUIRY" as const
          : getInitialStatus(input.orderType);
      const customerStatus = getCustomerStatus(initialStatus);

      // Use $transaction to ensure atomicity: order + customer stats + audit log
      // Retry up to 3 times on unique constraint violation (order number collision)
      const MAX_RETRIES = 3;
      let lastError: unknown = null;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const result = await ctx.prisma.$transaction(async (tx) => {
            // Generate order number inside transaction for consistency
            const orderNumber = await generateOrderNumber(tx);

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
                discount: orderData.discount || 0,
                discountReason: orderData.discountReason,
                priority: orderData.priority,
                paymentTerms: orderData.paymentTerms,
                poNumber: orderData.poNumber,
                estimatedQuantity: orderData.estimatedQuantity,
                taxRate: orderData.taxRate,
                taxAmount,
                subtotalItems,
                subtotalFees,
                totalAmount: Math.max(0, totalAmount),
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
                  create: itemsWithCalc.map((item) => ({
                    sortOrder: item.sortOrder,
                    description: item.description || "",
                    totalQuantity: item.totalQuantity,
                    subtotal: item.subtotal,
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
                items: { include: { products: { include: { variants: true } }, prints: true, addons: true } },
                fees: true,
              },
            });

            // Create reference image attachments (inside same transaction)
            if (referenceImages.length > 0) {
              for (const img of referenceImages) {
                await tx.attachment.create({
                  data: {
                    entityType: "ORDER",
                    entityId: order.id,
                    fileName: img.fileName,
                    fileUrl: img.fileUrl,
                    fileType: img.fileName.split(".").pop()?.toLowerCase() ?? "unknown",
                    fileSize: img.fileSize ?? 0,
                    category: "REFERENCE_IMAGE",
                    printPosition: img.printPosition,
                    uploadedById: ctx.userId,
                  },
                });
              }
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
    .input(
      z.object({
        id: z.string(),
        internalStatus: z.enum([
          "DRAFT", "INQUIRY", "QUOTATION", "CONFIRMED", "DESIGN_PENDING", "DESIGNING",
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
      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "ORDER",
        entityId: input.id,
        oldValue: { internalStatus: old.internalStatus, customerStatus: old.customerStatus },
        newValue: { internalStatus: input.internalStatus, customerStatus: newCustomerStatus },
        reason: input.reason,
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
        priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
        paymentTerms: z.string().optional(),
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

      // If taxRate changed, recalculate tax
      let taxUpdateData: Record<string, unknown> = {};
      if (data.taxRate !== undefined) {
        const currentOrder = await ctx.prisma.order.findUniqueOrThrow({ where: { id } });
        const subtotalBeforeTax = currentOrder.subtotalItems + currentOrder.subtotalFees - currentOrder.discount;
        const taxAmount = data.taxRate > 0 ? subtotalBeforeTax * (data.taxRate / 100) : 0;
        const totalAmount = subtotalBeforeTax + taxAmount;
        taxUpdateData = { taxAmount, totalAmount: Math.max(0, totalAmount) };
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
        const productsCalc = item.products.map((p, pIdx) => {
          const totalQuantity = calculateTotalQuantity(p.variants);
          const netPrice = p.baseUnitPrice - (p.discount || 0);
          const subtotal = totalQuantity * Math.max(0, netPrice);
          return { ...p, totalQuantity, subtotal, sortOrder: pIdx };
        });
        const itemTotalQty = productsCalc.reduce((s, p) => s + p.totalQuantity, 0);
        const productsCost = productsCalc.reduce((s, p) => s + p.subtotal, 0);
        const printsCost = itemTotalQty * item.prints.reduce((s, p) => s + p.unitPrice, 0);
        const addonsCost = item.addons.reduce((s, a) => {
          if (a.pricingType === "PER_PIECE") return s + (a.quantity ?? itemTotalQty) * a.unitPrice;
          return s + a.unitPrice;
        }, 0);
        const subtotal = productsCost + printsCost + addonsCost;
        return { ...item, products: productsCalc, totalQuantity: itemTotalQty, subtotal, sortOrder: index };
      });

      const subtotalItems = itemsWithCalc.reduce((sum, i) => sum + i.subtotal, 0);
      const subtotalFees = order.fees.reduce((sum, f) => sum + f.amount, 0);
      const subtotalBeforeTax = subtotalItems + subtotalFees + (order.platformFee || 0) - (input.discount || 0);
      const taxAmount = order.taxRate > 0 ? subtotalBeforeTax * (order.taxRate / 100) : 0;
      const totalAmount = subtotalBeforeTax + taxAmount;

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
              description: item.description || "",
              totalQuantity: item.totalQuantity,
              subtotal: item.subtotal,
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
            },
          });
        }

        return tx.order.update({
          where: { id: input.id },
          data: {
            subtotalItems,
            subtotalFees,
            discount: input.discount || 0,
            taxAmount,
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

      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "ORDER",
        entityId: input.id,
        newValue: { action: "updateItems", itemCount: input.items.length, totalAmount: Math.max(0, totalAmount) },
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
      const subtotalBeforeTax = order.subtotalItems + subtotalFees + (order.platformFee || 0) - order.discount;
      const taxAmount = order.taxRate > 0 ? subtotalBeforeTax * (order.taxRate / 100) : 0;
      const totalAmount = subtotalBeforeTax + taxAmount;

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
            taxAmount,
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

      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "ORDER",
        entityId: input.id,
        newValue: { action: "updateFees", feeCount: input.fees.length, subtotalFees },
      });

      return updatedOrder;
    }),

  updateReceiveTracking: protectedProcedure
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
    .input(z.object({ id: z.string() }))
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
            const orderNumber = await generateOrderNumber(tx);

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
                  create: original.items.map((item, index) => ({
                    sortOrder: index,
                    description: item.description,
                    totalQuantity: item.totalQuantity,
                    subtotal: item.subtotal,
                    notes: item.notes,
                    products: {
                      create: item.products.map((p, pIdx) => ({
                        sortOrder: pIdx,
                        productId: p.productId ?? undefined,
                        productType: p.productType,
                        description: p.description,
                        material: p.material,
                        baseUnitPrice: p.baseUnitPrice,
                        discount: p.discount,
                        totalQuantity: p.totalQuantity,
                        subtotal: p.subtotal,
                        itemSource: p.itemSource,
                        packagingOptionId: p.packagingOptionId ?? undefined,
                        fabricType: p.fabricType,
                        fabricWeight: p.fabricWeight,
                        fabricColor: p.fabricColor,
                        processingType: p.processingType,
                        patternId: p.patternId ?? undefined,
                        collarType: p.collarType,
                        sleeveType: p.sleeveType,
                        bodyFit: p.bodyFit,
                        patternFileUrl: p.patternFileUrl,
                        patternNote: p.patternNote,
                        garmentCondition: p.garmentCondition,
                        receivedInspected: false,
                        receiveNote: null,
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
                  })),
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
      revenueThisMonth: totalRevenue._sum.totalAmount ?? 0,
    };
  }),
});
