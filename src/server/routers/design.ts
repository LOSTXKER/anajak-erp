import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure, requirePermission } from "../trpc";
import { randomBytes } from "crypto";
import { fileUrlSchema } from "@/server/schemas";
import { withFileToken } from "@/lib/file-urls";
import { createAuditLog, createNotification } from "@/server/helpers";
import { transitionOrder, processDesignApproval } from "@/server/services/order-status";
import type { InternalStatus } from "@prisma/client";
import type { PrismaTx } from "@/lib/prisma";

const designerUp = requirePermission("manage_design_files");
// บันทึกผลอนุมัติแทนลูกค้า = คนถือความสัมพันธ์ลูกค้า — ไม่ให้ DESIGNER อนุมัติแบบตัวเอง
const salesUp = requirePermission("create_sales_docs");

const APPROVAL_TOKEN_TTL_DAYS = 30;

// เฟสที่ออเดอร์ยังอยู่ในงานออกแบบ — mirror เงื่อนไข canUpload/canApprove ฝั่ง UI
// (ยุบเหลือ DESIGNING สถานะเดียว — "ส่งเข้าออกแบบ" จาก CONFIRMED มาที่นี่ตรง)
const UPLOADABLE_STATUSES: InternalStatus[] = ["DESIGNING"];
const APPROVABLE_STATUSES: InternalStatus[] = ["DESIGNING"];

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

