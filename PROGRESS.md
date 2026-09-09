# PROGRESS — สถานะสด

## ตอนนี้ (2026-09-09 · A12 · กลับโครงเดิม)
- เบสแจ้ง “ใช้ยากกว่าเดิมอีก ขอเอาโครงแบบเดิม” → ยุติทิศ A/B แล้วคืนโครงหน้ารวมและใบผลิตแบบเดิมใน `/proto/production-flow`
- ทำบน `codex/production-flow-proto`; ยังไม่เปลี่ยนหน้าการผลิตที่ใช้งานจริง และไม่เปิด Production V2
- ทะเบียน proto **รอเคาะรายละเอียดโครงเดิม**; คง 15 ออเดอร์ / 16 ตัวเลือกสถานการณ์และวันจำลอง 9 ก.ย. 2026

## สิ่งที่เปลี่ยนตามเบส
- หน้ารวมใช้ DeskTiles/DeskToolbar/DeskTable เดิมกับสถานะและจำนวนจากเครื่องจำลองชุดเดียว
- ใบผลิตกลับเป็นหัวใบพร้อมปุ่มหลัก → รางขั้นแบบเลข/เส้นบาง → แท็บขั้นตอน-สินค้า → ตารางผลิตซ้ายและข้อกำหนด/ข้อมูลออเดอร์ขวา
- มอบหมาย/ร้านนอก/งานแก้อยู่เมนูเพิ่มเติม; เปิดฟอร์มเมื่อเลือกทำรายการ; เก็บตัวเลือกล็อตและยอดคงเหลือไว้
- ส่วนเลือกสถานการณ์/สิทธิ์/จำลองความผิดพลาด/เริ่มใหม่เปิดเมื่อจำเป็น; ลิงก์ A/B เดิมแสดงโครงเดิม ไม่มีหน้าจอแบ่งโต๊ะหรือ iframe เปรียบเทียบ
- รางใช้ dependency จริงสำหรับงานขนานและสถานะจริงของแต่ละขั้น; tooltip ตารางใช้คำจาก engine ไม่ตีความ “พร้อมทำ” ว่า “กำลังทำ”
- ใบรอเปิดยังคงปุ่มเปิดใบแม้กำลังเลือกดูสูตรขั้นอื่น; ไม่แสดงว่าเริ่มทำแล้ว; dialog คืน focus ให้ปุ่มที่เปิด
- คืน X-Frame-Options DENY ทุก route หลังเลิกใช้ iframe; auth เดิมและ noindex ของ proto คงอยู่

## กติกาที่คงไว้
- สูตร scoped ตามสินค้า/สี/ไซซ์/จุดพิมพ์/แบบ; เสื้อกองเดียวมีผู้ถือครองเดียว; รีดจับคู่ฟิล์มตรง scope/version/ทุกจุด
- บันทึกดี/แก้/เสียจริงโดยไม่เติมยอด; หัวหน้าตัดสินส่งบางส่วนทุกครั้ง เหลือเท่าไรอยู่ที่เดิมและส่งซ้ำไม่ได้
- รับร้านนอกหลายครั้งเป็นรอตรวจก่อน; งานแก้มีจุดเสีย/สาเหตุ/ขั้นย้อนตามสูตร และตรวจซ้ำ; ของเสียกับทดแทนมีหลักฐานแยก
- พร้อมส่งเมื่อแพ็กครบทุกสี/ไซซ์และทุกใบ; unknown ไม่แต่งจำนวน; permission, revision conflict, failure และ idempotency คงเดิม
- ภาพเสื้อเป็นภาพตัวอย่างสร้างเพื่อ proto มี provenance ไม่ใช่แบบอนุมัติลูกค้า

## ผลตรวจ
- typecheck ผ่าน; lint 0 errors / 23 warnings เดิม; ESLint ไฟล์แก้ผ่าน
- tests: 172 files / 1,763 tests ผ่าน รวม domain 28 tests; ตรวจ shared board/worklist/desk 60 tests หลังเพิ่ม tooltip override ผ่าน
- verify:ui ผ่าน tokens/hierarchy, dots 32 จาก baseline35, muted243 จาก baseline254; work-order 34 ผ่าน / 0 ตก
- build และ git diff --check ผ่าน
- Impeccable critique/polish: คืนลำดับภาพตามโครงเดิม ลดปุ่มและส่วนควบคุม; แก้สีตัวเลขร้านนอก/focus/รางที่เลือกเมื่อเปลี่ยนขนาดจอ
- Browser รอบคืนโครงเดิม: desktop1440/mobile390 Light/Dark; mobile ไม่มี page overflow (380/380) และ QC ที่เลือกอยู่ในจอเมื่อย่อ viewport
- Browser ส่งต่อ40จาก100 → QCเห็น40/ยังเหลือ60ที่รีด → กลับหน้ารวมเห็นทั้งสองขั้น; กดเปิดใบ90จากขั้นฟิล์มสำเร็จและเปิดแท็บสินค้าได้
- Browser ยกเลิก dialog คืน focus ปุ่มเปิดใบ; console ไม่มี error
- รอบก่อนตรวจ baseline ที่ล็อกอิน `/production` 21ออเดอร์/ใบจริงแล้ว และเดิน DTFจนครบ30, vendorรับ60ดี57แก้3คงร้าน40, failure/stale/worker/idempotency ผ่าน

## ทางต่อระบบจริง
- ใช้ Order → Production/workOrderNumber → ProductionStep, OperationJobDependency, OperationQuantity และ source references เดิม
- ต่อ PrintRun/PrintRunItem, OperationEvent, ManufacturingCommand, QcDefect/ReworkCase; mapping อยู่หัว `_domain/types.ts`
- สิ่งที่ระบบจริงยังขาด: การเลือกขั้นตามสินค้า, กองเสื้อ/ผู้ถือครอง, ส่งต่อบางส่วน, รับคืน/ตรวจหลายครั้ง และงานแก้ตามจำนวน
- ตอนเชื่อมต้องผ่านบริการ Manufacturing เดิมพร้อม transaction/locks/revision/idempotency ไม่ใช้ localStorage เป็นบริการผลิตใหม่
- รอบนี้ไม่มี API/schema/migration/dependency/env ใหม่ ไม่แตะฐานข้อมูลหรือกติกาเงินจริง

## NEXT
1. เบสลองโครงเดิมที่ `/proto/production-flow`; ปรับรายละเอียดจากการใช้งาน โดยไม่กลับไปถามเลือก A/B
2. หลังเคาะรายละเอียด ค่อยทำบริการและแผนย้ายข้อมูลของ V2 เดิม; ยังไม่เริ่มใน A12
3. Feature A2–A8/B/C/F ตาม ROADMAP เดิมยังเปิด ไม่ถูกนับว่าเสร็จจาก proto

## สภาพแวดล้อมและส่งมอบ
- npm run dev:demo ที่ port3000 ต่อ local demo; ใช้ HTTP/WebSocket proxy ชั่วคราว localhost:3005 →3000 เพราะ Chrome port3000 มี Fitness Service Worker ค้าง
- รอบนี้เริ่ม dev+proxy ใหม่เมื่อ process เดิมหยุด; ต้องมีทั้งคู่ทำงานเพื่อเปิดลิงก์ local ใช้ Chrome ที่ล็อกอินไว้
- ไม่ล้าง cookies/cache/Service Worker และไม่ bypass auth
- ส่งงานบน feature branch; ผลตรวจเป็น local prototype ไม่มีการปล่อยขึ้น Production หรือ push main
