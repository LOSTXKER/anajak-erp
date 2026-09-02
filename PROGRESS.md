# PROGRESS — สถานะสด (เขียนทับทุก session · ไม่สะสมประวัติ)

> session ใหม่: อ่านไฟล์นี้ + `git log --oneline -10` ก่อนเริ่ม · จบ session: เขียนทับ "ตอนนี้" + "NEXT" (ประวัติ = git log) · เพดาน ~100 บรรทัด
> ประวัติละเอียดทุกรอบก่อน 2026-09-02 (1 MB) อยู่ใน git: `git show 61575af:PROGRESS.md`

## ตอนนี้ (2026-09-02)
- **เก็บกวาด repo** (branch `cleanup/repo-docs-2026-09-02`): เขียน `AGENTS.md` / `SPEC.md` / `ROADMAP.md` / `PROGRESS.md` ใหม่ให้กระชับ · ลบ mockup/audit/spec ที่จบแล้ว (`docs/mockups` `docs/_ux-audit-2026-07` flow-redesign html · spec-*.md · `.impeccable/{review,mocks,sketches,critique,surfaces}` · `.mockups`) · รวม b15 checklist เป็น `docs/deploy-checklist.md` · vision doc `Anajak-Print-Features.md` ย้ายไป bestos `records/projects/anajak-erp/vision-anajak-print-features-2026-05.md` · เป้าหมายที่เบสย้ำวันนี้ลง `AGENTS.md` §เป้าหมาย
- **หน้าใบสั่งผลิต `/production/[id]`**: ล้างหน้าลอง 20+ แบบออกหมด คืน `production-v2-control-record.tsx` เป็นเวอร์ชันก่อนแตะ (เบสสั่ง "ลืมให้หมด เริ่มใหม่" 09-02) → หน้า `/production/[id]` เหมือนก่อนเริ่มเรื่องนี้ทุกอย่าง
- **Production V2**: โค้ด / migration / seed สูตรมาตรฐาน / หน้าตั้งค่า `/settings/routings` ครบ · ซ้อมบนฐาน demo (`npm run dev:demo` → `localhost:3100`) ผ่านถึงกลางทาง — ใบ MO-2609-0001 เปิดได้ครบ 9 ขั้น · ที่เหลือต้องกดในจอจริง `/factory/station` (รายงานผลผลิตต้องแยก quantity line · DTF ต้องเริ่มจากรอบพิมพ์) · **ของจริงบน Vercel ยังเป็น legacy** (`PRODUCTION_V2_ENABLED=0`) · ฐานจริงยังไม่ seed routing
- **ตัวกรอง `/production`**: คงแบบเดิม (เบส "เอาแบบเดิมก่อน" 09-02) · คอลัมน์ "เส้นทางงาน" แบบ C ลงของจริงแล้ว
- **🔥 เว็บจริงเดี้ยงเงียบตั้งแต่ 08-31 — แก้แล้วในรอบนี้**: ทุก deploy บน Vercel ตั้งแต่ commit `8d79749` (หน้าลอง `/proto/quiet`) ล้มเหลวทั้งหมด รวม main 09-01/09-02 · เว็บจริงค้างอยู่ที่ `f70cc40` (08-31) · สาเหตุ: `view/page.tsx` (server component) import ค่า `QUIET_LEVELS` จากไฟล์ `"use client"` → ตอน build ได้ client reference ไม่ใช่ array (`QUIET_LEVELS.map is not a function`) · dev/typecheck/lint/unit ไม่จับ มีแต่ `npm run build` ที่จับ และไม่มีใครรัน build ตั้งแต่ 08-26 · แก้: แยกข้อมูลไป `_levels-data.ts` (ไม่มี "use client") · **กติกาใหม่: `npm run build` ก่อน push main ทุกครั้ง** (อยู่ใน SPEC §ด่าน)
- ด่านที่ผ่านก่อน push main รอบนี้: typecheck · eslint 0 error · unit 1682/1682 · verify:ui · **`npm run build` 62 หน้า**

## NEXT
1. เบสตั้งโจทย์หน้าใบสั่งผลิตใหม่ → หน้าลอง `/proto` 2-4 ทาง → เคาะ → ลงของจริง (`ROADMAP.md` §A)
2. เบสซ้อม V2 บนฐาน demo ทีละขั้นในจอสถานี แล้วบอกว่าอะไรไม่ตรงหน้างาน → แก้ → cutover ทีละขั้น (§B)
3. ว่างจาก 1-2 → MFG1-3 (§C)

