import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { getServerUserAccess } from "@/lib/supabase-server";

export default async function HomePage() {
  const access = await getServerUserAccess();
  if (!access) redirect("/login");

  redirect(
    hasPermission(access.role, access.permissionOverrides, "supervise_operations")
      ? "/"
      : "/my-tasks"
  );
}
