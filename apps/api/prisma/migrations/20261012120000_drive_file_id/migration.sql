-- A stored upload keeps the Drive file id on that version.
-- Older rows stay null because no file was sent.

ALTER TABLE "AssetVersion" ADD COLUMN "driveFileId" TEXT;
