# Anajak ERP — งานและสถานะ

เก็บเฉพาะงานที่ยังเปิด งานเสร็จลบออก ประวัติอยู่ Git; พฤติกรรมที่ต้องรักษาอยู่ [SPEC](SPEC.md) คงรหัสเดิมให้ค้นจากโค้ดได้ ใช้ไฟล์นี้เป็นแผนและจุดรับงานต่อเพียงแห่งเดียว

## ตอนนี้ทำ — ทดลองใบผลิตและเตรียมปล่อย A16

- **ทำถึงไหน:** จัดเอกสาร/ย้ายสถานะเข้า ROADMAP แล้วบน codex/erp-new-repo-standard-20260911; โค้ด A16 ฐาน a41edbd ยังรอรับงาน/ปล่อยจริง
- **ตรวจแล้ว:** 2026-09-11 typecheck/test 1,823/verify:ui ผ่าน; lint 0 errors, 23 warnings; ลิงก์/ตัวอ่าน ROADMAP ผ่าน (ขอบเขตด้านล่าง)
- **ติดอะไร:** ยังไม่ตรวจ Production ด้วยบัญชีทีม/Back–Forward แบบ SPA; เบสยังใช้กระดาษผสมระบบและยังไม่ซ้อม V2
- **ทำต่อ:** ทดลอง A4/A16 ด้านล่างก่อนเสนอ merge branch; หลังอนุมัติตรวจ CI/deploy/Production โดยคง V2 ปิด

หลักฐานรอบนี้: 179 test files ผ่าน; verify-work-order-ui 35 ผ่าน; AST ของไฟล์ TS/TSX ที่แก้มีเฉพาะ comment/ข้อความชี้เอกสาร; fixture และตัวประกอบการ์ดจริงอ่าน ROADMAP ได้ ไม่ได้เริ่ม session ใหม่เพื่อทดสอบ hook event หรือเปิด DB/Production ผล local A16 เดิมอ่านด้วย `git show 054a46e:PROGRESS.md`

- [ ] **A4:** ลองทุกเส้นทางใน `FORM_ROUTES` (`prisma/seed-demo-form-states.ts`) ด้วยบัญชีหัวหน้า/ช่าง แล้วเดินกับพนักงานจริง หัวหน้าต้องทำครบจากใบผลิต ช่างลงที่ `/production/floor`
- [ ] **A16:** ตรวจยอดร่างเมื่อ Back/Forward แบบ SPA; review งานบน branch ก่อนเสนอ merge และตรวจ CI/deploy/Production หลังอนุมัติ ผล local เดิมไม่ปิดรายการนี้
- [ ] **A5:** ระบุขั้นที่จดกระดาษ/กดระบบ ต่อใบหรือต่อกอง, จุดบันทึก QC เสีย/ใบแก้ และฉบับพิมพ์ก่อนเปลี่ยน flow (schema ต้องเคาะ) แก้ข้อความเก่าที่บอกส่ง QC แล้วปิดขั้นกระดาษให้เองในใบพิมพ์และ `work-order-record-mode.ts`; คง parser `[ถือว่าผ่าน]` เพื่ออ่านประวัติและคำเตือน QR `?mockup=` ห้ามย้อน server ให้ปิดขั้นค้างแทนผู้ใช้

## คิว

