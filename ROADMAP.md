# Anajak ERP — งานปัจจุบันและคิว

งานเปิดเท่านั้น; งานปิด/แบบที่ปฏิเสธดู `git log -- ROADMAP.md` สถานะล่าสุด: `PROGRESS.md`; เกณฑ์/ข้อมูล: `SPEC.md`; วิธีทำงาน: `AGENTS.md`; โครงระบบ: `docs/ARCHITECTURE.md`; สัญญาจอ: `docs/DESIGN.md`

## ตอนนี้ทำ

### A16. ตรวจและรื้อ UI ด้วย ui-guidance ใหม่ (เบสสั่ง 2026-09-11)

**อนุมัติ:** ตรวจทุกหน้า/ส่วนย่อย แก้กฎและส่วนกลาง ปรับตามงานจริงบน `codex/ui-reset-20260911` ใช้ `global-skills/ui-guidance/SKILL.md` ใน `bestos-brain` คงคำช่วย/เหตุผลล็อก/ผลคำสั่งตรงจุดใช้ แต่ละรายการมี action ได้ ไม่บังคับคำโปรยหรือรูปแบบเดียว

**รอบนี้:** ปรับกฎ/ส่วนกลางแล้ว เปิดหลังบ้านบนฐานทดลองหลัง login และสร้าง `/proto/ui-reset` เทียบของเดิม/A เอกสารโปร่ง/B พื้นที่ทำงาน ด้วย component จริง 3 หน้า (คิวผลิต/ออเดอร์/ใบผลิต) **รอเลือกทิศ ยังไม่รื้อหน้าตาครบระบบ** แก้ใบเสนอบนมือถือ/ชื่อบริการร้านนอก/เลข 0 เกินในหน้าสินค้าแล้ว

**ขอบเขตโค้ด:** 60 `page.tsx` = dashboard 35 + public 5 + print 5 + proto 7 + v2 4 + login/factory/floor/station 4 รวม redirect/หน้าลอง

| กลุ่มและทางเข้า | ตรวจ/แก้แล้ว | ยังต้องตรวจจริง |
|---|---|---|
| ส่วนกลาง shell/header/section/field/ปุ่ม/เมนู/ตาราง/สถานะ | แก้คำช่วย/ข้อมูลค้าง; เดิน desktop และบาง flow มือถือ | ทุกบทบาท/สถานะ และเมนูใหม่ |
| ภาพรวม `/`, `/home`, `/my-tasks`, `/notifications`, `/analytics` | เปิด dashboard/tasks/notifications/analytics | จัดลำดับงานและ task ที่ควรรอก่อน |
| ลูกค้า `/customers`, `/customers/[id]`; เพิ่ม/แก้/เครดิต/ผู้ติดต่อ | เปิดรายชื่อและรายละเอียด; คำช่วยที่อยู่ | ฟอร์มและสิทธิ์ |
| ออเดอร์ `/orders`, new, `[id]`, edit; ภาพรวม/สินค้า/ผลิต/ส่ง/เงิน/ไฟล์/ประวัติ | เปิดรายการ/รายละเอียด/เพิ่ม/แก้; หน้าลองภาพรวม A/B ใช้รูปเดียวกัน ตรวจแท็บ/ซูมรูป | เคาะโครงและเดินทุกแท็บ/บันทึกจริง |
| ใบเสนอ `/quotations`, new, `[id]` | เปิดครบ; Back เตือนงานไม่บันทึก/อยู่ต่อ/ทิ้ง draft; มือถืออ่านสินค้า/ราคาได้ เงื่อนไขไทย | บันทึก/ส่ง/สิทธิ์ |
| การเงิน `/billing`, notes, aging, tax, wht; ออกใบ/รับ/คืน/ยกเลิก | เปิดครบ 5 หน้า; คำช่วย/โหลด/ลิงก์ | ธุรกรรมบนฐานทดลองและสิทธิ์ |
| ผลิต `/production`, `[id]`, floor, `/station`, `/factory`; รับ/เบิก/ร้านนอก/QC | เปิดคิว/ใบผลิต/floor/factory และ QC dialog; หน้าลองค้น/กรอง/เรียง/กลับคิว/ยอด/เช็คลิสต์/งานคู่/ติดปัญหา | ช่าง/สถานีและ flow บันทึกครบ |
| สินค้า `/products`, `/products/[id]` และตัวเลือกสินค้า | เปิดรายการ/รายละเอียด; แก้เลข 0 เกิน | ตัวกรอง สต๊อก และรูปแบบใหม่ |
| `/settings` + company/users/stock/cost-rates/vendors/services/patterns/packaging/routings/backup/audit | เปิดครบทุกหน้า; ชื่อบริการร้านนอกไทย | ทุกฟอร์ม/สิทธิ์; รหัส stock/audit ยังมี |
| status/upload/quote/job/approve-design token | ลองลิงก์ผิด 5 หน้า; retry คืนผลจริง | token ใช้ได้/หมดอายุ/เครือข่าย อนุมัติ/อัปโหลด |
| `/print/quotation`, invoice, billing-note, job-ticket, packing-list | เปิด HTML ครบ 5 แบบบน demo | พิมพ์/PDF จริง; ใบเสนอ print ยัง NET30 และยอดสินค้า/ยอดก่อนภาษีต่างกัน ต้องตรวจค่าบริการ |
| `/login`; `/v2`, orders/new/`[id]` | login ผ่านบัญชีเจ้าของ; ตรวจทางเข้า v2 ในโค้ด | บทบาทอื่นและความเข้ากันได้เดิม |
| `/proto`; production-flow, work-order-states/form + view, ui-reset | A16 เทียบ 3 หน้า × ของเดิม/A/B × desktop/mobile; สว่าง/มืดและกรณีติดขัด | เคาะแต่ละหน้า; หน้าลองเดิมยังไม่ครบ |

