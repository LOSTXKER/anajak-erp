-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "wht_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "wht_certificates" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "base_amount" DECIMAL(12,2) NOT NULL,
    "rate_pct" DECIMAL(5,2) NOT NULL DEFAULT 3,
    "amount" DECIMAL(12,2) NOT NULL,
    "cert_number" TEXT,
    "cert_date" TIMESTAMP(3),
    "received" BOOLEAN NOT NULL DEFAULT false,
    "received_at" TIMESTAMP(3),
    "file_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wht_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wht_certificates_payment_id_key" ON "wht_certificates"("payment_id");

-- CreateIndex
CREATE INDEX "wht_certificates_received_idx" ON "wht_certificates"("received");

-- CreateIndex
CREATE INDEX "wht_certificates_customer_id_idx" ON "wht_certificates"("customer_id");

-- AddForeignKey
ALTER TABLE "wht_certificates" ADD CONSTRAINT "wht_certificates_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wht_certificates" ADD CONSTRAINT "wht_certificates_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wht_certificates" ADD CONSTRAINT "wht_certificates_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

