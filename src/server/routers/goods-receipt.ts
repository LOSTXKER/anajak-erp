import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { fileUrlArraySchema } from "@/server/schemas";
import { hasPermission } from "@/lib/permissions";
import {
  RECEIPT_TYPES,
  getReceiptContext,
  createGoodsReceipt,
  confirmCustomerGarmentEvidence,
  listGoodsReceipts,
} from "@/server/services/goods-receipt";

// ใบตรวจรับของเข้า/ใบคืนของลูกค้า — router เป็นแค่ผิว logic อยู่ services/goods-receipt
// ใบทั่วไปใช้ manage_delivery; คำสั่งจาก Station ผูก productionStepId และใช้ manage_production
// ให้ตรงกับปุ่มปฏิบัติงานของจอสถานี (รวม permission override รายคน)

const receiptLineSchema = z.object({
  orderItemProductId: z.string().optional(),
  description: z.string().min(1),
  size: z.string().optional(),
  color: z.string().optional(),
  qtyExpected: z.number().int().min(0).default(0),
  qtyCounted: z.number().int().min(0),
  defectQty: z.number().int().min(0).default(0),
  defectNote: z.string().optional(),
});

export const goodsReceiptRouter = router({
  // prefill บรรทัดนับของตามชนิดใบ + ยอดรับสุทธิเดิม
  context: protectedProcedure
    .input(z.object({ orderId: z.string(), receiptType: z.enum(RECEIPT_TYPES) }))
    .query(({ ctx, input }) =>
      getReceiptContext(ctx.prisma, input.orderId, input.receiptType)
    ),

  listByOrder: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(({ ctx, input }) => listGoodsReceipts(ctx.prisma, input.orderId)),

  create: protectedProcedure
    .input(
      z.object({
        orderId: z.string(),
        idempotencyKey: z.string().min(8).max(100),
        receiptType: z.enum(RECEIPT_TYPES),
        outsourceOrderId: z.string().optional(),
        productionStepId: z.string().optional(),
        notes: z.string().optional(),
        photoUrls: fileUrlArraySchema.default([]),
        lines: z.array(receiptLineSchema).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const stationCommand = input.productionStepId !== undefined;
      const requiredPermission = stationCommand ? "manage_production" : "manage_delivery";
      if (!hasPermission(ctx.userRole, ctx.permissionOverrides, requiredPermission)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: stationCommand
            ? "บัญชีนี้ไม่มีสิทธิ์บันทึกงานผลิตที่สถานี"
            : "บัญชีนี้ไม่มีสิทธิ์บันทึกใบตรวจรับของเข้า",
        });
      }
      if (stationCommand && input.receiptType !== "CUSTOMER_GARMENT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "คำสั่งจากสถานีรองรับเฉพาะการรับเสื้อลูกค้า",
        });
      }

      return createGoodsReceipt(ctx.prisma, {
        ...input,
        userId: ctx.userId,
        canSupervise: hasPermission(
          ctx.userRole,
          ctx.permissionOverrides,
          "supervise_operations",
        ),
      });
    }),

  confirmCustomerGarmentEvidence: protectedProcedure
    .input(z.object({ productionStepId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!hasPermission(ctx.userRole, ctx.permissionOverrides, "manage_production")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "บัญชีนี้ไม่มีสิทธิ์ยืนยันงานผลิตที่สถานี",
        });
      }
      return confirmCustomerGarmentEvidence(ctx.prisma, {
        productionStepId: input.productionStepId,
        userId: ctx.userId,
        canSupervise: hasPermission(
          ctx.userRole,
          ctx.permissionOverrides,
          "supervise_operations",
        ),
      });
    }),
});
