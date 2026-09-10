# Anajak ERP — ROADMAP (แผนโค้ด · ไม่ใช่แผนธุรกิจ)
> งานที่ยังเปิดเท่านั้น · ทำทีละ task · ติ๊กเมื่อ verify แล้ว · ของที่เสร็จอยู่ใน git
> รหัสใบงานที่โค้ดอ้างแต่ปิดแล้ว (A9.x · A13 ฯลฯ) และรายละเอียดรอบเก่า: `git show 42c408a:ROADMAP.md` · แผนธุรกิจ + เหตุผลที่จงใจไม่ทำ: สมองของ Nami `records/projects/anajak-erp/plan.md`

## Milestone ปัจจุบัน: ใบผลิตพร้อมใช้จริง แล้วขึ้น main
> A16 (ตรวจ+แก้ flow ผลิตครบวงจร) อยู่บน branch `codex/production-flow-audit-20260910` ยังไม่ merge · V2 ยังปิด · หน้าลอง `/proto` ทั้งหมดถูกลบ 2026-09-11 (เบสสั่ง · ของเดิม `git show 42c408a:src/app/proto/`)
- [ ] A17 (พักไว้ · หน้าลองถูกลบ 2026-09-11) ปุ่มลงมือในใบผลิต: A ทำในหน้า หรือ B เปิดแผงทำงาน (ของเดิม `git show 42c408a:src/app/proto/work-order-actions/page.tsx`) → เบสสั่งกลับมาทำเมื่อไหร่ ลงของจริงเฉพาะทิศที่เลือก · ข้อคุณภาพใน checklist ต้องเชื่อมด่าน server ของแต่ละ flow โดยไม่ใช้แทนหลักฐานจำนวน · เพิ่ม test ตอนลงจริง · ช่องว่างตอนนี้ (อยู่แม้ A17 พัก): ขั้นของ flow อื่น (ใบรับ/รอบพิมพ์) ซ่อนช่องติ๊ก จึงไม่มีหลักฐานตรวจสี/ตัวอย่าง
- [ ] A4 เบสไล่ demo 12 เส้นทาง `/production/demo-production-form-<key>` (รายชื่อ `FORM_ROUTES` ใน `prisma/seed-demo-form-states.ts`) + ซ้อม 2 บทบาท (บัญชีหัวหน้า → ใบผลิต แก้ให้/แจ้งปัญหา · บัญชีช่าง → ล็อกอินแล้วตกที่ `/production/floor`) แล้วลองกับพนักงานจริง
- [ ] review branch codex → เบสกด merge → ตรวจ CI / deploy / เว็บจริง แยกจากผล local · branch `repo-standard-2026-09-10` merge หลังหรือพร้อมกัน
- [ ] A5 ยืนยันกับเบสว่าเลิก "กระดาษเป็นหลัก" แล้ว (ใบผลิตแบบฟอร์มปิดทุกขั้นด้วยปุ่ม 2026-09-08 · `sendToQc` ไม่ถือว่าผ่านแทน 2026-09-10) → แก้ข้อความที่ยังอธิบายแบบเก่า: `src/app/(print)/print/job-ticket/[id]/page.tsx` ("ขั้นที่จดบนกระดาษถือว่าผ่าน") + หัวไฟล์ `src/lib/work-order-record-mode.ts` · คำถาม A5 ที่ค้าง (กระดาษต่อใบผลิตหรือต่อกอง · QC เสียแล้วรีดใหม่จดที่ไหน · จำฉบับใบที่พิมพ์ = schema) ทบทวนหรือพับ · ห้ามถอดการเตือน QR ใบเก่า `?mockup=` (SPEC §การผลิต)
- [ ] ยอดร่างใบผลิต: เทสต์ Back/Forward แบบ SPA

## ถัดไป

