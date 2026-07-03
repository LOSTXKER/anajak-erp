import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { JobShareView } from "./job-share-view";

// หน้าใบงานร้านนอก (Gate B14 — เปิดผ่านลิงก์ token ไม่ต้อง login)
// wrapper ฝั่ง server มีไว้ทำ OG metadata อย่างเดียว — LINE unfurl ลิงก์เป็นการ์ด
// title/description ให้ร้านเห็นสรุปงานก่อนกด · เนื้อหาจริง render ฝั่ง client ผ่าน tRPC public

function bkkDate(d: Date): string {
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const job = await prisma.outsourceOrder.findUnique({
    where: { shareToken: token },
    select: { description: true, quantity: true, expectedBackAt: true, shareTokenExpiresAt: true },
  });
  // ลิงก์ตาย/หมดอายุ → metadata กลางๆ ไม่บอกอะไร (เนื้อหาบนหน้าเองจะฟ้องว่าลิงก์ใช้ไม่ได้)
  if (!job || !job.shareTokenExpiresAt || job.shareTokenExpiresAt < new Date()) {
    return { title: "ใบงานผลิต", robots: { index: false } };
  }
  const title = `ใบงาน: ${job.description} — ${job.quantity} ชิ้น`;
  const description = job.expectedBackAt
    ? `กำหนดส่งคืน ${bkkDate(job.expectedBackAt)} · เปิดดูตารางไซซ์ + ไฟล์ลาย`
    : "เปิดดูตารางไซซ์ + ไฟล์ลาย";
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description },
  };
}

export default async function JobSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <JobShareView token={token} />;
}
