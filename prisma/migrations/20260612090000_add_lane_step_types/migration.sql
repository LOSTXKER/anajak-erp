-- เพิ่มชนิดขั้นตอนผลิต: สายเตรียมเสื้อ (เบิกสต๊อค/ตรวจรับเสื้อลูกค้า) + Sublimation แยกจากพิมพ์พิเศษ
-- (เบสเคาะ 2026-06-12: ทำเอง = DTF เท่านั้น · DTG/สกรีน/ปัก/Sublimation/ตัดเย็บ/ป้ายคอ = outsource)
ALTER TYPE "ProductionStepType" ADD VALUE 'GARMENT_PICK';
ALTER TYPE "ProductionStepType" ADD VALUE 'GARMENT_RECEIVE';
ALTER TYPE "ProductionStepType" ADD VALUE 'SUBLIMATION';
