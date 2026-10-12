CREATE TYPE "DriveCleanupStatus" AS ENUM ('pending', 'running', 'deleted', 'failed', 'kept');

ALTER TABLE "Asset" ADD COLUMN "approvedVersionId" UUID;

CREATE UNIQUE INDEX "Asset_approvedVersionId_key" ON "Asset"("approvedVersionId");

ALTER TABLE "Asset"
  ADD CONSTRAINT "Asset_approvedVersionId_fkey"
  FOREIGN KEY ("approvedVersionId") REFERENCES "AssetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE "DriveCleanup" (
  "id" UUID NOT NULL,
  "versionId" UUID NOT NULL,
  "driveFileId" TEXT NOT NULL,
  "status" "DriveCleanupStatus" NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "detail" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "DriveCleanup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DriveCleanup_versionId_key" ON "DriveCleanup"("versionId");
CREATE INDEX "DriveCleanup_status_idx" ON "DriveCleanup"("status");

ALTER TABLE "DriveCleanup"
  ADD CONSTRAINT "DriveCleanup_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "AssetVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TYPE "AuditAction" ADD VALUE 'drive_file_removed';
