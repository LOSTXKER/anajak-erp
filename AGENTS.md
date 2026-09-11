# Anajak ERP — AGENTS.md
> แหล่งความจริงเดียวสำหรับ AI ทุกเจ้า (Claude/Codex/Gemini/Cursor) · Claude อ่านผ่าน `CLAUDE.md` (`@AGENTS.md`)
> แผนธุรกิจ/research/บัตร project อยู่ในสมองของ Nami (`records/projects/anajak-erp/`) ไม่อยู่ใน repo นี้ · repo = สเปค + แผนโค้ด + สถานะ + โค้ด · ห้ามเพิ่มไฟล์ใหม่ใน `docs/` หรือ .md ใหม่ที่ root · audit/mockup/แผนที่จบแล้วไม่เก็บใน repo (อยู่ใน git history)

## โปรเจคนี้คือ
- ERP หลังบ้านโรงงานสกรีนเสื้อ Anajak — ทีม ~5 คน + เจ้าของ (เบส · ไม่เขียนโค้ด) · ลูกค้า B2B เครดิตเทอม · ลูกค้า/ร้านนอกเปิดงานผ่านลิงก์ token · ทำเองมีแค่ DTF ที่เหลือส่งร้านนอก (เบสเคาะ 2026-06-12)
- เป้าหมายที่ใช้ตัดสินทุกงาน (เบสย้ำ 2026-09-02): (1) ครอบคลุมทั้งโรงงาน ขาย → ออกแบบ/อนุมัติ → ผลิต → QC → แพ็ก/ส่ง → บิล/ภาษี/ลูกหนี้ ไม่พึ่งกระดาษ/ความจำ (2) ส่งร้านนอกได้ทุกขั้นอย่างมีประสิทธิภาพ รวม DTF วันเครื่องเสีย (3) UX minimal เปิดหน้ารู้ใน 3 วิว่าทำอะไรต่อ · มือถือ/จอทัชหน้างานใช้ได้จริง · หนึ่งหน้า primary action เดียว (4) ออเดอร์จากเว็บสกรีน (ธรรมดา + custom) ไหลเป็นออเดอร์เดียวกับหน้าร้าน ไม่ทำทางแยก
- stack: Next.js 16.3 App Router (ประตู auth = `src/proxy.ts` ไม่ใช่ middleware) · React 19 · tRPC 11 · Prisma 6 บน PostgreSQL ของ Supabase · Supabase Auth/Storage · Tailwind 4 + Radix แนว shadcn · MCP server · Vitest · Vercel region sin1 + cron 2 ตัว (`vercel.json`) · **push main = ขึ้นเว็บจริง**
- ระบบข้างเคียง: Anajak Stock (repo พี่น้อง `anajaktshirt-stock`) ผ่าน `/api/erp/*` + `X-API-Key` ตั้งที่ Settings → Stock (env เป็นแค่ค่าสำรอง) · repo นี้ **public** บน GitHub

## คำสั่งหลัก
```bash
npm ci                  # ติดตั้ง (postinstall = prisma generate) · Node 24 ตาม CI
npm run dev             # localhost:3000 — ใช้ DB ใน .env = Supabase ตัวจริง
npm run dev:demo        # ฐานทดลอง local (Docker anajak-postgres · 127.0.0.1:5433/anajak_erp_demo) — คู่มือ docs/local-demo-data.md
npm run db:seed:demo    # ล้าง+สร้างข้อมูลในฐานทดลองใหม่ (สคริปต์ล็อกเป้าไว้) · ซ้อม V2: DEMO_PRODUCTION_V2=1 npm run db:seed:demo
npm run typecheck && npm run lint && npm test && npm run verify:ui   # ด่านขั้นต่ำก่อน commit
npm run build           # prisma generate && next build (deploy ไม่ apply migration ให้)
npm run db:migrate      # prisma migrate dev หลังแก้ schema — ทำกับ DB ใน .env → ถามก่อน · ห้าม db push
npm run db:seed         # master data idempotent (work center · แค็ตตาล็อกบริการ · สูตรขั้นงานมาตรฐาน)
```
- `npm run verify:<x>` (รายชื่อใน `package.json`) โหลด `.env` ทั้งชุด → ส่วนใหญ่เขียน/ลบข้อมูลใน DB และ Supabase Auth/Storage ตัวจริง บางตัวแก้ `DocumentSequence` · Stock client ปิดเฉพาะเมื่อ `ANAJAK_ERP_DEMO_MODE=1` → ห้ามรันจนเบสอนุมัติพร้อม env ฐานทดลองครบชุด (ตั้งแค่ `DATABASE_URL` ไม่พอ) · รันได้เลย: `verify:ui` (static) · `verify:printrun` (ล็อกฐานทดลองเอง) · อ่านอย่างเดียวแต่อ่านของจริงตาม `.env`: `verify:backup` `verify:supabase` · `verify:manufacturing-v2` ทำลายข้อมูล ใช้กับฐานทิ้งได้ที่มี sentinel + `PRODUCTION_V2_VERIFY_TOKEN` เท่านั้น
- CI `.github/workflows/ci.yml`: `npm ci` → lint → typecheck → test ทุก push main และ PR (ไม่มี build/verify:*)

