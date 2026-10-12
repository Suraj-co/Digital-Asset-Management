-- Module 6. Asset metadata and a failed upload operation.
-- File bytes are not stored. drive file ids are not invented.

CREATE TYPE "AssetState" AS ENUM ('upload_failed');
CREATE TYPE "UploadStatus" AS ENUM ('drive_failed');
CREATE TYPE "UploadFailureClass" AS ENUM ('not_configured');

CREATE TABLE "Asset" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "folderId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "state" "AssetState" NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Asset_companyId_sequence_key" ON "Asset"("companyId", "sequence");
CREATE UNIQUE INDEX "Asset_companyId_code_key" ON "Asset"("companyId", "code");
CREATE INDEX "Asset_companyId_idx" ON "Asset"("companyId");
CREATE INDEX "Asset_folderId_idx" ON "Asset"("folderId");

CREATE TABLE "UploadOperation" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "UploadStatus" NOT NULL,
    "failureClass" "UploadFailureClass" NOT NULL,
    "fileName" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadOperation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UploadOperation_userId_idempotencyKey_key" ON "UploadOperation"("userId", "idempotencyKey");
CREATE INDEX "UploadOperation_assetId_idx" ON "UploadOperation"("assetId");

ALTER TABLE "Asset" ADD CONSTRAINT "Asset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "FolderCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UploadOperation" ADD CONSTRAINT "UploadOperation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UploadOperation" ADD CONSTRAINT "UploadOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
