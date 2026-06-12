-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "blind_ship" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "blind_ship_sender_name" TEXT;

-- CreateTable
CREATE TABLE "delivery_lines" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "delivery_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_lines_delivery_id_idx" ON "delivery_lines"("delivery_id");

-- AddForeignKey
ALTER TABLE "delivery_lines" ADD CONSTRAINT "delivery_lines_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