## เสร็จแล้ว (ล่าสุดก่อน · milestone เท่านั้น — ใบงานเต็ม `ROADMAP.md` §เสร็จแล้ว)
- 09-02 ลบ proto ใบสั่งผลิตทั้งหมด · คอลัมน์เส้นทางงานแบบ C · ด่านตรวจงานลายใช้ยอดตรวจนับครบ · เก็บกวาด repo
- 09-01 แถบกรองเส้นทางงาน D (ถอดช่องเรียงบนคอม) · seed สูตรขั้นงานมาตรฐาน · หน้าตั้งค่า routings · V2 บนฐาน demo · หน้าลอง factory-canvas / production-canvas-filter (พับ)
- 08-31 สีบอกหมวดแบบ B ทั้งเว็บ (เมนูซ้ายไม่เอาสี) · `/production` แบบ C · แถบกรองแบบ A · ภาพรวมออเดอร์เห็นลายทันที (B)
- 08-30 ถอดระบบชื่องาน (migration drop) · หน้าใบงานหน้าตาใหม่ · work-board → เบสเลือก "ปัจจุบัน"
- 08-25 → 08-28 UI-2026 เฟส 1-11 · production step flow + live signal · ปุ่มหุบ/กางเมนูในแถวตรา
- 08-22 → 08-23 ม็อกอัพหลายรูป · PRODUCTION-V2 PV2.1-2.7 รวม local main · Visual identity / Vercel panels · Anajak Blue selection
- 08-15 → 08-21 Next.js 16.3 · PRODUCTION-UX2 · ใบผลิต → Direction A · Station low-tech · ฐาน demo local
- 08-12 → 08-14 UI V2 เป็น UI หลัก · ระบบสีใหม่ · ฟอร์มออเดอร์เดียว · แยกที่อยู่
- 07-02 → 08-05 Gate A / B1-B15 · PERM · UX0-UX3 + design system
- 06-10 → 06-19 P0 ฐานราก · audit 31 ข้อ · FLOW-REDESIGN · invariant เงิน 5 ข้อ

## ติดอยู่ / รอตัดสิน
- ใครถือ role ACCOUNTANT ในทีม 5 คน — ถ้าไม่มี gate การเงิน (FINANCE_ROLES) อาจติด · ตอนนี้ OWNER/MANAGER/ACCOUNTANT เห็นเงิน · SALES เห็นราคาขายไม่เห็นทุน · ถ้าติดจริงค่อยปรับ
- เบสเคาะแล้ว 2026-07-02 (อย่าถามซ้ำ): จด VAT แล้ว · outsource คุยผ่าน LINE (ใบส่งของ = ลิงก์/รูป) · นักบัญชีใช้ PEAK (export CSV template PEAK + generic) · ปริมาณออเดอร์ต้องรองรับเยอะ → pagination/index ทุก list ใหม่ ห้าม hard cap
- เบสเคาะ 2026-09-01: งานร้านนอกเดินขนานกับ DTF ได้ · "ตรวจของกลับจากร้าน" เป็นขั้นในสูตร · สูตรที่ RELEASED แก้ไม่ได้ ต้องคัดลอกเป็นร่างใหม่

## ข้อเท็จจริงที่ session ใหม่ต้องรู้
- บัญชี OWNER ของเบส: hongtaeswatht@gmail.com · สร้างพนักงาน: Settings → Users · bootstrap: `node --env-file=.env scripts/create-owner.ts <email> <password> [ชื่อ]`
- ฐานข้อมูล: Supabase (จริง · migration up to date — เช็ค `npx prisma migrate status`) + ฐาน demo local `127.0.0.1:5433/anajak_erp_demo` (`docs/local-demo-data.md` · reset `npm run db:seed:demo`) · dev สองตัวพร้อมกันใน repo เดียวไม่ได้
- **ฐานจริงไม่ว่าง** — มีออเดอร์/ใบเสนอ/ใบผลิต legacy อยู่ · ห้ามรัน `verify:*` ที่สร้างข้อมูลบนฐานจริง · ห้าม reset
- อ่าน `docs/ARCHITECTURE.md` ก่อนวางโค้ดใหม่ · UI ตาม `docs/DESIGN.md` · payment method / shipping / status map ใช้จาก `src/lib/*` ที่เดียว
- หน้าลอง `/proto` + ทะเบียน `src/app/proto/_registry.ts` — หน้าที่เคาะแล้วเก็บไว้เป็นที่มาตามสถานะในทะเบียน ห้ามลบเงียบ
- Codex ก็ทำงานใน repo นี้ (branch `codex/*`) — `AGENTS.md` เป็นกติการ่วม
- หนี้ที่จดไว้ (อย่าแก้เงียบ) → `ROADMAP.md` §F
