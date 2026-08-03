import type { Metadata } from "next";

// หน้าลิงก์ลูกค้า/ร้านนอกทั้งกลุ่ม — ห้าม search engine เก็บ (มีราคา/ข้อมูลลูกค้า)
// เดิม noindex มีแค่หน้า job หน้าเดียว อีก 4 หน้าเปิดโล่ง
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