### A2 · A3 หน้างานและรายการผลิต (ค้างจากรอบรื้อ 2026-09-02)
- [ ] หน้าลงมือ QC / แพ็กสุดท้ายบนจอหน้างาน (ตอนนี้การ์ดพาไปหน้าออเดอร์ — `src/components/station/station-screen.tsx`) · สแกน QR ที่สถานี QC ยังไปหน้าลงมือของสถานี
- [ ] PIN ต่อคนบนจอร่วม (auth — ถามก่อน) · ทางกลับจากหน้างานไป My Tasks/แจ้งเตือนของช่าง (ถามเบสว่าพอไหม)
- [ ] สถานีอ่านจาก work center ในหน้าตั้งค่าเมื่อ V2 cutover (`src/lib/station-desk.ts`)
- [ ] คลังฟิล์มยังไม่มีทางเข้า · `manufacturing.controlList` / `manufacturing.workOrder` ยังไม่ต่อจอ · ตารางผลิตบนมือถือเลื่อนแนวนอน (ทำเมื่อเบสยืนยันว่ามีคนใช้มือถือ)
- [ ] ข้อกำหนดต่อขั้นยังเป็นตารางนิ่ง `src/lib/work-order-standards.ts` — ย้ายเข้าสูตรขั้นงาน `/settings/routings` = แก้ schema (ถามก่อน)

### B. Cutover Production V2 (PV2.8 · เสี่ยงสูง · เบสอนุมัติทุกขั้น)
> เว็บจริงยังเป็นแบบเดิม (`PRODUCTION_V2_ENABLED=0`) · ฐานจริงยังไม่ seed routing/work center · ซ้อมบนฐานทดลองด้วย `DEMO_PRODUCTION_V2=1 npm run db:seed:demo`
- [ ] B1 เบสซ้อมบนฐานทดลอง: เปิดใบจากสูตรมาตรฐาน → กดทีละขั้นบนจอหน้างาน (รวมส่งร้านนอก · QC ไม่ผ่าน/งานแก้ · แพ็กแยกไซซ์) → บอกจุดที่ไม่ตรงหน้างาน · จากการซ้อม 2026-09-01: รายงานผลผลิตต้องแยกตาม quantity line · DTF เริ่มจากรอบพิมพ์ที่ผูกหลักฐาน · เดิมรอ "จอสถานีใหม่" — `/production/floor` มีแล้ว ถามเบสว่าพร้อมซ้อมหรือยัง
- [ ] B2 แก้ตามที่ซ้อมเจอ (แตก task ใต้ข้อนี้) · ฟอร์มใบผลิตยังขับใบ V2 ไม่ได้ (`lockProductionStepScope` ปฏิเสธ)
- [ ] B3 ก่อนเปิด flag: รัน `scripts/verify-production-v2-migration.sql` บนฐานทิ้งได้หลัง `prisma migrate deploy` (สคริปต์ยัง INSERT `orders.title` ที่ลบแล้วใน migration `20260830120000_drop_job_title` → รันไม่ผ่านจนกว่าจะแก้ ดู §F) + `npm run verify:manufacturing-v2` บนฐานทิ้งได้ที่มี sentinel / `PRODUCTION_V2_VERIFY_TOKEN` · ห้าม merge main/deploy cutover ก่อนเบสรับ walkthrough B1 → seed routing + work center ลงฐานจริง (additive) → backup → เปิด flag → ลบ UI/writer แบบเดิมหลังพ้นช่วงย้อนกลับ (ลบ `src/lib/production-v2-flag.ts` พร้อมกัน · ด่านใน `order.updateStatus` ต้องคงไว้แบบไม่มีเงื่อนไข ห้ามลบไปพร้อม flag)
- [ ] B4 ของที่ V2 ยังขาด (ปิดหลัง cutover): QC rework target work center · DTF partial/waste/reprint event · owner/plan/SLA/audit actor read model · supervisor material recovery · WIP ownership ของ QC/final pack

