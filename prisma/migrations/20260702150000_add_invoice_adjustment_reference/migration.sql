-- ใบลดหนี้/เพิ่มหนี้อ้างใบกำกับเดิม + เหตุผล (ม.86/10 + ป.80/2542) — Gate B1 audit 2026-07-02
-- additive ล้วน (nullable ทั้งคู่) — apply ได้ปลอดภัยแม้มีข้อมูล

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "original_invoice_id" TEXT,
ADD COLUMN "adjustment_reason" TEXT;

-- CreateIndex
CREATE INDEX "invoices_original_invoice_id_idx" ON "invoices"("original_invoice_id");

-- AddForeignKey (Restrict — กติกาห้ามลบใบ: ใบเดิมที่มี CN/DN อ้างอยู่ห้ามหายแม้ทาง SQL)
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_original_invoice_id_fkey" FOREIGN KEY ("original_invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
