import { redirect } from "next/navigation";
import { AppShell } from "@/components/v2/v2-shell";
import { getServerSession } from "@/lib/supabase-server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ชั้นที่สองถัดจาก middleware — กันหลุดกรณี matcher ไม่ครอบ
  const user = await getServerSession();
  if (!user) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
