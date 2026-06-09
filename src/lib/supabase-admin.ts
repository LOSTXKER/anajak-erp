import { createClient } from "@supabase/supabase-js";

/**
 * Supabase admin client (service role) — server-only.
 * ใช้สำหรับจัดการ auth users (สร้าง/รีเซ็ตรหัสผ่าน/ปิดบัญชี) เท่านั้น
 * ห้าม import ไฟล์นี้จาก client component เด็ดขาด
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ไม่ถูกตั้งค่า — จัดการผู้ใช้ไม่ได้");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