**หลักฐาน 2026-09-11:** typecheck ผ่าน; lint 0 errors/22 warnings; 183 files/1,840 tests; `verify:ui` ผ่าน (ใบผลิต 35 ข้อ) หน้าลอง 18 ภาพไม่มีจอล้น/รูปเสีย/หน้าว่าง; ทดลองกดผ่าน CUA ใน IAB ที่ login แล้ว คำสั่งจำลองไม่เขียน DB; ภาพ/รายงาน local `.tmp-test/ui-reset/{sheet.png,report.json,audit.json}` ใช้ CUA แทน browser แยกของ proto-shots ซึ่งไม่มี login. ผู้ตรวจอิสระตรวจโค้ด/44 tests; browser โดย root. แก้เวลาจำลองและปุ่มธีมที่ทำ hydration ไม่ตรงแล้ว ไม่พบ error ใหม่หลังแก้สุดท้าย. ด่านภาพรวมออเดอร์เปลี่ยนจาก regex โค้ดเป็น render ตรวจเนื้อหา/สิทธิ์ทุกแบบ. iframe ผ่อน SAMEORIGIN เฉพาะ dev `/proto`; หน้าลองนี้ยังไม่รองรับ iframe บน Production

- [ ] เคาะคิวผลิต/ออเดอร์/ใบผลิตจาก `/proto/ui-reset` แล้วต่อโครงที่เลือก; รื้อ shell/เมนู/รายการ/ฟอร์ม/dialog ส่วนที่เหลือ ตรวจ keyboard/focus/loading/refetch/empty/error/no-permission/ทัช
- [ ] เดิน flow บันทึกบน demo ครบหลายบทบาท รวมเงิน/ฟอร์มลูกค้า/settings; รอบนี้ตรวจอ่านและ draft ไม่มีธุรกรรม
- [ ] คืน DTF รอบพิมพ์/คลังฟิล์ม และร้านนอก ส่ง → รับ → QC ตามบริการเดิม รับกลับบันทึกหลักฐานเท่านั้น ไม่ปิดขั้น/เปลี่ยนสถานะ
- [ ] แยกขั้นที่เปิดดูกับขั้นที่ลงมือบนหน้าจริง; ตรวจ My Tasks ที่รวมงานต่างชนิดด้วย order key เดียวก่อนเปลี่ยนคิว
- [ ] ลอง public ทุกสถานะ/พิมพ์จริง 5 แบบ; ตรวจยอด/เงื่อนไข print และหน้าแสดงสินค้าเทียบหน้าแก้

A16 ไม่รวม schema/เงิน/status/permission/API ใหม่ ไม่ทดสอบเขียนฐานจริง การปล่อย Production ต้องอนุมัติ

## คิว

### หนี้ผลิตที่ยังจริงจาก A2–A15

