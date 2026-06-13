-- preflight ไฟล์งานพิมพ์ DTF (FLOW-REDESIGN ก้อน 4)
-- additive: ตารางใหม่ ไม่แตะข้อมูลเดิม

CREATE TABLE "file_preflights" (
    "id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "format" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "has_alpha" BOOLEAN,
    "summary" TEXT NOT NULL DEFAULT '',
    "warnings" JSONB,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_preflights_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "file_preflights_file_url_key" ON "file_preflights"("file_url");
