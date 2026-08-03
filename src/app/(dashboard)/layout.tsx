import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getServerSession } from "@/lib/supabase-server";
import { FOCUS_BUTTON } from "@/components/ui/tokens";
import { cn } from "@/lib/utils";

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

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      <a
        href="#main-content"
        className={cn("fixed left-4 top-4 z-[100] -translate-y-24 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-lg transition-transform focus:translate-y-0", FOCUS_BUTTON, "dark:bg-white dark:text-slate-950")}
      >
        ข้ามไปเนื้อหาหลัก
      </a>
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        {/* relative จำเป็น: Radix Select ฝัง <select> จริงแบบ absolute ไว้ใช้กับ form —
            ถ้าไม่มี positioned ancestor มันยึดกับ <html> แล้วยื่นท้ายเอกสาร ทำให้หน้าที่ฟอร์มยาว
            (เช่น /orders/new) มี scrollbar นอก shell — เลื่อนสุดฟอร์มแล้วทั้ง shell ไหลหนีขึ้น
            (เบสเจอ 2026-08-03) · anchor ไว้ใน main ให้มันเลื่อนตามเนื้อหา */}
        <main id="main-content" tabIndex={-1} className="relative flex-1 overflow-y-auto outline-none">
          <div className="mx-auto w-full max-w-screen-2xl px-5 py-8 sm:px-8 lg:px-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
