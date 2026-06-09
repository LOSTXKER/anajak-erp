import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure, requireRole } from "../trpc";
import { randomBytes } from "crypto";
import { createAuditLog, processDesignApproval } from "@/server/helpers";
import type { InternalStatus } from "@prisma/client";

const designerUp = requireRole("OWNER", "MANAGER", "DESIGNER");
// บันทึกผลอนุมัติแทนลูกค้า = คนถือความสัมพันธ์ลูกค้า — ไม่ให้ DESIGNER อนุมัติแบบตัวเอง
const salesUp = requireRole("OWNER", "MANAGER", "SALES");

const APPROVAL_TOKEN_TTL_DAYS = 30;

// เฟสที่ออเดอร์ยังอยู่ในงานออกแบบ — mirror เงื่อนไข canUpload/canApprove ฝั่ง UI
const UPLOADABLE_STATUSES: InternalStatus[] = [
  "DESIGN_PENDING",
  "DESIGNING",
  "AWAITING_APPROVAL",
];
const APPROVABLE_STATUSES: InternalStatus[] = ["DESIGNING", "AWAITING_APPROVAL"];

function approvalTokenExpiry(): Date {
  return new Date(Date.now() + APPROVAL_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function assertTokenNotExpired(design: { tokenExpiresAt: Date | null }) {
  // fail-closed: ไม่มีวันหมดอายุ (แถวเก่าก่อนเพิ่ม field) = ถือว่าหมดอายุ
  if (!design.tokenExpiresAt || design.tokenExpiresAt < new Date()) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "ลิงก์อนุมัติแบบหมดอายุแล้ว กรุณาติดต่อร้านเพื่อขอลิงก์ใหม่",
    });
  }
}

function assertOrderInDesignPhase(internalStatus: InternalStatus) {
  if (!APPROVABLE_STATUSES.includes(internalStatus)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "ออเดอร์นี้พ้นขั้นตอนออกแบบไปแล้ว ตัดสินแบบไม่ได้ กรุณาติดต่อร้าน",
    });
  }
}

