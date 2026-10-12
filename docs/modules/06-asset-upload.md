# Module 6 — Asset upload failure

## A. Purpose and status

A member can record an upload against a folder path. The file is not stored, and Google is not called.

Status: **ready for manual verification**. Not COMPLETE until that verification is recorded. The success path that writes a Drive file is not implemented.

## B. Functionality

| Name | Purpose | Role | UI | API | Data | External | Security | Tests |
|---|---|---|---|---|---|---|---|---|
| Record upload | Save metadata and a failure | Member | `/assets` | `POST /api/v1/assets` | `Asset`, `UploadOperation` | None | Company comes from the folder. Bytes are discarded | e2e, page test |
| Retry | Replace the recorded name and size | Member | Try again | `POST /api/v1/assets/:id/content` | updates the operation | None | Same asset id. Still no Drive file | e2e |
| Read asset | Show one attempt | Member | Table | `GET /api/v1/assets` and `GET /api/v1/assets/:id` | `Asset` | None | Other company is 403 | e2e |

## C. Not in this module

- A Drive file id, a preview, or a download.
- Version numbers. Module 8 records them as failed attempts. A stored Drive file is still absent.
- Submit, approval, and archive.

## D. Files

- `apps/api/prisma/migrations/20261010190000_asset_upload_failure`
- `apps/api/src/assets/`
- `apps/web/src/pages/AssetsPage.tsx`
- ADR 0012.

## E. Tests

API end-to-end covers the failure body, idempotency, a BAPL folder denied to a SAPL user, retry, and the absence of file bytes. The page test covers the signed-out state and the failure sentence. Counts are in `TESTING_STATUS.md`.

## F. Known defects

None in the failure path. Every upload fails until Drive is configured. That is the recorded behavior, not a hidden error.

## G. Manual verification

`docs/manual-testing/06-asset-upload.md`.

## H. System health

No new outbound call. The API holds the file in memory only while the request is handled. See `SYSTEM_HEALTH.md`.

## Dependencies

PostgreSQL. Multer is already provided by the Nest Express adapter. No new package was added.

## Limitations

Retry still cannot store the file. The client must send it again after a later module calls Drive.
