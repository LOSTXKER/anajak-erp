import type { Metadata } from "next";
import { Suspense } from "react";

/**
 * หน้าใต้ /proto ใช้ตัวเลข ราคา ชื่อลูกค้าปลอมทั้งหมด — หลุดขึ้นสารบัญ Google เมื่อไหร่
 * = ข้อมูลมั่วถูกอ้างว่าเป็นของ Anajak จริง · noindex คือด่านที่เชื่อถือได้ที่นี่
 * (จงใจให้ crawl ได้ ห้ามบล็อกใน robots.txt — บล็อกแล้ว Google จะไม่มีวันอ่าน noindex เจอ)
 */
export const metadata: Metadata = {
  title: "หน้าลอง — Anajak ERP",
  robots: { index: false, follow: false, nocache: true },
};

export default function ProtoLayout({ children }: { children: React.ReactNode }) {
  // หน้าลองอ่านตัวเลือกจาก query (`?v=…`) ด้วย useSearchParams — ต้องมี Suspense คั่น
  // ไม่งั้นตอน build Next ฟ้องว่าหน้าถูกบังคับเป็น dynamic · วางที่ layout ที่เดียว
  // ทุกหน้าลองจึงไม่ต้องห่อเอง (fallback เป็น null เพราะหน้าลองไม่ได้รอข้อมูลอะไร
  // ค่าจาก query มาถึงพร้อมเฟรมแรกอยู่แล้ว)
  return <Suspense fallback={null}>{children}</Suspense>;
}
