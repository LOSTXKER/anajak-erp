import { z } from "zod";
import { router, protectedProcedure, requirePermission } from "../trpc";
import { byIdInput } from "@/server/schemas";
import { badRequest, notFound } from "@/server/errors";
import { createAuditLog } from "@/server/helpers";
import { openClaim, sumClaimLines } from "@/server/services/claim";
import { lockOrderRow } from "@/server/services/order-cost";
import { addOrderRevision, reopenProductionsForRework, transitionOrder } from "@/server/services/order-status";
import { claimCloseBlockers, resolutionNeedsRework } from "@/lib/claim";
import { getFlowSteps, getNextStatuses } from "@/lib/order-status";
import type { InternalStatus, OrderType } from "@prisma/client";
import { singleBackStatus } from "@/lib/order-status-rail";

// ใบเคลม / รอบแก้งาน (ก้อน 1 — เบสสั่ง 2026-09-18 "รื้อได้ แก้ที่ราก")
//
// หลักที่ยึด: ใบเคลมเก็บ "เจตนา + เส้นเชื่อม + ด่านปิด" เท่านั้น ไม่เขียนสถานะออเดอร์เอง
// (ผ่าน transitionOrder ทีละขั้นตามกติกาถอยสถานะใน SPEC) และไม่เขียนเงินเอง (ผ่าน billing)
//
// สิทธิ์: ตัดสินใบเคลมใช้ decide_claims (เจ้าของ/ผู้จัดการ/ฝ่ายขาย — เบสเคาะ 2026-09-18
// ว่าฝ่ายขายตัดสินได้เพราะเป็นคนรับเรื่อง) · แต่การ "สั่งงานแก้" ต้องถอยสถานะข้ามเส้น
// ของที่ออกจากโรงงานแล้ว จึงยังคุมด้วย supervise_operations ตามกติกาเดิม — ตัดสินกับลงมือ
// เป็นคนละกุญแจ เหมือนที่ตัดสินกับออกเอกสารเงินเป็นคนละกุญแจ
const claimDecider = requirePermission("decide_claims");
const supervisor = requirePermission("supervise_operations");

const CLAIM_INCLUDE = {
  lines: { orderBy: { size: "asc" } },
  invoices: { select: { id: true, type: true, invoiceNumber: true, totalAmount: true, isVoided: true } },
  steps: { select: { id: true, status: true, customStepName: true } },
  deliveries: { select: { id: true, status: true } },
} as const;

/** ยอดเอกสารเงินที่ออกให้ใบเคลมนี้และยังไม่ถูกยกเลิก */
function moneyDocTotals(invoices: { type: string; totalAmount: unknown; isVoided: boolean }[]) {
  const sum = (type: string) =>
    invoices
      .filter((invoice) => invoice.type === type && !invoice.isVoided)
      .reduce((total, invoice) => total + Number(invoice.totalAmount), 0);
  return { creditNoteTotal: sum("CREDIT_NOTE"), debitNoteTotal: sum("DEBIT_NOTE") };
}