export const designRouter = router({
  listByOrder: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.designVersion.findMany({
        where: { orderId: input.orderId },
        orderBy: { versionNumber: "desc" },
      });
    }),

  upload: protectedProcedure
    .use(designerUp)
    .input(
      z.object({
        orderId: z.string(),
        fileUrl: z.string(),
        thumbnailUrl: z.string().optional(),
        designerNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // upload ได้เฉพาะออเดอร์ที่อยู่เฟสออกแบบ — กัน DESIGNER ดึงสถานะ
      // ออเดอร์ที่ผลิต/ส่งแล้วกลับมา DESIGNING (mirror เงื่อนไข canUpload ฝั่ง UI)
      const order = await ctx.prisma.order.findUniqueOrThrow({
        where: { id: input.orderId },
        select: { internalStatus: true },
      });
      if (!UPLOADABLE_STATUSES.includes(order.internalStatus)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "ออเดอร์นี้ไม่อยู่ในขั้นตอนออกแบบ อัปโหลดแบบไม่ได้",
        });
      }

      const design = await ctx.prisma.$transaction(async (tx) => {
        const lastVersion = await tx.designVersion.findFirst({
          where: { orderId: input.orderId },
          orderBy: { versionNumber: "desc" },
        });

        // ลิงก์อนุมัติของ version เก่าที่ยังค้าง PENDING ต้องตายทันที
        // ไม่งั้นลูกค้าถือลิงก์เก่าตัดสินแบบที่ถูกแทนที่แล้วได้
        await tx.designVersion.updateMany({
          where: { orderId: input.orderId, approvalStatus: "PENDING" },
          data: { tokenExpiresAt: new Date() },
        });

        const created = await tx.designVersion.create({
          data: {
            orderId: input.orderId,
            versionNumber: (lastVersion?.versionNumber ?? 0) + 1,
            fileUrl: input.fileUrl,
            thumbnailUrl: input.thumbnailUrl,
            designerNotes: input.designerNotes,
            approvalToken: randomBytes(32).toString("hex"),
            tokenExpiresAt: approvalTokenExpiry(),
          },
        });

        // เปลี่ยนเฉพาะเมื่อยังอยู่เฟสออกแบบ (เงื่อนไขใน where กัน race)
        await tx.order.updateMany({
          where: {
            id: input.orderId,
            internalStatus: { in: UPLOADABLE_STATUSES },
          },
          data: { internalStatus: "DESIGNING", customerStatus: "PREPARING" },
        });

        return created;
      });

      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "CREATE",
        entityType: "DESIGN_VERSION",
        entityId: design.id,
        newValue: { orderId: input.orderId, version: design.versionNumber },
      });

      return design;
    }),

  // Public endpoint for customer approval via token
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const design = await ctx.prisma.designVersion.findUniqueOrThrow({
        where: { approvalToken: input.token },
        include: {
          order: {
            select: {
              orderNumber: true,
              title: true,
              customer: { select: { name: true } },
            },
          },
        },
      });
      assertTokenNotExpired(design);
      return design;
    }),

  approve: protectedProcedure
    .use(salesUp)
    .input(
      z.object({
        designId: z.string(),
        approved: z.boolean(),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.designVersion.findUniqueOrThrow({
        where: { id: input.designId },
        select: {
          approvalStatus: true,
          order: { select: { internalStatus: true } },
        },
      });
      // guard ชุดเดียวกับ approveByToken — กันตัดสินซ้ำ + กันดึงสถานะ
      // ออเดอร์ที่พ้นเฟสออกแบบ (เช่น PRODUCING/SHIPPED) ถอยกลับ DESIGNING
      if (existing.approvalStatus !== "PENDING") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "แบบนี้ถูกตัดสินไปแล้ว — อัปโหลด version ใหม่หากต้องการแก้",
        });
      }
      assertOrderInDesignPhase(existing.order.internalStatus);

      const updated = await ctx.prisma.designVersion.updateMany({
        where: { id: input.designId, approvalStatus: "PENDING" },
        data: {
          approvalStatus: input.approved ? "APPROVED" : "REVISION_REQUESTED",
          customerComment: input.comment,
          approvedAt: input.approved ? new Date() : null,
        },
      });
      if (updated.count === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "แบบนี้ถูกตัดสินไปแล้ว — อัปโหลด version ใหม่หากต้องการแก้",
        });
      }

      const design = await ctx.prisma.designVersion.findUniqueOrThrow({
        where: { id: input.designId },
        include: { order: true },
      });

      await processDesignApproval(ctx.prisma, {
        design: { orderId: design.orderId, versionNumber: design.versionNumber },
        approved: input.approved,
        comment: input.comment,
        changedBy: ctx.userId,
        descriptionPrefix: "",
      });

      return design;
    }),

  // Public mutation for customer approval via token (no login required)
  approveByToken: publicProcedure
    .input(
      z.object({
        token: z.string(),
        approved: z.boolean(),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.designVersion.findUniqueOrThrow({
        where: { approvalToken: input.token },
        select: {
          id: true,
          approvalStatus: true,
          tokenExpiresAt: true,
          order: { select: { internalStatus: true } },
        },
      });
      assertTokenNotExpired(existing);
      // กันตัดสินซ้ำ/กลับคำที่ server — ตัดสินแล้วต้องให้ทีมงานเปิด version ใหม่เท่านั้น
      if (existing.approvalStatus !== "PENDING") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "แบบนี้ถูกตัดสินไปแล้ว หากต้องการเปลี่ยนแปลงกรุณาติดต่อร้าน",
        });
      }
      // ออเดอร์ต้องยังอยู่เฟสออกแบบ — token เก่าดึงสถานะออเดอร์ที่ผลิตแล้วกลับไม่ได้
      assertOrderInDesignPhase(existing.order.internalStatus);

      // updateMany แบบมีเงื่อนไข status — กันยิงพร้อมกัน (race) สองคำขอผ่านพร้อมกัน
      const updated = await ctx.prisma.designVersion.updateMany({
        where: { approvalToken: input.token, approvalStatus: "PENDING" },
        data: {
          approvalStatus: input.approved ? "APPROVED" : "REVISION_REQUESTED",
          customerComment: input.comment,
          approvedAt: input.approved ? new Date() : null,
        },
      });
      if (updated.count === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "แบบนี้ถูกตัดสินไปแล้ว หากต้องการเปลี่ยนแปลงกรุณาติดต่อร้าน",
        });
      }

      const design = await ctx.prisma.designVersion.findUniqueOrThrow({
        where: { id: existing.id },
        include: { order: { include: { customer: { select: { name: true } } } } },
      });

      await processDesignApproval(ctx.prisma, {
        design: { orderId: design.orderId, versionNumber: design.versionNumber },
        approved: input.approved,
        comment: input.comment,
        changedBy: "ลูกค้า",
        descriptionPrefix: "ลูกค้า",
      });

      return design;
    }),
});
