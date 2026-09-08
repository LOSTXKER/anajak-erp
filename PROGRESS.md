# PROGRESS — สถานะสด

## ตอนนี้ (2026-09-09 · A10)
- เบสสั่ง `/production` เป็นตารางต่อเนื่อง ไม่แบ่งหัวสถานะ และเกลา `/production/demo-production-form-tag-press` บนโครงเดิม พร้อม refactor ที่ช่วยทั้งเว็บ
- ทำบน branch `codex/production-table-refine` ต่อจาก `proto/work-order-form` ที่ `92defca`; ไม่ได้ขึ้น main/Production ในรอบนี้
- `/production`: ตารางเดียว 6 คอลัมน์ ไม่มีหัวแบ่งกลุ่ม; รวมเส้นทางไว้ใต้ขั้นตอน; หัวใบงาน/จำนวน/กำหนดส่งกดเรียง asc/desc ได้ (URL sort/dir); เลขใบเป็น Link จริง ใช้คีย์บอร์ด/เปิดแท็บใหม่ได้; ค้นหา/ตัวกรองเดิม + จำนวนผล + ล้างตัวกรอง; ตัวเลขร้านนอกนับใบไม่ซ้ำ; มือถือเลื่อนเฉพาะตารางและแถบกรอง
- ใบผลิตคงหัวใบ → ราง → ขั้นตอน/สินค้า → ตารางซ้าย/เช็คลิสต์ขวา; แสดงไซซ์/สี/ลายเป็นสัดส่วน, โซนกรอกครบ/บันทึกแยกจากหัว, เช็คลิสต์อ่านง่ายและข้อมูลร้านนอกครบขึ้น
- แยก `work-order-page.tsx` เหลือ 336 บรรทัด: `work-order-quantities` / `work-order-checklist` / `work-order-items` / `work-order-steps`; query/controller/server/สิทธิ์เดิม; หน้าลองทุกสถานะใช้ component ชุดเดียว
- ขั้นคู่มีตารางยอดของแต่ละขั้นและ anchor เช็คลิสต์/ยอดแยกตาม step; ปุ่มปิดพาไปช่องของขั้นนั้น แทนช่องของขั้นหลัก
- Refactor กลาง: `differenceInBangkokDays` ใน date-utils ใช้ร่วมรายการผลิต/ใบผลิต/ออเดอร์/board (แก้ tests เดิมที่ล้มบน UTC); `DataTable cellPadding` รวมระยะหัว/เซลล์/ปุ่มเรียง (ผลิต compact12px, ออเดอร์ responsive16/24px); hook `clearSearch` ยกเลิก debounce พร้อมล้าง URL/input ใช้ร่วมผลิต/ออเดอร์; ลบ groupDeskRows/DESK_PILES ที่หมดผู้ใช้

## ตรวจแล้ว
- Full unit: 168 files / 1,702 tests ผ่าน; typecheck ผ่าน; full lint 0 errors (มี warnings เดิมนอกขอบเขต); ไฟล์ที่แก้ตรวจ lint แยก 0 errors/0 warnings
- Date/desk/board/worklist: 62/62 ผ่านทั้ง TZ=UTC และ Asia/Bangkok
- verify:ui ผ่าน tokens + hierarchy + ใบผลิต 33/33 (เพิ่ม guard ขั้นคู่แยกยอด/anchor); targeted tests หลัง clearSearch 35/35 ผ่าน
- Chrome session เดิม: `/production` 21 ใบ / 21 Link / 0 หัว rowgroup, ค้น “ป้ายคอ” ได้ 2, ร้านนอกได้ 8 ใบไม่ซ้ำ, เรียงกลับด้าน, ผลว่าง, ล้างตัวกรอง, Enter ที่เลขใบเปิด tag-press ถูกหน้า
- สองหน้าที่เบสระบุ: 1440 และ 390 ทั้ง Light/Dark; page scrollWidth เท่าจอ ไม่มีทั้งหน้าล้น; มือถือตารางเลื่อนแนวนอนในกรอบ
- ใบผลิตจริงแท็บขั้นตอน/สินค้าเปิดได้; หน้าลอง qty-partial กรอกครบ → บันทึก 39→60 ตัว; pair มี 2 ตาราง แถวที่อยู่ร้านนอกอ่านอย่างเดียว; ช่างดูงานคนอื่นไม่มีช่องแก้ยอด
- ไม่มี schema/migration/dependency/env ใหม่; ไม่ seed/reset หรือแก้ข้อมูลธุรกิจจริง; รอบนี้ตรวจการกรอกผ่าน controller จำลองของหน้าลอง ไม่ได้ทดสอบเขียน DB ซ้ำ

## NEXT
1. เบสดู `/production` และ `/production/demo-production-form-tag-press` ที่ localhost:3000 เพื่อทบทวนหน้าจอที่ปรับแล้ว
2. เมื่อต้องการขึ้นเว็บจริง ค่อยรวม branch และตรวจ build/deploy; รอบนี้ push branch เท่านั้น
3. งานเดิมยังค้าง: A2–A8/B/C/F ตาม ROADMAP; A9 server sendToQc ทางลัด, ข้อกำหนดยังนิ่งในโค้ด, `work-order-route.tsx` เก่ายังอยู่ (ไม่ได้ลบในรอบนี้)

## บริบทที่ต้องรักษา
- A9 ใบผลิตแบบฟอร์มและเช็คลิสต์/กรอกยอด/ย้อนขั้น/ช่องคู่เคยขึ้น main เมื่อเบสสั่ง 09-09 02:30; migration 39/39 บนฐานจริงและ backup บันทึกไว้ใน git history ของ PROGRESS
- งานปรับฟอร์ม/หน้าลองทุกสถานะหลังจากนั้นเดิมอยู่ `proto/work-order-form`; branch ใหม่นี้ต่อจากงานนั้น ยังไม่ใช่การยืนยันเว็บจริงล่าสุด
- หัวหน้าทำครบจากใบผลิต · ช่าง `/production/floor` · Station/TV ไม่มีเงิน · ทำเองเฉพาะ DTF · สูตร RELEASED ต้องคัดลอกก่อนแก้
- Production V2 ยังไม่ cutover; ใบผลิตที่ทดสอบเป็น legacy; ไม่เปลี่ยน flag
- A5 กระดาษเป็นหลักถอยบางส่วนตาม A9: ทุกขั้นปิดด้วยปุ่ม + ติ๊กครบ; ขั้นร้านนอก/รอบพิมพ์/ใบตรวจรับใช้ flow เจ้าของหลักฐานเดิม
- Demo “ลอง 1–10” เริ่มที่ขั้นแรกคนละเส้นทาง; scenario หลักมีงานกลางทาง; ไม่ล้าง/สร้างชุดใหม่ในรอบนี้

## สภาพแวดล้อม
- localhost:3000 ใช้ฐานทดลองตามการตั้งค่าที่มีอยู่; ตรวจผ่าน Chrome session เบส (in-app browser ยังไม่มี login)
- Canonical dev/demo ใช้ port เดียวกัน; ถ้าต้อง restart ให้ตรวจ target DB ตาม docs/local-demo-data.md ก่อน
