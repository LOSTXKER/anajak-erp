import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { FLOOR_HREF, isFloorWorker } from "@/lib/production-surface";
import { getServerUserAccess } from "@/lib/supabase-server";

/** จุดตกหลังล็อกอิน — หัวหน้า/เจ้าของ → แดชบอร์ด · ช่างผลิต → โหมดหน้างาน (เบสเคาะ 09-03) · คนอื่น → งานของฉัน */
export default async function HomePage() {
  const access = await getServerUserAccess();
  if (!access) redirect("/login");

  if (hasPermission(access.role, access.permissionOverrides, "supervise_operations")) redirect("/");
  if (isFloorWorker(access.role, access.permissionOverrides)) redirect(FLOOR_HREF);
  redirect("/my-tasks");
}
