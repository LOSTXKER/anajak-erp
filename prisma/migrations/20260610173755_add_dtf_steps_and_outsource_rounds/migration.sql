-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProductionStepType" ADD VALUE 'DTF_PRINT';
ALTER TYPE "ProductionStepType" ADD VALUE 'HEAT_PRESS';
ALTER TYPE "ProductionStepType" ADD VALUE 'DTG_PRETREAT';
ALTER TYPE "ProductionStepType" ADD VALUE 'DTG_PRINT';
ALTER TYPE "ProductionStepType" ADD VALUE 'CURING';

-- DropIndex
DROP INDEX "outsource_orders_production_step_id_key";

-- CreateIndex
CREATE INDEX "outsource_orders_production_step_id_idx" ON "outsource_orders"("production_step_id");

-- CreateIndex
CREATE INDEX "outsource_orders_status_idx" ON "outsource_orders"("status");
