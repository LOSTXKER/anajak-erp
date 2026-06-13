-- ลิงก์สถานะออเดอร์ให้ลูกค้า (FLOW-REDESIGN ก้อน 4 — portal ขั้น 1)
-- additive: คอลัมน์ใหม่ nullable บน orders — ไม่แตะข้อมูลเดิม

ALTER TABLE "orders" ADD COLUMN "status_token" TEXT;
ALTER TABLE "orders" ADD COLUMN "status_token_expires_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "orders_status_token_key" ON "orders"("status_token");
