# Local demo data

ชุดนี้มีไว้ให้ลอง ERP (และจอสถานีเมื่อออกแบบใหม่เสร็จ) บนเครื่องโดยไม่แตะฐาน Supabase ที่ใช้ร่วมกัน

## ขอบเขตความปลอดภัย

- ยอมทำงานเฉพาะ PostgreSQL `127.0.0.1:5433/anajak_erp_demo`
- `npm run db:seed:demo` ล้างเฉพาะข้อมูลธุรกิจในฐาน demo แล้วสร้างใหม่ทั้งชุด
- เก็บ User mapping สำหรับ Supabase login รวมถึง Pattern, PackagingOption และ ServiceCatalog
- ล้าง Product/ProductVariant เดิมในฐาน demo แล้วสร้างเฉพาะสินค้า `DEMO-*` พร้อมยอดทดสอบใหม่ทุกครั้ง จึงไม่ใช้ mirror จาก Anajak Stock
- ฐาน demo ต้องไม่มี `stock_api_url` หรือ `stock_api_key`; ถ้ามี script จะหยุดก่อนล้างข้อมูล
- local stock writer เปิดได้เมื่อทั้ง `ANAJAK_ERP_DEMO_MODE=1` และ DATABASE_URL ตรงฐาน demo เท่านั้น; flag ที่ชี้ฐานอื่นจะหยุดก่อนอ่านหรือเขียนข้อมูล
- หน้า Products/Settings ซ่อนการ Sync และช่อง API ในโหมด demo; outbound Stock request ถูกปิดอีกชั้นก่อน `fetch`
- ชื่อลูกค้า บริษัท เบอร์โทร อีเมล และเอกสารทั้งหมดเป็นข้อมูลสมมติ
- canonical `npm run db:seed` ยังเป็น master data เท่านั้น และไม่ล้างข้อมูลธุรกิจ

## คำสั่งที่ใช้ประจำ

```bash
npm run db:seed:demo
npm run dev:demo
```

ทั้งสองคำสั่งอ่าน user/password จาก Docker container `anajak-postgres` โดยไม่พิมพ์ค่าออกมา และบังคับฐานเป้าหมายผ่าน `src/lib/demo-seed-plan.ts`

## สิ่งที่ต้องมีครั้งแรก

ฐาน `anajak_erp_demo` ต้องถูกสร้างและ apply migrations ครบก่อน จากนั้นต้องมี active OWNER ที่ `supabaseId` ตรงกับ session ของผู้ทดสอบ Script จะ fail closed หากเงื่อนไขนี้ไม่ครบ และจะไม่พยายามสร้างบัญชี Supabase หรือนำ Product/credential จาก Stock เข้ามาเอง

## ภาพวันทำงานที่สร้าง

- 15 ออเดอร์ ตั้งแต่ inquiry, ออกแบบ, รอเปิดผลิต, กำลังผลิต, QC, แพ็ก, พร้อมส่ง, ส่งแล้ว และเสร็จสิ้น
- 12 ใบผลิต / 35 ขั้น พร้อมงานรับเสื้อ, เบิกสต๊อกทดสอบ, DTF, รีดร้อน, blocked stock และร้านนอกเกินกำหนด
- Print Run กำลังพิมพ์ 1, รอตัดแยก 1 และประวัติเสร็จแล้ว 2 รอบ โดย DTF ที่ปิดแล้วทุกขั้นมี item หลักฐาน
- QC, Delivery, Invoice, Payment, Billing Note, Notification และ Audit ที่สัมพันธ์กับออเดอร์จริง
- สินค้าทดสอบพร้อมเบิก `DEMO-POLO-READY` มี 24 ตัวต่อไซส์ S/M/L; สินค้าขาดจริง `DEMO-TEE-SHORT` มี L เพียง 6 ตัว

## ลอง flow สต๊อก

1. เปิดใบผลิต `/production/demo-production-stock-pick-ready` (`ORD-2608-0015`) — จอสถานีถอดออก 2026-09-02 จึงลองผ่านใบผลิตแทน
2. กด **เบิกเสื้อที่ยังขาด 24 ตัว** ค่าเริ่มต้นเผื่อเสียเป็น 9/9/9; ledger จะออกเลข `DEMO-ISSUE-*` และขั้นปิดที่ 24/24
3. เปิด `/production/demo-production-stock-pick-ready?tab=inventory` แล้วกด **คืนเศษ** เพื่อคืนส่วนเกิน; ledger จะออกเลข `DEMO-RETURN-*`
4. ค้น `ORD-2608-0008` ที่ `/production` แล้วเปิดใบผลิต เพื่อดูงานติดปัญหาจากสต๊อก L ที่ขาดจริง โดยไม่มีปุ่มลงมือ

การเบิก/คืนเปลี่ยน `ProductVariant.stock`, `ProductVariant.totalStock`, `Product.totalStock`, MaterialUsage และ audit ใน transaction เดียว พร้อมกันยอดจองของออเดอร์อื่นไว้ หากต้องการเริ่มใหม่ให้รัน `npm run db:seed:demo` อีกครั้ง
