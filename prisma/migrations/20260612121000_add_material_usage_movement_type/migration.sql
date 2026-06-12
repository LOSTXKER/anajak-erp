-- ใบเบิกเสื้อ/ใบคืนเศษ (FLOW-REDESIGN ก้อน 1): MaterialUsage บอกทิศทางได้
-- ISSUE = เบิกออก (ค่าเดิมทั้งหมด) · RETURN = คืนเศษกลับสต๊อค · note = เหตุผล/หมายเหตุ
ALTER TABLE "material_usages"
ADD COLUMN "movement_type" TEXT NOT NULL DEFAULT 'ISSUE',
ADD COLUMN "note" TEXT;