## โครงสร้าง
- `src/app/` — `(dashboard)/` หลังบ้าน · `(public)/` หน้าลูกค้า/ร้านนอกถือ token ไม่ login · `(print)/print/` เอกสาร A4 · `(auth)/` login · `(v2)/` redirect เข้ากันได้ · `production/floor/` โหมดหน้างานช่าง (`station/` redirect มา) · `factory/` จอ TV อ่านอย่างเดียว · `api/` trpc · files · mcp · cron · backup
- `src/proxy.ts` refresh session + redirect + ข้อยกเว้นหน้า public · `src/instrumentation.ts` → `src/lib/env.ts` ตรวจ env ตอนบูต
- `src/server/routers/` tRPC (รวมที่ `_app.ts`) = ผิว: zod + สิทธิ์ + เรียก service · `src/server/services/` business logic แกน (เงิน · สถานะ · เลขเอกสาร · ผลิต/V2 · QC · สต๊อก) · `src/server/trpc.ts` context + สิทธิ์
- `src/lib/` ของใช้ร่วม client+server (prisma · supabase* · stock-api · permissions/roles · mcp/) · `src/components/ui/` primitives + `tokens.ts` · `src/components/<โมดูล>/` · `src/hooks/` · `src/types/`
- `prisma/` schema · migrations · `seed.ts` (master data) · `seed-demo*.ts` (ฐานทดลอง) · `scripts/` verify-* · create-owner · create-agent-key · run-local-demo · `storage-private-rollout.sql` (policy bucket `designs` รันมือใน Supabase · ต้นฉบับเดียว)
- `docs/` เหลือเฉพาะที่โค้ดชี้ถึง: `deploy-checklist.md` (งานใน console · `scripts/verify-supabase-audit.ts` พิมพ์ชี้) · `local-demo-data.md` (`prisma/seed-demo.ts` ชี้) · `DESIGN.md` (ป้ายชี้ไป `DESIGN.md` ที่ root · `scripts/ui-hierarchy-ratchet.ts` + คอมเมนต์ 4 ไฟล์ยังเขียนชื่อเก่า) — รอเบสเคาะย้าย (`ROADMAP.md` §F)

