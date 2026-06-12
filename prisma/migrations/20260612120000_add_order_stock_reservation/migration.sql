-- จองสต๊อคฝั่ง Stock ตามออเดอร์ (FLOW-REDESIGN ก้อน 1): เก็บสถานะการจองล่าสุดบนออเดอร์
-- nullable ทั้งคู่ — ออเดอร์เดิม/ออเดอร์ไม่มีของจากสต๊อคไม่กระทบ
ALTER TABLE "orders"
ADD COLUMN "stock_reserved_at" TIMESTAMP(3),
ADD COLUMN "stock_reservation_error" TEXT;
