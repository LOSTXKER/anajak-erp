-- ยุบสถานะออเดอร์ให้เรียบ: ตัด QUOTATION (ใช้โมดูลใบเสนอแทน) +
-- DESIGN_PENDING/AWAITING_APPROVAL (ยุบเฟสออกแบบเหลือ DESIGNING/DESIGN_APPROVED)
-- DB ว่าง (ไม่มี order) จึงปลอดภัย — ไม่มีแถวอ้างค่าที่ลบ

-- AlterEnum
BEGIN;
CREATE TYPE "InternalStatus_new" AS ENUM ('DRAFT', 'INQUIRY', 'CONFIRMED', 'DESIGNING', 'DESIGN_APPROVED', 'PRODUCTION_QUEUE', 'PRODUCING', 'QUALITY_CHECK', 'PACKING', 'READY_TO_SHIP', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'ON_HOLD');
ALTER TABLE "public"."orders" ALTER COLUMN "internal_status" DROP DEFAULT;
ALTER TABLE "orders" ALTER COLUMN "internal_status" TYPE "InternalStatus_new" USING ("internal_status"::text::"InternalStatus_new");
ALTER TYPE "InternalStatus" RENAME TO "InternalStatus_old";
ALTER TYPE "InternalStatus_new" RENAME TO "InternalStatus";
DROP TYPE "public"."InternalStatus_old";
ALTER TABLE "orders" ALTER COLUMN "internal_status" SET DEFAULT 'INQUIRY';
COMMIT;