## code style
- TypeScript strict · import `@/*` → `src/*` · ชื่อไฟล์ kebab-case · 2 ช่อง LF (`.editorconfig`) · double quote + semicolon
- ESLint 9 `eslint.config.mjs`: jsx-a11y = error · `no-alert` = error (ใช้ `useConfirm`/`usePromptText` จาก `@/components/ui/confirm-dialog`) · กฎภาษา UI (ขนาดตัว/เงา/ระยะ/สี/ความสูง control) ยกเว้นเอกสารพิมพ์และจอโรงงาน
- procedure ใหม่ใช้ `requirePermission` (`requireRole` = ของเก่ากำลังไล่แทน) · logic อยู่ service ไม่ฝังใน router
- ประกาศค่า+ป้ายที่เดียว: `src/lib/status-config.ts` · `payment-methods.ts` · `payment-terms.ts` · `shipping-methods.ts` · `order-status.ts` · สูตรราคาฝั่ง client `src/lib/pricing.ts` ต้องให้ผลเท่า `src/server/services/pricing.ts` (test คู่)
- ใช้ของกลางก่อนสร้างใหม่: หน้ารายการ `useListPageState` + `usePageClamp` · นำทางนอก Link `requestAppNavigation` · วันกำหนดส่ง `differenceInBangkokDays` · โครงหน้า `PageShell` / `DataTable` / `TablePagination` · ไฟล์อัปโหลดลูกค้า `src/lib/customer-upload-policy.ts` · ใบผลิตกับหน้างานใช้ `work-order-controller` ชุดเดียว
- test วางข้างไฟล์เป็น `*.test.ts` (vitest จับเฉพาะ `src/**/*.test.ts` — `.test.tsx` ไม่รัน) · ชื่อ test ไทย
- comment ไทยบอก "ทำไม" + วันที่เบสเคาะ · โค้ดอ้างรหัสใบงานใน `ROADMAP.md` (§A2 · §A5 · §B15 · §PERM ฯลฯ) → ห้ามเปลี่ยนชื่อไฟล์นี้
- surgical: แตะเฉพาะที่ใบงานสั่ง · grep หา pattern เดิมก่อนสร้างใหม่ · ห้ามสร้าง primitive ซ้ำหน้าที่ · refactor = targeted + มี test ก่อน ห้าม big-bang · แตะไฟล์ไหนเก็บกวาดไฟล์นั้น

## วงจรการทำงาน (บังคับ — กันหลุด 3 อย่าง)
1. เริ่มงาน → อ่านการ์ดงาน (ระบบยื่นให้ตอนเปิด) + `SPEC.md` · หยิบงานจาก `ROADMAP.md` (ไฟล์แผนของ repo นี้) § ตอนนี้ทำ · งานไม่อยู่ใน ROADMAP = ถามเบสก่อน
2. งานใหญ่ → แตกงานใต้ § ตอนนี้ทำ ก่อนแตะโค้ด · ทำทีละข้อ
3. ก่อนเคลม "เสร็จ" → verify ทุกข้อที่เกี่ยวใน `SPEC.md` ด้วยรัน/เปิดดูจริง: typecheck · lint 0 error · test · verify:ui · งาน UI เปิดจอจริง 1440 + 390 สว่าง/มืด · build ก่อนขึ้น main
4. งานเสร็จ → ลบออกจาก `ROADMAP.md` (ไม่ติ๊กเก็บ · ประวัติอยู่ git) → commit (บรรทัดแรก = ประโยคไทยที่คนอ่านออก ≤90 ตัว) → push เป็น branch
5. ปิดรอบ (จบ session/เปลี่ยนเรื่อง — ไม่ใช่ทุก commit) → เขียนทับ `PROGRESS.md` ครั้งเดียว (ทำถึงไหน·ค้าง·NEXT ≤2.5KB)

## UI (มาตรฐาน 2026-09-10 — ดีไซน์ = ของเราเอง ไม่มี engine ภายนอก)
- งาน UI ที่เปลี่ยนรูปร่าง/ตำแหน่งของที่คนเห็นและมีทางให้เลือก → ให้เจ้าของงานเคาะทางก่อน ห้ามแตะของจริงจนกว่าเคาะ · repo นี้ไม่มีหน้าลอง `/proto` แล้ว (เบสสั่งลบ 2026-09-11) — จะทำหน้าลองใหม่ต้องให้เบสสั่งก่อน
- บนจอมีแค่ข้อมูลจริงกับปุ่ม — คำอธิบาย/ที่มา/คำโปรย = ตัดหรือเข้า tooltip · เข้าใจด้วยชื่อ/การจัดกลุ่ม ไม่ใช่ประโยค (ด่าน ui-text-gate ตรวจหลังเขียนไฟล์)
- `DESIGN.md` = ฉบับบาง ≤4KB: ตัวตน · ground truth ชี้ไฟล์ · "ตอนนี้ใช้อะไร" · บทเรียนเทคนิค — ไม่ใช่สมุดคำห้าม

