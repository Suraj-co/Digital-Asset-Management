-- Module 8. Version metadata for a failed upload.
-- File bytes are not stored. No Drive file id is written.

CREATE TABLE "AssetVersion" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "state" "AssetState" NOT NULL,
    "failureClass" "UploadFailureClass" NOT NULL,
    "detail" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssetVersion_assetId_number_key" ON "AssetVersion"("assetId", "number");
CREATE UNIQUE INDEX "AssetVersion_createdById_idempotencyKey_key" ON "AssetVersion"("createdById", "idempotencyKey");
CREATE INDEX "AssetVersion_assetId_idx" ON "AssetVersion"("assetId");

ALTER TABLE "AssetVersion" ADD CONSTRAINT "AssetVersion_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetVersion" ADD CONSTRAINT "AssetVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "AssetVersion" (
    "id",
    "assetId",
    "number",
    "fileName",
    "byteSize",
    "contentType",
    "state",
    "failureClass",
    "detail",
    "createdById",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid(),
    latest."assetId",
    1,
    latest."fileName",
    latest."byteSize",
    latest."contentType",
    'upload_failed',
    latest."failureClass",
    latest.detail,
    latest."userId",
    latest."createdAt",
    latest."updatedAt"
FROM (
    SELECT DISTINCT ON ("assetId") *
    FROM "UploadOperation"
    ORDER BY "assetId", "createdAt" DESC
) AS latest;
