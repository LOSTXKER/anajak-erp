import { z } from "zod";
import { hasPermission } from "@/lib/permissions";
import { globalSearch } from "@/server/services/global-search";
import { protectedProcedure, router } from "../trpc";

export const searchRouter = router({
  global: protectedProcedure
    .input(
      z.object({
        q: z.string().trim().min(2).max(100),
        limit: z.number().int().min(1).max(8).default(5),
      })
    )
    .query(({ ctx, input }) => {
      // ใบเสนอและบิลมีข้อมูลราคาขาย — ใช้ permission เดียวกับหน้ารายละเอียดออเดอร์
      // และ quotation.getById ไม่อาศัยการซ่อนเฉพาะฝั่งจอ
      const canSeeOrderMoney = hasPermission(
        ctx.userRole,
        ctx.permissionOverrides,
        "see_order_money"
      );

      return globalSearch(ctx.prisma, {
        query: input.q,
        limit: input.limit,
        access: {
          canSeeQuotations: canSeeOrderMoney,
          canSeeInvoices: canSeeOrderMoney,
        },
      });
    }),
});
