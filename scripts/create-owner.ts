/**
 * Bootstrap OWNER คนแรกของระบบ — หลังจากนั้นจัดการผู้ใช้ผ่านหน้า Settings → Users
 *
 * ใช้: node --env-file=.env scripts/create-owner.ts <email> <password> [ชื่อ]
 * รันซ้ำได้ (idempotent) — ถ้ามีบัญชีอยู่แล้วจะผูก supabaseId ให้ตรงและอัปเดต role เป็น OWNER
 */
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

async function main() {
  const [email, password, name = "เจ้าของ"] = process.argv.slice(2);
  if (!email || !password) {
    console.error("ใช้: node --env-file=.env scripts/create-owner.ts <email> <password> [ชื่อ]");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("รหัสผ่านอย่างน้อย 8 ตัวอักษร");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error("ต้องตั้ง NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY ใน .env");
    process.exit(1);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) หา/สร้าง auth user
  let supabaseId: string;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.data.user) {
    supabaseId = created.data.user.id;
    console.log(`สร้าง auth user ใหม่: ${supabaseId}`);
  } else {
    const { data: list, error: listError } = await admin.auth.admin.listUsers();
    if (listError) throw listError;
    const existing = list.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (!existing) {
      throw new Error(`สร้าง auth user ไม่สำเร็จ: ${created.error?.message}`);
    }
    supabaseId = existing.id;
    const { error: pwError } = await admin.auth.admin.updateUserById(supabaseId, {
      password,
    });
    if (pwError) throw pwError;
    console.log(`auth user มีอยู่แล้ว (${supabaseId}) — อัปเดตรหัสผ่านให้`);
  }

  // 2) หา/สร้าง User record ผูก supabaseId
  const user = await prisma.user.upsert({
    where: { email },
    create: { supabaseId, email, name, role: "OWNER" },
    update: { supabaseId, role: "OWNER", isActive: true },
  });

  console.log(`เรียบร้อย: ${user.name} <${user.email}> role=${user.role} id=${user.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
