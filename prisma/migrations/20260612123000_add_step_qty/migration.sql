-- ProductionStep บอก "บางส่วน" ได้ (FLOW-REDESIGN ก้อน 1): ทำแล้ว/ทั้งหมด ต่อขั้น
-- qty_total NULL = ขั้นแบบติ๊กเฉยๆ (ของเดิมทั้งหมด) — ไม่บังคับกรอกหน้างาน
ALTER TABLE "production_steps"
ADD COLUMN "qty_done" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "qty_total" INTEGER;
