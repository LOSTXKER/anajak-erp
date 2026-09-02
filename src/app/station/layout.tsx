import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase-server";

/**
 * จอสถานี /station (แบบ A · เบสเคาะ 2026-09-03) — เต็มจอ ไม่มีเมนูข้าง/แถบบน
 * อยู่หลัง auth ปกติ (บัญชีพนักงานล็อกอินค้างที่จอ · เปลี่ยนคน = ออกจากระบบ) · session หลุด = เด้ง /login
 * ใช้ธีมเดียวกับทั้งเว็บ (สว่าง/มืดตามเครื่อง) — ไม่บังคับมืดแบบจอเดิม (เบสตีกลับ "ธีมสีไม่เข้ากับเว็บ" 09-02)
 */
export default async function StationLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerSession();
  if (!user) redirect("/login?next=/station");
  return <div className="min-h-screen bg-bg text-strong">{children}</div>;
}