export const claimRouter = router({
  byOrder: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const claims = await ctx.prisma.orderClaim.findMany({
        where: { orderId: input.orderId },
        orderBy: { round: "desc" },
        include: CLAIM_INCLUDE,
      });
      return claims.map((claim) => {
        const totals = sumClaimLines(claim.lines);
        const money = moneyDocTotals(claim.invoices);
        return {
          ...claim,
          agreedCredit: Number(claim.agreedCredit),
          agreedCharge: Number(claim.agreedCharge),
          qtyClaimed: totals.qtyClaimed,
          qtyAccepted: totals.qtyAccepted,
          ...money,
          openReworkSteps: claim.steps.filter((step) => step.status !== "COMPLETED").length,
        };
      });
    }),

  open: protectedProcedure
    .use(claimDecider)
    .input(
      z.object({
        orderId: z.string(),
        source: z.enum(["CUSTOMER_REPORT", "INTERNAL_FOUND", "QC_AFTER_DELIVERY"]),
        title: z.string().trim().min(1, "ใส่เรื่องที่เกิดขึ้นสั้นๆ ก่อน").max(200),
        detail: z.string().trim().max(2000).optional(),
        reportedAt: z.coerce.date().optional(),
        lines: z
          .array(
            z.object({
              size: z.string().trim().min(1),
              color: z.string().trim().max(60).optional(),
              qtyClaimed: z.number().int().min(1),
            }),
          )
          .default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.prisma.order.findUnique({
        where: { id: input.orderId },
        select: { id: true, customerId: true, orderNumber: true },
      });
      if (!order) notFound("ออเดอร์", input.orderId);

      const claim = await ctx.prisma.$transaction(async (tx) =>
        openClaim(tx, {
          orderId: order.id,
          customerId: order.customerId,
          source: input.source,
          title: input.title,
          detail: input.detail,
          reportedAt: input.reportedAt,
          openedById: ctx.userId!,
          lines: input.lines,
        }),
      );

      await createAuditLog(ctx.prisma, {
        userId: ctx.userId!,
        action: "CREATE",
        entityType: "ORDER_CLAIM",
        entityId: claim.id,
        newValue: { claimNumber: claim.claimNumber, orderNumber: order.orderNumber, source: input.source },
      });
      return claim;
    }),

  decide: protectedProcedure
    .use(claimDecider)
    .input(
      byIdInput.extend({
        resolution: z.enum(["REWORK", "REPLACE", "DISCOUNT", "REFUND", "EXTRA_CHARGE", "GOODWILL", "REJECTED"]),
        fault: z.enum(["UNDETERMINED", "SHOP", "CUSTOMER", "VENDOR", "MATERIAL", "CARRIER", "NONE"]),
        agreedCredit: z.number().min(0).default(0),
        agreedCharge: z.number().min(0).default(0),
        resolutionNote: z.string().trim().max(2000).optional(),
        faultNote: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const claim = await ctx.prisma.orderClaim.findUnique({
        where: { id: input.id },
        select: { id: true, state: true, orderId: true, claimNumber: true },
      });
      if (!claim) notFound("ใบเคลม", input.id);
      if (claim.state === "CLOSED" || claim.state === "CANCELLED") {
        badRequest("ใบเคลมนี้จบไปแล้ว — เปิดใบใหม่ถ้ามีเรื่องเพิ่ม");
      }

      // ลดราคา/คืนเงิน = ต้องมีใบกำกับให้อ้าง ไม่งั้นออกใบลดหนี้ไม่ได้ตามกฎหมาย และใบเคลม
      // จะค้างปิดไม่ลงตลอดกาล — บอกทางไปต่อตรงๆ แทนที่จะปล่อยให้ไปติดตอนออกเอกสาร
      if (input.resolution === "DISCOUNT" || input.resolution === "REFUND") {
        const billable = await ctx.prisma.invoice.count({
          where: {
            orderId: claim.orderId,
            isVoided: false,
            type: { in: ["DEPOSIT_INVOICE", "FINAL_INVOICE", "RECEIPT"] },
          },
        });
        if (billable === 0) {
          badRequest(
            "ออเดอร์นี้ยังไม่ได้วางบิล — ออกใบกำกับงวดนี้ก่อน แล้วจึงออกใบลดหนี้ตามใบเคลม",
          );
        }
      }

      const updated = await ctx.prisma.$transaction(async (tx) => {
        const saved = await tx.orderClaim.update({
          where: { id: claim.id },
          data: {
            state: "DECIDED",
            resolution: input.resolution,
            fault: input.fault,
            faultNote: input.faultNote ?? null,
            resolutionNote: input.resolutionNote ?? null,
            agreedCredit: input.agreedCredit,
            agreedCharge: input.agreedCharge,
            decidedById: ctx.userId!,
            decidedAt: new Date(),
          },
        });
        await addOrderRevision(tx, {
          orderId: claim.orderId,
          changedBy: ctx.userId!,
          changeType: "CLAIM",
          description: `ตัดสินใบเคลม ${claim.claimNumber}`,
        });
        return saved;
      });

      await createAuditLog(ctx.prisma, {
        userId: ctx.userId!,
        action: "UPDATE",
        entityType: "ORDER_CLAIM",
        entityId: claim.id,
        newValue: {
          claimNumber: claim.claimNumber,
          resolution: input.resolution,
          fault: input.fault,
          agreedCredit: input.agreedCredit,
          agreedCharge: input.agreedCharge,
        },
      });
      return updated;
    }),

  /**
   * สั่งงานแก้เข้าสายผลิต — ถอยสถานะทีละขั้นตามกติกาเดิมจนถึง "กำลังผลิต" แล้วเปิดขั้นงานแก้
   * เหตุผลที่ส่งลงขั้นงานเป็นข้อความตายตัวที่ไม่มียอดเงิน เพราะ notes ของขั้นคือสิ่งที่ช่างอ่าน
   */
  startRework: protectedProcedure
    .use(supervisor)
    .input(byIdInput)
    .mutation(async ({ ctx, input }) => {
      const claim = await ctx.prisma.orderClaim.findUnique({
        where: { id: input.id },
        select: { id: true, state: true, resolution: true, orderId: true, claimNumber: true, round: true },
      });
      if (!claim) notFound("ใบเคลม", input.id);
      if (claim.state !== "DECIDED" || !resolutionNeedsRework(claim.resolution)) {
        badRequest("ใบเคลมนี้ยังไม่ได้ตัดสินว่าจะซ่อม/ทำใหม่ — ตัดสินก่อนถึงจะสั่งงานแก้ได้");
      }

      return ctx.prisma.$transaction(async (tx) => {
        await lockOrderRow(tx, claim.orderId);
        const order = await tx.order.findUniqueOrThrow({
          where: { id: claim.orderId },
          select: { internalStatus: true, orderType: true },
        });

        const flowSteps = getFlowSteps(order.orderType as OrderType) as readonly string[];
        // ถอยทีละขั้นตามกติกา SPEC — ไม่กระโดด ไม่เขียนสถานะเอง
        let current = order.internalStatus as InternalStatus;
        const reason = `งานแก้ตามใบเคลม ${claim.claimNumber} (รอบที่ ${claim.round})`;
        let guard = 0;
        while (current !== "PRODUCING") {
          if (guard++ > 6) badRequest("ถอยสถานะไม่ถึงขั้นผลิต — ตรวจเส้นทางงานของออเดอร์นี้");
          const allowed = getNextStatuses(order.orderType as OrderType, current);
          const back = singleBackStatus({ flowSteps, internalStatus: current, allowedTargets: allowed });
          if (!back) {
            badRequest(
              `ออเดอร์อยู่สถานะ "${current}" ซึ่งถอยกลับไปผลิตอัตโนมัติไม่ได้ — ถอยด้วยปุ่มบนหัวใบออเดอร์ก่อน`,
            );
          }
          const moved = await transitionOrder(tx, {
            orderId: claim.orderId,
            to: back as InternalStatus,
            changedBy: ctx.userId!,
            reason,
          });
          if (!moved.changed) break;
          current = back as InternalStatus;
        }

        const reopened = await reopenProductionsForRework(tx, {
          orderId: claim.orderId,
          reason,
          claimId: claim.id,
          stepName: `งานแก้ ${claim.claimNumber}`,
        });
        if (reopened === 0) {
          badRequest("ออเดอร์นี้ไม่มีใบผลิตที่ปิดแล้วให้เปิดงานแก้ — เปิดใบผลิตรอบใหม่แทน");
        }

        await addOrderRevision(tx, {
          orderId: claim.orderId,
          changedBy: ctx.userId!,
          changeType: "CLAIM",
          description: `สั่งงานแก้ตามใบเคลม ${claim.claimNumber}`,
        });
        return { reopened };
      });
    }),

  close: protectedProcedure
    .use(claimDecider)
    .input(byIdInput.extend({ closeNote: z.string().trim().max(1000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const claim = await ctx.prisma.orderClaim.findUnique({
        where: { id: input.id },
        include: { ...CLAIM_INCLUDE, order: { select: { internalStatus: true } } },
      });
      if (!claim) notFound("ใบเคลม", input.id);

      const money = moneyDocTotals(claim.invoices);
      const blockers = claimCloseBlockers({
        state: claim.state,
        resolution: claim.resolution,
        agreedCredit: Number(claim.agreedCredit),
        agreedCharge: Number(claim.agreedCharge),
        creditNoteTotal: money.creditNoteTotal,
        debitNoteTotal: money.debitNoteTotal,
        reworkSteps: claim.steps.length,
        openReworkSteps: claim.steps.filter((step) => step.status !== "COMPLETED").length,
        orderBackToShipped: ["SHIPPED", "COMPLETED"].includes(claim.order.internalStatus),
        closeNote: input.closeNote ?? null,
      });
      if (blockers.length > 0) badRequest(`ปิดใบเคลมยังไม่ได้ — ${blockers.join(" · ")}`);

      const closed = await ctx.prisma.$transaction(async (tx) => {
        const saved = await tx.orderClaim.update({
          where: { id: claim.id },
          data: {
            state: "CLOSED",
            closedById: ctx.userId!,
            closedAt: new Date(),
            closeNote: input.closeNote ?? null,
          },
        });
        await addOrderRevision(tx, {
          orderId: claim.orderId,
          changedBy: ctx.userId!,
          changeType: "CLAIM",
          description: `ปิดใบเคลม ${claim.claimNumber}`,
        });
        return saved;
      });

      await createAuditLog(ctx.prisma, {
        userId: ctx.userId!,
        action: "UPDATE",
        entityType: "ORDER_CLAIM",
        entityId: claim.id,
        newValue: { claimNumber: claim.claimNumber, closed: true },
      });
      return closed;
    }),

  cancel: protectedProcedure
    .use(claimDecider)
    .input(byIdInput.extend({ reason: z.string().trim().min(1, "ใส่เหตุผลที่ยกเลิกเรื่องด้วย").max(500) }))
    .mutation(async ({ ctx, input }) => {
      const claim = await ctx.prisma.orderClaim.findUnique({
        where: { id: input.id },
        select: { id: true, state: true, orderId: true, claimNumber: true, steps: { select: { id: true } } },
      });
      if (!claim) notFound("ใบเคลม", input.id);
      if (claim.state === "CLOSED") badRequest("ใบเคลมนี้ปิดไปแล้ว ยกเลิกย้อนหลังไม่ได้");
      if (claim.steps.length > 0) {
        badRequest("สั่งงานแก้เข้าสายผลิตไปแล้ว — ยกเลิกเรื่องไม่ได้ ให้ปิดใบพร้อมเขียนเหตุผลแทน");
      }

      return ctx.prisma.$transaction(async (tx) => {
        const saved = await tx.orderClaim.update({
          where: { id: claim.id },
          data: {
            state: "CANCELLED",
            closedById: ctx.userId!,
            closedAt: new Date(),
            closeNote: input.reason,
          },
        });
        await addOrderRevision(tx, {
          orderId: claim.orderId,
          changedBy: ctx.userId!,
          changeType: "CLAIM",
          description: `ยกเลิกเรื่องใบเคลม ${claim.claimNumber}: ${input.reason}`,
        });
        return saved;
      });
    }),
});
