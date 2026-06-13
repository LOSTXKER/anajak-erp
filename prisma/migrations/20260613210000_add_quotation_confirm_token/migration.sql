-- ลิงก์ยืนยันใบเสนอราคาให้ลูกค้า (FLOW-REDESIGN ก้อน 4 — ขอบลูกค้า)
-- additive: คอลัมน์ใหม่ nullable บน quotations — ไม่แตะข้อมูลเดิม
-- หมดอายุลิงก์อิงจาก validUntil ของใบเสนอ (ไม่มีคอลัมน์ expiry แยก)

ALTER TABLE "quotations" ADD COLUMN "confirm_token" TEXT;

CREATE UNIQUE INDEX "quotations_confirm_token_key" ON "quotations"("confirm_token");
