# PROGRESS — สถานะสด

## ตอนนี้ (2026-09-09 · A12 · หน้าลองรอเคาะ)
- เบสอนุมัติแผนสร้าง `/proto/production-flow`: ปัจจุบัน / A คุมกำหนดส่ง / B โต๊ะติดตามงาน พร้อมหน้ารายละเอียดและเครื่องจำลองกติกาจำนวนจริง
- ทำบน `codex/production-flow-proto` จาก main `9761802`; ยังไม่เปลี่ยนหน้าการผลิตที่ใช้งานจริง และไม่เปิด Production V2
- ทะเบียน proto สถานะ **รอเคาะ**; มี 15 ออเดอร์ / 16 ตัวเลือกสถานการณ์ ใช้วันจำลอง 9 ก.ย. 2026

## สิ่งที่ทำ
- A ตารางต่อเนื่องเน้นกำหนดส่ง เรื่องต้องจัดการ คน/ร้านที่ถือของ; B รายการซ้ายพร้อมรายละเอียดขวา มือถือเลือกแล้วเปิดใบพร้อมปุ่มกลับ
- รายละเอียดเลือกได้ทุกขั้น แสดงงานเริ่มคู่กันจาก dependency จริง; ปุ่มลงมือก่อนภาพ/ข้อมูลรอง พร้อมล็อต สินค้า สี ไซซ์ ตำแหน่ง และจำนวน
- เครื่องจำลอง pure commands/selectors ชุดเดียวสำหรับรายการ/รายละเอียด/A/B; เก็บใน localStorage เฉพาะ proto แยกผลตามสถานการณ์ มีเริ่มใหม่และ sync หลายแท็บ/iframe
- สูตร scoped ตามสินค้า/สี/ไซซ์/จุดพิมพ์/แบบ; เสื้อกองเดียวมีผู้ถือครองเดียว; รีดจับคู่ฟิล์มตรง scope/version/ทุกจุด ไม่ใช้ยอดรวมแทน
- คนทำบันทึกดี/แก้/เสียจริงโดยไม่เติมยอด; ส่งบางส่วนให้หัวหน้าตัดสินทุกครั้ง ยอดที่เหลืออยู่ที่เดิม; ส่งครบทุกกองที่พร้อมพร้อมกันได้
- รับร้านนอกหลายครั้ง รับคืนเป็นรอตรวจก่อน; งานแก้มีจุดเสีย/สาเหตุ ย้อนเฉพาะขั้นในสูตร และผ่านตรวจซ้ำ; ของเสียกับทดแทนมีหลักฐานแยก
- พร้อมส่งเมื่อแพ็กครบทุกสี/ไซซ์และทุกใบ; unknown ไม่แต่งจำนวน/สถานะ; permission, revision conflict, failure, double submit และ idempotency มีเส้นทางทดลอง
- ปัจจุบันใช้ Desk/WorkOrder components จริงกับ adapter ข้อมูลชุดเดียวแบบอ่านอย่างเดียว; แยกคำอธิบายข้อจำกัดของข้อมูลเก่า/ล็อต/หลายใบอย่างชัดเจน
- ภาพเสื้อตัวอย่างสร้างเพื่อ proto มี prompt/provenance กำกับ ไม่ใช่แบบอนุมัติของลูกค้า
- iframe compare อนุญาตเฉพาะ `/proto/production-flow` จาก same origin; หน้าอื่นคง X-Frame-Options DENY และ auth เดิม; noindex จาก layout proto

