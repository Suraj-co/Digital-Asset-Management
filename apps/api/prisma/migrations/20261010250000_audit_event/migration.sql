-- Module 14. An append-only sentence for a completed company change.
-- Rows are inserted, not updated. No file bytes are stored.

CREATE TYPE "AuditAction" AS ENUM (
    'asset_recorded',
    'asset_retried',
    'asset_version_recorded',
    'asset_resubmitted',
    'asset_title_changed',
    'asset_submitted',
    'asset_approved',
    'asset_rejected',
    'asset_published',
    'task_planned',
    'task_changed',
    'time_recorded',
    'time_changed',
    'time_submitted',
    'time_accepted',
    'time_returned',
    'membership_granted',
    'membership_revoked',
    'account_disabled',
    'account_enabled'
);

CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "summary" TEXT NOT NULL,
    "subjectType" TEXT,
    "subjectId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditEvent_companyId_createdAt_idx" ON "AuditEvent"("companyId", "createdAt");
CREATE INDEX "AuditEvent_actorId_idx" ON "AuditEvent"("actorId");

ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