1. [ ] **A2 — QC/แพ็ก:** ทำจอลงมือ QC/แพ็กสุดท้ายและทาง QR ของ QC; `station-screen.tsx` ยังพาไปหน้าออเดอร์
2. [ ] **A2 — จอร่วม:** PIN ต่อคนบนจอร่วม แตะ auth ต้องมีขอบเขตที่เคาะแล้ว; เรื่องนี้ยังอยู่คิวแม้ทางกลับหน้างานถูกพัก
3. [ ] **A2/A3 — หลัง V2 cutover:** สถานีอ่าน work center จาก settings แทนตารางนิ่ง และต่อ `manufacturing.controlList/workOrder` เข้าจอ
4. [ ] **A3 — ทางเข้าหน้างาน:** ทางเข้า “คลังฟิล์ม”; ตารางผลิตมือถือปรับเมื่อยืนยันว่ามีผู้ใช้งานจริงบนมือถือ
5. [ ] **A2 — ข้อกำหนดขั้น:** ย้ายมาตรฐานใน `work-order-standards.ts` ไปสูตร `/settings/routings`; schema ต้องเคาะก่อน
6. [ ] **B1–B3 / PV2.8 — เปิดใช้ V2:** ตามรายละเอียด §B ด้านล่าง; เบสตอบ 2026-09-11 ว่า “ยังไม่ซ้อม”
7. [ ] **B4 — หลัง cutover:** QC rework ระบุ target work center; DTF partial/waste/reprint event; owner/plan/SLA/audit actor; supervisor material recovery; WIP ของ QC/final pack
8. [ ] **MFG1–MFG3 — ตัวชี้วัดโรงงาน:** อ่านอย่างเดียว ไม่เพิ่ม schema/เงิน; ส่งตรงเวลาเทียบ `Delivery.shippedAt` กับ `Order.deadline` (ไม่มี deadline ไม่นับ และต้องเคาะวิธีนับแบ่งส่ง), ทำถูกครั้งแรก = good/(good+defect), เลือกเดือนไทย; แสดงสาเหตุเสีย `QcDefect.reason`/ป้าย `qc.ts` แยกไซซ์/สี/ลายและรูป; pure functions + tests กรณีขอบ + 1440/390 สองธีม + เติม SPEC
9. [ ] **D · B6/B16 — ตรวจรับระบบ:** นักบัญชี พนักงาน และ console ตามรายละเอียด §D ด้านล่าง ผลแต่ละส่วนต้องมีหลักฐานแยก
10. [ ] **C1/C2/C5/C6 — หลังใช้จริงประมาณหนึ่งเดือน:** pricing service ตามจำนวน×เทคนิค×ตำแหน่ง/ราคาลูกค้าเพื่อ P4; เตือนใบเสนอ/แบบ/INQUIRY/ร้านนอกค้างเกิน N วัน; เก็บ UX ปฏิบัติการหลัง cutover; LINE OA
11. [ ] **E2/F — UI เมื่อแตะไฟล์:** เคาะภาพรวม/แถบสถานะออเดอร์ก่อนเปลี่ยน; ลด baseline ด้วย Fact/Metric/DueTag และถอด class ซ้ำใน Alert; factory alpha/จอทัชจริง, quotations/new → Section/Field, settings labels, dashboard width, addon labels และ lint เดิม; ประวัติละเอียดในใบผลิตยังพาไปออเดอร์ ให้ทบทวนเมื่อแตะ UX โดยรักษาข้อมูลและ logic
12. [ ] **B15/PERM — สิทธิ์/ความปลอดภัย:** CSP ที่ยังรองรับ inline Next และ Supabase signed image; ย้าย router `requireRole` → `requirePermission` เมื่อแตะไฟล์
13. [ ] **F — ข้อมูล:** ตรวจโค้ดล่าสุดก่อนแตกงานและ tests: เชื่อม inquiry→ใบเสนอ→ออเดอร์/รายการจริงแทน `quotationSkeletonItems` (เกี่ยว P4); `recordPayment` เตือนเมื่อใบอยู่บนใบวางบิลแล้ว
14. [ ] **F — เก็บกวาด:** ตรวจ caller ก่อนลบ `order-info-edit-dialog`, `order-items-editor`, `orders/new/product-adaptive-card` และปรับ verify-ui-tokens/baseline ใน commit เดียวเมื่อจำเป็น; Stock เลือก location เมื่อ ERP ไม่ระบุแทนค่าใน `stock-constants.ts`
15. [ ] **P2–P4 — ทบทวนก่อนเริ่ม:** P2 หลัง cutover = per-item/waste/reprint, AP ร้านนอก/WHT ขาจ่าย 3%/50ทวิ/ภงด53, stock reservation/ใบแพ็ก; P3 = portal/OA/ทวงหนี้/WIP/CRM/โควตาแก้แบบ+ล็อก/strike-off/preflight/analytics; P4 = ออเดอร์เว็บธรรมดา+custom เข้า flow เดียวกับหน้าร้านโดยใช้ชนิดออเดอร์/แหล่งเสื้อ/design/approval/payment เดิม, MCP ตามสิทธิ์/ฟอร์มไซซ์ และ e-Tax/PEAK/courier เมื่อปริมาณงานคุ้ม

### B — เงื่อนไขเปิดใช้ Production V2

