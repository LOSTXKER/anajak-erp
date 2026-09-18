-- ใบเคลม / รอบแก้งาน (ก้อน 1 — เบสสั่ง 2026-09-18)
-- additive ล้วน: ตารางใหม่ 2 + enum 4 + คอลัมน์ nullable 3 ไม่แตะข้อมูลเดิมแถวใดเลย

-- CreateEnum
CREATE TYPE "ClaimState" AS ENUM ('OPEN', 'DECIDED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClaimSource" AS ENUM ('DELIVERY_RETURN', 'CUSTOMER_REPORT', 'INTERNAL_FOUND', 'QC_AFTER_DELIVERY');

-- CreateEnum
CREATE TYPE "ClaimFault" AS ENUM ('UNDETERMINED', 'SHOP', 'CUSTOMER', 'VENDOR', 'MATERIAL', 'CARRIER', 'NONE');

-- CreateEnum
CREATE TYPE "ClaimResolution" AS ENUM ('REWORK', 'REPLACE', 'DISCOUNT', 'REFUND', 'EXTRA_CHARGE', 'GOODWILL', 'REJECTED');

-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN     "claim_id" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "claim_id" TEXT;

-- AlterTable
ALTER TABLE "production_steps" ADD COLUMN     "claim_id" TEXT;

-- CreateTable
CREATE TABLE "order_claims" (
    "id" TEXT NOT NULL,
    "claim_number" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "state" "ClaimState" NOT NULL DEFAULT 'OPEN',
    "source" "ClaimSource" NOT NULL,
    "fault" "ClaimFault" NOT NULL DEFAULT 'UNDETERMINED',
    "round" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "fault_note" TEXT,
    "reported_at" TIMESTAMP(3) NOT NULL,
    "photo_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resolution" "ClaimResolution",
    "resolution_note" TEXT,
    "agreed_credit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "agreed_charge" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "opened_by_id" TEXT NOT NULL,
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "closed_by_id" TEXT,
    "closed_at" TIMESTAMP(3),
    "close_note" TEXT,
    "source_delivery_id" TEXT,
    "source_qc_record_id" TEXT,
    "customer_message" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_claim_lines" (
    "id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "color" TEXT,
    "qty_claimed" INTEGER NOT NULL,
    "qty_accepted" INTEGER,
    "qty_returned" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "order_claim_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_claims_claim_number_key" ON "order_claims"("claim_number");

-- CreateIndex
CREATE INDEX "order_claims_order_id_idx" ON "order_claims"("order_id");

-- CreateIndex
CREATE INDEX "order_claims_customer_id_idx" ON "order_claims"("customer_id");

-- CreateIndex
CREATE INDEX "order_claims_state_reported_at_idx" ON "order_claims"("state", "reported_at");

-- CreateIndex
CREATE INDEX "order_claims_source_delivery_id_idx" ON "order_claims"("source_delivery_id");

-- CreateIndex
CREATE INDEX "order_claim_lines_claim_id_idx" ON "order_claim_lines"("claim_id");

-- AddForeignKey
ALTER TABLE "order_claims" ADD CONSTRAINT "order_claims_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_claims" ADD CONSTRAINT "order_claims_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_claims" ADD CONSTRAINT "order_claims_source_delivery_id_fkey" FOREIGN KEY ("source_delivery_id") REFERENCES "deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_claims" ADD CONSTRAINT "order_claims_source_qc_record_id_fkey" FOREIGN KEY ("source_qc_record_id") REFERENCES "qc_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_claim_lines" ADD CONSTRAINT "order_claim_lines_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "order_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "order_claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_steps" ADD CONSTRAINT "production_steps_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "order_claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "order_claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

