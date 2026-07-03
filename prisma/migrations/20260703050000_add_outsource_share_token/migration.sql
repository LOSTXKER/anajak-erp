-- AlterTable
ALTER TABLE "outsource_orders" ADD COLUMN     "share_token" TEXT,
ADD COLUMN     "share_token_expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "outsource_orders_share_token_key" ON "outsource_orders"("share_token");
