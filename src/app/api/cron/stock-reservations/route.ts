import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sweepStaleReservations } from "@/server/services/stock-reservation-sweep";

// cron auto-release จองสต๊อกค้าง — Vercel Cron ยิง GET ทุกวันตาม vercel.json (00:10 เวลาไทย)
// เตือนล่วงหน้าออเดอร์ที่จองค้าง 2 วันยังไม่จ่ายมัดจำ + ปลดจองคืนเมื่อค้างครบ 3 วัน
// route นี้อยู่ใต้ /api ที่ middleware ปล่อยผ่าน — fail-closed: ไม่มี secret = ปฏิเสธทุก request

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await sweepStaleReservations(prisma);
  return Response.json(result);
}
