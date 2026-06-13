// ลิงก์อัปโหลดไฟล์ลูกค้า (FLOW-REDESIGN ก้อน 4 ชิ้น 3)
//
// ปัญหาแกน: ลูกค้าไม่มี account/session → browser ใช้ anon key อัปขึ้น storage ไม่ได้
// (RLS INSERT ให้เฉพาะ authenticated — ก้อน 4 ชิ้น 1) → ต้องออก "signed upload URL"
// ด้วย service role ฝั่ง server ให้ลูกค้าอัปตรงเข้า bucket ที่ path ที่ "server เลือกเอง"
//
// flow 3 จังหวะ (เลียน pattern ลิงก์อนุมัติแบบ — token บน Order):
//   1. staff สร้าง/รีเฟรช uploadToken บนออเดอร์ → ส่งลิงก์ /upload/<token> ใน LINE
//   2. ลูกค้าเปิดลิงก์ → เลือกไฟล์ → createUploadUrl ออก signed upload URL (path server คุม)
//   3. browser อัปตรงเข้า storage → confirmUpload บันทึก Attachment ชั้น 1 + กระดิ่งทีม
//
// ความปลอดภัย: server คุม path เองทั้งหมด (ลูกค้าเลือก path เองไม่ได้) · confirm ตรวจ
// path ขึ้นต้น <orderId>/customer/ (กันแนบข้ามออเดอร์/ข้ามชั้น) + เช็คว่าไฟล์ขึ้นจริง
// ก่อนบันทึก (กัน phantom row ชี้ไฟล์ที่ไม่มี) + cap จำนวน/ขนาด/นามสกุล

import { randomBytes } from "crypto";
import { TRPCError } from "@trpc/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { proxyFileUrl, safeFileExt } from "@/lib/file-urls";
import { createNotification } from "@/server/helpers";
import type { PrismaTx } from "@/lib/prisma";

const UPLOAD_TOKEN_TTL_DAYS = 30;
export const UPLOAD_BUCKET = "designs";
// 25MB — เท่าฝั่งแอดมินแนบ RAW (file-upload maxSizeMB) · บังคับจริงที่ bucket ไม่ได้จาก
// signed upload URL จึงเช็คขนาดที่ฝั่ง createUploadUrl (claimed) เป็นด่านแรก
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
// กันลิงก์ถูกใช้ถล่ม — ลูกค้าอัปได้สูงสุดต่อออเดอร์ (เกินนี้ติดต่อร้าน)
const MAX_CUSTOMER_FILES_PER_ORDER = 30;
// นามสกุลที่ลูกค้าอัปได้ (รูป/ไฟล์งานออกแบบ) — บัญชีขาว กันไฟล์อันตราย (exe/js/html/svg-xss)
const ALLOWED_EXTS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "heic", "heif", "bmp", "tif", "tiff",
  "pdf", "ai", "psd", "eps", "zip", "rar", "7z",
]);

export function uploadTokenExpiry(): Date {
  return new Date(Date.now() + UPLOAD_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function newUploadToken(): string {
  return randomBytes(32).toString("hex");
}

function customerPrefix(orderId: string): string {
  return `${orderId}/customer/`;
}

type TokenOrder = {
  id: string;
  orderNumber: string;
  title: string;
  deadline: Date | null;
  uploadTokenExpiresAt: Date | null;
  customer: { name: string };
};

/** หาออเดอร์จาก uploadToken + ตรวจหมดอายุ (fail-closed) — payload นี้ถึงมือลูกค้านอกระบบ ห้ามคืนทั้ง row */
export async function getOrderByUploadToken(
  prisma: Pick<PrismaTx, "order">,
  token: string
): Promise<TokenOrder> {
  const order = await prisma.order.findUnique({
    where: { uploadToken: token },
    select: {
      id: true,
      orderNumber: true,
      title: true,
      deadline: true,
      uploadTokenExpiresAt: true,
      customer: { select: { name: true } },
    },
  });
  if (!order) {
    throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบลิงก์อัปโหลดนี้" });
  }
  // fail-closed: ไม่มีวันหมดอายุ = ถือว่าหมดอายุ
  if (!order.uploadTokenExpiresAt || order.uploadTokenExpiresAt < new Date()) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "ลิงก์อัปโหลดหมดอายุแล้ว กรุณาติดต่อร้านเพื่อขอลิงก์ใหม่",
    });
  }
  return order;
}

