# ADR 0012 — Upload fails without Drive

## Status

Accepted. Module 6.

## Problem

An upload has to write metadata and a file, or record a failure that can be retried. Drive credentials are absent. Storing the bytes in PostgreSQL, or inventing a Drive file id, would claim a file exists that nobody can open.

## Decision

- `POST /api/v1/assets` accepts a folder id, a title, and one file. The company comes from the folder. The caller must belong to that company.
- The file is read for its name, size, and content type, then discarded. The 20 MB limit is enforced before the row is written. Names that contain a path are reduced to the base name, and `..` is rejected.
- An `Asset` row is created in state `upload_failed` with a company-scoped code such as `SAPL-0001`. An `UploadOperation` row is `drive_failed` with failure class `not_configured`.
- `driveFileId` is not a column. The response sends `null`. There is no version row until a later module stores a real Drive id.
- The same `Idempotency-Key` for the same user, folder, title, name, and size returns the same asset. A different payload with that key is 409.
- `POST /api/v1/assets/:id/content` retries the same asset. It still does not call Google, so the state stays `upload_failed`.
- `GET /api/v1/assets/:id` for another company's asset is 403.

## Alternatives

- Refuse the route until Drive exists. Rejected. The failure path is the requirement, and the membership check has to exist before a live upload.
- Keep the bytes on disk for a later retry. Rejected for this module. A local file store would be a second source of truth. The client sends the file again.

## Trade-offs

Every upload fails today. The page says so. A successful Drive write is a later change, not a hidden branch.

## Security

The response and the database row do not contain the file bytes. Another company's asset id is 403.

## Scaling limit

The process holds one file in memory up to 20 MB, then drops it. Do not raise that limit until the bytes go to Drive instead of the API process.

## Revisit when

The four Drive settings exist. The operation can then move from `drive_failed` to a stored file id without changing the asset id.
