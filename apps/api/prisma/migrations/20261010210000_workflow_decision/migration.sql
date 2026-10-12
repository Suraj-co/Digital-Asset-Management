-- Module 9. Review decisions. Publication does not call Google.

CREATE TYPE "WorkflowStage" AS ENUM (
    'draft',
    'scope_analysis',
    'rm_qc',
    'rm_approval',
    'admin_qc',
    'admin_approval',
    'changes_requested'
);

CREATE TYPE "PublicationStatus" AS ENUM ('not_started', 'not_run');

CREATE TYPE "WorkflowAction" AS ENUM ('submit', 'approve', 'reject', 'publish', 'resubmit');

ALTER TABLE "Asset" ADD COLUMN "workflowStage" "WorkflowStage" NOT NULL DEFAULT 'draft';
ALTER TABLE "Asset" ADD COLUMN "publication" "PublicationStatus" NOT NULL DEFAULT 'not_started';

CREATE TABLE "WorkflowDecision" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "action" "WorkflowAction" NOT NULL,
    "fromStage" "WorkflowStage" NOT NULL,
    "toStage" "WorkflowStage" NOT NULL,
    "reason" TEXT,
    "detail" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowDecision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkflowDecision_assetId_idx" ON "WorkflowDecision"("assetId");

ALTER TABLE "WorkflowDecision" ADD CONSTRAINT "WorkflowDecision_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowDecision" ADD CONSTRAINT "WorkflowDecision_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "AssetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowDecision" ADD CONSTRAINT "WorkflowDecision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
