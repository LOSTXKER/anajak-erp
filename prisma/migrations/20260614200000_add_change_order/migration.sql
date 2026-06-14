-- CreateTable
CREATE TABLE "change_orders" (
    "id" TEXT NOT NULL,
    "change_number" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "summary" TEXT,
    "old_total" DECIMAL(12,2) NOT NULL,
    "new_total" DECIMAL(12,2) NOT NULL,
    "invoiced_warning" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "change_orders_change_number_key" ON "change_orders"("change_number");

-- CreateIndex
CREATE INDEX "change_orders_order_id_idx" ON "change_orders"("order_id");

-- AddForeignKey
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
