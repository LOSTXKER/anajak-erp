-- สำเนาคู่สัญญา ณ วันออกเอกสาร (ผู้ซื้อ 10 ช่อง + ผู้ขาย 6 ช่อง) บนใบเสนอราคา/
-- ใบแจ้งหนี้+ใบกำกับ/ใบวางบิล — เดิมหน้าพิมพ์ join สดจาก customers + settings ทุกครั้ง
-- ที่กดพิมพ์ ทำให้ "พิมพ์ใบเก่าซ้ำ" ได้ที่อยู่ปัจจุบัน ไม่ตรงต้นฉบับที่ลูกค้าถือและที่
-- ยื่นสรรพากรไปแล้ว (ม.86/4 บังคับว่าสำเนาต้องตรงต้นฉบับ)
--
-- additive ล้วน — ทุกคอลัมน์ nullable ไม่มี default ไม่แตะข้อมูลเดิม apply ได้ปลอดภัย
-- แม้ตารางมีข้อมูล · ไม่ backfill ใบเก่าโดยตั้งใจ: ที่อยู่ ณ วันนั้นไม่มีใครรู้แล้ว
-- การเดาย้อนหลังด้วยค่าปัจจุบันคือการปลอมสำเนา · หน้าพิมพ์อ่านแบบ `snapshot ?? ค่าสด`
-- ใบเก่าจึงพิมพ์ได้เหมือนเดิมทุกประการ

-- AlterTable
ALTER TABLE "billing_notes" ADD COLUMN     "buyer_address" TEXT,
ADD COLUMN     "buyer_branch_number" TEXT,
ADD COLUMN     "buyer_company" TEXT,
ADD COLUMN     "buyer_district" TEXT,
ADD COLUMN     "buyer_name" TEXT,
ADD COLUMN     "buyer_phone" TEXT,
ADD COLUMN     "buyer_postal_code" TEXT,
ADD COLUMN     "buyer_province" TEXT,
ADD COLUMN     "buyer_sub_district" TEXT,
ADD COLUMN     "buyer_tax_id" TEXT,
ADD COLUMN     "seller_address" TEXT,
ADD COLUMN     "seller_branch" TEXT,
ADD COLUMN     "seller_email" TEXT,
ADD COLUMN     "seller_name" TEXT,
ADD COLUMN     "seller_phone" TEXT,
ADD COLUMN     "seller_tax_id" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "buyer_address" TEXT,
ADD COLUMN     "buyer_branch_number" TEXT,
ADD COLUMN     "buyer_company" TEXT,
ADD COLUMN     "buyer_district" TEXT,
ADD COLUMN     "buyer_name" TEXT,
ADD COLUMN     "buyer_phone" TEXT,
ADD COLUMN     "buyer_postal_code" TEXT,
ADD COLUMN     "buyer_province" TEXT,
ADD COLUMN     "buyer_sub_district" TEXT,
ADD COLUMN     "buyer_tax_id" TEXT,
ADD COLUMN     "seller_address" TEXT,
ADD COLUMN     "seller_branch" TEXT,
ADD COLUMN     "seller_email" TEXT,
ADD COLUMN     "seller_name" TEXT,
ADD COLUMN     "seller_phone" TEXT,
ADD COLUMN     "seller_tax_id" TEXT;

-- AlterTable
ALTER TABLE "quotations" ADD COLUMN     "buyer_address" TEXT,
ADD COLUMN     "buyer_branch_number" TEXT,
ADD COLUMN     "buyer_company" TEXT,
ADD COLUMN     "buyer_district" TEXT,
ADD COLUMN     "buyer_name" TEXT,
ADD COLUMN     "buyer_phone" TEXT,
ADD COLUMN     "buyer_postal_code" TEXT,
ADD COLUMN     "buyer_province" TEXT,
ADD COLUMN     "buyer_sub_district" TEXT,
ADD COLUMN     "buyer_tax_id" TEXT,
ADD COLUMN     "seller_address" TEXT,
ADD COLUMN     "seller_branch" TEXT,
ADD COLUMN     "seller_email" TEXT,
ADD COLUMN     "seller_name" TEXT,
ADD COLUMN     "seller_phone" TEXT,
ADD COLUMN     "seller_tax_id" TEXT;