// ผลตัดสินแบบ → กระดิ่งทีม (ทั้ง path ลูกค้ากดเองและขายบันทึกแทน — ห้าม drift กัน)
// ขาย/แอดมินถือความสัมพันธ์ลูกค้า · กราฟิกรับงานแก้ · เจ้าของ/ผู้จัดการเห็นภาพรวม
async function notifyDesignDecision(
  tx: PrismaTx,
  params: {
    orderId: string;
    orderNumber: string;
    orderTitle: string;
    versionNumber: number;
    approved: boolean;
    comment?: string | null;
    titlePrefix: string; // "ลูกค้า" หรือ "ขายบันทึกผล: ลูกค้า"
    excludeUserId?: string; // คนกดเองไม่ต้องได้กระดิ่งตัวเอง
  }
) {
  const team = await tx.user.findMany({
    where: {
      role: { in: ["OWNER", "MANAGER", "SALES", "DESIGNER"] },
      isActive: true,
      ...(params.excludeUserId ? { id: { not: params.excludeUserId } } : {}),
    },
    select: { id: true },
  });
  for (const member of team) {
    await createNotification(tx, {
      userId: member.id,
      type: "ORDER",
      title: params.approved
        ? `${params.titlePrefix}อนุมัติแบบ v${params.versionNumber} — ${params.orderNumber}`
        : `${params.titlePrefix}ขอแก้แบบ v${params.versionNumber} — ${params.orderNumber}`,
      message: params.comment || params.orderTitle,
      link: `/orders/${params.orderId}`,
      entityType: "ORDER",
      entityId: params.orderId,
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
        fileUrl: fileUrlSchema,
        thumbnailUrl: fileUrlSchema.optional(),
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

        // เปลี่ยนสถานะผ่าน service กลาง — ตอกย้ำสถานะ DESIGNING (อยู่แล้ว = no-op
        // · พ้นเฟสออกแบบไประหว่างทาง = โยน error ทั้ง transaction ถูก rollback รวม version ที่เพิ่งสร้าง)
        await transitionOrder(tx, {
          orderId: input.orderId,
          to: "DESIGNING",
          changedBy: ctx.userId,
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

  // ลิงก์อนุมัติหมดอายุ (30 วัน) → สร้างใหม่ได้ เฉพาะแบบที่ยังรอลูกค้าตัดสิน
  // (เดิม regenerate ไม่ได้เลย — ลูกค้าหายไปเดือนกว่ากลับมา ทีมต้องอัปแบบซ้ำทั้งที่ไฟล์เดิม
  // audit ข้อ 17) · แบบที่ตัดสินแล้วไม่มีลิงก์ใหม่ — ผลตัดสินจบแล้ว
  regenerateToken: protectedProcedure
    .use(requirePermission("create_design_assets"))
    .input(z.object({ designId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.designVersion.findUniqueOrThrow({
        where: { id: input.designId },
        select: { approvalStatus: true, orderId: true, versionNumber: true },
      });
      if (existing.approvalStatus !== "PENDING") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "แบบนี้ถูกตัดสินไปแล้ว — สร้างลิงก์ใหม่ได้เฉพาะแบบที่รอลูกค้าตัดสิน",
        });
      }
      const design = await ctx.prisma.designVersion.update({
        where: { id: input.designId },
        data: {
          approvalToken: randomBytes(32).toString("hex"),
          tokenExpiresAt: approvalTokenExpiry(),
        },
      });
      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "DESIGN_VERSION",
        entityId: input.designId,
        reason: `สร้างลิงก์อนุมัติใหม่ (v${existing.versionNumber})`,
      });
      return design;
    }),

  // Public endpoint for customer approval via token
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      // select แคบ — payload นี้ถึงมือลูกค้านอกระบบ ห้ามคืนทั้ง row
      const design = await ctx.prisma.designVersion.findUniqueOrThrow({
        where: { approvalToken: input.token },
        select: {
          versionNumber: true,
          fileUrl: true,
          approvalStatus: true,
          customerComment: true,
          designerNotes: true,
          tokenExpiresAt: true,
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
      // ไฟล์เป็น proxy URL (bucket private) — ลูกค้าไม่มี session ต้องพก token
      // ไปกับ URL ให้ /api/files เช็คว่าเป็นไฟล์ของแบบใบนี้จริง
      return {
        ...design,
        fileUrl: withFileToken(design.fileUrl, input.token),
      };
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

      // ผลตัดสิน + สถานะออเดอร์ + revision = transaction เดียว (เดิมแยกก้อน — ค้างครึ่งทางได้)
      return ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.designVersion.updateMany({
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

        const design = await tx.designVersion.findUniqueOrThrow({
          where: { id: input.designId },
          include: { order: true },
        });

        await processDesignApproval(tx, {
          design: { orderId: design.orderId, versionNumber: design.versionNumber },
          approved: input.approved,
          comment: input.comment,
          changedBy: ctx.userId,
          descriptionPrefix: "",
        });

        // ขายบันทึกผลแทนลูกค้า — กราฟิก/คนอื่นในทีมยังต้องรู้ (เฉพาะคนกดที่รู้อยู่แล้ว ไม่ต้อง)
        await notifyDesignDecision(tx, {
          orderId: design.orderId,
          orderNumber: design.order.orderNumber,
          orderTitle: design.order.title,
          versionNumber: design.versionNumber,
          approved: input.approved,
          comment: input.comment,
          titlePrefix: "ลูกค้า",
          excludeUserId: ctx.userId,
        });

        return design;
      });
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

      // ผลตัดสิน + สถานะออเดอร์ + revision = transaction เดียว
      // updateMany แบบมีเงื่อนไข status — กันยิงพร้อมกัน (race) สองคำขอผ่านพร้อมกัน
      return ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.designVersion.updateMany({
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

        // select แคบ — payload นี้ถึงมือคนถือ token นอกระบบ ห้ามคืน Order ทั้ง row
        // (ต้นทุน/กำไร/โน้ตภายในอยู่บน Order — หลักเดียวกับ getByToken)
        const design = await tx.designVersion.findUniqueOrThrow({
          where: { id: existing.id },
          select: {
            orderId: true,
            versionNumber: true,
            approvalStatus: true,
            order: { select: { orderNumber: true, title: true } },
          },
        });

        await processDesignApproval(tx, {
          design: { orderId: design.orderId, versionNumber: design.versionNumber },
          approved: input.approved,
          comment: input.comment,
          changedBy: "ลูกค้า",
          descriptionPrefix: "ลูกค้า",
        });

        // ลูกค้าตัดสินแบบเองนอกเวลางานได้ — ทีมต้องรู้จากกระดิ่ง ไม่ใช่รอเปิดออเดอร์เจอเอง
        await notifyDesignDecision(tx, {
          orderId: design.orderId,
          orderNumber: design.order.orderNumber,
          orderTitle: design.order.title,
          versionNumber: design.versionNumber,
          approved: input.approved,
          comment: input.comment,
          titlePrefix: "ลูกค้า",
        });

        return {
          approvalStatus: design.approvalStatus,
          versionNumber: design.versionNumber,
        };
      });
    }),
});
