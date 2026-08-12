import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase-server";

export default async function V2Layout({ children }: { children: React.ReactNode }) {
  const user = await getServerSession();
  if (!user) {
    redirect("/login");
  }

  return children;
}
