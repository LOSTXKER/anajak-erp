-- CreateTable
CREATE TABLE "qc_records" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "qty_good" INTEGER NOT NULL,
    "qty_defect" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "checked_by_id" TEXT NOT NULL,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qc_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qc_defects" (
    "id" TEXT NOT NULL,
    "qc_record_id" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "print_label" TEXT,
    "reason" TEXT NOT NULL,
    "photo_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,

    CONSTRAINT "qc_defects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "qc_records_order_id_idx" ON "qc_records"("order_id");

-- CreateIndex
CREATE INDEX "qc_records_checked_at_idx" ON "qc_records"("checked_at");

-- CreateIndex
CREATE INDEX "qc_defects_reason_idx" ON "qc_defects"("reason");

-- AddForeignKey
ALTER TABLE "qc_records" ADD CONSTRAINT "qc_records_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_records" ADD CONSTRAINT "qc_records_checked_by_id_fkey" FOREIGN KEY ("checked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_defects" ADD CONSTRAINT "qc_defects_qc_record_id_fkey" FOREIGN KEY ("qc_record_id") REFERENCES "qc_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

