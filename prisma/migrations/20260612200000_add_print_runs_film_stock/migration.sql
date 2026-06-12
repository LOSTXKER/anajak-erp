-- CreateEnum
CREATE TYPE "PrintRunStatus" AS ENUM ('PRINTING', 'PRINTED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "print_runs" (
    "id" TEXT NOT NULL,
    "run_number" TEXT NOT NULL,
    "status" "PrintRunStatus" NOT NULL DEFAULT 'PRINTING',
    "note" TEXT,
    "created_by_id" TEXT NOT NULL,
    "printed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_run_items" (
    "id" TEXT NOT NULL,
    "print_run_id" TEXT NOT NULL,
    "production_step_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "extra_qty" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "print_run_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "film_stocks" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "order_id" TEXT,
    "print_run_id" TEXT,
    "label" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "initial_qty" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "film_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "print_runs_run_number_key" ON "print_runs"("run_number");

-- CreateIndex
CREATE INDEX "print_runs_status_idx" ON "print_runs"("status");

-- CreateIndex
CREATE INDEX "print_run_items_production_step_id_idx" ON "print_run_items"("production_step_id");

-- CreateIndex
CREATE INDEX "print_run_items_print_run_id_idx" ON "print_run_items"("print_run_id");

-- CreateIndex
CREATE INDEX "film_stocks_customer_id_idx" ON "film_stocks"("customer_id");

-- AddForeignKey
ALTER TABLE "print_runs" ADD CONSTRAINT "print_runs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_run_items" ADD CONSTRAINT "print_run_items_print_run_id_fkey" FOREIGN KEY ("print_run_id") REFERENCES "print_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_run_items" ADD CONSTRAINT "print_run_items_production_step_id_fkey" FOREIGN KEY ("production_step_id") REFERENCES "production_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_run_items" ADD CONSTRAINT "print_run_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "film_stocks" ADD CONSTRAINT "film_stocks_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "film_stocks" ADD CONSTRAINT "film_stocks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "film_stocks" ADD CONSTRAINT "film_stocks_print_run_id_fkey" FOREIGN KEY ("print_run_id") REFERENCES "print_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

