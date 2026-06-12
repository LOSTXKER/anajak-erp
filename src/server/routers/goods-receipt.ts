import { z } from "zod";
import { router, protectedProcedure, requireRole } from "../trpc";
import { createAuditLog } from "@/server/helpers";
import {
  RECEIPT_TYPES,
  getReceiptContext,
  createGoodsReceipt,
  listGoodsReceipts,
} from "@/server/services/goods-receipt";

// ใบตรวจรับของเข้า/ใบคืนของลูกค้า — router เป็นแค่ผิว logic อยู่ services/goods-receipt
// คนรับของหน้าโรงงาน = แอดมิน/ขาย/ทีมผลิต (DESIGNER/ACCOUNTANT ไม่เกี่ยวกับของเข้า)
const receiver = requireRole("OWNER", "MANAGER", "SALES", "PRODUCTION_STAFF");

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
    .use(receiver)
    .input(
      z.object({
        orderId: z.string(),
        receiptType: z.enum(RECEIPT_TYPES),
        outsourceOrderId: z.string().optional(),
        notes: z.string().optional(),
        photoUrls: z.array(z.string()).default([]),
        lines: z.array(receiptLineSchema).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const receipt = await createGoodsReceipt(ctx.prisma, {
        ...input,
        userId: ctx.userId,
      });
      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "CREATE",
        entityType: "GOODS_RECEIPT",
        entityId: receipt.id,
        newValue: {
          orderId: input.orderId,
          receiptType: input.receiptType,
          lineCount: receipt.lines.length,
        },
      });
      return receipt;
    }),
});
