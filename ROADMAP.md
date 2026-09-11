# Anajak ERP — งานปัจจุบันและคิว

งานเปิดเท่านั้น; งานปิด/แบบที่ปฏิเสธดู `git log -- ROADMAP.md` สถานะล่าสุด: `PROGRESS.md`; เกณฑ์/ข้อมูล: `SPEC.md`; วิธีทำงาน: `AGENTS.md`; โครงระบบ: `docs/ARCHITECTURE.md`; สัญญาจอ: `docs/DESIGN.md`

## ตอนนี้ทำ

### A16. ตรวจและรื้อ UI ด้วย ui-guidance ใหม่ (เบสสั่ง 2026-09-11)

**อนุมัติ:** ตรวจทุกหน้า/ส่วนย่อย แก้กฎและส่วนกลาง ปรับตามงานจริงบน `codex/ui-reset-20260911` ใช้ `global-skills/ui-guidance/SKILL.md` ใน `bestos-brain` คงคำช่วย/เหตุผลล็อก/ผลคำสั่งตรงจุดใช้ แต่ละรายการมี action ได้ ไม่บังคับคำโปรยหรือรูปแบบเดียว

**รอบแรก:** กฎตรงกัน ตัวตรวจหน้าตาเชิงคาดเดาเป็นคำแนะนำ; แก้ส่วนกลาง/คำช่วย/สถานะ/ทางไปต่อ/เลือกใบร้านนอก **ยังไม่รื้อหน้าตาครบ และยังไม่มีหน้าลอง A16 ให้เลือก** หน้าลองเดิมก็ต้อง login จึงยังตรวจผ่าน browser ไม่ได้

**ขอบเขตโค้ด:** 59 `page.tsx` = dashboard 35 + public 5 + print 5 + proto 6 + v2 4 + login/factory/floor/station 4 รวม redirect/หน้าลอง

| กลุ่มและทางเข้า | ตรวจ/แก้แล้ว | ยังต้องตรวจจริง |
|---|---|---|
| ส่วนกลาง shell/header/section/field/ปุ่ม/เมนู/ตาราง/สถานะ | อ่านโค้ด แก้คำช่วย/ข้อมูลค้าง | หลัง login ทุกจอ/สถานะ |
| ภาพรวม `/`, `/home`, `/my-tasks`, `/notifications`, `/analytics` | ตรวจเส้นทางและแท็บปลายทาง | งานจริงและการจัดลำดับงาน |
| ลูกค้า `/customers`, `/customers/[id]`; เพิ่ม/แก้/เครดิต/ผู้ติดต่อ | สถิติโหลด/คำช่วยที่อยู่ | ฟอร์มและสิทธิ์ |
| ออเดอร์ `/orders`, `/orders/new`, `/orders/[id]`, `/orders/[id]/edit`; ภาพรวม/สินค้า/ผลิต/ส่ง/เงิน/ไฟล์/ประวัติ | เหตุผลล็อก/ทางแก้ | กรอกจริง งานติด และทุกแท็บ |
| ใบเสนอ `/quotations`, `/quotations/new`, `/quotations/[id]` | กันข้อมูลไม่บันทึกหาย | Back/ยกเลิก/บันทึก |
| การเงิน `/billing`, `/billing/notes`, `/billing/aging`, `/billing/tax`, `/billing/wht`; ออกใบ/รับ/คืน/ยกเลิก | คำช่วย/โหลด/ลิงก์ | ธุรกรรมบนฐานทดลองและสิทธิ์ |
| ผลิต `/production`, `/production/[id]`, `/production/floor`, `/station`, `/factory`; รับ/เบิก/ร้านนอก/QC | สถานะ/หลักฐาน/เช็คลิสต์/error/ลิงก์ | งานหัวหน้า/ช่างและจอทัช |
| สินค้า `/products`, `/products/[id]` และตัวเลือกสินค้า | ตรวจโครงสร้าง | ตัวกรอง สต๊อก และรูปแบบใหม่ |
| `/settings` + company/users/stock/cost-rates/vendors/services/patterns/packaging/routings/backup/audit | ข้อความตัด/ราคาศูนย์/มือจับลากเสีย | ทุกฟอร์ม/สิทธิ์ |
| `/status/[token]`, `/upload/[token]`, `/quote/[token]`, `/job/[token]`, `/approve/design/[token]` | error และลองลิงก์ผิดจริง | token ใช้ได้/หมดอายุ/เครือข่าย อนุมัติ/อัปโหลด |
| `/print/quotation/[id]`, invoice, billing-note, job-ticket, packing-list | สัญญา/ทางเข้า ไม่แก้ส่วนพิมพ์ | พิมพ์จริงทั้ง 5 แบบ |
| `/login`; `/v2`, `/v2/orders`, `/v2/orders/new`, `/v2/orders/[id]` | เปิด login จริง; ตรวจทางเข้า v2 | ความเข้ากันได้เดิม |
| `/proto`; production-flow, work-order-states + view, work-order-form + view | ตรวจทะเบียน/ขอบเขต | A16 ยังไม่สร้าง/ส่งให้เลือก |

**หลักฐาน 2026-09-11:** typecheck ผ่าน; lint 0 errors/22 warnings; 178 files/1,796 tests; `verify:ui` ผ่าน (ใบผลิต 35 ข้อ) Browser: login/public error 5 หน้า; status retry คืนผลจริง; status/approve 390px ไม่ล้น หลังบ้าน Chrome/IAB ยังติด login จึงยังไม่ยืนยันฟอร์ม/รับร้านนอก/เงิน/พิมพ์ ดูล่าสุดใน PROGRESS

- [ ] Login ฐานทดลองแล้วเดิน desktop/mobile: รับงาน → ออเดอร์ → ผลิต/ใบผลิต/floor → QC/แพ็ก → เงิน → ตั้งค่า/รายงาน เก็บจุดติดก่อนเทียบหน้าตา
- [ ] รื้อเมนู/รายการ/รายละเอียด/ฟอร์ม/dialog; ทำหน้าลองทางเลือกด้วย component จริงหลัง login ก่อนเคาะ ตรวจธีม/keyboard/focus/loading/refetch/empty/error/no-permission/ทัช
- [ ] คืน DTF รอบพิมพ์/คลังฟิล์ม และร้านนอก ส่ง → รับ → QC ตามบริการเดิม รอบนี้บันทึกหลักฐานรับกลับเท่านั้น ไม่ปิดขั้น/เปลี่ยนสถานะ ตรวจจำนวน/สถานะ/สิทธิ์ก่อนต่อ flow
- [ ] แยกขั้นที่เปิดดูกับขั้นที่ลงมือ; ตรวจ My Tasks ที่รวมงานต่างชนิดด้วย order key เดียวก่อนเปลี่ยนคิว
- [ ] ลอง public ทุกสถานะ/พิมพ์ 5 แบบบน demo; ตรวจคำช่วยเงิน/ใบเสนอ/settings และสินค้าเทียบหน้าแก้ไข
- [ ] ทบทวน `verify-ui-tokens` ที่ผูกข้อความโค้ดเมื่อเปลี่ยนสัญญาจอ พร้อมหลักฐานแทน ห้ามลดด่านข้อมูล/สิทธิ์/การเข้าถึง

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
