import { redirect } from "next/navigation";
import { RedesignShell } from "@/components/redesign/redesign-shell";
import { getServerSession } from "@/lib/supabase-server";
import "./redesign.css";

export default async function RedesignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense in depth: the prototype follows the same authenticated boundary as the ERP.
  const user = await getServerSession();
  if (!user) {
    redirect("/login");
  }

  return <RedesignShell>{children}</RedesignShell>;
}
