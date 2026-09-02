# PROGRESS — สถานะสด (เขียนทับทุก session · ไม่สะสมประวัติ)

> session ใหม่: อ่านไฟล์นี้ + `git log --oneline -10` ก่อนเริ่ม · จบ session: เขียนทับ "ตอนนี้" + "NEXT" (ประวัติ = git log) · เพดาน ~100 บรรทัด
> ประวัติละเอียดทุกรอบก่อน 2026-09-02 (1 MB) อยู่ใน git: `git show 61575af:PROGRESS.md`

## ตอนนี้ (2026-09-02)
- **ถอดโมดูลผลิตออกเกือบทั้งหมด — รอออกแบบใหม่** (เบสสั่ง 09-02 · branch `remove/factory-station-2026-09-02` · ROADMAP §A2 + §A3): 
  - จอสถานี `/factory/station` (legacy + V2) — commit `13b68f4`
  - หน้ารายการผลิต `/production` + รอบพิมพ์ DTF `/production/print-runs` + คลังฟิล์ม `/production/films` + คิวร้านนอก `/outsource` (legacy + V2) + dialog เปิดใบผลิต + lib worklist/board/print-run-workspace + หน้าลอง proto ของหน้ารายการ 5 ชุด — commit นี้
  - **เหลือ**: ใบผลิต `/production/[id]` (เข้าจากหน้าออเดอร์ / My Tasks) · จอโรงงาน `/factory` (TV) · หน้าตั้งค่า `/settings/routings`
- **เบสเคาะ "ลบเกลี้ยง ยอมพังชั่วคราว"** — ผลที่เห็น: เมนู "การผลิต" หายจากเมนูข้าง/แดชบอร์ด · **เปิดใบผลิตจากออเดอร์ไม่ได้** (ปุ่มถูกถอด ข้อความบอกว่ากำลังทำใหม่) · ลิงก์ที่เคยชี้มาหน้าเหล่านี้ (My Tasks · ปุ่มกลับในใบผลิต · การ์ดผลิตในออเดอร์ · แจ้งเตือน · QR ใบงาน) ชี้ไปหน้าออเดอร์/ใบผลิต/My Tasks แทน · ปุ่ม "รอบพิมพ์ DTF" ในใบผลิตซ่อนไว้ (prop `printRunsHref` เป็น null)
- **ยังเก็บไว้ให้หน้าใหม่ต่อ (ไม่ได้ลบ):** server ทั้งหมด (`production.kanban` · `manufacturing.controlList/station*` · router print-run/film-stock/outsource/factory) · `lib/outsource-ui` · โหมด `surface="station"` ที่ฝังใน `production-detail-screen` (ไม่มีใครเรียก) · `station-garment-preview` · กติกาเดิมใน `SPEC.md`/`docs/DESIGN.md` (ทำเครื่องหมาย "ถอดออก" ไว้แล้ว)
- ด่านที่ผ่าน: typecheck · eslint 0 error · unit 1610/1610 · verify:ui ผ่านครบ · `npm run build` ผ่าน → **merge main + push แล้ว 09-02** (เบสสั่ง) · Vercel deploy ตาม
- **แก้ราก "text ธรรมดาต่อกันด้วยจุด" (เบสสั่ง 09-02 เย็น "ทำเลยและ refactor ด้วย")**: ไล่หลักฐานพบกฎมีแต่ข้อห้าม + ไม่มีชิ้นส่วนนำเสนอข้อมูล + ไม่เคยใช้ impeccable → ทำ 4 ชั้น: (1) `docs/DESIGN.md` §ลำดับความสำคัญทางสายตา กฎ 3 ชั้น (2) primitive `Fact/FactList` `Metric` `InfoChip/InfoChipRow` `DueTag` `ActionZone` ใน `src/components/ui/` (3) ด่าน `scripts/ui-hierarchy-ratchet.ts` ผูกใน `verify:ui` (baseline ต่อไฟล์ ห้ามเพิ่ม dots/muted · ตอนนี้ dots 113 · muted 365) (4) AGENTS §วงจร 3 หน้าลองต้องผ่าน impeccable · refactor รอบ 1 ลงของจริง 6 ไฟล์ (ROADMAP §E2) · หน้าลองโมดูลผลิตทำใหม่ด้วยชิ้นส่วนชุดนี้ + ผ่าน impeccable detect (0 finding) · ด่าน typecheck/lint/test 1610/verify:ui ผ่าน
- **หน้าลองโมดูลผลิตใหม่ `/proto/production-module`** (branch `proto/production-module-2026-09-02`): 3 ทาง (A โต๊ะงานหัวหน้า · B สายพาน · C ตารางเวลา) + สรุปของที่ถอดไป · ทุกทางมี "โหมดหน้างาน" (จอทัช) · "งานล้น" · ธีม · ข้อมูลปลอมจาก `_kit/demo-jobs` + เส้นทางงาน/ร้านนอกใน `_data.ts` · เปิดดูเองแล้วทั้ง 1440 / 1024×768 / 390 ทั้ง 3 ทาง · typecheck + eslint ผ่าน
- **หน้าใบสั่งผลิต `/production/[id]`**: ล้างหน้าลอง 20+ แบบออกหมดแล้ว (09-02) · หน้าเหมือนก่อนเริ่มเรื่องนี้ · รอเบสตั้งโจทย์ใหม่
- **Production V2**: โค้ด / migration / seed / `/settings/routings` ครบ · ซ้อมบนฐาน demo ผ่านถึงกลางทาง · **การซ้อมที่เหลือต้องกดในจอสถานี → ค้างจนกว่าจอใหม่จะเสร็จ** · ของจริงบน Vercel ยังเป็น legacy (`PRODUCTION_V2_ENABLED=0`)
- เว็บจริง: แก้ build พังจาก `/proto/quiet` แล้ว (09-02) · กติกาใหม่ `npm run build` ก่อน push main ทุกครั้ง (SPEC §ด่าน)

