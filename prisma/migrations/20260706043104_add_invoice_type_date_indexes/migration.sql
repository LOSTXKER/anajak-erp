-- CreateIndex
CREATE INDEX "invoices_type_issue_date_idx" ON "invoices"("type", "issue_date");

-- CreateIndex
CREATE INDEX "invoices_type_created_at_idx" ON "invoices"("type", "created_at");
