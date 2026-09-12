# Anajak ERP — งานและสถานะ

ข้อกำหนดอยู่ [SPEC.md](SPEC.md), วิธีใช้ [README.md](README.md), กติกา [AGENTS.md](AGENTS.md), ทิศทางหน้าจอ [DESIGN.md](DESIGN.md). งานที่จบและแบบที่ไม่เลือกดู Git; ไฟล์นี้เก็บเฉพาะงานที่ยังทำต่อ

## ตอนนี้ทำ

- รอตรวจรับ branch `codex/ui-refactor-20260912` เทียบฐาน `codex/erp-repo-refresh-20260912`; งานปรับ UI ตาม A16 และ 4 กลุ่มที่เบสสั่ง “ทำหมดเลย” วันที่ 13 ก.ย. 2569 ทำและตรวจครบขอบเขตรอบนี้แล้ว
- ทำถึงไหน: ใช้ ui-guidance ปัจจุบัน ปลดกฎตรึงหน้าตาและปรับหน้าจริงทั้งส่วนกลาง/ออเดอร์/ลูกค้า/ใบเสนอ/การเงิน/ผลิต/สินค้า/ตั้งค่า/ภาพรวม/public/print. เพิ่มรอบพิมพ์ DTF คลังฟิล์ม และงานร้านนอกบน flow เดิม; คงตัวอักษร Prompt และสีน้ำเงิน Anajak. รายละเอียดกฎถาวรอยู่ SPEC; ไม่เพิ่มหน้าลองใหม่
- ตรวจแล้ว: `typecheck`, `lint` 0 errors/22 warnings เดิม, `npm test` 201 files/1,966 tests และ `verify:ui` 255 + work-order 32 ผ่าน. อ่าน diff และทวนสิทธิ์/เงิน/สถานะโดยผู้ตรวจแยกจากผู้ทำแล้ว; ยังไม่ใช่ผล CI หรือ deployment จนตรวจหลัง push
- ขอบเขตที่ยังไม่ยืนยัน: Production/main/การปล่อยเว็บ, การเปิด Manufacturing V2, เชื่อม Stock จริง และ Auth/Storage policies/cron ของระบบจริง. โหมด Stock ในรอบนี้เป็น demo; notifications ของบัญชี QA ว่าง จึงทดสอบตัวกรอง/URL แต่ไม่ได้กดอ่านรายการของบัญชีนั้น. การจัดการเครือข่ายขาดช่วงของ public ตรวจด้วย regression ส่วน token ใช้ได้/หมดอายุตรวจบน browser
- ทำต่อ: ทบทวน PR ของ UI แล้วรวม/ปล่อยตามคำสั่งเบส โดยจัดการ branch ฐานก่อน. ก่อนขึ้น main ต้อง build และตรวจ release จริงตาม README; ไม่ใช้ผล local แทนผล Production

### หลักฐานรับงานรอบนี้

| ส่วน | ผลที่ยืนยัน |
|---|---|
| หน้าทำงานและฟอร์ม | CUA บน demo 1440/390 ทั้ง Light/Dark และใบผลิต 1024; ค้นไม่พบ/ล้างกรอง, รายละเอียดเริ่มบนสุดและ Back คืนตำแหน่ง, 7 แท็บออเดอร์, draft/ออกหน้า/Escape/focus, ลูกค้าบันทึกการคุยผ่าน SALES. ตั้งค่า 11 หน้าและภาพรวม/สถิติ/My Tasks/แจ้งเตือนโหลดข้อมูลจริง; ตารางมือถือบอกทางเลื่อนและชื่อประเภทบริการอ่านไทย |
| เงิน ข้อมูล และสิทธิ์ | ราคา/ค่าบริการ/ส่วนลด/VAT/เศษสตางค์ preview→สร้าง→แก้ และ customer/settings/product permission ผ่าน DB harness แบบ rollback. Browser รับ 100 จากบิลสมมติ 1,284 เหลือ 1,184 แล้วออกใบเสร็จ 100 โดยยอดไม่ซ้ำ; วันไทย/PAID/paidAt ตรงงวดจริง. ตัดต้นทุนและ bearer token จาก response ที่ไม่มีสิทธิ์; ไม่แก้ tokens ที่เก็บหรือข้อมูล Production |
| ผลิตเดิม | Browser สร้างรอบ DTF→พิมพ์→ตัด/เก็บเผื่อ→ใช้ฟิล์ม; ร้านนอกส่ง→รับ 8 เสีย 1 จึงดี 7/10 และยังผ่าน QC ไม่ได้→รับอีก 3→ผ่าน 10; กดซ้ำไม่เพิ่มยอด. Floor รีดร้อนเริ่ม→เช็คลิสต์ 3/3→จบ 10. คิว/TV ไม่มีเงิน; STAFF เข้า production ถูกพาไป floor. Integration ผลิต 22 checks ผ่าน |
| ลูกค้าและกระดาษ | Public 5 แบบเปิดข้อมูลจริงบนมือถือ, อนุมัติแบบ/ปฏิเสธใบเสนอและหมดอายุ; integration quote 24/status 17/outsource 26/upload 17 ผ่าน โดย upload ใช้ไฟล์สมมติและลบไฟล์หลังตรวจ. Chrome ส่ง PDF จริงครบ quotation/invoice/billing-note/job-ticket/packing-list; ใบกำกับมีต้นฉบับ+สำเนา 2 หน้า ส่วนอีก 4 แบบอย่างละ 1 หน้า อ่านยอด/รูป/ไซซ์/QR/ท้ายใบจากไฟล์จริง |

