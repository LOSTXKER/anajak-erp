import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase-server";
import { V2Shell } from "@/components/v2/v2-shell";

export default async function V2Layout({ children }: { children: React.ReactNode }) {
  const user = await getServerSession();
  if (!user) {
    redirect("/login");
  }

  return <V2Shell>{children}</V2Shell>;
}
