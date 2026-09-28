-- CreateEnum
CREATE TYPE "JobState" AS ENUM ('QUEUED', 'RUNNING', 'PREVIEW', 'SUCCEEDED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "export_jobs" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "status" "JobState" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "execution_id" UUID,
    "lease_until" TIMESTAMP(3),
    "result_key" TEXT,
    "file_name" TEXT,
    "mime_type" TEXT,
    "size" INTEGER,
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_job_projects" (
    "job_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,

    CONSTRAINT "export_job_projects_pkey" PRIMARY KEY ("job_id","project_id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "source_key" TEXT,
    "checksum" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "status" "JobState" NOT NULL DEFAULT 'QUEUED',
    "phase" TEXT NOT NULL DEFAULT 'VALIDATE',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "execution_id" UUID,
    "lease_until" TIMESTAMP(3),
    "result_key" TEXT,
    "error_code" TEXT,
    "counts" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_rows" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "sheet" TEXT NOT NULL,
    "row_number" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL DEFAULT 'PENDING',
    "errors" JSONB NOT NULL DEFAULT '[]',
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "export_jobs_status_created_at_idx" ON "export_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "export_jobs_owner_id_created_at_idx" ON "export_jobs"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "export_jobs_expires_at_idx" ON "export_jobs"("expires_at");

-- CreateIndex
CREATE INDEX "import_jobs_status_created_at_idx" ON "import_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "import_jobs_owner_id_created_at_idx" ON "import_jobs"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "import_jobs_expires_at_idx" ON "import_jobs"("expires_at");

-- CreateIndex
CREATE INDEX "import_rows_job_id_processed_at_idx" ON "import_rows"("job_id", "processed_at");

-- CreateIndex
CREATE UNIQUE INDEX "import_rows_job_id_sheet_row_number_key" ON "import_rows"("job_id", "sheet", "row_number");

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_job_projects" ADD CONSTRAINT "export_job_projects_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "export_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_job_projects" ADD CONSTRAINT "export_job_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE export_jobs ADD CONSTRAINT export_progress CHECK (progress BETWEEN 0 AND 100), ADD CONSTRAINT export_attempts CHECK (attempts BETWEEN 0 AND 3), ADD CONSTRAINT export_kind CHECK (kind IN ('SUMMARY','PROJECT','STATISTICS')), ADD CONSTRAINT export_format CHECK (format IN ('xls','xlsx','pdf','png'));
ALTER TABLE import_jobs ADD CONSTRAINT import_progress CHECK (progress BETWEEN 0 AND 100), ADD CONSTRAINT import_attempts CHECK (attempts BETWEEN 0 AND 3), ADD CONSTRAINT import_phase CHECK (phase IN ('VALIDATE','APPLY'));
ALTER TABLE import_rows ADD CONSTRAINT import_action CHECK (action IN ('CREATE','UPDATE','SKIP','ERROR')), ADD CONSTRAINT import_result CHECK (result IN ('PENDING','CREATED','UPDATED','SKIPPED','ERROR'));
