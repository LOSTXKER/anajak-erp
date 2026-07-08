import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase-server";

// จอโรงงาน /factory (UX4) — อยู่หลัง auth ปกติ (บัญชี "จอโรงงาน" login ค้าง · เบสเคาะ ไม่แตะ schema)
// ไม่มี sidebar/topbar · ธีมมืดเต็มจอ · session หลุด = เด้ง /login เอง (fail-closed โดยธรรมชาติ)
export default async function FactoryLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerSession();
  if (!user) redirect("/login");
  return <div className="min-h-screen bg-black text-white">{children}</div>;
}
