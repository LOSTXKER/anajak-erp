import type { Metadata } from "next";

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
  return children;
}