## NEXT
1. **เบสดูหน้าลอง `/proto/production-module` ที่ทำใหม่ด้วยชิ้นส่วนชุดใหม่แล้วเคาะ** (ถ้ายังไม่ถูกใจเรื่องหน้าตา บอกจุด — กฎ 3 ชั้นอยู่ `docs/DESIGN.md`) (branch `proto/production-module-2026-09-02` · เปิด dev แล้วดูที่ `localhost:3000/proto/production-module`) — A โต๊ะงานหัวหน้า / B สายพาน / C ตารางเวลา · แต่ละทางมีสวิตช์ "โหมดหน้างาน" + "งานล้น" + ธีม · เคาะแล้ว → ลงของจริง (ROADMAP §A2/§A3)
2. เบสตั้งโจทย์หน้าใบสั่งผลิตใหม่ (§A)
3. ~~merge เข้า main~~ ทำแล้ว 09-02 (build ผ่าน 61 หน้า → push main → Vercel deploy) — **เว็บจริงไม่มีหน้ารายการผลิต/จอสถานีแล้ว** ตามที่เบสยอมรับ
4. ซ้อม V2 ต่อเมื่อจอสถานีใหม่ใช้ได้ (§B) · ว่างค่อย MFG1-3 (§C)

## เสร็จแล้ว (ล่าสุดก่อน · milestone เท่านั้น — ใบงานเต็ม `ROADMAP.md` §เสร็จแล้ว)
- 09-02 ถอดจอสถานี `/factory/station` + โมดูลรายการผลิต (`/production` · รอบพิมพ์ · คลังฟิล์ม · `/outsource`) ทั้งชุด (รอออกแบบใหม่) · ลบ proto ใบสั่งผลิตทั้งหมด · คอลัมน์เส้นทางงานแบบ C · ด่านตรวจงานลายใช้ยอดตรวจนับครบ · เก็บกวาด repo
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
