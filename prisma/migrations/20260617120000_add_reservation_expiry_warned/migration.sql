-- เพิ่ม field กันเตือนซ้ำตอน auto-release จองสต๊อกค้าง (เตือนล่วงหน้า 1 วันก่อนปลด)
-- additive ล้วน · ค่าเดิมทุกแถว = NULL (ยังไม่เคยเตือน)
ALTER TABLE "orders" ADD COLUMN "reservation_expiry_warned_at" TIMESTAMP(3);
