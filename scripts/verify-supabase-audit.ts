// Supabase security audit (Gate B15) — เช็คส่วนที่ service role ตรวจได้เอง
// รัน: npm run verify:supabase · ส่วนที่ต้องทำใน console (signup/PITR/backup) ดู README.md หัวข้อ Supabase และไฟล์
import { createAdminClient } from "@/lib/supabase-admin";
import { createClient } from "@supabase/supabase-js";

let pass = 0;
const fails: string[] = [];
function ok(name: string, cond: boolean, detail?: unknown) {
  if (cond) { pass++; console.log("PASS:", name); }
  else { fails.push(name); console.log("FAIL:", name, "→", JSON.stringify(detail)); }
}

async function main() {
  const admin = createAdminClient();

  // 1) bucket "designs" ต้องเป็น private (เอกสารภาษี/ไฟล์ลูกค้าห้ามเปิดสาธารณะ)
  const { data: bucket, error: bErr } = await admin.storage.getBucket("designs");
  ok("1. bucket 'designs' มีจริง", !bErr && !!bucket, bErr?.message);
  ok("2. bucket 'designs' เป็น private (public=false)", bucket?.public === false, { public: bucket?.public });

  // 3) anon list ไม่คืนรายการ; ผลนี้ยังไม่พิสูจน์การอ่านไฟล์หรือ Storage policy ครบ
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: list, error: listErr } = await anon.storage.from("designs").list();
  ok("3. anon list ไม่คืนรายการ (ยังต้องตรวจ Storage policy)", !!listErr || (list?.length ?? 0) === 0, {
    err: listErr?.message,
    count: list?.length,
  });

  console.log(`\n${pass} passed, ${fails.length} failed`);
  console.log("⚠️ ส่วนที่สคริปต์เช็คไม่ได้ (ต้องทำ/ยืนยันใน Supabase Console) — ดู README.md หัวข้อ Supabase และไฟล์:");
  console.log("   - ปิด public signup (Authentication → Sign In/Up)");
  console.log("   - ตรวจแผนสำรองข้อมูล/ไฟล์และซ้อมกู้คืนตาม README; เกณฑ์เก็บเอกสารอยู่ SPEC");
  if (fails.length > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
