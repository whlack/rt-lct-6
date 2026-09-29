CREATE TYPE "IntegrationSource" AS ENUM ('LMS', 'WEBSITE');
CREATE TYPE "SyncTrigger" AS ENUM ('MANUAL', 'SCHEDULED');
CREATE TYPE "SyncStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');
CREATE TABLE "integration_sync_runs" (
  "id" UUID NOT NULL,
  "source" "IntegrationSource" NOT NULL,
  "trigger" "SyncTrigger" NOT NULL,
  "initiator_id" UUID,
  "status" "SyncStatus" NOT NULL DEFAULT 'QUEUED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "error_code" TEXT,
  "execution_id" UUID,
  "lease_until" TIMESTAMP(3),
  "delivered_at" TIMESTAMP(3),
  "scheduled_at" TIMESTAMP(3),
  CONSTRAINT "integration_sync_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "integration_sync_runs_initiator_id_fkey" FOREIGN KEY ("initiator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "integration_sync_runs_attempts_check" CHECK ("attempts" BETWEEN 0 AND 3),
  CONSTRAINT "integration_sync_runs_trigger_check" CHECK (("trigger" = 'MANUAL' AND "scheduled_at" IS NULL) OR ("trigger" = 'SCHEDULED' AND "initiator_id" IS NULL AND "scheduled_at" IS NOT NULL))
);
CREATE UNIQUE INDEX "integration_sync_runs_source_scheduled_at_key" ON "integration_sync_runs"("source", "scheduled_at");
-- Queue delivery and scheduler replicas cannot create a second active run per source.
CREATE UNIQUE INDEX "integration_sync_runs_active_source_key" ON "integration_sync_runs"("source") WHERE "status" IN ('QUEUED', 'RUNNING');
CREATE INDEX "integration_sync_runs_source_created_at_id_idx" ON "integration_sync_runs"("source", "created_at", "id");
CREATE INDEX "integration_sync_runs_status_next_attempt_at_lease_until_idx" ON "integration_sync_runs"("status", "next_attempt_at", "lease_until");
