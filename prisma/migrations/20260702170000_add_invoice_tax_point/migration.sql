-- tax point จ้างทำของ (Gate B3 · ม.78/1(1)): วันที่เอกสารจริง + ผูกใบเสร็จ↔งวดรับเงิน
-- additive ล้วน (nullable ทั้งคู่) — apply ได้ปลอดภัยแม้มีข้อมูล

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "issue_date" TIMESTAMP(3),
ADD COLUMN "for_payment_id" TEXT;

-- CreateIndex (unique — 1 งวดรับเงิน ออกใบเสร็จ/ใบกำกับได้ใบเดียว กันนับซ้ำ)
CREATE UNIQUE INDEX "invoices_for_payment_id_key" ON "invoices"("for_payment_id");

-- AddForeignKey (Restrict — งวดรับเงินที่มีใบกำกับผูกอยู่ห้ามหาย)
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_for_payment_id_fkey" FOREIGN KEY ("for_payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
