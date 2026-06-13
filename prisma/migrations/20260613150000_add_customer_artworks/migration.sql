-- คลังลายต่อลูกค้า (FLOW-REDESIGN ก้อน 4 ชิ้น 2)
-- CustomerArtwork + FK จาก order_item_prints / film_stocks (nullable — ของเก่าเป็น null)

-- CreateTable
CREATE TABLE "customer_artworks" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT,
    "print_file_url" TEXT,
    "position" TEXT,
    "print_type" TEXT,
    "print_size" TEXT,
    "width_cm" DOUBLE PRECISION,
    "height_cm" DOUBLE PRECISION,
    "color_count" INTEGER,
    "heat_temp_c" INTEGER,
    "heat_press_sec" INTEGER,
    "heat_pressure" TEXT,
    "spec_notes" TEXT,
    "source_order_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_artworks_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "order_item_prints" ADD COLUMN "artwork_id" TEXT;
ALTER TABLE "film_stocks" ADD COLUMN "artwork_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "customer_artworks_customer_id_image_url_key" ON "customer_artworks"("customer_id", "image_url");
CREATE INDEX "customer_artworks_customer_id_idx" ON "customer_artworks"("customer_id");
CREATE INDEX "order_item_prints_artwork_id_idx" ON "order_item_prints"("artwork_id");
CREATE INDEX "film_stocks_artwork_id_idx" ON "film_stocks"("artwork_id");

-- AddForeignKey
ALTER TABLE "customer_artworks" ADD CONSTRAINT "customer_artworks_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_artworks" ADD CONSTRAINT "customer_artworks_source_order_id_fkey" FOREIGN KEY ("source_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_item_prints" ADD CONSTRAINT "order_item_prints_artwork_id_fkey" FOREIGN KEY ("artwork_id") REFERENCES "customer_artworks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "film_stocks" ADD CONSTRAINT "film_stocks_artwork_id_fkey" FOREIGN KEY ("artwork_id") REFERENCES "customer_artworks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