### C. MFG ตัวชี้วัดฝ่ายผลิต (เบสสั่ง 2026-08-15 · อ่านอย่างเดียว · ไม่เพิ่ม schema · ไม่มีเงิน)
- [ ] MFG1 หน้าเดียว 2 ตัวเลข: ส่งตรงเวลา % (ออเดอร์ที่ส่งในงวด — วันส่งอยู่ที่ `Delivery.shippedAt` (Order ไม่มีช่องนี้ · เคาะว่านับใบส่งใบไหนเมื่อแบ่งส่ง) เทียบ `Order.deadline` · ไม่มี deadline ไม่นับ) + ทำถูกครั้งแรก % (`Σ qtyGood / (Σ qtyGood + Σ qtyDefect)`) · เลือกงวดเดือนไทยแบบ `/billing/tax`
- [ ] MFG2 ของเสียตาม `QcDefect.reason` ในงวด แยกไซซ์/สี/ลาย + เปิดรูป · ป้ายสาเหตุจาก `src/lib/qc.ts` (ห้ามประกาศ map ใหม่)
- [ ] MFG3 pure function แยกจาก router + unit test เคสขอบ (งวดว่าง · ไม่มี deadline · หารศูนย์ · ยังไม่ส่ง · ยกเลิก) · จอ 1440/390 สองธีม · เพิ่มเกณฑ์ใน `SPEC.md`

### D. Gate ก่อนใช้จริง
- [ ] B6 นักบัญชีรีวิว template ใบกำกับ/CN/DN + เลขรัน จากเอกสารพิมพ์จริง
- [ ] B16 walkthrough ของจริงกับทีม (login จริงบน Production) + นักบัญชีดูเอกสารเงินพิมพ์จริง 1 รอบ
- [ ] เบสทำใน console ข้อที่ยังไม่ติ๊กใน `docs/deploy-checklist.md`: ปิด public signup ของ Supabase · ทบทวน Storage policies · rate-limit หน้า public token ด้วย Vercel Firewall · env บน Vercel ตั้ง `CRON_SECRET` และคง `PRODUCTION_V2_ENABLED=0`

### E. หลังใช้จริง ~1 เดือน (ดูข้อมูลจริงก่อนสร้าง)
- [ ] C1 pricing engine ใบเสนอ (qty break × เทคนิค × ตำแหน่ง + ราคาต่อลูกค้า) เป็น service เรียกซ้ำได้ — ฐานราคาออเดอร์เว็บ P4 (`src/server/services/pricing.ts` วันนี้เป็นสูตรยอดรวม)
- [ ] C2 stale sweep: ใบเสนอ SENT / แบบรอลูกค้า / INQUIRY / ร้านนอกเลยกำหนด ค้างเกิน N วัน → แจ้งเตือน (โครง cron + notification มีแล้ว)
- [ ] C5 UX ฝั่งปฏิบัติการที่เหลือหลัง cutover · C6 แจ้งเตือนผ่าน LINE OA

### E2. ลำดับความสำคัญทางสายตา
- [ ] หน้าออเดอร์ `/orders/[id]` แท็บภาพรวม + แถบสถานะ → ให้เบสเคาะทางก่อน
- [ ] ลดตัวเลขใน `scripts/ui-hierarchy-baseline.json` ตอนแตะไฟล์: "ป้าย: ค่า" → `Fact` · ตัวเลขนำ → `Metric` · กำหนดส่ง → `DueTag` แล้ว `npx tsx scripts/ui-hierarchy-ratchet.ts --update` · `Alert` ที่ยังใส่ `text-xs`/สีเองใน children ถอด class ตอนแตะไฟล์

