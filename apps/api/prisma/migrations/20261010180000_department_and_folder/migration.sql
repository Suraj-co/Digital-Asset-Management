-- Module 5. Department and folder catalog. driveFolderId stays null until a live Drive call.

CREATE TYPE "FolderStage" AS ENUM ('working', 'approved', 'archive');

CREATE TYPE "FolderAssetType" AS ENUM ('images', 'videos', 'posters', 'banners', 'source_files', 'other');

CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Department_companyId_name_key" ON "Department"("companyId", "name");
CREATE INDEX "Department_companyId_idx" ON "Department"("companyId");

CREATE TABLE "FolderCatalog" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "campaign" TEXT NOT NULL,
    "stage" "FolderStage" NOT NULL,
    "assetType" "FolderAssetType" NOT NULL,
    "path" TEXT NOT NULL,
    "driveFolderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FolderCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FolderCatalog_departmentId_year_campaign_stage_assetType_key" ON "FolderCatalog"("departmentId", "year", "campaign", "stage", "assetType");
CREATE INDEX "FolderCatalog_companyId_idx" ON "FolderCatalog"("companyId");

ALTER TABLE "Department" ADD CONSTRAINT "Department_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FolderCatalog" ADD CONSTRAINT "FolderCatalog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FolderCatalog" ADD CONSTRAINT "FolderCatalog_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
