-- ม็อกอัพหนึ่งเวอร์ชัน = หลายรูป (หน้า/หลัง/แขน) — ลูกค้าอนุมัติทั้งชุดครั้งเดียว
-- เดิม 1 เวอร์ชัน = 1 รูป (design_versions.file_url) ทำให้เสื้อที่พิมพ์หลายจุดต้องยัด
-- ทุกด้านลงรูปเดียว หรือแตกเป็นหลายเวอร์ชันจนประวัติการอนุมัติอ่านไม่รู้เรื่อง
--
-- additive ล้วน — ตารางใหม่ไม่แตะ design_versions เดิม และ **ไม่ backfill** โดยตั้งใจ:
-- file_url เดิมยังทำหน้าที่ "รูปปก" ของเวอร์ชันต่อไป ใบสั่งผลิต/station/ลิงก์อนุมัติลูกค้า
-- ที่อ่าน file_url อยู่จึงทำงานเหมือนเดิมทุกประการแม้เวอร์ชันเก่าไม่มีแถวในตารางนี้เลย
-- โค้ดฝั่งอ่านใช้สูตร `files ถ้ามี ไม่งั้นถอยไปใช้รูปปก` จึงรองรับทั้งของเก่าและของใหม่

-- CreateTable
CREATE TABLE "design_version_files" (
    "id" TEXT NOT NULL,
    "design_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "file_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "position" TEXT,
    "caption" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "design_version_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "design_version_files_design_id_idx" ON "design_version_files"("design_id");

-- AddForeignKey
ALTER TABLE "design_version_files" ADD CONSTRAINT "design_version_files_design_id_fkey" FOREIGN KEY ("design_id") REFERENCES "design_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
