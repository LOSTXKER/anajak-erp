-- ต้นทุนอัตโนมัติจากงานผลิต/outsource ต้องมี key ผูกต้นทาง — upsert ได้ ไม่เขียนซ้ำ
-- (audit 2026-06-11 ข้อ 21: actualCost + ค่าจ้างร้านนอก ไม่เคยไหลเข้ากำไรหน้าออเดอร์)
ALTER TABLE "cost_entries" ADD COLUMN "source_ref" TEXT;
CREATE UNIQUE INDEX "cost_entries_source_ref_key" ON "cost_entries"("source_ref");
