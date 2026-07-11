import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, type Permission } from "@/lib/permissions";
import type { Role } from "@prisma/client";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll can fail when called from Server Components
          }
        },
      },
    }
  );
}

export async function getServerSession() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// role+สิทธิ์ของผู้ใช้ที่ล็อกอิน (ฝั่ง server component) — lookup ด้วย supabaseId เหมือน trpc context
// fail-closed: getUser/DB error → null (ด่านเรียกใช้จะ redirect · ไม่ปล่อยใบเงินหลุดเพราะ error)
export async function getServerUserAccess(): Promise<{
  role: Role;
  permissionOverrides: unknown;
} | null> {
  try {
    const authUser = await getServerSession();
    if (!authUser) return null;
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      select: { role: true, isActive: true, permissionOverrides: true },
    });
    if (!dbUser || !dbUser.isActive) return null;
    return { role: dbUser.role, permissionOverrides: dbUser.permissionOverrides };
  } catch {
    return null;
  }
}

// ด่านสิทธิ์สำหรับหน้า print เอกสารเงิน (B12 · PERM4: เช็คสิทธิ์จริงรวม override รายคน)
// ไม่มีสิทธิ์ → เด้งกลับหน้าแรก (middleware กัน login แล้ว · ด่านนี้กันคนไม่มีสิทธิ์เปิด URL ใบเงินตรงๆ)
export async function requirePrintPermission(permission: Permission): Promise<void> {
  const access = await getServerUserAccess();
  if (!access) redirect("/login");
  if (!hasPermission(access.role, access.permissionOverrides, permission)) redirect("/");
}
