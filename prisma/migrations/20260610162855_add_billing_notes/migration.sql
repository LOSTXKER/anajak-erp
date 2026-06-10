-- CreateTable
CREATE TABLE "billing_notes" (
    "id" TEXT NOT NULL,
    "billing_note_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "billing_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3),
    "total_amount" DECIMAL(12,2) NOT NULL,
    "is_voided" BOOLEAN NOT NULL DEFAULT false,
    "voided_reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_note_items" (
    "id" TEXT NOT NULL,
    "billing_note_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "billing_note_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_notes_billing_note_number_key" ON "billing_notes"("billing_note_number");

-- CreateIndex
CREATE INDEX "billing_notes_customer_id_idx" ON "billing_notes"("customer_id");

-- CreateIndex
CREATE INDEX "billing_note_items_invoice_id_idx" ON "billing_note_items"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_note_items_billing_note_id_invoice_id_key" ON "billing_note_items"("billing_note_id", "invoice_id");

-- AddForeignKey
ALTER TABLE "billing_notes" ADD CONSTRAINT "billing_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_note_items" ADD CONSTRAINT "billing_note_items_billing_note_id_fkey" FOREIGN KEY ("billing_note_id") REFERENCES "billing_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_note_items" ADD CONSTRAINT "billing_note_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
