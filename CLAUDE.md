# Anajak ERP — คำสั่งประจำ repo

ERP หลังบ้านโรงงานสกรีนเสื้อ Anajak (**ทำเองมีแค่ DTF** — DTG/silkscreen/ปัก/sublimation/ตัดเย็บ/ป้ายคอ = outsource ทั้งหมด (เบสเคาะ 2026-06-12) · ทีม 5 คน + เจ้าของ · ลูกค้า B2B เครดิตเทอมคือฐานรายได้) — Next.js 15 + React 19 + tRPC 11 + Prisma 6 + Supabase + Tailwind 4 + shadcn

## เอกสารนำทาง (อ่านตามลำดับนี้)
1. **`PROGRESS.md`** — สถานะสด: ทำถึงไหน ทำอะไรต่อ · **อ่านก่อนเริ่มทุก session + อัปเดตก่อนจบทุก session** (พร้อม `git log --oneline -10`)
2. **`ROADMAP.md`** — แผน P0-P4 + ใบงาน checklist + กติกา build 8 ข้อ · งานทุกชิ้นต้อง trace กลับ ROADMAP ได้ — ไม่อยู่ใน ROADMAP = ถามเบสก่อน ห้ามทำเงียบ
3. `Anajak-Print-Features.md` — vision/flow reference เท่านั้น · บางส่วนถูกทับแล้ว ดู banner หัวไฟล์ก่อนใช้
4. แผนฉบับเหตุผลเต็ม + survey: ใน repo **bestos** (sibling ของ repo นี้) → `records/projects/anajak-erp/` (plan.md + _survey) · path เต็มต่างตามเครื่อง (Win `D:/dev/ai-agent2` · Mac `~/dev/Git/bestos`) — อย่า hardcode (ถ้าเข้าถึงได้)

## กติกา build (ย่อ — เต็มใน ROADMAP.md)
- **surgical**: แตะเฉพาะที่ใบงานสั่ง · เลียน pattern เดิม (grep หาก่อนสร้างใหม่) · refactor = targeted + test ก่อน ห้าม big-bang
- **เงิน = Decimal เท่านั้น** (ห้าม Float ใหม่) · เลขเอกสาร = รันต่อเนื่องผ่าน DocumentSequence (ห้ามสุ่ม) · การเงินหลายขั้นตอน = `$transaction` เสมอ
- ใบกำกับภาษี: ออก**ทุกงวดรับเงินรวมมัดจำ** (จ้างทำของ) · ยกเลิก-ออกใหม่เท่านั้น **ห้ามลบ**
- status เปลี่ยนผ่าน `isValidTransition` ที่ server เท่านั้น — ห้าม set ตรง
- business logic แกน (pricing/status/เลขเอกสาร) อยู่ `src/server/services/` — tRPC router เป็นแค่ผิว
- UI ใหม่/หน้าที่แตะ = ใช้ design system (P1.0) · mobile-first สำหรับหน้า ops · ห้าม `window.prompt/confirm`
- **ไม่ build**: GL/บัญชีแยกประเภท · **job costing/ต้นทุนต่อออเดอร์ (เบสเคาะ 2026-06-12 — บัญชีคิดรายเดือน ห้ามเพิ่มช่องเงินใน flow ผลิต/outsource)** · DTF auto-nesting · in-app chat · online designer · time-clock (hr-platform-v2 มี) · WMS (Anajak Stock มี) — รายการเต็ม+เหตุผลท้าย ROADMAP.md
- เคลม "เสร็จ" ต้องรัน/เปิดดูจริงก่อน · type check ผ่าน ≠ ใช้งานได้

## รัน
```bash
npm run dev          # localhost:3000
npm run db:generate  # หลังแก้ schema
npx prisma migrate dev   # ใช้ migrations (P0.3 ขึ้นไป — เลิก db push)
npm run db:seed
```
external: Anajak Stock app (sibling `../anajaktshirt-stock`) — ERP คุยผ่าน `/api/erp/*` + X-API-Key (ตั้งค่าใน Settings → Stock)

## จบ session ทุกครั้ง
อัปเดต `PROGRESS.md` (เสร็จอะไร/ค้างอะไร/ติดอะไร/ต่อที่ไหน) + commit งานเป็นก้อนเล็กพร้อมข้อความชัด — session ถัดไปต้องทำงานต่อได้โดยไม่ต้องถามซ้ำ
