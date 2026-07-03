# B15 — Supabase Security Audit (checklist ก่อน go-live)

> ส่วนที่สคริปต์เช็คได้: `npm run verify:supabase` (bucket private + anon อ่านไม่ได้)
> ไฟล์นี้ = ส่วนที่ **ต้องทำ/ยืนยันใน Supabase Console เอง** (service role เช็คแทนไม่ได้)

## ✅ เช็คอัตโนมัติแล้ว (verify:supabase — 3/3 ผ่าน 2026-07-03)
- [x] bucket `designs` เป็น **private** (`public=false`) — เอกสารภาษี/ไฟล์ลูกค้าไม่เปิดสาธารณะ
- [x] anon (คนนอก) **list/อ่านไฟล์ในบัคเก็ตไม่ได้** — ไม่มี SELECT policy, อ่านผ่าน `/api/files` (signed URL) เท่านั้น
- [x] storage RLS policy `erp_staff_upload_designs` (INSERT เฉพาะ authenticated) — จาก `docs/sql/storage-private-rollout.sql`

## ⛔ ต้องทำใน Console (เบส)

### 1. ปิด public signup — **สำคัญ/ยังไม่ยืนยัน**
`Authentication → Sign In / Providers → ปิด "Allow new users to sign up"`
- เดิม (2026-06-13) **เปิดอยู่** — anon key เป็น public ในหน้าเว็บ → คนนอกสมัคร+ยืนยันอีเมลตัวเอง
  ได้ session role `authenticated` → อัปไฟล์เข้าบัคเก็ตผ่าน INSERT policy ได้
- ระบบนี้สร้าง user ทาง Settings → ผู้ใช้ เท่านั้น — **ไม่มีเหตุต้องเปิด signup สาธารณะ**
- (การอ่านไฟล์ /api/files กันด้วยเช็คแถว User + isActive แล้ว — แต่ปิด signup คือปิดต้นทาง)

### 2. เปิด Point-in-Time Recovery (PITR) + backup — เอกสารภาษีต้องอยู่ครบ 5 ปี
`Database → Backups`
- เปิด **PITR** (กู้คืนจุดเวลาใดก็ได้ — ต้อง Pro plan ขึ้นไป)
- ตรวจว่ามี **daily backup** + retention เพียงพอ
- **เอกสารภาษี (ใบกำกับ/ใบเสร็จ/CN/DN + ไฟล์ที่แนบ)** ตามกฎหมายต้องเก็บ **≥ 5 ปี**:
  - ข้อมูลใน Postgres (invoice rows) — ครอบด้วย backup/PITR
  - ไฟล์ใน storage bucket `designs` — **storage ไม่รวมใน PITR ของ DB** → ตรวจว่ามี backup/retention ของ storage แยก หรือวางแผน export เอกสารสำคัญออกเป็นระยะ

### 3. (ทบทวน) ไม่มี RLS policy ที่เปิด SELECT/UPDATE/DELETE ให้ anon/authenticated บน `storage.objects`
- ยืนยันใน `Storage → Policies` ว่ามีแค่ INSERT policy — การอ่าน/ลบทั้งหมดผ่าน service role (/api/files)

---
_อัปเดตล่าสุด: 2026-07-03 (Gate B15)_
