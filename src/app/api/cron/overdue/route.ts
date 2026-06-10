import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sweepOverdueInvoices } from "@/server/services/overdue";

// cron กวาดบิลเลยกำหนด — Vercel Cron ยิง GET ทุกวันตาม vercel.json (00:05 เวลาไทย)
// พร้อม header Authorization: Bearer <CRON_SECRET> ให้อัตโนมัติเมื่อตั้ง env CRON_SECRET
// route นี้อยู่ใต้ /api ที่ middleware ปล่อยผ่าน — ต้อง fail-closed: ไม่มี secret = ปฏิเสธทุก request

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await sweepOverdueInvoices(prisma);
  return Response.json(result);
}
