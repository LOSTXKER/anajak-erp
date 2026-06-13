/**
 * verify ขาอัปโหลด client-direct ผ่าน storage RLS (ก้อน 4 ชิ้น 1) — ของจริงทั้งสาย
 * รัน: npm run verify:storage
 * จำลอง browser เป๊ะ: สร้าง auth user ชั่วคราว → signInWithPassword ด้วย anon key →
 * upload option เดียวกับ uploadFile (src/lib/supabase.ts) — ลบเกลี้ยงท้ายสคริปต์
 *
 * บทเรียนที่ทำให้มี script นี้ (2026-06-13): policy ให้ INSERT อย่างเดียว แต่โค้ดเดิมใช้
 * upsert:true → storage-api เดินเส้นทางต้องมีสิทธิ์ UPDATE → โดนปัดทั้งที่ login ถูกต้อง
 */
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase-admin";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++;
    console.log(`PASS: ${name}`);
  } else {
    fails.push(name);
    console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const admin = createAdminClient();
  const email = `storage-verify-${Date.now()}@anajak.test`;
  const password = `Verify-${Math.random().toString(36).slice(2)}-x9!`;
  const path = `verify/${Date.now()}-staff-upload.txt`;
  let userId: string | null = null;

  try {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error) throw created.error;
    userId = created.data.user.id;

    const staff = createClient(URL_, ANON, { auth: { persistSession: false } });
    const signIn = await staff.auth.signInWithPassword({ email, password });
    check("1. login ด้วย anon key ได้ session", !signIn.error, signIn.error?.message);

    // option ต้องตรงกับ uploadFile ใน src/lib/supabase.ts ทุกตัว — script นี้คือกระจกของมัน
    const up = await staff.storage.from("designs").upload(path, Buffer.from("verify"), {
      cacheControl: "3600",
      upsert: false,
      contentType: "text/plain",
    });
    check("2. พนักงาน login แล้วอัปโหลดผ่าน RLS ได้", !up.error, up.error?.message);

    const dup = await staff.storage.from("designs").upload(path, Buffer.from("dup"), {
      cacheControl: "3600",
      upsert: false,
      contentType: "text/plain",
    });
    check("3. เขียนทับ path เดิมถูกปัด (กันแก้หลักฐานไฟล์)", !!dup.error, "ทับได้ — ไม่ควร");

    const anonClient = createClient(URL_, ANON, { auth: { persistSession: false } });
    const upAnon = await anonClient.storage
      .from("designs")
      .upload(`verify/anon-${Date.now()}.txt`, Buffer.from("x"), { upsert: false });
    check("4. ไม่ login อัปโหลดถูกปัด", !!upAnon.error, "anon อัปได้ — ช่องโหว่!");

    const pub = await fetch(
      `${URL_}/storage/v1/object/public/designs/${path}`
    );
    check("5. public URL เปิดไม่ได้ (bucket private)", !pub.ok, `${pub.status}`);
  } finally {
    await admin.storage.from("designs").remove([path]);
    if (userId) await admin.auth.admin.deleteUser(userId);
  }

  console.log(`\n${pass} PASS / ${fails.length} FAIL`);
  if (fails.length > 0) {
    console.log("FAILED:", fails.join(" · "));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
