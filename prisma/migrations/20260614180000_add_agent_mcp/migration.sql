-- AgentApiKey + AgentCallLog (FLOW-REDESIGN ก้อน 5 — MCP read-only เฟสแรก)
-- additive: ตารางใหม่ทั้งคู่ + FK ไป users / agent_api_keys · ไม่แตะข้อมูลเดิม

-- CreateTable
CREATE TABLE "agent_api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_call_logs" (
    "id" TEXT NOT NULL,
    "key_id" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "error_code" TEXT,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_api_keys_key_hash_key" ON "agent_api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "agent_api_keys_user_id_idx" ON "agent_api_keys"("user_id");

-- CreateIndex
CREATE INDEX "agent_call_logs_key_id_created_at_idx" ON "agent_call_logs"("key_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_call_logs_created_at_idx" ON "agent_call_logs"("created_at");

-- AddForeignKey
ALTER TABLE "agent_api_keys" ADD CONSTRAINT "agent_api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_call_logs" ADD CONSTRAINT "agent_call_logs_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "agent_api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
