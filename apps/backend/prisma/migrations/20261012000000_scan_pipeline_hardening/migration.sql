-- Scan pipeline hardening: mock flag, MTTR, severity ordering, CI/scan status split.
--
-- Written idempotently (IF NOT EXISTS) because databases created with the old
-- `prisma db push` start command may already have some of these columns.

-- AlterTable
ALTER TABLE "deployments" ADD COLUMN IF NOT EXISTS "ci_status" VARCHAR(20),
ADD COLUMN IF NOT EXISTS "scan_status" VARCHAR(20);

-- AlterTable
ALTER TABLE "scans" ADD COLUMN IF NOT EXISTS "is_mock" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "vulnerabilities" ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "severity_rank" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "deployments_service_id_commit_sha_environment_idx" ON "deployments"("service_id", "commit_sha", "environment");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vulnerabilities_deployment_id_severity_rank_idx" ON "vulnerabilities"("deployment_id", "severity_rank");
