CREATE TABLE "ai_usage_logs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "feature" TEXT,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
  "completion_tokens" INTEGER NOT NULL DEFAULT 0,
  "total_tokens" INTEGER NOT NULL DEFAULT 0,
  "cached_tokens" INTEGER,
  "request_chars" INTEGER,
  "response_chars" INTEGER,
  "duration_ms" INTEGER,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_usage_logs_created_at_idx" ON "ai_usage_logs"("created_at" DESC);
CREATE INDEX "ai_usage_logs_feature_created_at_idx" ON "ai_usage_logs"("feature", "created_at" DESC);
CREATE INDEX "ai_usage_logs_provider_model_idx" ON "ai_usage_logs"("provider", "model");
CREATE INDEX "ai_usage_logs_user_id_created_at_idx" ON "ai_usage_logs"("user_id", "created_at" DESC);

ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
