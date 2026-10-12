# Module 7 — Metadata search

## A. Purpose and status

A member can find a recorded upload by code, title, or file name, open it, and change the title. There is no preview and no download.

Status: **ready for manual verification**. Not COMPLETE until that verification is recorded. File contents are not searched.

## B. Functionality

| Name | Purpose | Role | UI | API | Data | External | Security | Tests |
|---|---|---|---|---|---|---|---|---|
| Search | Find a recorded upload | Member | Shell field and `/assets?q=` | `GET /api/v1/assets?q=` | `Asset`, `UploadOperation.fileName` | None | Selected company, or all memberships when `companyId` is omitted | e2e, page test |
| Open | Read one asset | Member | `/assets/:id` | `GET /api/v1/assets/:id` | `Asset` | None | Other company is 403 | e2e, page test |
| Edit title | Change the title only | Member | Edit title | `PATCH /api/v1/assets/:id` | `Asset.title` | None | Extra fields are 400 | e2e, page test |

## C. Not in this module

- A preview image, a download, or a search of file contents.
- A version row. The asset stays `upload_failed`.
- Approval.

## D. Files

- `apps/api/src/assets/`
- `apps/web/src/pages/AssetDetailPage.tsx`
- `apps/web/src/components/shell/AppShell.tsx`
- ADR 0013.

## E. Tests

API end-to-end covers a title match, a code match, a file-name match, a BAPL caller who cannot see the SAPL title, a title change, and a rejected `driveFileId`. The page tests cover the search request and the “No preview” sentence. Counts are in `TESTING_STATUS.md`.

## F. Known defects

None in the metadata search. Every result is still an upload that failed.

## G. Manual verification

`docs/manual-testing/07-metadata-search.md`.

## H. System health

No new outbound call and no new table. See `SYSTEM_HEALTH.md`.

## Dependencies

The Module 6 asset rows. No new package.

## Limitations

Search looks at the company selected in the tab. A second membership is not included until that company is selected.
