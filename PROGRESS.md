# PROGRESS — สถานะสด

## ตอนนี้ (2026-09-09 เช้า)
- **เบสอนุมัติ “1 2 3 4 ทำเลย” → ใบผลิตแบบฟอร์มลงจริงครบทั้ง 4 เรื่องหลังบ้าน (ROADMAP §A9.2–A9.5)** บน branch `proto/work-order-form` (main ไม่แตะ):
  - schema: ตาราง `ProductionStepCheck` (ผลติ๊กต่อขั้น ใครติ๊กเมื่อไหร่) + `pairWithPrevious` บน `ProductionStep` และ `RoutingOperation` — migration `20260908183653_work_order_form_checks_and_pair` apply บน**ฐานทดลอง**แล้ว (ฐานจริง Supabase ยังไม่ apply — ขึ้นตอน deploy ตาม `docs/deploy-checklist.md`)
  - server (`routers/production.ts` + `services/work-order-form.ts` pure + test): `tickStandard` · `reportPieceQty` (ใช้ `OperationQuantity` เดิม ไม่สร้างตารางใหม่) · `reopenStep` (หัวหน้า) · **ด่านใน `updateStep`: ปิดขั้นได้เมื่อติ๊กข้อกำหนดครบ** · สูตรขั้นงาน/เปิดใบผลิตรับ flag ช่องคู่
  - หน้า `work-order-page.tsx`: เช็คลิสต์ติ๊กได้ (ชื่อคนติ๊ก · ชิป “ติ๊กอีก N ข้อ”) · ตารางรายตัวกรอก ทำแล้ว/เสีย ต่อแถว + ครบทุกแถว + บันทึก · ปุ่มปิดขั้นบนหัวใบ aria-disabled พาไปเช็คลิสต์จนติ๊กครบ · เมนู ⋯ “ย้อนกลับไป <ขั้น>” · ราง `lib/work-order-rail.ts` รวมช่องคู่ “A + B” · “ส่งเข้า QC” โผล่เมื่อทุกขั้นปิดแล้วเท่านั้น
- ตรวจแล้ว: typecheck · lint · unit 1,683 (+17) · verify:ui 26/26 · Chrome ฐานทดลอง ORD-2609-0009 เดินครบ: เริ่มทำ → ปุ่มปิดติดจนติ๊ก 2 ข้อ → ครบทุกแถว → บันทึกยอด 30/30 → ปิดขั้น → รางเลื่อน → ⋯ ย้อนกลับ → กลับมาเปิด ยอด/ติ๊กยังอยู่ · ช่องคู่โชว์ “ตรวจคุณภาพ + แพ็ก” · หน้าสูตรมีติ๊ก “เดินคู่กับขั้นก่อน” · ไม่มี console error
- **ข้อจำกัดฐานทดลอง**: ใบผลิตทดลองทุกใบเป็น V2 (`executionEnabled`) → ปุ่มสถานะ/ยอด/ย้อนโดน server ปฏิเสธ (กติกาเดิมของ updateStep) · ตอนตรวจปรับ ORD-2609-0009 ให้เป็นใบแบบเดิม + ปักลายปิดแล้ว + แพ็กติดช่องคู่ ด้วย SQL บนฐานทดลอง (รีเซ็ตได้ `npm run db:seed:demo`) · มีร่างสูตร “DTF ในโรงงาน เวอร์ชัน 2” ค้างบนฐานทดลองจากการตรวจ

## NEXT
0. **เบสลอง** http://localhost:3000/production/demo-production-outsource-overdue (ฐานทดลอง `npm run dev:demo`) แล้วบอกว่า push main ไหม — push main = ต้อง `prisma migrate deploy` บนฐานจริงด้วย (ถาม + backup ก่อน ตาม deploy-checklist)
1. ⚠️ ถามเบส: แก้ seed ฐานทดลองให้มีใบผลิตแบบเดิม 1 ใบ (ไม่ใช่ V2) เพื่อลองฟอร์มได้โดยไม่ต้องแก้ SQL มือ (ROADMAP §A9 หนี้ 1)
2. หนี้ A9 ที่เหลือ (ROADMAP §A9 ท้ายใบงาน): ทางลัด `sendToQc` ฝั่ง server · ข้อกำหนดยังนิ่งในโค้ด · `work-order-route.tsx` ไม่ถูกใช้ (ลบต้องถาม)
3. งานค้างเดิม: CI แดงจาก `production-desk.test.ts` เขตเวลา (แยกแก้) · A2–A8/B/C/F ตาม ROADMAP

## บริบทที่ยังต้องรักษา
- หัวหน้าทำครบจากใบผลิต · ช่างมี `/production/floor` · Station/TV ไม่มีเงิน · ทำเองเฉพาะ DTF · สูตร RELEASED ต้องคัดลอกก่อนแก้
- A5 กระดาษเป็นหลักถอยบางส่วนแล้ว (SPEC): ทุกขั้นปิดด้วยปุ่ม + ติ๊กครบ · ขั้นที่ปิดผ่าน flow อื่น (ร้านนอก/รอบพิมพ์/ใบตรวจรับ) ไม่ผ่านด่านติ๊ก
- Production V2 บนเว็บจริงยัง legacy · ไม่เปลี่ยน flag · ฟอร์มใบผลิตขับขั้นแบบเดิมเท่านั้น (ติ๊กเช็คลิสต์ใช้ได้ทั้งสองแบบ)

## สภาพแวดล้อม
- Port 3000: `npm run dev:demo` (ฐานทดลอง 127.0.0.1:5433/anajak_erp_demo) — migrate ใหม่ apply แล้ว · ไม่ seed/reset ในรอบนี้
- หน้าจริงต้องล็อกอิน — ดูผ่านแท็บ Claude-in-Chrome (session เบส) · migrate ฐานทดลองใช้ DATABASE_URL จาก docker `anajak-postgres` (ห้ามรัน migrate dev กับ .env ที่ชี้ Supabase)
