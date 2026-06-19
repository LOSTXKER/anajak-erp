# Anajak ERP — AGENTS.md
> แหล่งความจริงเดียวสำหรับ AI ทุกเจ้า (Claude/Cursor/Copilot/Codex) · Claude อ่านผ่าน `CLAUDE.md` (`@AGENTS.md`)
> 📌 แผนธุรกิจ/research ไม่อยู่ใน repo นี้ — อยู่ที่ระบบจัดการเจ้าของ (bestos `records/projects/anajak-erp/`) · ไฟล์ใน repo = สเปค+โค้ดเท่านั้น

## โปรเจคนี้คือ
ERP หลังบ้านโรงงานสกรีนเสื้อ Anajak (**ทำเองมีแค่ DTF** — DTG/silkscreen/ปัก/sublimation/ตัดเย็บ/ป้ายคอ = outsource ทั้งหมด · เบสเคาะ 2026-06-12 · ทีม 5 คน + เจ้าของ · ลูกค้า B2B เครดิตเทอม = ฐานรายได้) — Next.js 15 + React 19 + tRPC 11 + Prisma 6 + Supabase + Tailwind 4 + shadcn

## 🔄 วงจรการทำงาน (บังคับ — กันหลุด 3 อย่าง)
1. **เริ่มงาน** → อ่าน `SPEC.md` (อะไรคือเสร็จ) + `ROADMAP.md` (แผน P0-P4 + ใบงาน · = PLAN) + `PROGRESS.md` (ทำถึงไหน · พร้อม `git log --oneline -10`) ก่อนแตะโค้ด · งานทุกชิ้น trace กลับ ROADMAP ได้ — ไม่อยู่ใน ROADMAP = ถามเบสก่อน ห้ามทำเงียบ
2. **งานใหญ่/หลายขั้น** → อัปเดต ROADMAP ใบงานก่อนลงมือ · ทำทีละ task ไม่กระโดด
3. **ก่อนเคลม "เสร็จ"** → verify ทุกข้อใน `SPEC.md` ด้วยรัน/เปิดดูจริง — **type check ผ่าน ≠ ใช้งานได้**
4. **ก่อนจบงาน** → เขียนทับ `PROGRESS.md` (เสร็จอะไร/ค้าง/ติด/ต่อที่ไหน) + commit ก้อนเล็กข้อความชัด — session ถัดไปทำต่อได้ไม่ต้องถามซ้ำ

## เอกสารนำทาง (อ่านตามลำดับ)
1. **`PROGRESS.md`** — สถานะสด · อ่านก่อนเริ่ม + อัปเดตก่อนจบทุก session
2. **`SPEC.md`** — เกณฑ์ "เสร็จ" (acceptance · verify ได้)
3. **`ROADMAP.md`** — แผน P0-P4 + ใบงาน checklist + กติกา build 8 ข้อ
4. `Anajak-Print-Features.md` — vision/flow reference · บางส่วนถูกทับ ดู banner หัวไฟล์ก่อนใช้
5. แผนเหตุผลเต็ม + survey → repo **bestos** (sibling · `resolve-repo.mjs anajak-erp` หา path) → `records/projects/anajak-erp/` (plan.md + _survey) — อย่า hardcode path

## กติกา build (ย่อ — เต็มใน ROADMAP.md)
- **surgical**: แตะเฉพาะที่ใบงานสั่ง · เลียน pattern เดิม (grep ก่อนสร้างใหม่) · refactor = targeted + test ก่อน ห้าม big-bang
- **เงิน = Decimal เท่านั้น** (ห้าม Float ใหม่) · เลขเอกสาร = รันต่อเนื่องผ่าน DocumentSequence (ห้ามสุ่ม) · การเงินหลายขั้นตอน = `$transaction` เสมอ
- ใบกำกับภาษี: ออก**ทุกงวดรับเงินรวมมัดจำ** (จ้างทำของ) · ยกเลิก-ออกใหม่เท่านั้น **ห้ามลบ**
- status เปลี่ยนผ่าน `isValidTransition` ที่ server เท่านั้น — ห้าม set ตรง
- business logic แกน (pricing/status/เลขเอกสาร) อยู่ `src/server/services/` — tRPC router เป็นแค่ผิว
- UI ใหม่/หน้าที่แตะ = ใช้ design system (P1.0) · mobile-first หน้า ops · ห้าม `window.prompt/confirm`
- **ไม่ build**: GL/บัญชีแยกประเภท · job costing/ต้นทุนต่อออเดอร์ (เบสเคาะ 2026-06-12 — บัญชีคิดรายเดือน ห้ามเพิ่มช่องเงินใน flow ผลิต/outsource) · DTF auto-nesting · in-app chat · online designer · time-clock (hr-platform-v2 มี) · WMS (Anajak Stock มี) — เต็ม+เหตุผลท้าย ROADMAP.md

## คำสั่งหลัก
```bash
npm run dev          # localhost:3000
npm run db:generate  # หลังแก้ schema
npx prisma migrate dev   # ใช้ migrations (P0.3 ขึ้นไป — เลิก db push)
npm run db:seed
```
external: Anajak Stock app (sibling `../anajaktshirt-stock`) — ERP คุยผ่าน `/api/erp/*` + X-API-Key (ตั้งใน Settings → Stock)

## permission (3 ชั้น)
- ✅ ทำได้เลย: แก้โค้ดตามใบงาน · รัน test/lint/typecheck
- ⚠️ ถามก่อน: ลบไฟล์ · แก้ schema/migration · เพิ่ม dependency · แตะ config/env · งานนอก ROADMAP
- ⛔ ห้าม: push เข้า main ตรงๆ · commit secret · ลบ/ปิด test เพื่อให้ผ่าน · set status ตรง (ข้าม isValidTransition) · เพิ่ม Float ให้ฟิลด์เงิน
