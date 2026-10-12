# Module 8 — Version history

## A. Purpose and status

A member can record another attempt on the same asset. The earlier attempt stays. Neither file is stored.

Status: **ready for manual verification**. Not COMPLETE until that verification is recorded.

## B. Functionality

| Name | Purpose | Role | UI | API | Data | External | Security | Tests |
|---|---|---|---|---|---|---|---|---|
| First version | Label the original attempt `v001` | Member | Detail table | `POST /api/v1/assets` | `AssetVersion` | None | Created with the asset | e2e |
| Next version | Keep the asset id and add `v002` | Member | Record another version | `POST /api/v1/assets/:id/versions` | `AssetVersion` | None | Other company is 403. Bytes are discarded | e2e, page test |
| Retry latest | Replace only the latest recorded name | Member | Try again | `POST /api/v1/assets/:id/content` | updates the latest version | None | Earlier versions stay | e2e |

## C. Not in this module

- A Drive file id on any version.
- A preview or a download.
- Approval of one version over another.

## D. Files

- `apps/api/prisma/migrations/20261010200000_asset_version`
- `apps/api/src/assets/`
- `apps/web/src/pages/AssetDetailPage.tsx`
- ADR 0014.

## E. Tests

API end-to-end covers `v001` and `v002` on the same asset id, idempotency, a retry that changes only the latest name, a BAPL denial, and the absence of file bytes. The page test covers `v001` and the sentence that the new version was not stored. Counts are in `TESTING_STATUS.md`.

## F. Known defects

None in the version list. Every version is an upload that failed.

## G. Manual verification

`docs/manual-testing/08-versions.md`.

## H. System health

No new outbound call. See `SYSTEM_HEALTH.md`.

## Dependencies

Module 6 asset rows. Existing rows receive `v001` from their latest upload operation. No new package.

## Limitations

Retry still replaces the latest version’s name. It does not restore a file, because no version has one.