## กติกาสำคัญ (พลาดแล้วเสียหาย · invariant ครบอยู่ `SPEC.md`)
**เงิน/ภาษี**
- เงิน = `Decimal(12,2)` เท่านั้น ห้าม Float ให้ช่องเงิน · คำนวณ `Prisma.Decimal` + `round2` (half-up) ใน `src/server/services/money.ts` · แปลงเป็น number ที่ขอบเดียว `src/lib/prisma.ts` · `_sum`/`_avg` ไม่ผ่านขอบนั้น → ใช้ `aggToNumber`
- เลขเอกสารจาก `nextDocumentNumber()` ใน `$transaction` เดียวกับการสร้างเอกสารเท่านั้น ห้ามสุ่ม/ตั้งเอง (เลขใบกำกับต้องรันต่อเนื่อง) · import เอกสารเก่าต้อง seed `lastNumber` ก่อน
- เงินหลายขั้น = `$transaction` + `SELECT … FOR UPDATE` · เพดาน `billedFloor` / `assertOrderTotalCoversBilled` ต้องจริงเสมอ · ใบกำกับ/ใบเสร็จออกทุกงวดรับเงิน (รวมมัดจำ) ยอดเท่าเงินรับ วันที่ = วันเงินเข้าจริง
- ใบกำกับ/ใบวางบิลห้ามลบ — ยกเลิกพร้อมเหตุผลแล้วออกใหม่ · CN/DN อ้างใบเดิม + เหตุผล (ม.86/10) · ผู้ซื้อ/ผู้ขายบนเอกสาร = สำเนา ณ วันออก (ม.86/4 · `src/server/services/document-party.ts`) ห้ามเขียนโค้ดดึงใหม่ (ยกเว้นใบเสนอราคาร่าง) · เอกสารพิมพ์ปรับหน้าตาได้ แต่ข้อความกฎหมาย/ยอด/ลำดับหน้าคงเดิม
- ไม่คิดต้นทุนต่องาน (เบสเคาะ 2026-06-12) → ห้ามเพิ่มช่องเงิน/ต้นทุนใน flow ผลิต–ร้านนอก · จอหน้างาน/สถานี/TV ไม่ส่งและไม่แสดงเงินแม้ role เป็น OWNER · ทุน/กำไรไม่ถึงฝ่ายขาย/ช่าง (`src/lib/roles.ts`)

**สถานะ/การผลิต**
- สถานะออเดอร์ (`internalStatus`) เปลี่ยนผ่าน `transitionOrder()` ใน `src/server/services/order-status.ts` เท่านั้น ห้าม set ตรง
- กฎรอ/ความพร้อม/สิทธิ์/สถานะถัดไปคำนวณที่ server — จอห้ามคิดกฎธุรกิจคู่ขนาน
- Production V2 ปิดบนเว็บจริง (`PRODUCTION_V2_ENABLED=0`) จน cutover `ROADMAP.md` §B · เปิด flag / seed routing ลงฐานจริง = เบสอนุมัติทีละขั้น + backup ก่อน · คำสั่ง V2 ต้องมี `commandId` + `expectedRevision` · RoutingVersion ที่ RELEASED ห้ามแก้ (ออกเวอร์ชันใหม่)
- ห้ามเปลี่ยนชื่อตาราง `design_versions` (audit · token ที่ส่งลูกค้าแล้ว · migration อ้างอยู่) — เปลี่ยนได้แค่คำบนจอ

**สิทธิ์/ไฟล์/ระบบภายนอก**
- auth fail-closed · ทุก mutation ผ่านสิทธิ์ที่ server · `manage_users` ไม่รับ override (OWNER เท่านั้น) · ต้องเหลือ OWNER active อย่างน้อย 1 · session Supabase อย่างเดียวไม่พอ — ต้องมีแถว `User` ที่ `isActive` (tRPC `src/server/trpc.ts` + `/api/files`)
- หน้า public ใหม่ = เพิ่ม prefix ใน `src/lib/public-routes.ts` + matcher ใน `src/proxy.ts` · ห้ามใส่ logic ระหว่าง `createServerClient` กับ `getUser`
- ไฟล์อยู่ bucket private `designs` — อ่านผ่าน `/api/files` (เช็คสิทธิ์ → signed URL สั้น) · อัปโหลด `upsert: false` (RLS ให้แค่ INSERT) · allowlist ไฟล์ของ token กว้างเท่าที่หน้าโชว์ · service role ใช้ฝั่ง server เท่านั้น
- cron fail-closed ด้วย `CRON_SECRET` · กุญแจ MCP เก็บเป็น sha256 · ห้าม secret/ข้อมูลลูกค้า/โน้ตธุรกิจในไฟล์ที่ track (repo public)
- ERP เขียนระบบ Anajak Stock จริง (จอง/ตัดสต๊อก/ลบสินค้า) — test/สคริปต์ห้ามยิงด้วย Stock setting จริง · ฐานทดลองต้องไม่มี Stock credentials และตั้ง `ANAJAK_ERP_DEMO_MODE=1`

