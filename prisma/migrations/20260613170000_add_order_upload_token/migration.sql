-- ลิงก์อัปโหลดไฟล์ลูกค้า (FLOW-REDESIGN ก้อน 4 ชิ้น 3)
-- additive: คอลัมน์ใหม่ nullable บน orders + ปลด NOT NULL ของ attachments.uploaded_by_id
-- (null = ลูกค้าอัปผ่านลิงก์ token ไม่มี user) — ไม่แตะข้อมูลเดิม

-- AlterTable: token อัปโหลดต่อออเดอร์ (ลูกค้าเปิดผ่านลิงก์ ไม่ต้อง login)
ALTER TABLE "orders" ADD COLUMN "upload_token" TEXT;
ALTER TABLE "orders" ADD COLUMN "upload_token_expires_at" TIMESTAMP(3);

-- CreateIndex: token ต้องไม่ซ้ำ (lookup ทางลิงก์ลูกค้า)
CREATE UNIQUE INDEX "orders_upload_token_key" ON "orders"("upload_token");

-- AlterTable: ไฟล์ที่ลูกค้าอัปเองไม่มีผู้อัปในระบบ → ปลด NOT NULL
ALTER TABLE "attachments" ALTER COLUMN "uploaded_by_id" DROP NOT NULL;
