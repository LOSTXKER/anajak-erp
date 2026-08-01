import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase-server";

// จอโรงงาน /factory (UX4) — อยู่หลัง auth ปกติ (บัญชี "จอโรงงาน" login ค้าง · เบสเคาะ ไม่แตะ schema)
// ไม่มี sidebar/topbar · ธีมมืดเต็มจอ · session หลุด = เด้ง /login เอง (fail-closed โดยธรรมชาติ)
export default async function FactoryLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerSession();
  if (!user) redirect("/login");
  // ใส่ class `dark` ให้ทั้งจอ — เดิมเขียน bg-black ทับเอง จอนี้จึงไม่เคยอยู่ในธีมมืดจริง
  // (ถ้าเครื่องตั้งธีมสว่าง ของที่ใช้ dark: จะออกโทนสว่างทับพื้นดำ) · ตอนนี้พื้นมาจาก
  // token เดียวกับทั้งเว็บ = ดำเทา ไม่ใช่ดำสนิท (เบสสั่ง 2026-08-01)
  return <div className="dark min-h-screen bg-bg text-white">{children}</div>;
}
