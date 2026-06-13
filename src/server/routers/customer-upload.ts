import { z } from "zod";
import { router, protectedProcedure, publicProcedure, requireRole } from "../trpc";
import { createAuditLog } from "@/server/helpers";
import { notFound } from "@/server/errors";
import {
  newUploadToken,
  uploadTokenExpiry,
  getOrderByUploadToken,
  createCustomerUploadUrl,
  confirmCustomerUpload,
} from "@/server/services/customer-upload";

// ลิงก์อัปโหลดไฟล์ลูกค้า (FLOW-REDESIGN ก้อน 4 ชิ้น 3)
// ฝั่งใน (staff) = protected · ฝั่งลูกค้าถือ token = public (เช็ค token ในแต่ละ procedure)
const salesUp = requireRole("OWNER", "MANAGER", "SALES");

export const customerUploadRouter = router({
  // staff สร้าง/รีเฟรช ลิงก์ — ออก token ใหม่เสมอ (ลิงก์เก่าตายทันที)
  generateLink: protectedProcedure
    .use(salesUp)
    .input(z.object({ orderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const order = await ctx.prisma.order.findUnique({
        where: { id: input.orderId },
        select: { id: true },
      });
      if (!order) notFound("ออเดอร์", input.orderId);

      const token = newUploadToken();
      const expiresAt = uploadTokenExpiry();
      await ctx.prisma.order.update({
        where: { id: input.orderId },
        data: { uploadToken: token, uploadTokenExpiresAt: expiresAt },
      });
      await createAuditLog(ctx.prisma, {
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "ORDER",
        entityId: input.orderId,
        reason: "สร้างลิงก์อัปโหลดไฟล์ให้ลูกค้า",
      });
      return { token, expiresAt };
    }),

  // OrderFilesCard ใช้โชว์ปุ่มคัดลอกลิงก์ (มี token = โชว์ปุ่ม · null = ปุ่ม "สร้างลิงก์")
  getLink: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const order = await ctx.prisma.order.findUnique({
        where: { id: input.orderId },
        select: { uploadToken: true, uploadTokenExpiresAt: true },
      });
      return {
        token: order?.uploadToken ?? null,
        expiresAt: order?.uploadTokenExpiresAt ?? null,
      };
    }),

  // ── ฝั่งลูกค้า (public — ถือ token) ──

  // ข้อมูลย่อให้หน้า /upload/<token> โชว์ (ห้ามคืนข้อมูลภายใน — เงิน/สถานะผลิต)
  getInfo: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const order = await getOrderByUploadToken(ctx.prisma, input.token);
      const files = await ctx.prisma.attachment.findMany({
        where: { entityType: "ORDER", entityId: order.id, uploadedById: null },
        select: { fileName: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });
      return {
        orderNumber: order.orderNumber,
        title: order.title,
        customerName: order.customer.name,
        deadline: order.deadline,
        files,
      };
    }),

  // ออก signed upload URL ให้อัปไฟล์เดียว (server เลือก path — ลูกค้ากำหนดไม่ได้)
  createUploadUrl: publicProcedure
    .input(
      z.object({
        token: z.string(),
        fileName: z.string().min(1),
        fileSize: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const order = await getOrderByUploadToken(ctx.prisma, input.token);
      const signed = await createCustomerUploadUrl({
        orderId: order.id,
        fileName: input.fileName,
        fileSize: input.fileSize,
      });
      return {
        bucket: signed.bucket,
        path: signed.path,
        uploadToken: signed.token,
      };
    }),

  // บันทึก Attachment หลังลูกค้าอัปไฟล์ขึ้น storage สำเร็จ
  confirmUpload: publicProcedure
    .input(
      z.object({
        token: z.string(),
        path: z.string(),
        fileName: z.string().min(1),
        fileType: z.string(),
        fileSize: z.number().int().nonnegative(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const order = await getOrderByUploadToken(ctx.prisma, input.token);
      await confirmCustomerUpload(ctx.prisma, {
        order: { id: order.id, orderNumber: order.orderNumber, title: order.title },
        path: input.path,
        fileName: input.fileName,
        fileType: input.fileType,
        fileSize: input.fileSize,
      });
      return { ok: true };
    }),
});
