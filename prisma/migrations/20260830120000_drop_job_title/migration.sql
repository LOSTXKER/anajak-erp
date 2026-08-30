-- เอาระบบ "ชื่องาน" ออกทั้งหมด (เบสสั่ง 2026-08-30)
-- ใบงานอ้างด้วยเลขที่ออเดอร์ + ลูกค้า · สิ่งที่บอกว่าทำอะไรคือรายการงาน (order_items.description)
-- ลบถาวรตามที่เบสเคาะ — ชื่องานเดิมกู้คืนไม่ได้
ALTER TABLE "orders" DROP COLUMN "title";
ALTER TABLE "quotations" DROP COLUMN "title";