ฐานทดลอง `127.0.0.1:5433/anajak_erp_demo` สำรองก่อนซ้อม. ซ่อมเฉพาะค่าบริการที่หายจากใบเสนอ demo 2 ใบให้รายการตรงยอด stored โดยยอดรวมเดิมไม่เปลี่ยน. Fixture ของ browser/Storage ถูกล้างตาม ID และบทบาทบัญชีคืน OWNER/override เดิม; หลังล้างมีออเดอร์ demo เดิม 27 ใบ. PDF/backup/log อยู่ `.tmp-test/ui-complete-20260913/` ในเครื่องและไม่เข้า Git. ใช้ `scripts/run-local-demo.ts check` สำหรับด่านที่ต่อ DB เพื่อบังคับ target demo; ไม่รัน reset/แก้ schema/เปิด V2 ในรอบนี้

## คิว

- [ ] **A15:** DB harness ของ `correctCustomerGarmentReceipt`: ส่วนต่างขึ้น/ลง เปิดขั้นกลับ กดซ้ำ; ปัจจุบันมี router test และผลลองลด S 15 → 12 บน demo
- [ ] **A12:** production-flow โครงเดิมยังจำลอง รอเคาะรายละเอียดก่อนต่อ Manufacturing จริง; A/B เดิมถูกปฏิเสธ การปล่อยหน้าลองไม่ใช่เปิดระบบผลิตใหม่
- [ ] **A9/A5:** ฟอร์มยังขับ V2 ไม่ได้ (`lockProductionStepScope`); `sendToQc` ยังปิดขั้นกระดาษข้ามได้ ต้องมีใบงานบริการ/test. ผูกข้อกำหนดนิ่งใน `work-order-standards.ts` กับ routing; ตรวจผู้ใช้ `work-order-route.tsx` ก่อนพิจารณาลบ คงหลักฐานร้านนอก/QC/รอบพิมพ์/ใบตรวจรับแทน checkbox
- [ ] **A2/A4:** ต่อ QC/final-pack และทางกลับ floor → My Tasks/แจ้งเตือน ซ้อมหัวหน้า/ช่าง; PIN เครื่องร่วมต้องตกลงสิทธิ์ก่อนทำ สถานี settings/V2 `controlList/workOrder` รอ cutover
- [ ] **A5:** ครั้งพิมพ์/รุ่นกระดาษต้องอนุมัติ schema ก่อน, QR ไป QC, ตรวจงานพิมพ์จาก `scripts/verify-print.tsx` บน demo; เวลาที่อนุมานจากปิดงานกระดาษเดิมไม่ใช่เวลาทำจริง
- [ ] **A7/F:** หน้าแสดง/แก้สินค้าและชื่อ accessory enum ให้ตรงกัน; ตรวจ orphan `OrderInfoEditDialog`/`OrderItemsEditor` และ lint เมื่อแตะไฟล์
- [ ] **F:** แจ้งรับเงินใบที่อยู่ในใบวางบิล
- [ ] **หน้างานจริง:** ตรวจแสงสะท้อนและการแตะบนอุปกรณ์ factory ของทีม; ผลตรวจ desktop/mobile ใน A16 ยังไม่แทนสภาพแสงโรงงาน
- [ ] **B1:** ก่อนซ้อม V2 ตรวจข้อขัดกันใน seed: `seed-demo-form-states.ts` สร้างใบไม่มีเลข MO แต่ `seed-demo.ts` ตรวจ V2 ทุกใบ (พบจากโค้ด 2026-09-12 ยังไม่รัน reset). จากนั้นซ้อมสูตร → สถานี → ร้านนอก → QC fail/rework → แพ็กแยกไซซ์บน demo ตาม README; ผลเดิมใช้ legacy/flag 0 ต้องตรวจค่าจริงก่อนเริ่ม
- [ ] **B2:** แก้ผลซ้อม V2 เป็นงานย่อย; ตรวจ mapping CUSTOM/งานขนานเมื่อจำเป็น ไม่คืนผังเก่าที่ถูกปฏิเสธ
- [ ] **B3:** ขออนุมัติ rollout ทีละขั้นตาม SPEC: target/backup → additive seed → flag → ตรวจ → ลบ legacy UI/writer ตาม rollout window. มีโค้ด/migration/seed/settings ไม่เท่ากับเปิดใช้จริง
- [ ] **B4:** หลัง cutover ต่อ QC rework target work center; DTF partial/waste/reprint event; owner/plan/SLA/audit actor read model; supervisor material recovery; WIP ownership ของ QC/final pack
- [ ] **MFG1–3:** ตัวชี้วัดผลิตแบบอ่านอย่างเดียว ไม่มีเงิน/ไม่เพิ่ม schema: งวดเดือนไทย ส่งตรงเวลา (`shippedAt` เทียบ `deadline`, ไม่มี deadline ไม่นับ), ทำถูกครั้งแรก `ΣqtyGood / (ΣqtyGood + ΣqtyDefect)`, ของเสียตาม `QcDefect.reason`/ไซซ์/สี/ลายและรูป. แยกสูตรจาก router; ทดสอบงวดว่าง/หารศูนย์/ยังไม่ส่ง/ยกเลิก/ไม่มี deadline, ตรวจ 1440/390 สองธีม แล้วเพิ่มเกณฑ์ใน SPEC
- [ ] **B6/B16:** นักบัญชีตรวจใบกำกับ/CN/DN และเลขรันจากเอกสารพิมพ์จริง; เดินงานกับทีมและนักบัญชีหนึ่งรอบก่อนเปลี่ยน flow การเงิน
- [ ] **สภาพแวดล้อมก่อนใช้จริง:** ยืนยัน public signup ปิด/Storage policies, Vercel rate limit/Bot Protection, env และผล cron สอง route, สำรองไฟล์/Auth พร้อมซ้อมกู้คืน ตาม README. เก็บผลตรวจ target/commit/เวลา แยกจาก CI/deployment; ยังไม่มีหลักฐานครบในรอบนี้

