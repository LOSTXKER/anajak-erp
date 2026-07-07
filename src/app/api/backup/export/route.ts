/**
 * GET /api/backup/export — ดาวน์โหลดสำรองข้อมูลทั้งฐานเป็นไฟล์ JSON (เจ้าของเท่านั้น)
 *
 * เบสเคาะ 2026-07-07: ใช้ export มือแทน backup อัตโนมัติ (Supabase แผนฟรีไม่มี)
 * — กดจาก ตั้งค่า → สำรองข้อมูล · gate มาตรฐานเดียวกับ /api/files (session → User
 * active) + hasPermission manage_users (non-overridable = OWNER เสมอ) · audit ทุกครั้ง
 * เพราะไฟล์มีข้อมูลลับทั้งระบบ (ลูกค้า/เงิน/key เชื่อม Stock)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/supabase-server";
import { hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/server/helpers";
import { buildBackupExport, jsonReplacer } from "@/server/services/backup-export";

export const runtime = "nodejs";
// เพดานจริงของขาอ่านคือ tx timeout 120s ใน service — 300 เผื่อ auth+serialize+ส่งไฟล์
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function deny(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const session = await getServerSession();
  if (!session) return deny(401, "กรุณาเข้าสู่ระบบ");

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: session.id },
    select: { id: true, role: true, isActive: true, permissionOverrides: true },
  });
  if (!dbUser?.isActive || !hasPermission(dbUser.role, dbUser.permissionOverrides, "manage_users")) {
    return deny(403, "เจ้าของเท่านั้นที่ดาวน์โหลดไฟล์สำรองข้อมูลได้");
  }

  let data;
  try {
    data = await buildBackupExport(prisma);
  } catch (err) {
    // ล้มกลาง tx (เช่น timeout) — ตอบไทยอ่านรู้เรื่องแทน 500 ดิบของ Next (review จับ)
    console.error("[backup/export] ล้มเหลว", err);
    return deny(500, "สำรองข้อมูลไม่สำเร็จ — ลองใหม่อีกครั้ง");
  }

  // audit ก่อนส่งไฟล์ — ข้อมูลลับทั้งระบบออกนอกบ้าน ต้องมีร่องรอยเสมอ
  await createAuditLog(prisma, {
    userId: dbUser.id,
    action: "EXPORT",
    entityType: "DATABASE_BACKUP",
    entityId: data.exportedAt,
    newValue: { tableCount: data.tableCount, rowCount: data.rowCount },
    reason: "ดาวน์โหลดไฟล์สำรองข้อมูลทั้งระบบ",
  });

  // 2026-07-07T09:30 → 2026-07-07-0930 (พอระบุไฟล์ได้ ไม่ต้องเป๊ะ timezone)
  const stamp = data.exportedAt.slice(0, 16).replace("T", "-").replace(":", "");
  return new NextResponse(JSON.stringify(data, jsonReplacer), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="anajak-erp-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