**ฐานข้อมูล**
- DB ใน `.env` = Supabase ตัวจริง แผนฟรีไม่มี backup อัตโนมัติ (สำรอง = export ในแอป) → reset / `db push` / `verify:*` ที่เขียนข้อมูล ลงฐานนี้ = กู้ไม่ได้
- schema เพิ่มแบบ additive ผ่าน migration เท่านั้น · ห้าม apply/reset ฐาน shared/remote โดยไม่ระบุ target + backup แยก
- `prisma/seed.ts` = master data idempotent ไม่ทับราคาที่ผู้ใช้แก้ ห้ามใส่ข้อมูลตัวอย่าง · ด่านฐานทดลอง (`src/lib/demo-seed-plan.ts` + token + ห้าม Stock credentials) ห้ามผ่อน
- เปิดด่านบังคับใหม่ทีละด่าน (เปิดพร้อมกัน = พนักงาน bypass ข้อมูลเป็นขยะ) · manual/CSV ก่อน API เสมอ

**ด่าน UI**
- `verify:ui` ห้ามปิด · baseline `scripts/ui-hierarchy-baseline.json` ลดได้ เพิ่มไม่ได้ (`--update` หลังลดจริงเท่านั้น ห้ามลดด้วยการลบข้อมูลออกจากจอ) · แก้ค่าคาดหวังได้เมื่อบทบาท token เปลี่ยนจริงในคอมมิตเดียวกัน
- เคาะทางแล้ว ลงของจริงเฉพาะ presentation (ไม่แตะ query/mutation/permission/status/schema ถ้าใบงานไม่สั่ง) · ห้ามย้ายเข้า tooltip: warning · validation · เหตุที่ช่องล็อก · สิทธิ์ไม่พอ · เตือนก่อนบันทึก · EmptyState
- หน้าดู `src/components/orders/detail/order-items-display.tsx` ต้องล้อฟอร์ม `src/components/orders/new/order-item-card.tsx` ด้วยมือ — แก้ฟอร์มต้องแก้หน้าดูตาม
- บล็อก `nextjs-agent-rules` ท้ายไฟล์นี้ `next dev` เขียนกลับเอง — คงไว้คำต่อคำ

## permission (3 ชั้น)
- ทำได้เลย: แก้โค้ดตามใบงานใน ROADMAP · รัน typecheck/lint/test/verify:ui/build · ใช้ฐานทดลอง (`dev:demo` · `db:seed:demo`) · ปรับ UX/UI + refactor บนโครงเดิมเมื่อช่วยให้ใช้ง่ายขึ้น (เบสอนุญาต 2026-09-09) — งานที่มีหลายทางต้องให้เบสเคาะก่อน
- ถามก่อน: ลบไฟล์โค้ด · แก้ schema/migration · `db:migrate` / `db:seed` / `db:studio` / `prisma migrate deploy` กับ DB ใน `.env` (บอก target + backup ก่อน) · เพิ่ม dependency · แตะ config/env/auth · งานนอก ROADMAP · รื้อหน้าจริงที่ยังไม่เคาะทิศ
- ห้าม: push main ตรง / `vercel --prod` (ต่อ Vercel = ขึ้นเว็บจริง) · force push · commit secret · ลบ/ปิด test หรือด่าน verify เพื่อให้ผ่าน · set สถานะตรง · Float ให้ช่องเงิน · reset / `db push` / `verify:*` ที่เขียนข้อมูล ลงฐานจริง · พิมพ์รหัสผ่านหรือสร้างกุญแจ MCP แทนเบส (`scripts/create-owner.ts` · `npm run key:agent` เบสรันเอง)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