## พักไว้

### หลังมีข้อมูลใช้งานจริงประมาณหนึ่งเดือน

- C1 ราคาตามจำนวน × เทคนิค × ตำแหน่ง และราคาต่อลูกค้า เป็น service ใช้ต่อ P4 — รอข้อมูลราคา/งานจริงตามแผนเดิม
- C2 กวาดใบเสนอ SENT/แบบรอลูกค้า/INQUIRY/ร้านนอกเกินกำหนด → กระดิ่งผ่าน cron เดิม — รอเห็นอายุงานจริง
- C5 เก็บ UX หน้างานหลัง V2; C6 LINE OA notify — ระหว่างนี้ใช้ข้อความก๊อปส่ง

### P2–P4

- **P2 หลัง V2:** quantity line/event เพื่อติดตามชิ้น ของเสีย/พิมพ์ซ้ำ; จองสต๊อกลึกขึ้นกับ Anajak Stock และให้ Stock เลือก location เมื่อ ERP ไม่ระบุแทนค่าคงที่ใน `src/lib/stock-constants.ts`; ใบแพ็ก/แบ่งส่งจาก DeliveryLine. AP ร้านนอก + WHT ขาจ่าย 3%/50ทวิ/ภงด.53 ต้องทบทวนขอบเขตก่อนเริ่ม ไม่ใช่ job costing
- **P3 ลูกค้า:** portal สถานะ/ประวัติ/เอกสาร/อนุมัติ/สั่งซ้ำ; LINE แจ้ง/ทวง/รูป WIP; CRM follow-up/RFM; โควตาแก้แบบ/ค่าเกิน/ล็อกหลังอนุมัติ; ตัวอย่างจริง opt-in; ตรวจ DPI/พื้นโปร่ง; analytics ลึก — รอข้อมูลใช้จริงและคิวหลัง V2
- **P4 เว็บ/ระบบอื่น:** intake ของ `anajak-print-web` ใช้ order/design/payment pipeline เดียวกับหน้าร้านตาม SPEC; ราคาจาก C1, ขยาย MCP/ฟอร์มเก็บไซซ์องค์กร/e-Tax/PEAK/courier ตามปริมาณงาน — ยังไม่เริ่มเชื่อมเพิ่มในรอบนี้

ขอบเขตที่จงใจไม่ทำและกฎข้อมูลถาวรอยู่ SPEC; วิธีลงมือและข้อห้ามอยู่ AGENTS ไม่สร้างข้อกำหนดอีกชุดในแผน
