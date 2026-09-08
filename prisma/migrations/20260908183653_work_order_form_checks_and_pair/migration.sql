-- AlterTable
ALTER TABLE "production_steps" ADD COLUMN     "pair_with_previous" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "routing_operations" ADD COLUMN     "pair_with_previous" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "production_step_checks" (
    "id" TEXT NOT NULL,
    "production_step_id" TEXT NOT NULL,
    "item_key" TEXT NOT NULL,
    "checked_by_id" TEXT NOT NULL,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_step_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "production_step_checks_production_step_id_item_key_key" ON "production_step_checks"("production_step_id", "item_key");

-- AddForeignKey
ALTER TABLE "production_step_checks" ADD CONSTRAINT "production_step_checks_production_step_id_fkey" FOREIGN KEY ("production_step_id") REFERENCES "production_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_step_checks" ADD CONSTRAINT "production_step_checks_checked_by_id_fkey" FOREIGN KEY ("checked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