## เชื่อมระบบจริงหลังเคาะ
- ใช้ตัวตน Order → Production/workOrderNumber → ProductionStep; dependency จาก OperationJobDependency; ปริมาณจาก OperationQuantity และ source references
- ใช้ PrintRun/PrintRunItem, OperationEvent, ManufacturingCommand และ QcDefect/ReworkCase เดิม; mapping ระบุไว้หัว `_domain/types.ts`
- ส่วนที่ยังเป็นข้อเสนอ: กองเสื้อ/ผู้ถือครอง, partial transfer ราย scope, รับคืน/ตรวจแบบผสมหลายครั้ง และ conditional recipe expansion
- ตอนต่อจริงต้องผ่านบริการ Manufacturing เดิม พร้อม transaction/locks/revision/idempotency; ไม่เอา global revision/localStorage ของ proto ไปเป็นบริการผลิตชุดใหม่
- รอบนี้ไม่มี API/schema/migration/dependency/env ใหม่ ไม่แตะฐานข้อมูล และไม่เปลี่ยนกติกาเงินจริง

## ผลตรวจ
- `npm run typecheck` ผ่าน; `npm run lint` 0 errors / 23 warnings เดิม; ESLint เฉพาะ proto ผ่านสะอาด
- `npm test`: 172 files / **1,763 tests ผ่าน** รวม domain ใหม่ 28 tests
- `npm run verify:ui`: tokens/hierarchy ผ่าน, work-order 34 ผ่าน / 0 ตก; ไม่ลดหรือปิด gate
- `npm run build` ผ่าน; `git diff --check` ผ่าน
- Impeccable polish: ตรวจ flow จริง + desktop/mobile Light/Dark, แก้ความสูง harness/ลำดับ action/unknown/focus/scroll/semantic tokens; detector `[]` (0 findings)
- Browser baseline ล็อกอินถูกต้องที่ localhost:3005: `/production` 21 ออเดอร์ และ `/production/demo-production-form-tag-press` อ่านได้ก่อนเริ่ม QA
- Browser DTF จากรับเสื้อ 30/ทำฟิล์ม 30 → รีด → QC → แพ็กครบ 30 จึงพร้อมส่ง; partial 40/100 → QC → แพ็ก 40 โดยยังเหลือ 60 ที่รีด; A/B และ reload เห็นยอดเดียวกัน
- Browser ร้านนอก: รับ 60/100 → ผ่าน 57/แก้ 3 คงร้าน 40; worker ส่งบางส่วนไม่ได้; failure/stale ไม่เปลี่ยนยอดและคงฟอร์ม; retry + ส่งคำสั่งเดิมซ้ำไม่เพิ่มยอด
- Browser A/B คอม 1440 และมือถือ 390 ทั้ง Light/Dark, compare iframe โหลดได้, ค้นหาไม่พบ/ล้างกลับ/กรองยังไม่มอบหมายได้; fresh tab console ไม่มี error
- Independent domain review: ไล่ทุกออเดอร์ที่มีหลักฐานจนแพ็กครบ, ตรวจฟิล์ม shared pool/ตำแหน่ง/variant, vendor custody, rework/reinspection/replacements และหลายใบ; unknown คงกั้นการบันทึก

## NEXT
1. เบสลอง A/B ที่ `/proto/production-flow` แล้วเคาะทิศ; ใช้ปุ่มเริ่มใหม่เมื่อต้องการกลับสถานการณ์ต้นทาง
2. หลังเคาะ ค่อยแปลงข้อเสนอล็อต/ส่งต่อ/รับกลับเป็นบริการและ migration ของ V2 เดิม พร้อมแผนย้ายข้อมูลเก่า; ยังไม่เริ่มใน A12
3. Feature A2–A8/B/C/F ตาม ROADMAP เดิมยังเปิด ไม่ถูกนับว่าเสร็จจาก proto รอบนี้

## สภาพแวดล้อมและส่งมอบ
- dev เดิม `npm run dev:demo` ที่ port3000 ต่อฐาน local demo; Chrome port3000 มี Fitness Service Worker ค้าง จึงใช้ HTTP/WebSocket proxy ชั่วคราว localhost:3005 → 3000
- ไม่ล้าง cookies/cache/Service Worker และไม่ bypass auth; localhost:3005 ต้องมี dev+proxy ทำงานสำหรับดูในเครื่อง
- ผลตรวจทั้งหมดเป็น local prototype; feature branch push แยกจาก main/CI/deployment และไม่มีการปล่อยขึ้น Production ในรอบนี้
