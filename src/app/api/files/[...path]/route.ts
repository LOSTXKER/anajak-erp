import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { prisma } from "@/lib/prisma";
import {
  ALLOWED_FILE_BUCKETS,
  parseProxyFileUrl,
  safeDecode,
} from "@/lib/file-urls";

// ประตูไฟล์เดียวของทั้งระบบ (FLOW-REDESIGN ก้อน 4 — signed URL)
// DB เก็บ URL รูปแบบ /api/files/<bucket>/<path> → ทุกการเปิดไฟล์วิ่งผ่าน route นี้:
// เช็คสิทธิ์ → ขอ signed URL อายุสั้นด้วย service role → redirect
//
// สิทธิ์ 2 ทาง (middleware ปล่อย /api/* ผ่าน — route นี้เช็คเองทั้งหมด):
// 1. พนักงาน login (มี session) — เปิดได้ทุกไฟล์
// 2. ลูกค้าถือ approval token (?t=) — เปิดได้เฉพาะไฟล์ของ DesignVersion ใบนั้น
//    (= ชั้น 2 แบบขออนุมัติเท่านั้น โดยโครงสร้าง — ไฟล์ชั้น 1/3 ไม่มีทางหลุดผ่านทางนี้)

const SIGNED_URL_TTL_SECONDS = 3600;
// ให้ browser cache คำตอบ redirect สั้นกว่าอายุ signed URL พอประมาณ —
// เปิดหน้าเดิมซ้ำไม่ต้องยิง route นี้ใหม่ทุกรูป แต่ลิงก์ที่ cache ไว้ไม่มีวันชี้ URL ที่ตายแล้ว
const REDIRECT_CACHE_SECONDS = 3000;

function deny(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  if (!segments || segments.length < 2) {
    return deny(400, "path ไม่ถูกต้อง");
  }
  const [bucket, ...rest] = segments;
  if (!(ALLOWED_FILE_BUCKETS as readonly string[]).includes(bucket)) {
    return deny(400, "bucket ไม่ถูกต้อง");
  }
  // กัน path traversal — segment ว่าง/จุดล้วนต้องไม่หลุดไปถึง storage API
  if (rest.some((s) => !s || s === "." || s === "..")) {
    return deny(400, "path ไม่ถูกต้อง");
  }
  const objectPath = rest.join("/");

  const user = await getServerSession();
  if (user) {
    // session อย่างเดียวไม่พอ — มาตรฐานเดียวกับ createContext (trpc.ts):
    // ต้องมีแถว User ใน ERP และ isActive (Supabase auth user ≠ พนักงานที่ยังทำงานอยู่)
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
      select: { isActive: true },
    });
    if (!dbUser?.isActive) {
      return deny(403, "บัญชีนี้เข้าถึงไฟล์ไม่ได้");
    }
  } else {
    const token = req.nextUrl.searchParams.get("t");
    if (!token) {
      return deny(401, "ต้องเข้าสู่ระบบ หรือเปิดผ่านลิงก์ที่ได้รับ");
    }
    // ลูกค้าถือ token — เปิดได้เฉพาะไฟล์/รูปตัวอย่างของแบบใบนั้น (fail-closed เหมือน design router)
    const design = await prisma.designVersion.findUnique({
      where: { approvalToken: token },
      select: { fileUrl: true, thumbnailUrl: true, tokenExpiresAt: true },
    });
    if (!design || !design.tokenExpiresAt || design.tokenExpiresAt < new Date()) {
      return deny(403, "ลิงก์หมดอายุหรือไม่ถูกต้อง");
    }
    // เทียบแบบ parse+decode ทั้งสองฝั่ง — ค่าใน DB อาจ percent-encoded (ผ่าน
    // normalizeFileUrl ที่คืน URL.pathname) แต่ Next decode path param ให้แล้ว
    const allowed = [design.fileUrl, design.thumbnailUrl]
      .map((u) => parseProxyFileUrl(u))
      .filter((p): p is { bucket: string; path: string } => p !== null);
    const isAllowed = allowed.some(
      (p) => p.bucket === bucket && safeDecode(p.path) === objectPath
    );
    if (!isAllowed) {
      return deny(403, "ลิงก์นี้เปิดไฟล์นี้ไม่ได้");
    }
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    return deny(404, "ไม่พบไฟล์");
  }

  return NextResponse.redirect(data.signedUrl, {
    status: 302,
    headers: { "Cache-Control": `private, max-age=${REDIRECT_CACHE_SECONDS}` },
  });
}
