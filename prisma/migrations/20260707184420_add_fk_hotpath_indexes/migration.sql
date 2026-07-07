-- CreateIndex
CREATE INDEX "communication_logs_customer_id_idx" ON "communication_logs"("customer_id");

-- CreateIndex
CREATE INDEX "cost_entries_order_id_idx" ON "cost_entries"("order_id");

-- CreateIndex
CREATE INDEX "deliveries_order_id_idx" ON "deliveries"("order_id");

-- CreateIndex
CREATE INDEX "goods_receipt_lines_receipt_id_idx" ON "goods_receipt_lines"("receipt_id");

-- CreateIndex
CREATE INDEX "goods_receipts_outsource_order_id_idx" ON "goods_receipts"("outsource_order_id");

-- CreateIndex
CREATE INDEX "invoices_order_id_idx" ON "invoices"("order_id");

-- CreateIndex
CREATE INDEX "invoices_customer_id_idx" ON "invoices"("customer_id");

-- CreateIndex
CREATE INDEX "material_usages_production_id_idx" ON "material_usages"("production_id");

-- CreateIndex
CREATE INDEX "order_fees_order_id_idx" ON "order_fees"("order_id");

-- CreateIndex
CREATE INDEX "order_item_addons_order_item_id_idx" ON "order_item_addons"("order_item_id");

-- CreateIndex
CREATE INDEX "order_item_prints_order_item_id_idx" ON "order_item_prints"("order_item_id");

-- CreateIndex
CREATE INDEX "order_item_products_order_item_id_idx" ON "order_item_products"("order_item_id");

-- CreateIndex
CREATE INDEX "order_item_variants_order_item_product_id_idx" ON "order_item_variants"("order_item_product_id");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_revisions_order_id_idx" ON "order_revisions"("order_id");

-- CreateIndex
CREATE INDEX "orders_deadline_idx" ON "orders"("deadline");

-- CreateIndex
CREATE INDEX "outsource_orders_vendor_id_idx" ON "outsource_orders"("vendor_id");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

-- CreateIndex
CREATE INDEX "print_run_items_order_id_idx" ON "print_run_items"("order_id");

-- CreateIndex
CREATE INDEX "production_steps_production_id_idx" ON "production_steps"("production_id");

-- CreateIndex
CREATE INDEX "production_steps_step_type_status_idx" ON "production_steps"("step_type", "status");

-- CreateIndex
CREATE INDEX "productions_order_id_idx" ON "productions"("order_id");

-- CreateIndex
CREATE INDEX "qc_defects_qc_record_id_idx" ON "qc_defects"("qc_record_id");

-- CreateIndex
CREATE INDEX "quotation_items_quotation_id_idx" ON "quotation_items"("quotation_id");

-- CreateIndex
CREATE INDEX "quotations_customer_id_idx" ON "quotations"("customer_id");

