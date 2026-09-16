import type { Metadata } from "next";

/* หน้าเข้าสู่ระบบเป็น client component จึง export metadata เองไม่ได้ —
   ชื่อแท็บ "เข้าสู่ระบบ · Anajak Print" มาจาก template ของ layout ราก (ต้นแบบ PTITLE.login)
   กลุ่ม (auth) มีหน้าเดียว layout นี้จึงทำหน้าที่แค่ตั้งชื่อแท็บ ไม่ห่ออะไรเพิ่ม */
export const metadata: Metadata = {
  title: "เข้าสู่ระบบ",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
