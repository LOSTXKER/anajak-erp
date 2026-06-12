-- ใบตรวจรับของเข้า + ใบคืนของลูกค้า (FLOW-REDESIGN ก้อน 1)
-- นับจริงต่อไซส์ + รูป + ตำหนิ — เสื้อลูกค้า/เสื้อโรงเย็บ/รับกลับร้านนอก/คืนของลูกค้า

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "receipt_type" TEXT NOT NULL,
    "outsource_order_id" TEXT,
    "notes" TEXT,
    "photo_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "received_by_id" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_lines" (
    "id" TEXT NOT NULL,
    "receipt_id" TEXT NOT NULL,
    "order_item_product_id" TEXT,
    "description" TEXT NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "qty_expected" INTEGER NOT NULL DEFAULT 0,
    "qty_counted" INTEGER NOT NULL,
    "defect_qty" INTEGER NOT NULL DEFAULT 0,
    "defect_note" TEXT,

    CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "goods_receipts_order_id_idx" ON "goods_receipts"("order_id");

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
