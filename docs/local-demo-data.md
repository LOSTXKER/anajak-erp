# Local demo data

ชุดนี้มีไว้ให้ลอง ERP และ Station บนเครื่องโดยไม่แตะฐาน Supabase ที่ใช้ร่วมกัน

## ขอบเขตความปลอดภัย

- ยอมทำงานเฉพาะ PostgreSQL `127.0.0.1:5433/anajak_erp_demo`
- `npm run db:seed:demo` ล้างเฉพาะข้อมูลธุรกิจในฐาน demo แล้วสร้างใหม่ทั้งชุด
- เก็บ User mapping สำหรับ Supabase login และ master data ได้แก่ Product, ProductVariant, Pattern, PackagingOption และ ServiceCatalog
- ฐาน demo ต้องไม่มี `stock_api_url` หรือ `stock_api_key`; ถ้ามี script จะหยุดก่อนล้างข้อมูล
- ชื่อลูกค้า บริษัท เบอร์โทร อีเมล และเอกสารทั้งหมดเป็นข้อมูลสมมติ
- canonical `npm run db:seed` ยังเป็น master data เท่านั้น และไม่ล้างข้อมูลธุรกิจ

## คำสั่งที่ใช้ประจำ

```bash
npm run db:seed:demo
npm run dev:demo
```

ทั้งสองคำสั่งอ่าน user/password จาก Docker container `anajak-postgres` โดยไม่พิมพ์ค่าออกมา และบังคับฐานเป้าหมายผ่าน `src/lib/demo-seed-plan.ts`

## สิ่งที่ต้องมีครั้งแรก

ฐาน `anajak_erp_demo` ต้องถูกสร้างและ apply migrations ครบก่อน จากนั้นต้องมี active OWNER ที่ `supabaseId` ตรงกับ session ของผู้ทดสอบ รวมถึง Product/ProductVariant mirror อย่างน้อยหนึ่งรายการ Script จะ fail closed หากเงื่อนไขนี้ไม่ครบ และจะไม่พยายามสร้างบัญชี Supabase หรือนำ Stock credentials เข้ามาเอง

## ภาพวันทำงานที่สร้าง

- 14 ออเดอร์ ตั้งแต่ inquiry, ออกแบบ, รอเปิดผลิต, กำลังผลิต, QC, แพ็ก, พร้อมส่ง, ส่งแล้ว และเสร็จสิ้น
- 11 ใบผลิต / 32 ขั้น พร้อมงานรับเสื้อ, DTF, รีดร้อน, blocked stock และร้านนอกเกินกำหนด
- Print Run กำลังพิมพ์ 1, รอตัดแยก 1 และประวัติเสร็จแล้ว 2 รอบ โดย DTF ที่ปิดแล้วทุกขั้นมี item หลักฐาน
- QC, Delivery, Invoice, Payment, Billing Note, Notification และ Audit ที่สัมพันธ์กับออเดอร์จริง
- งาน Stock แสดงกรณีติดปัญหาแบบอ่านได้ แต่ปุ่มเชื่อม Stock จริงจะใช้ไม่ได้โดยตั้งใจ