/** ออก signed upload URL ให้ลูกค้าอัปไฟล์เดียว — server เลือก path เอง (ลูกค้ากำหนดไม่ได้) */
export async function createCustomerUploadUrl(params: {
  orderId: string;
  fileName: string;
  fileSize: number;
}): Promise<{ bucket: string; path: string; token: string }> {
  const ext = safeFileExt(params.fileName);
  if (!ALLOWED_EXTS.has(ext)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "ไฟล์ชนิดนี้อัปไม่ได้ — รองรับรูปภาพ/PDF/AI/PSD/ZIP",
    });
  }
  if (params.fileSize > MAX_UPLOAD_BYTES) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `ไฟล์ใหญ่เกินไป (สูงสุด ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)}MB)`,
    });
  }
  // ชื่อ object สุ่มไม่ซ้ำ + นามสกุล ASCII ล้วน (กัน path เพี้ยน/เทียบสิทธิ์พลาด)
  const objectName = `${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;
  const path = `${customerPrefix(params.orderId)}${objectName}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(UPLOAD_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data?.token) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "ออกลิงก์อัปโหลดไม่สำเร็จ กรุณาลองใหม่",
    });
  }
  return { bucket: UPLOAD_BUCKET, path: data.path, token: data.token };
}

/** บันทึก Attachment หลังลูกค้าอัปไฟล์สำเร็จ — ตรวจ path/มีไฟล์จริง/cap ก่อน */
export async function confirmCustomerUpload(
  prisma: PrismaTx,
  params: {
    order: { id: string; orderNumber: string; title: string };
    path: string;
    fileName: string;
    fileType: string;
    fileSize: number;
  }
) {
  const { order } = params;
  // 1) path ต้องอยู่ใต้โฟลเดอร์ของออเดอร์นี้เท่านั้น (กันแนบข้ามออเดอร์/ข้ามชั้น/traversal)
  const prefix = customerPrefix(order.id);
  if (
    !params.path.startsWith(prefix) ||
    params.path.includes("..") ||
    params.path.slice(prefix.length).includes("/")
  ) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "path ไฟล์ไม่ถูกต้อง" });
  }

  // 2) cap จำนวนไฟล์ลูกค้าต่อออเดอร์ (กันลิงก์ถูกใช้ถล่ม)
  const existing = await prisma.attachment.count({
    where: { entityType: "ORDER", entityId: order.id, uploadedById: null },
  });
  if (existing >= MAX_CUSTOMER_FILES_PER_ORDER) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "ไฟล์เต็มจำนวนที่อัปได้แล้ว กรุณาติดต่อร้าน",
    });
  }

  // 3) เช็คว่าไฟล์ขึ้น storage จริง ก่อนบันทึกแถว (กัน phantom row ชี้ไฟล์ที่ไม่มี
  //    — ลูกค้า/บอทยิง confirm มั่วโดยไม่อัปจริง)
  const admin = createAdminClient();
  const probe = await admin.storage
    .from(UPLOAD_BUCKET)
    .createSignedUrl(params.path, 60);
  if (probe.error || !probe.data?.signedUrl) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "ยังไม่พบไฟล์ที่อัป กรุณาลองใหม่",
    });
  }

  // 4) บันทึก Attachment ชั้น 1 (RAW) — uploadedById = null (ลูกค้า ไม่มี user)
  const attachment = await prisma.attachment.create({
    data: {
      entityType: "ORDER",
      entityId: order.id,
      fileName: params.fileName.slice(0, 255),
      fileUrl: proxyFileUrl(UPLOAD_BUCKET, params.path),
      fileType: params.fileType.slice(0, 100),
      fileSize: params.fileSize,
      category: "REFERENCE_IMAGE",
      uploadedById: null,
      notes: "อัปโหลดโดยลูกค้าผ่านลิงก์",
    },
  });

  // 5) กระดิ่งทีมที่ถือความสัมพันธ์ลูกค้า (ขาย/เจ้าของ/ผู้จัดการ) — ของจาก LINE เข้าออเดอร์แล้ว
  const team = await prisma.user.findMany({
    where: { role: { in: ["OWNER", "MANAGER", "SALES"] }, isActive: true },
    select: { id: true },
  });
  for (const member of team) {
    await createNotification(prisma, {
      userId: member.id,
      type: "ORDER",
      title: `ลูกค้าอัปไฟล์ — ${order.orderNumber}`,
      message: `${order.title}: ${params.fileName}`,
      link: `/orders/${order.id}`,
      entityType: "ORDER",
      entityId: order.id,
    });
  }

  return attachment;
}
