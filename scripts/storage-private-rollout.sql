-- ============================================================================
-- สร้าง bucket "designs" แบบ private + ตั้ง storage RLS (FLOW-REDESIGN ก้อน 4 ชิ้น 1)
-- รันใน Supabase Dashboard → SQL Editor (ต้องเป็น owner ของ storage schema)
--
-- 🔎 ค้นพบตอน verify (2026-06-13): bucket "designs" ไม่เคยถูกสร้างบนโปรเจกต์นี้
--    → การอัปไฟล์ทุกจุดในระบบ (แบบ/สลิป/รูป QC/ตรวจรับ) ไม่เคยสำเร็จมาก่อน
--    → ไม่มีไฟล์เก่า/URL เก่าต้อง migrate — สร้างเป็น private ตั้งแต่วันแรกได้เลย
--
-- รันไฟล์นี้ "หลัง" โค้ด /api/files + migration 20260613130000 อยู่บนเครื่องที่รันแอปแล้ว
-- ============================================================================

-- STEP 1: สร้าง bucket แบบ private (id ต้องเป็น 'designs' ตรงกับโค้ด)
--   ถ้ามีอยู่แล้ว = บังคับเป็น private
INSERT INTO storage.buckets (id, name, public)
VALUES ('designs', 'designs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- STEP 2: พนักงานที่ login (Supabase Auth) อัปโหลดเข้า bucket designs ได้
--   - อัปโหลดเป็น client-direct จาก browser (anon key + session JWT = role authenticated)
--   - ไม่ให้ SELECT — การอ่านทุกทางวิ่งผ่าน /api/files (service role ออก signed URL)
--   - ไม่ให้ UPDATE/DELETE — ระบบตั้งชื่อไฟล์สุ่มไม่ซ้ำ ไม่มีเหตุต้องเขียนทับ
--   ⚠️ ผลพวง: โค้ดอัปโหลดห้ามใช้ upsert:true (x-upsert เดินเส้นทางต้องมีสิทธิ์ UPDATE
--   → โดนปัดทั้งก้อนแม้ login ถูกต้อง — เจอจริง 2026-06-13) · uploadFile ตั้ง false แล้ว
--   · ทดสอบซ้ำได้ด้วย `npm run verify:storage`
CREATE POLICY "erp_staff_upload_designs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'designs');

-- STEP 3 ⚠️ ปิด email signup (ไม่ใช่ SQL — ทำใน Dashboard):
--   Authentication → Sign In / Up → ปิด "Allow new users to sign up"
--   ตรวจแล้ว (2026-06-13) โปรเจกต์นี้ "เปิดอยู่" — anon key เป็น public อยู่ในหน้าเว็บ
--   คนนอกสมัครเอง+ยืนยันอีเมลตัวเอง = ได้ session role authenticated → อัปไฟล์เข้า
--   bucket ผ่าน policy ข้างบนได้ (การอ่านไฟล์ /api/files กันด้วยเช็คแถว User+isActive แล้ว)
--   ระบบนี้สร้าง user ทาง Settings → ผู้ใช้ เท่านั้น ไม่มีเหตุต้องเปิด signup สาธารณะ

-- STEP 4 (ตรวจหลังรัน):
--   1. รัน `npm run verify:files -- --base-url=http://localhost:<พอร์ต dev>` — ต้องผ่านครบ
--   2. พนักงาน login → หน้าออเดอร์ → การ์ด "ไฟล์ของออเดอร์" → แนบไฟล์ → เห็นรูปปกติ
--   3. อัปแบบที่การ์ดงานออกแบบ → copy ลิงก์อนุมัติ → เปิดในแท็บ incognito (ไม่ login)
--      → ต้องเห็นรูปแบบปกติ (รูปวิ่งผ่าน /api/files?t=token)