### F. หนี้ (ทำตอนแตะไฟล์ หรือเปิดใบงานเมื่อถึงคิว — อย่าแก้เงียบ)
- [ ] B15 ตั้ง Content-Security-Policy ใน `next.config.ts` (ไล่ทดสอบ inline script/style ของ Next + รูปจาก Supabase signed URL ก่อน)
- [ ] PERM router ที่ยังใช้ `requireRole` เปลี่ยนเป็น `requirePermission` ตอนแตะไฟล์ (`grep -rl "requireRole(" src/server/routers`)
- [ ] โค้ดที่แอปไม่เรียกแล้ว รออนุญาตลบ (ลบเมื่อไหร่ต้องแก้รายชื่อใน `scripts/verify-ui-tokens.tsx` + entry ใน `scripts/ui-hierarchy-baseline.json` ในคอมมิตเดียวกัน ไม่งั้น verify:ui พัง): `src/components/orders/order-info-edit-dialog.tsx` · `src/components/orders/order-items-editor.tsx` · `src/components/orders/new/product-adaptive-card.tsx`
- [ ] UI: `/factory` ใช้สี alpha ดิบ · ยังไม่ตรวจกับจอทัชโรงงานจริง · `/quotations/new` ยังใช้ Card รุ่นเก่า → `Section`/`Field` (คง logic แปลงเป็นออเดอร์) · settings ยังมี label ดิบ · หน้าแรก dashboard ซ่อน `max-w-6xl` (`src/components/dashboard/dashboard-home.tsx`) · รหัสส่วนเสริม (SIZE_LABEL ฯลฯ) เป็นศัพท์ภายใน · lint warning เก่าเก็บตอนแตะไฟล์ ห้ามเพิ่มใหม่
- [ ] ข้อมูล (ต้องมีใบงาน + test · ยังไม่ verify กับโค้ดล่าสุด): inquiry ↔ ใบเสนอ ↔ ออเดอร์ไม่ผูกกัน + `convertToOrder` ได้รายการแค่โครง (`quotationSkeletonItems` · productType OTHER ไม่มีลาย/จุดพิมพ์) (เกี่ยว P4) · `recordPayment` ไม่เตือนว่าใบอยู่บนใบวางบิลแล้ว
- [ ] แก้ `scripts/verify-production-v2-migration.sql` ให้ตรง schema ปัจจุบัน (ตัดคอลัมน์ `title` ออกจาก INSERT orders) ก่อนใช้เป็นด่าน B3 · แตะโค้ด ถามก่อน
- [ ] Stock: ให้ Anajak Stock เลือก location เองเมื่อ ERP ไม่ระบุ (ตอนนี้ตายตัวที่ `src/lib/stock-constants.ts` · comment ในไฟล์นั้นยังชี้ `PROGRESS.md`)
- [ ] ล้าง `docs/` ให้หมด (รอเบสเคาะ · แตะโค้ด): แก้ข้อความที่ชี้ `docs/deploy-checklist.md` (`scripts/verify-supabase-audit.ts`) และ `docs/local-demo-data.md` (`prisma/seed-demo.ts`) แล้วย้ายเนื้อเข้าไฟล์มาตรฐาน → `git rm` โฟลเดอร์ (SQL policy bucket `designs` ย้ายไป `scripts/storage-private-rollout.sql` แล้ว)

### P2–P4 (ยังไม่เริ่ม · ทบทวนขอบเขตกับเบสก่อนเริ่ม)
- [ ] P2 หลัง cutover: per-item tracking + ของเสีย/reprint log ต่อยอด V2 · AP ร้านนอก + หัก ณ ที่จ่ายขาจ่าย 3% + 50ทวิ + ภงด.53 export · จองสต๊อกลึกกับ Anajak Stock · ใบแพ็ค
- [ ] P3 ฝั่งลูกค้า: portal เต็ม · LINE OA + ทวงหนี้ + รูประหว่างผลิต · CRM follow-up/RFM · โควตาแก้แบบ + ล็อกหลังอนุมัติ · strike-off · preflight ไฟล์ · analytics ลึก
- [ ] P4 เว็บสกรีน (`anajak-print-web`): API รับออเดอร์ธรรมดา + custom เข้าเป็นออเดอร์เดียวกับหน้าร้าน (ใช้ order type / garment source / design version / approval token / payment terms เดิม · ไม่สร้างสถานะ/flow แยก) · MCP ขยายตามสิทธิ์ · ฟอร์มไซซ์ลูกค้าองค์กร · e-Tax / PEAK / courier API เมื่อ volume ถึง
