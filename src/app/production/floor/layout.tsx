import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase-server";
import { FLOOR_HREF } from "@/lib/production-surface";

/**
 * โหมดหน้างาน /production/floor — เต็มจอ ไม่มีเมนูข้าง/แถบบน (จอทัชหน้าเครื่อง · จอร่วมของทีม)
 * อยู่หลัง auth ปกติ (บัญชีพนักงานล็อกอินค้างที่จอ · เปลี่ยนคน = ออกจากระบบ) · session หลุด = เด้ง /login กลับมาที่นี่
 * ใช้ธีมเดียวกับทั้งเว็บ (สว่าง/มืดตามเครื่อง) — ไม่บังคับมืดแบบจอเดิม (เบสตีกลับ "ธีมสีไม่เข้ากับเว็บ" 09-02)
 */
export default async function ProductionFloorLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerSession();
  if (!user) redirect(`/login?next=${FLOOR_HREF}`);
  return <div className="min-h-screen bg-bg text-strong">{children}</div>;
}