**B1:** ซ้อมบนฐานทดลอง สูตร→สถานี→ร้านนอก→QC เสีย/งานแก้→แพ็กตามไซซ์ รวม quantity line และหลักฐาน DTF คำตอบ “ยังไม่ซ้อม” ไม่ใช่ยกเลิก V2 และไม่ใช่อนุมัติเปิดจริง

**B2:** แก้ผลจากการซ้อมก่อนรับงาน ฟอร์ม legacy ยังปฏิเสธ `executionEnabled` ผ่าน `lockProductionStepScope`; อย่าถือว่าฟอร์ม A16 ขับใบ V2 ได้แล้ว

**B3:** แก้ `scripts/verify-production-v2-migration.sql` ที่ยัง INSERT `orders.title` ซึ่ง migration `20260830120000_drop_job_title` ลบไปแล้ว แล้วตรวจ migration/manufacturing บนฐานทิ้งได้พร้อม sentinel และ `PRODUCTION_V2_VERIFY_TOKEN` รับ walkthrough ก่อน deploy cutover ให้เบสอนุมัติ target+backup **ก่อน** apply migration/seed routing/work center แล้วค่อยเปิด flag ทีละขั้น เมื่อพ้นช่วงย้อนกลับจึงถอด legacy/flag โดยคง ownership gate ของ `order.updateStatus`

Gate นี้คุมการ cutover V2; การปล่อย A16 ที่ V2 ปิดใช้การตรวจรับของตนเอง ไม่ถือว่าต้องเปิด V2 ไปพร้อมกัน

### D — ตรวจรับและค่าผู้ให้บริการที่ยังไม่ยืนยัน

**B6/B16:** นักบัญชีตรวจเอกสารพิมพ์จริง ใบกำกับ/CN/DN และเลขรัน; ทีมเดิน flow ด้วยบัญชีจริงบน Production การทดสอบในเครื่องไม่ทดแทนทั้งสองส่วน

**Supabase:** ยืนยันปิด public signup ใน Authentication → Providers; พนักงานสร้างผ่าน Settings → ผู้ใช้ ตรวจ Storage policy กับ `scripts/storage-private-rollout.sql`: upload INSERT ตาม policy ที่กำหนด ไม่เปิด SELECT/UPDATE/DELETE ให้ anon/authenticated; การอ่านผ่าน service role/signed URL ตรวจ private bucket และ anon access ด้วยหลักฐานใหม่ก่อนปิด gate นี้ `verify:supabase` อ่านบางข้อได้ แต่ยืนยันสถานะ console ทั้งหมดไม่ได้

**Backup:** ตรวจ export/การกู้ตาม README และการเก็บ Storage แยก รักษาแผนเก็บเอกสารภาษีอย่างน้อย 5 ปีตามข้อกำหนดเดิมให้ผู้รับผิดชอบบัญชีตรวจรับ ไม่เพิ่มค่าใช้จ่าย Pro/PITR โดยอัตโนมัติ

**Vercel:** rate-limit หน้า token ตาม `src/lib/public-routes.ts` ผ่าน platform ตามทิศที่เลือกไว้ เริ่ม log ตรวจ traffic ก่อนบล็อกจริงและพิจารณา Bot Protection โดยไม่บล็อก crawler/LINE unfurler ด้วย user-agent; ตรวจสิทธิ์แพ็กเกจและคำสั่งผู้ให้บริการปัจจุบันก่อนตั้งจริง ไม่ใช้ `deny` บน path กว้าง

**Env:** ยืนยัน `CRON_SECRET` และให้ `PRODUCTION_V2_ENABLED=0` จนผ่าน §B; Stock API key ตั้งใน Settings → Stock การตั้งค่ากับผล deploy ต้องมีหลักฐานของ environment เป้าหมาย

## พักไว้

- **A17 — รูปแบบปุ่มลงมือ:** ตัวเลือกทำในหน้า/เปิดแผงและ proto ถูกพัก/ลบตามสั่ง 2026-09-11 กลับมาทำเมื่อเบสสั่งและเลือกทิศ ช่องว่าง checklist คุณภาพของ DTF/รับเสื้อ/ร้านนอกที่ซ่อน checkbox ยังไม่ปิด ต้องเชื่อมกับ gate ของแต่ละ flow แยกจากหลักฐานจำนวนและเพิ่ม test ก่อนรับงาน
- **A4 — ทางกลับหน้างาน:** My Tasks/แจ้งเตือน เบสตอบ 2026-09-11 ว่า “ค่อยว่ากัน”
