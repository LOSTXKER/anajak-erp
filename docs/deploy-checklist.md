# Deploy checklist — สิ่งที่ต้องทำใน Supabase / Vercel console ก่อนใช้จริง

> รวมจาก Gate B15 (2026-07-03) · ส่วนที่สคริปต์เช็คได้: `npm run verify:supabase` (bucket private + anon อ่านไม่ได้ + RLS policy) · ไฟล์นี้ = ส่วนที่ **service role เช็คแทนไม่ได้ ต้องทำในหน้าเว็บของผู้ให้บริการเอง** (เบส)
> ทำแล้วติ๊ก `[x]` พร้อมวันที่ — ไม่ติ๊ก = ยังไม่ยืนยัน

## Supabase

- [ ] **ปิด public signup — สำคัญ / ยังไม่ยืนยัน** — `Authentication → Sign In / Providers → ปิด "Allow new users to sign up"` · เดิม (2026-06-13) เปิดอยู่ → anon key เป็น public บนหน้าเว็บ คนนอกสมัครเองได้ session `authenticated` แล้วอัปไฟล์เข้าบัคเก็ตผ่าน INSERT policy ได้ · ระบบสร้าง user ทาง Settings → ผู้ใช้ เท่านั้น **ไม่มีเหตุต้องเปิด signup**
- [ ] **ทบทวน `Storage → Policies`** — ต้องมีแค่ INSERT policy `erp_staff_upload_designs` (จาก `docs/sql/storage-private-rollout.sql`) · ห้ามมี SELECT/UPDATE/DELETE ให้ anon/authenticated บน `storage.objects` — การอ่าน/ลบทั้งหมดผ่าน service role (`/api/files` signed URL)
- [x] bucket `designs` เป็น private + anon list/อ่านไม่ได้ + RLS INSERT เฉพาะ authenticated — `verify:supabase` 3/3 ผ่าน 2026-07-03
- **backup / เอกสารภาษีต้องอยู่ครบ 5 ปี** — เบสเคาะ 2026-07-07: **ไม่อัปเกรด Pro** (แผนฟรีไม่มี backup อัตโนมัติ) → ใช้ **export ในแอป** (ตั้งค่า → สำรองข้อมูล · JSON ทุกตาราง snapshot เดียวกัน + audit) กดเก็บสัปดาห์ละครั้ง + หลังปิดเดือน · backup มือก้อนแรก pg_dump อยู่ที่เครื่องเบส `~/Backups/anajak-erp-db/` (2026-07-07) · ไฟล์ใน storage bucket **ไม่รวมใน export** → ถ้าธุรกิจพึ่งระบบมากขึ้นค่อยทบทวน Pro + PITR (`Database → Backups`)

## Vercel

- [x] DDoS mitigation — เปิดให้ทุก project ทุก plan อัตโนมัติ ไม่ต้องทำอะไร
- [ ] **rate-limit หน้า public token** (เบสเคาะ 2026-07-03: ใช้ Vercel platform ไม่เขียนโค้ดในแอป) — หน้าที่เปิดได้ไม่ต้อง login: `/job/` `/status/` `/quote/` `/approve/` `/upload/` · ทำหลัง `vercel link` แล้ว
  1. เพิ่ม rule แบบ **log ก่อน** (ยังไม่บล็อก ดูทราฟฟิกจริง):
     ```bash
     vercel firewall rules add "RL public token pages" \
       --condition '{"type":"path","op":"pre","value":"/job/"}' \
       --or --condition '{"type":"path","op":"pre","value":"/status/"}' \
       --or --condition '{"type":"path","op":"pre","value":"/quote/"}' \
       --or --condition '{"type":"path","op":"pre","value":"/approve/"}' \
       --or --condition '{"type":"path","op":"pre","value":"/upload/"}' \
       --action rate_limit --rate-limit-window 60 --rate-limit-requests 60 \
       --rate-limit-keys ip --rate-limit-action log --yes
     vercel firewall diff && vercel firewall publish --yes
     ```
  2. ดูผลที่ `Project → Firewall → Traffic` ว่าโดนแต่ทราฟฟิกผิดปกติ → เปลี่ยนเป็นบล็อกจริง: `vercel firewall rules edit "RL public token pages" --rate-limit-action rate_limit --yes` แล้ว `publish` · ลด requests เป็น 20-30/นาที ได้
  3. `Project → Firewall → Bot Protection` เปิด managed ruleset · อย่าบล็อกด้วย user-agent เอง (ชน Googlebot / LINE unfurler)
  - ข้อควรรู้: counter นับแยกต่อ region (ตั้งเผื่อ) · ห้ามตั้ง `deny` บน path กว้าง · นับต่อ token/cookie ต้องใช้ Rate Limiting SDK (ยังไม่จำเป็น)
- [ ] env บน Vercel: `CRON_SECRET` (cron `/api/cron/overdue` fail-closed ถ้าไม่ตั้ง) · `PRODUCTION_V2_ENABLED` ยังเป็น `0` จน cutover (ROADMAP §B) · Stock API key ตั้งใน Settings → Stock ไม่ใช่ env

## ก่อนขึ้นใช้จริง (นอก console — ดู `SPEC.md` §Gate)
B6 นักบัญชีรีวิว template ใบกำกับ/CN/DN + เลขรัน · B16 walkthrough ของจริงกับทีม · PV2.8 cutover Production V2