- [ ] **A15:** DB harness ของ `correctCustomerGarmentReceipt`: ส่วนต่างขึ้น/ลง เปิดขั้นกลับ กดซ้ำ มีเพียง router test และลองลด S 15 → 12 บน demo แล้ว
- [ ] **A12:** production-flow โครงเดิมยังจำลอง รอเคาะรายละเอียดก่อนต่อ Manufacturing จริง A/B ถูกปฏิเสธแล้ว การปล่อยหน้าลองไม่ใช่เปิดระบบผลิตใหม่
- [ ] **A9:** ฟอร์มยังขับ V2 ไม่ได้ (`lockProductionStepScope`) รอ cutover; server `sendToQc` ยังปิดขั้นกระดาษข้ามได้แม้ UI รอครบ การปิดทางลัดต้องมีใบงานบริการ/test A5
- [ ] **A9:** ข้อกำหนดนิ่งใน `work-order-standards.ts` รอผูก routing; `work-order-route.tsx` ไม่ใช้ พิจารณาก่อนลบ ร้านนอก/QC/รอบพิมพ์/ใบตรวจรับใช้หลักฐาน flow แทน checkbox ต้องคงไว้
- [ ] **A2/A4:** ต่อ QC/final-pack ทางกลับ floor → My Tasks/แจ้งเตือน ซ้อมหัวหน้า/ช่าง; PIN เครื่องร่วมตกลงสิทธิ์ก่อนทำ สถานีจาก settings/V2 `controlList/workOrder` รอ cutover
- [ ] **A5:** ครั้งพิมพ์/รุ่นกระดาษ (อนุมัติ schema ก่อน), QR ไป QC, `verify:print` บน demo; เวลาที่อนุมานจากปิดงานกระดาษเดิมไม่ใช่เวลาทำจริง
- [ ] **A7/F:** ตรวจหน้าแสดง/แก้สินค้าให้ตรงกันและชื่อ accessory enum; พิจารณา orphan `OrderInfoEditDialog`/`OrderItemsEditor` และ lint เมื่อแตะไฟล์
- [ ] **F:** แจ้งรับเงินใบที่อยู่ในใบวางบิล; quotation Card/form row → Section/Field คง conversion; ทบทวน dashboard width
- [ ] **F → A16:** ตรวจ factory alpha/hairline/แสงสะท้อนทัช, แถบยังไม่อ่าน/SegmentedControl, ลำดับชั้นธีมมืดตามจอจริง

A9/A15 ทำการบันทึกเช็คลิสต์/ย้อนขั้น/ช่องคู่/แก้ยอดแล้ว หนี้เดิมที่โค้ดปิดแล้วตัดจากคิว ไม่เปิดซ้ำ

### B. Cutover Production V2 — อนุมัติเป็นขั้น

สถานะเดิม: Production legacy (`PRODUCTION_V2_ENABLED=0`), ยังไม่ seed routing/work center จริง **ตรวจสดก่อน rollout** demo เริ่ม legacy; ซ้อม V2 `DEMO_PRODUCTION_V2=1` ตาม `docs/local-demo-data.md` โค้ด/migration/seed/settings มีแล้ว แต่ยังไม่ยืนยันเปิดจริง

- [ ] B1 ซ้อมหัวหน้า/ช่างบน demo: สูตร → สถานี → ร้านนอก → QC fail/rework → แพ็กแยกไซซ์ ตรวจ/ต่อ UI ที่ขาด
- [ ] B2 แก้ผลซ้อมเป็นใบงานย่อย; ตรวจ mapping CUSTOM/งานขนานเมื่อจำเป็น ไม่คืนผังเก่าที่ถูกปฏิเสธ
- [ ] B3 target/backup ก่อนเขียนจริง; additive seed → flag → ตรวจ → ลบ legacy UI/writer ตาม rollout window เบสอนุมัติแต่ละขั้น (`SPEC.md` §Production V2)
- [ ] B4 หลัง cutover: QC rework target work center; DTF partial/waste/reprint event; owner/plan/SLA/audit actor read model; supervisor material recovery; WIP ownership ของ QC/final pack

### C. MFG — ตัวชี้วัดผลิต อ่านอย่างเดียว ไม่มีเงิน/ไม่เพิ่ม schema

- [ ] MFG1 เลือกงวดเดือนไทย: ส่งตรงเวลา = ออเดอร์ที่ `shippedAt` ในงวดเทียบ `deadline` (ไม่มี deadline ไม่นับ); ทำถูกครั้งแรก = `ΣqtyGood / (ΣqtyGood + ΣqtyDefect)`
- [ ] MFG2 ของเสียตาม `QcDefect.reason` แยกไซซ์/สี/ลาย เปิดรูปหน้างานได้ ใช้ป้ายจาก `src/lib/qc.ts`
- [ ] MFG3 แยกสูตรบริสุทธิ์จาก router; test งวดว่าง/ไม่มี deadline/หารศูนย์/ยังไม่ส่ง/ยกเลิก; ตรวจ 1440/390 ทั้งสองธีม และเพิ่มเกณฑ์ใน SPEC

