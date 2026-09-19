-- CreateEnum
CREATE TYPE "ExceptionSource" AS ENUM ('STATION', 'QC', 'OUTSOURCE', 'CLAIM', 'SYSTEM');

-- AlterTable
ALTER TABLE "production_exceptions" ADD COLUMN     "photo_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "source" "ExceptionSource" NOT NULL DEFAULT 'SYSTEM';

-- CreateTable
CREATE TABLE "production_exception_lines" (
    "id" TEXT NOT NULL,
    "exception_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "size" TEXT,
    "color" TEXT,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "production_exception_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "production_exception_lines_exception_id_idx" ON "production_exception_lines"("exception_id");

-- CreateIndex
CREATE INDEX "production_exceptions_state_created_at_idx" ON "production_exceptions"("state", "created_at");

-- AddForeignKey
ALTER TABLE "production_exception_lines" ADD CONSTRAINT "production_exception_lines_exception_id_fkey" FOREIGN KEY ("exception_id") REFERENCES "production_exceptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
