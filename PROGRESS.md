# PROGRESS — สถานะสด (เขียนทับทุก session · ไม่สะสมประวัติ)

> session ใหม่: อ่านไฟล์นี้ + `git log --oneline -10` ก่อนเริ่ม · จบ session: เขียนทับ "ตอนนี้" + "NEXT" (ประวัติ = git log) · เพดาน ~100 บรรทัด
> ประวัติละเอียดทุกรอบก่อน 2026-09-02 (1 MB) อยู่ใน git: `git show 61575af:PROGRESS.md`

## ตอนนี้ (2026-09-02)
- **ถอดจอสถานี `/factory/station` ออกทั้งชุด — รอออกแบบใหม่** (เบสสั่ง 09-02 · branch `remove/factory-station-2026-09-02` · ROADMAP §A2): ลบ route + UI legacy/V2 (station-mode-screen, manufacturing-station-screen, dtf-batch-dialog, station-queue/current/order-workspace/shell) + lib ที่ใช้เฉพาะจอนี้ (`manufacturing-station` `station-continuation`) + test 16 ไฟล์ · ทางเข้าทุกจุดชี้ใบผลิต `/production/[id]` แทน (เมนูข้าง · เมนูโมดูลผลิต · My Tasks · ปุ่ม "เปิดบริบทสถานี" ในใบผลิต · ลิงก์ในแจ้งเตือน · QR ใบงานพิมพ์ → หน้าออเดอร์) · ด่าน `verify:ui` ที่อ่านไฟล์ที่ลบไปถอดตามไป
- **ยังเก็บไว้ให้จอใหม่ต่อ (ไม่ได้ลบ):** จอโรงงาน `/factory` (TV) · server `factory.station*` / `manufacturing.station*` + read model + `factory-scan` · โหมด `surface="station"` ที่ฝังใน `production-detail-screen` / `print-runs-screen` (ไม่มีใครเรียกแล้ว) · `station-garment-preview` (การ์ดลายในใบผลิตใช้) · กติกาใน `docs/DESIGN.md` §Station work center
- ด่านที่ผ่านรอบนี้: typecheck · eslint 0 error · unit 1659/1659 (ลดจาก 1682 เพราะลบ test ของจอที่ถอด) · verify:ui ผ่านครบ · **ยังไม่ได้รัน `npm run build`** เพราะ dev demo (`:3100`) เปิดค้างอยู่ — ต้องรันก่อน merge main
- **หน้าใบสั่งผลิต `/production/[id]`**: ล้างหน้าลอง 20+ แบบออกหมดแล้ว (09-02) · หน้าเหมือนก่อนเริ่มเรื่องนี้ทุกอย่าง · รอเบสตั้งโจทย์ใหม่
- **Production V2**: โค้ด / migration / seed / `/settings/routings` ครบ · ซ้อมบนฐาน demo ผ่านถึงกลางทาง (ใบ MO-2609-0001 เปิดได้ครบ 9 ขั้น) · **การซ้อมที่เหลือต้องกดในจอสถานี → ค้างจนกว่าจอใหม่จะเสร็จ** · ของจริงบน Vercel ยังเป็น legacy (`PRODUCTION_V2_ENABLED=0`)
- เว็บจริง: แก้ build พังจาก `/proto/quiet` แล้ว (09-02) · กติกาใหม่ `npm run build` ก่อน push main ทุกครั้ง (SPEC §ด่าน)

## NEXT
1. เบสตั้งโจทย์ **จอสถานีใหม่** → หน้าลอง `/proto` 2-4 ทาง → เคาะ → ลงของจริง (ROADMAP §A2) · ตอนลงของจริงค่อยถอดโหมด `surface="station"` ที่ค้างในหน้าใบผลิต/รอบพิมพ์
2. เบสตั้งโจทย์หน้าใบสั่งผลิตใหม่ → หน้าลอง → เคาะ → ลงของจริง (§A)
3. merge branch `remove/factory-station-2026-09-02` เข้า main: ปิด dev demo → `npm run build` → push (เบสอนุมัติ)
4. ซ้อม V2 ต่อเมื่อจอสถานีใหม่ใช้ได้ (§B) · ว่างค่อย MFG1-3 (§C)

## เสร็จแล้ว (ล่าสุดก่อน · milestone เท่านั้น — ใบงานเต็ม `ROADMAP.md` §เสร็จแล้ว)
- 09-02 ถอดจอสถานี `/factory/station` ทั้งชุด (รอออกแบบใหม่) · ลบ proto ใบสั่งผลิตทั้งหมด · คอลัมน์เส้นทางงานแบบ C · ด่านตรวจงานลายใช้ยอดตรวจนับครบ · เก็บกวาด repo
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
