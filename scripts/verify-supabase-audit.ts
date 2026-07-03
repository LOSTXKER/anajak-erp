// Supabase security audit (Gate B15) — เช็คส่วนที่ service role ตรวจได้เอง
// รัน: npm run verify:supabase · ส่วนที่ต้องทำใน console (signup/PITR/backup) ดู docs/b15-supabase-audit.md
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

  // 3) anon (คนนอก) list/อ่านไฟล์ในบัคเก็ตไม่ได้ (ไม่มี SELECT policy — อ่านผ่าน /api/files เท่านั้น)
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: list, error: listErr } = await anon.storage.from("designs").list();
  ok("3. anon list ไฟล์ไม่เห็น (RLS ปิด SELECT)", !!listErr || (list?.length ?? 0) === 0, {
    err: listErr?.message,
    count: list?.length,
  });

  console.log(`\n${pass} passed, ${fails.length} failed`);
  console.log("⚠️ ส่วนที่สคริปต์เช็คไม่ได้ (ต้องทำ/ยืนยันใน Supabase Console) — ดู docs/b15-supabase-audit.md:");
  console.log("   - ปิด public signup (Authentication → Sign In/Up)");
  console.log("   - เปิด PITR + ตั้ง retention ให้เอกสารภาษีอยู่ครบ 5 ปี (Database → Backups)");
  if (fails.length > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