### D. ก่อนใช้จริง

- [ ] B6 นักบัญชีตรวจใบกำกับ/CN/DN และเลขรันจากเอกสารพิมพ์จริง
- [ ] B16 เดินงานจริงกับทีมและนักบัญชีดูเอกสารเงิน 1 รอบ
- [ ] ตรวจ Supabase/Vercel console ตาม `docs/deploy-checklist.md` รวมสิ่งที่ SPEC ระบุว่ายังไม่ยืนยัน; ตรวจ release/deployment แยกจากผลโค้ด

## พักไว้

### E. หลังมีข้อมูลใช้งานจริงประมาณ 1 เดือน

- C1 ราคาตามจำนวน × เทคนิค × ตำแหน่ง และราคาต่อลูกค้า เป็น service เรียกซ้ำได้สำหรับ P4
- C2 กวาดงานค้างตามอายุ: ใบเสนอ SENT/แบบรอลูกค้า/INQUIRY/ร้านนอกเกินกำหนด → กระดิ่ง ใช้ cron เดิม
- C5 ตรวจ UX หน้างานที่ยังเหลือหลัง V2; C6 LINE OA notify ระหว่างนี้ใช้ข้อความก๊อปส่ง

### P2–P4

- **P2 หลัง V2:** ต่อ quantity line/event เดิมเพื่อติดตามชิ้น ของเสีย/พิมพ์ซ้ำ; จองสต๊อกลึกขึ้นกับ Anajak Stock; ตรวจใบแพ็ก/การแบ่งส่งจาก DeliveryLine ที่มีแล้ว AP ร้านนอก + WHT ขาจ่าย 3%/50ทวิ/ภงด.53 ต้องทบทวนขอบเขตก่อนเริ่ม ไม่ใช่ job costing
- **P3 ลูกค้า:** portal สถานะ/ประวัติ/เอกสาร/อนุมัติ/สั่งซ้ำ; LINE แจ้ง/ทวง/รูป WIP; CRM follow-up/RFM; โควตาแก้แบบ/ค่าเกิน/ล็อกหลังอนุมัติ; ตัวอย่างจริงแบบ opt-in; ตรวจ DPI/พื้นโปร่ง; analytics ลึก
- **P4 เว็บ/ระบบอื่น:** intake API ของ `anajak-print-web` ทั้งเสื้อธรรมดาและ custom ใช้ order/garment source/design version/approval token/payment terms เดียวกับหน้าร้าน ราคาจาก C1 ไฟล์เข้า pipeline เดิม ไม่เพิ่มสถานะหรือ flow แยก MCP/API ใช้สิทธิ์เดียวกัน; ขยาย MCP/ฟอร์มเก็บไซซ์องค์กร/e-Tax/PEAK/courier ตามปริมาณงาน

### ขอบเขตที่ต้องคง

คงกฎ SPEC/AGENTS: Decimal, DocumentSequence, transaction/lock, สถานะผ่าน server, ใบกำกับทุกงวดรวมมัดจำยกเลิก/ออกใหม่ไม่ลบ; Station/TV ไม่มีเงิน; ไม่ปิด tests/verify; schema additive; ฐาน shared/remote ต้อง target/backup/อนุมัติ

ทำก้อนเล็กตามใบงาน/pattern เดิม/test จริง เปิดด่านทีละด่าน คน/CSV ก่อน API; ทบทวนคิวรายไตรมาส (1–2 โมดูลเล็ก/เดือน) A16 ยกเลิกข้อห้าม refactor UI เดิม คงสัญญาข้อมูล/เคาะทิศก่อนรื้อ

**จงใจไม่ทำ:** GL/งบการเงิน; job costing/เงินในผลิตและร้านนอก; DTF auto-nesting (ใช้โปรแกรม RIP); in-app chat; online designer เต็ม; ใบกำกับอย่างย่อ; time-clock/payroll; WMS/PR-PO-GRN; mockup generator; CMMS เต็ม; anomaly detection; capacity planning เต็ม (ใช้ปฏิทินภาระงานเบา); Block reuse/BOM เต็ม ไม่มีงานทำบล็อกในบ้าน ใช้ Anajak Stock/ระบบ HR/นักบัญชีตามขอบเขตเดิม
